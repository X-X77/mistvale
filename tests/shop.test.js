import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progress, START_COINS, GIFT_UNLOCK, normalizeState } from '../js/game/progress.js';
import { describeItem, FISH, ORES, RECIPES, DISH_QUALITY, GATHER_SPOTS } from '../js/game/items.js';
import { GOODS, GROUPS, groupOf, isProtected, equipmentBonus, baitEffect, BAIT_IDS } from '../js/game/goods.js';
import { SHOPS, PRICES, DISH_BASE, GIFT, buyPrice, baseSell, shopByPlace, shopByNpc, giftCode, MAX_STACK } from '../js/game/shop-data.js';
import { sellPrice, stockFor, sellables, quoteBuy, quoteSell, buy, sell, sellAll, giftStatus, quoteGift, buyGift, auditEconomy } from '../js/game/shop-engine.js';
import { places } from '../js/world/place-data.js';
import { MineSession } from '../js/game/mining-engine.js';
import { BiteSession } from '../js/game/fishing-engine.js';
import { createRng } from '../js/game/rng.js';

const memoryStorage = () => { let v = null; return { getItem:() => v, setItem:(_k, x) => { v = x; }, dump:() => v }; };
const KEY = 'mistvale.progress.v1';
const fresh = () => new Progress(memoryStorage());
// 저장소에 직접 값을 써서 준비합니다(거래 직전에 저장값을 다시 읽기 때문에, 메모리 상태만 고쳐서는 반영되지 않습니다).
const mk = (patch = {}, store = memoryStorage()) => { const p = new Progress(store); store.setItem(KEY, JSON.stringify({ ...p.state, ...patch })); p.refresh(); p.store = store; return p; };
const set = (p, patch) => { const store = p.store || (p.store = memoryStorage()); store.setItem(KEY, JSON.stringify({ ...p.state, ...patch })); p.refresh(); };
const shop = SHOPS.clover;

/* ---- 구성: 상점은 하나, 상품은 미니게임에 필요한 것만 ---- */
test('가격표 점검: 알 수 없는 물품·효과 없는 상품·사고팔기 이익·보호 장비 매입이 없다', () => { assert.deepEqual(auditEconomy(), []); });
test('상점은 기존 장소·NPC 한 곳(클로버 잡화점·로웬)뿐이다', () => {
  assert.deepEqual(Object.keys(SHOPS), ['clover']);
  const chars = JSON.parse(readFileSync(new URL('../assets/npc/characters.json', import.meta.url), 'utf8')).npc;
  assert.ok(places[shop.placeId]); assert.equal(chars[shop.npcId]?.placeId, shop.placeId);
  assert.equal(shopByPlace('clover'), shop); assert.equal(shopByNpc('rowen'), shop);
  for (const other of ['forge', 'workshop', 'apothecary', 'bakery', 'ranch', 'pub']) assert.equal(shopByPlace(other), null, other + ' 은 상점이 아님');
  for (const key of ['greet', 'buy', 'sell', 'sellBig', 'rare', 'poor', 'lack', 'full', 'owned', 'nobuy', 'empty', 'gift', 'bye']) assert.ok(shop.lines[key]?.length, '대사 ' + key);
});
test('상품: 미끼 2종, 낚싯대 1종, 곡괭이 1종, 요리 재료(허브·버섯·베리)만 판다', () => {
  const ids = shop.stock.map(row => row.id);
  assert.deepEqual(ids.sort(), ['bait-glow', 'bait-worm', 'berry', 'herb', 'mushroom', 'pick-copper', 'rod-steel'].sort());
  assert.equal(BAIT_IDS.length, 2);
  for (const row of stockFor(shop)) assert.ok(row.price > 0 && row.info.kind !== 'unknown', row.id);
});
test('모든 상품은 실제 미니게임에서 쓰인다(미끼·장비는 효과, 재료는 레시피)', () => {
  for (const id of ['bait-worm', 'bait-glow', 'rod-steel', 'pick-copper']) assert.ok(GOODS[id].effect, id + ' 효과');
  const used = new Set(Object.values(RECIPES).flatMap(recipe => Object.keys(recipe.need)));
  for (const id of ['herb', 'mushroom', 'berry']) assert.ok(used.has(id), id + ' 를 쓰는 요리');
});

/* ---- 코인 ---- */
test('코인 하나로 정리: 시작 100코인, 옛 gold 저장값도 이어 읽는다', () => {
  assert.equal(START_COINS, 100); const p = fresh(); assert.equal(p.state.coins, 100); assert.equal(p.state.earned, 0);
  assert.deepEqual(p.state.gift, { unlocked:false, seen:false, bought:false });
  assert.equal(normalizeState({ gold:250 }).coins, 250); assert.equal(normalizeState({ coins:40, gold:250 }).coins, 40);
  assert.equal('gold' in p.state, false);
});

/* ---- 구매 ---- */
test('구매: 코인이 줄고 소지품이 늘어난다', () => {
  const p = mk({ coins:100 });
  const r = buy(p, shop, 'bait-worm', 3);
  assert.equal(r.ok, true); assert.equal(r.total, 45); assert.equal(p.state.coins, 55); assert.equal(p.count('bait-worm'), 3);
});
test('구매: 코인이 모자라면 거절되고 아무것도 바뀌지 않는다', () => {
  const p = mk({ coins:40 });
  const r = buy(p, shop, 'bait-glow', 1);   // 45코인
  assert.equal(r.ok, false); assert.equal(r.reason, 'coins'); assert.equal(p.state.coins, 40); assert.equal(p.count('bait-glow'), 0);
  const q = mk({ coins:399 });
  const r3 = buy(q, shop, 'rod-steel', 1); assert.equal(r3.ok, false); assert.equal(r3.reason, 'coins'); assert.equal(q.state.coins, 399); assert.equal(q.count('rod-steel'), 0);
});
test('구매: 고유 장비는 하나만, 같은 장비를 또 사지 못한다', () => {
  const p = mk({ coins:2000 });
  assert.equal(buy(p, shop, 'pick-copper', 2).reason, 'qty');
  assert.equal(buy(p, shop, 'pick-copper', 1).ok, true); assert.equal(p.state.coins, 1600);
  assert.equal(buy(p, shop, 'pick-copper', 1).reason, 'owned'); assert.equal(p.state.coins, 1600); assert.equal(p.count('pick-copper'), 1);
});
test('구매: 가방 한도(99개)·잘못된 수량·상점에 없는 물건은 거절된다', () => {
  const p = mk({ coins:9999, items:{ 'bait-worm':98 } });
  assert.equal(buy(p, shop, 'bait-worm', 2).reason, 'full'); assert.equal(p.count('bait-worm'), 98); assert.equal(p.state.coins, 9999);
  for (const qty of [0, -1, 1.5, NaN, 100]) assert.equal(quoteBuy(p.state, shop, 'herb', qty).ok, false, 'qty ' + qty);
  assert.equal(buy(p, shop, 'moon-carp', 1).ok, false); assert.equal(buy(p, shop, 'potion-small', 1).ok, false);
  assert.equal(MAX_STACK, 99);
});

/* ---- 판매 ---- */
test('판매: 물고기·광석·요리만 사 주고, 재료·미끼·장비는 사지 않는다', () => {
  for (const id of ['silver-minnow', 'mist-trout', 'moon-carp', 'moss-copper', 'moondrop-crystal', 'dish:herb-grilled-fish:normal']) assert.ok(sellPrice(shop, id) > 0, id);
  for (const id of ['herb', 'mushroom', 'berry', 'bait-worm', 'bait-glow', 'rod-steel', 'pick-copper', 'rod-bamboo', 'pick-silver', 'dish:burnt']) assert.equal(sellPrice(shop, id), 0, id);
  const items = { 'silver-minnow':2, herb:3, 'bait-worm':1, 'pick-copper':1 };
  assert.deepEqual(sellables(shop, items).map(row => row.id), ['silver-minnow']);
});
test('판매: 코인이 늘고 수량이 줄며 누적 획득액에 더해진다', () => {
  const p = mk({ items:{ 'reed-crucian':3 } });
  const r = sell(p, shop, 'reed-crucian', 1);
  assert.equal(r.ok, true); assert.equal(r.total, 32); assert.equal(p.state.coins, 132); assert.equal(p.state.earned, 32); assert.equal(p.count('reed-crucian'), 2);
  const all = sellAll(p, shop, 'reed-crucian');
  assert.equal(all.ok, true); assert.equal(all.total, 64); assert.equal(all.qty, 2); assert.equal(p.state.coins, 196); assert.equal(p.state.earned, 96); assert.equal(p.count('reed-crucian'), 0);
});
test('판매: 없는 물건·가진 것보다 많은 수량·이미 판 물건은 거절된다(이중 판매 없음)', () => {
  const p = mk({ items:{ 'moss-copper':3 } });
  const r = sell(p, shop, 'moss-copper', 4); assert.equal(r.ok, false); assert.equal(r.reason, 'lack'); assert.equal(p.count('moss-copper'), 3); assert.equal(p.state.coins, 100); assert.equal(p.state.earned, 0);
  assert.equal(sellAll(p, shop, 'moss-copper').ok, true);
  const again = sellAll(p, shop, 'moss-copper'); assert.equal(again.ok, false); assert.equal(p.state.coins, 100 + 75);
  assert.equal(sell(p, shop, 'moon-carp', 1).ok, false); assert.equal(sell(p, shop, 'herb', 1).ok, false);
  for (const qty of [0, -2, 1.2, NaN]) assert.equal(quoteSell({ ...p.state, items:{ 'moss-copper':3 } }, shop, 'moss-copper', qty).ok, false, 'qty ' + qty);
});
test('판매: 장비·고유 아이템은 가지고 있어도 팔 수 없다', () => {
  const p = mk({ items:{ 'pick-copper':1, 'rod-steel':1 } });
  assert.equal(sell(p, shop, 'pick-copper', 1).ok, false); assert.equal(sell(p, shop, 'rod-steel', 1).reason, 'nobuy');
  assert.equal(p.count('pick-copper'), 1); assert.equal(p.state.coins, 100);
  for (const good of Object.values(GOODS)) if (good.kind === 'tool') assert.equal(isProtected(good), true);
});
test('중복 클릭·두 탭 동시 판매에서도 한 번만 팔린다(복제 없음)', () => {
  const store = memoryStorage(), a = mk({ items:{ 'tide-mackerel':1 } }, store);
  const b = new Progress(store);   // 같은 저장소를 보는 다른 탭
  const results = [sell(a, shop, 'tide-mackerel', 1), sell(b, shop, 'tide-mackerel', 1), sell(a, shop, 'tide-mackerel', 1)];
  assert.equal(results.filter(r => r.ok).length, 1);
  const c = new Progress(store); assert.equal(c.state.coins, 128); assert.equal(c.state.earned, 28); assert.equal(c.count('tide-mackerel'), 0);
});
test('두 탭에서 같은 장비를 동시에 사도 한 번만 사고 코인도 한 번만 빠진다', () => {
  const store = memoryStorage(), a = mk({ coins:1000 }, store);
  const b = new Progress(store);
  assert.equal(buy(a, shop, 'rod-steel', 1).ok, true); assert.equal(buy(b, shop, 'rod-steel', 1).ok, false);
  const c = new Progress(store); assert.equal(c.state.coins, 600); assert.equal(c.count('rod-steel'), 1);
});
test('거래는 원자적이다: 하나라도 어긋나면 코인·소지품 모두 그대로', () => {
  const p = mk({ items:{ herb:1 } });
  assert.equal(p.transact({ coins:-10, items:{ herb:-2 } }), false); assert.equal(p.state.coins, 100); assert.equal(p.count('herb'), 1);
  assert.equal(p.transact({ coins:-200 }), false); assert.equal(p.transact({ coins:1.5 }), false); assert.equal(p.transact({ coins:5, earn:-3 }), false);
  assert.equal(p.transact({ coins:-10, items:{ herb:-1, berry:2 } }), true); assert.equal(p.state.coins, 90); assert.equal(p.count('herb'), 0); assert.equal(p.count('berry'), 2);
});
test('코인 상한을 넘기는 판매는 거절된다', () => {
  const p = mk({ coins:999990, items:{ 'moon-carp':1 } });
  const r = sell(p, shop, 'moon-carp', 1); assert.equal(r.ok, false); assert.equal(r.reason, 'cap'); assert.equal(p.count('moon-carp'), 1);
});

/* ---- 가격·균형 ---- */
test('요리 판매가: 품질 배율과 실패작(0)', () => {
  const q = id => DISH_QUALITY.find(x => x.id === id).mult;
  for (const recipe of Object.keys(RECIPES)) {
    const base = DISH_BASE[recipe]; assert.ok(base > 0);
    assert.equal(baseSell(`dish:${recipe}:normal`), base); assert.equal(baseSell(`dish:${recipe}:good`), Math.round(base * q('good'))); assert.equal(baseSell(`dish:${recipe}:great`), Math.round(base * q('great')));
    assert.equal(baseSell(`dish:${recipe}:burnt`), 0);
  }
});
test('가격 균형: 희귀할수록 비싸고, 요리는 재료값보다 값이 나가며, 구매는 판매로 되팔 수 없다', () => {
  for (const [a, b, c, d] of [['silver-minnow', 'reed-crucian', 'mist-trout', 'moon-carp'], ['tide-mackerel', 'reef-bream', 'lighthouse-bass', 'fog-anglerfish']]) {
    assert.ok(baseSell(a) < baseSell(c) && baseSell(b) < baseSell(c) && baseSell(c) < baseSell(d), a);
    for (const id of [a, b, c, d]) assert.equal(baseSell(id) > 0, true);
  }
  const ores = ['moss-copper', 'silver-mist-stone', 'moondrop-crystal'].map(baseSell); assert.ok(ores[0] < ores[1] && ores[1] < ores[2]);
  for (const recipe of Object.values(RECIPES)) {
    const cost = Object.entries(recipe.need).reduce((sum, [id, n]) => sum + buyPrice(id) * n, 0), cheapestFish = Math.min(...Object.values(FISH).map(f => baseSell(f.id)));
    const total = cost + (recipe.fishAny ? cheapestFish : 0);
    assert.ok(DISH_BASE[recipe.id] >= total * .9, recipe.name + ' 일반 요리가 재료값(' + total + ')보다 너무 낮음');
    assert.ok(baseSell(`dish:${recipe.id}:great`) > total * 1.5, recipe.name + ' 훌륭한 요리는 확실히 이익');
  }
  for (const id of Object.keys(PRICES)) assert.ok(!(PRICES[id].buy && PRICES[id].sell), id + ' 는 사기만 하거나 팔기만 가능');
  assert.ok(buyPrice('rod-steel') >= 300 && buyPrice('pick-copper') >= 300, '좋은 장비는 모아야 살 수 있음');
  assert.ok(buyPrice('bait-worm') < buyPrice('bait-glow') && buyPrice('bait-worm') <= 20);
});
test('물고기·광석·요리 한 번 성공이 5,000코인까지 가는 길(대략): 평균 수확이 너무 적거나 너무 크지 않다', () => {
  const avg = ids => ids.reduce((s, id) => s + baseSell(id), 0) / ids.length;
  const commonFish = avg(['silver-minnow', 'reed-crucian', 'tide-mackerel', 'reef-bream']), oreMix = avg(['moss-copper', 'silver-mist-stone']);
  assert.ok(commonFish >= 20 && commonFish <= 45); assert.ok(oreMix >= 40 && oreMix <= 90);
  assert.ok(GIFT.cost / commonFish < 250, '흔한 물고기만으로도 250마리 안쪽');
});

/* ---- 엑스의 비밀 선물 ---- */
test('누적 획득 5,000코인에 닿으면 선물이 열리고, 이벤트는 정확히 한 번만 발생한다', () => {
  const store = memoryStorage(), p = mk({ earned:4990, items:{ 'moon-carp':1 } }, store);
  assert.equal(GIFT_UNLOCK, 5000); assert.equal(giftStatus(p.state), 'hidden');
  assert.equal(p.state.gift.unlocked, false); assert.equal(p.claimGiftEvent(), false, '열리기 전에는 이벤트 없음');
  const r = sell(p, shop, 'moon-carp', 1);
  assert.equal(r.ok, true); assert.equal(r.unlockedNow, true); assert.equal(p.state.gift.unlocked, true); assert.equal(giftStatus(p.state), 'open');
  assert.equal(p.claimGiftEvent(), true, '처음 한 번'); assert.equal(p.claimGiftEvent(), false, '두 번째부터는 없음');
  const other = new Progress(store); assert.equal(other.claimGiftEvent(), false, '다른 탭·새로고침 뒤에도 없음');
  p.add('moon-carp', 1); const r2 = sell(p, shop, 'moon-carp', 1); assert.equal(r2.unlockedNow, false); assert.equal(p.claimGiftEvent(), false);
});
test('두 탭이 동시에 이벤트를 요청해도 한 곳만 받는다', () => {
  const store = memoryStorage(), a = mk({ earned:5000 }, store);
  const b = new Progress(store);
  assert.deepEqual([a.claimGiftEvent(), b.claimGiftEvent()], [true, false]);
});
test('판매 이외의 코인 변동(구매)은 누적 획득액에 들어가지 않는다', () => {
  const p = mk({ coins:1000 }); buy(p, shop, 'bait-glow', 5); assert.equal(p.state.earned, 0); assert.equal(p.state.gift.unlocked, false);
});
test('선물 구매: 열리기 전·코인 부족은 거절, 5,000코인을 실제로 차감하고 한 번만 살 수 있다', () => {
  const p = mk({ coins:4000 });
  assert.equal(quoteGift(p.state).reason, 'locked'); assert.equal(buyGift(p).ok, false); assert.equal(p.state.coins, 4000);
  set(p, { earned:5000, gift:{ unlocked:true, seen:false, bought:false } }); assert.equal(p.state.gift.unlocked, true);
  set(p, { coins:4999 }); assert.equal(buyGift(p).reason, 'coins'); assert.equal(p.state.gift.bought, false); assert.equal(p.state.coins, 4999);
  set(p, { coins:7000 });
  const r = buyGift(p); assert.equal(r.ok, true); assert.equal(p.state.coins, 2000); assert.equal(p.state.gift.bought, true); assert.equal(giftStatus(p.state), 'bought');
  const again = buyGift(p); assert.equal(again.ok, false); assert.equal(again.reason, 'owned'); assert.equal(p.state.coins, 2000);
});
test('두 탭에서 동시에 선물을 사도 5,000코인은 한 번만 빠진다', () => {
  const store = memoryStorage(), a = mk({ coins:12000, earned:5000, gift:{ unlocked:true, seen:true, bought:false } }, store);
  const b = new Progress(store);
  assert.equal(buyGift(a).ok, true); assert.equal(buyGift(b).ok, false);
  assert.equal(new Progress(store).state.coins, 7000);
});
test('구매 상태는 새로고침(새 Progress) 뒤에도 유지된다', () => {
  const store = memoryStorage(), p = mk({ coins:6000, earned:5200 }, store); p.claimGiftEvent(); buyGift(p);
  const q = new Progress(store);
  assert.deepEqual(q.state.gift, { unlocked:true, seen:true, bought:true }); assert.equal(q.state.coins, 1000); assert.equal(q.state.earned, 5200);
  assert.equal(q.claimGiftEvent(), false);
});
test('코드: 구매 전에는 상점 데이터·소지품 정의에 문자 그대로 들어 있지 않고, 풀면 약속된 코드', () => {
  const CODE = ['X_X', 'NYANG'].join('-');   // 소스에 문자 그대로 적지 않습니다
  assert.equal(giftCode(), CODE);
  assert.equal(JSON.stringify(SHOPS).includes(CODE), false); assert.equal(JSON.stringify(GIFT).includes(CODE), false);
  for (const file of ['shop-data.js', 'shop-ui.js', 'gift-ui.js', 'shop-engine.js', 'host.js']) assert.equal(readFileSync(new URL('../js/game/' + file, import.meta.url), 'utf8').includes(CODE), false, file + ' 소스');
  assert.equal(GIFT.cost, 5000); assert.match(GIFT.effect, /500G.*10,000G/);
});
test('옛 저장값: 누적 5,000 이상이면 선물이 열린 것으로, 구매한 것은 이벤트도 본 것으로 읽는다', () => {
  assert.equal(normalizeState({ earned:6000 }).gift.unlocked, true);
  const bought = normalizeState({ gift:{ bought:true } }); assert.deepEqual(bought.gift, { unlocked:true, seen:true, bought:true });
  assert.deepEqual(normalizeState({ gift:'x', earned:-5 }).gift, { unlocked:false, seen:false, bought:false });
});

/* ---- 미니게임 효과 ---- */
test('장비 효과가 실제 미니게임 값에 반영된다', () => {
  assert.deepEqual(equipmentBonus({}), { mineSwings:0, biteWindow:1 });
  assert.equal(equipmentBonus({ 'pick-copper':1 }).mineSwings, 1); assert.equal(equipmentBonus({ 'pick-copper':1, 'pick-silver':1 }).mineSwings, 2);
  assert.equal(equipmentBonus({ 'rod-steel':1 }).biteWindow, 1.25); assert.equal(equipmentBonus({ 'bait-worm':5 }).biteWindow, 1, '미끼는 장비 효과가 아님');
  const ore = ORES['moss-copper'];
  assert.equal(new MineSession(ore).swings, ore.mine.swings);
  assert.equal(new MineSession(ore, undefined, { extraSwings:1 }).swings, ore.mine.swings + 1);
  const pool = [FISH['silver-minnow']];
  assert.equal(new BiteSession(pool, 0).window, FISH['silver-minnow'].bite.window);
  assert.ok(Math.abs(new BiteSession(pool, 0, undefined, 1.25).window - FISH['silver-minnow'].bite.window * 1.25) < 1e-9);
});
test('미끼 효과: 지렁이는 입질이 빨리 오고, 반딧은 희귀·특수가 더 자주 걸린다', () => {
  assert.deepEqual(baitEffect(null), { waitMul:1, rareMul:1 }); assert.deepEqual(baitEffect('herb'), { waitMul:1, rareMul:1 });
  assert.ok(baitEffect('bait-worm').waitMul < 1); assert.ok(baitEffect('bait-glow').rareMul > 1);
  const pool = ['silver-minnow', 'reed-crucian', 'mist-trout', 'moon-carp'].map(id => FISH[id]);
  let plain = 0, worm = 0; for (let i = 1; i <= 400; i++) { plain += new BiteSession(pool, .3, createRng(i)).biteAt; worm += new BiteSession(pool, .3, createRng(i), 1, baitEffect('bait-worm')).biteAt; }
  assert.ok(worm < plain * .8, '지렁이 평균 대기 ' + (worm / 400).toFixed(2) + ' < 일반 ' + (plain / 400).toFixed(2));
  const share = bait => { let hit = 0, n = 4000; const rng = createRng(7); for (let i = 0; i < n; i++) if (['rare', 'special'].includes(BiteSession.pickFish(pool, .55, rng, bait.rareMul).tier)) hit++; return hit / n; };
  const base = share({ rareMul:1 }), glow = share(baitEffect('bait-glow'));
  assert.ok(glow > base * 1.4, `반딧 희귀·특수 비율 ${glow.toFixed(2)} > 기본 ${base.toFixed(2)}`);
  assert.deepEqual(BiteSession.weights(.5).slice(0, 2), BiteSession.weights(.5, 3).slice(0, 2), '미끼는 일반 물고기 비중을 바꾸지 않음');
});

/* ---- 분류·설명 ---- */
test('모든 소지품은 분류·이름·설명이 있다', () => {
  const ids = [...Object.keys(PRICES), ...Object.keys(GOODS), ...Object.keys(FISH), ...Object.keys(ORES)];
  for (const id of ids) { const info = describeItem(id); assert.notEqual(info.kind, 'unknown', id); assert.ok(info.name && info.desc, id); assert.ok(GROUPS.some(g => g.id === groupOf(info.kind)), id); }
  for (const spot of Object.values(GATHER_SPOTS)) for (const pick of spot.picks) assert.ok(describeItem(pick.id).name);
});

test('이벤트: 옛 저장(누적 기록 없이 코인만 5,000 이상)이나 보유 코인 5,000 이상이어도 열리고, 한 번만 열린다', () => {
  const store = memoryStorage();
  store.setItem(KEY, JSON.stringify({ v:1, gold:6200, items:{} }));       // 이전 상점 버전의 저장 형태
  const p = new Progress(store);
  assert.equal(p.state.coins, 6200); assert.equal(p.state.gift.unlocked, true); assert.ok(p.state.earned >= 6100);
  assert.equal(p.claimGiftEvent(), true); assert.equal(p.claimGiftEvent(), false);
  // 번 누적은 적어도 지금 5,000 이상 가진 경우
  const q = mk({ coins:5000, earned:300 });
  assert.equal(q.state.gift.unlocked, true); assert.equal(q.claimGiftEvent(), true); assert.equal(q.claimGiftEvent(), false);
  // 5,000 미만이면 닫혀 있음
  assert.equal(mk({ coins:4999, earned:4000 }).state.gift.unlocked, false);
});
