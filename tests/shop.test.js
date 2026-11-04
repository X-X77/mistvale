import test from 'node:test';
import assert from 'node:assert/strict';
import { Progress, START_GOLD } from '../js/game/progress.js';
import { describeItem, FISH, ORES, RECIPES, DISH_QUALITY } from '../js/game/items.js';
import { GOODS, GROUPS, groupOf, isProtected, equipmentBonus } from '../js/game/goods.js';
import { SHOPS, PRICES, DISH_BASE, buyPrice, baseSell, shopByPlace, shopByNpc, SPECIAL_CODE } from '../js/game/shop-data.js';
import { isOpen, parseClock, hoursText, sellPrice, sellRate, stockFor, sellables, quoteBuy, quoteSell, buy, sell, auditEconomy } from '../js/game/shop-engine.js';
import { places } from '../js/world/place-data.js';
import { MineSession } from '../js/game/mining-engine.js';
import { BiteSession } from '../js/game/fishing-engine.js';

const memoryStorage = () => { let v = null; return { getItem:() => v, setItem:(_k, x) => { v = x; }, dump:() => v }; };
const fresh = () => new Progress(memoryStorage());
const NOON = 12 * 60;

test('가격표: 규칙 위반 없음(구매가 60% 이하 매입, 고유 장비 매입 금지, 모든 물품 정의 존재)', () => { assert.deepEqual(auditEconomy(), []); });
test('시작 소지금 500G, 상점은 G 만 쓰고 특별 코드는 별개의 P(미구현 표시)', () => {
  assert.equal(START_GOLD, 500); assert.equal(fresh().state.gold, 500);
  assert.equal(SPECIAL_CODE.unit, 'P'); assert.equal(SPECIAL_CODE.code, 'X_X-NYANG'); assert.equal(SPECIAL_CODE.cost, 5000); assert.equal(SPECIAL_CODE.implemented, false);
  assert.equal(JSON.stringify(SHOPS).includes('X_X-NYANG'), false);
});
test('모든 상점은 기존 장소·NPC 를 씀', async () => {
  const chars = JSON.parse((await import('node:fs')).readFileSync(new URL('../assets/npc/characters.json', import.meta.url), 'utf8')).npc;
  for (const shop of Object.values(SHOPS)) {
    assert.ok(places[shop.placeId], shop.id + ' 장소'); assert.equal(chars[shop.npcId]?.placeId, shop.placeId, shop.id + ' NPC 가 그 장소에 있어야 함');
    assert.equal(shopByPlace(shop.placeId), shop); assert.equal(shopByNpc(shop.npcId), shop);
    for (const key of ['greet', 'buy', 'sell', 'poor', 'lack', 'full', 'owned', 'need', 'nobuy', 'empty', 'closed', 'bye']) assert.ok(shop.lines[key]?.length, shop.id + ' 대사 ' + key);
  }
  assert.deepEqual(['clover', 'forge', 'workshop', 'apothecary', 'bakery'].every(id => SHOPS[id]), true);
  assert.equal(SHOPS.clover.npcId, 'rowen'); assert.equal(SHOPS.forge.npcId, 'bianca'); assert.equal(SHOPS.workshop.npcId, 'noah'); assert.equal(SHOPS.apothecary.npcId, 'lillian'); assert.equal(SHOPS.bakery.npcId, 'cordelia');
});
test('클로버 잡화점의 영업시간은 장소 데이터와 같다', () => { assert.equal(hoursText(SHOPS.clover), places.clover.hours.replace('–', '–')); });

/* ---- 구매 ---- */
test('구매: 골드 감소·물건 증가', () => {
  const p = fresh(), shop = SHOPS.clover;
  const r = buy(p, shop, 'seed-turnip', 3, NOON);
  assert.equal(r.ok, true); assert.equal(r.total, 90);
  assert.equal(p.state.gold, 500 - 90); assert.equal(p.count('seed-turnip'), 3);
});
test('구매: 소지금이 부족하면 불가', () => {
  const p = fresh(); p.state.gold = 50;
  const r = buy(p, SHOPS.clover, 'seed-pumpkin', 1, NOON);
  assert.equal(r.ok, false); assert.equal(r.reason, 'gold'); assert.equal(p.state.gold, 50); assert.equal(p.count('seed-pumpkin'), 0);
  const r2 = buy(p, SHOPS.clover, 'seed-turnip', 2, NOON);   // 60G > 50G
  assert.equal(r2.ok, false); assert.equal(p.state.gold, 50);
});
test('구매: 이 상점이 팔지 않는 물건·잘못된 수량은 거절', () => {
  const p = fresh();
  assert.equal(buy(p, SHOPS.clover, 'pick-copper', 1, NOON).reason, 'unknown');
  for (const q of [0, -1, 1.5, NaN, 100, '3x']) assert.equal(buy(p, SHOPS.clover, 'seed-turnip', q, NOON).ok, q === 1.5 ? true : false, 'qty ' + q);
  assert.equal(p.state.gold <= 500, true);
});
test('구매: 소수 수량은 내림 처리되어 값과 수량이 일치', () => {
  const p = fresh(); const r = buy(p, SHOPS.clover, 'candle', 1.9, NOON);
  assert.equal(r.ok, true); assert.equal(r.qty, 1); assert.equal(p.count('candle'), 1); assert.equal(p.state.gold, 500 - 24);
});
test('구매: 한 물건은 99개까지만', () => {
  const p = fresh(); p.state.gold = 5000; p.state.items.torch = 98;
  assert.equal(buy(p, SHOPS.clover, 'torch', 2, NOON).reason, 'full'); assert.equal(p.count('torch'), 98); assert.equal(p.state.gold, 5000);
  assert.equal(buy(p, SHOPS.clover, 'torch', 1, NOON).ok, true); assert.equal(p.count('torch'), 99);
});
test('고유 장비: 하나만 살 수 있고, 같은 계열의 더 좋은 것을 가지면 낮은 것은 못 산다', () => {
  const p = fresh(); p.state.gold = 5000;
  assert.equal(buy(p, SHOPS.forge, 'pick-copper', 2, NOON).reason, 'qty');
  assert.equal(buy(p, SHOPS.forge, 'pick-copper', 1, NOON).ok, true);
  assert.equal(buy(p, SHOPS.forge, 'pick-copper', 1, NOON).reason, 'owned');
  const q = fresh(); q.state.gold = 5000; q.state.items['pick-silver'] = 1;
  assert.equal(buy(q, SHOPS.forge, 'pick-copper', 1, NOON).reason, 'better');
});
test('강화: 재료와 골드가 함께 차감되고 이전 장비는 새 장비로 바뀐다', () => {
  const p = fresh(); p.state.gold = 1000; Object.assign(p.state.items, { 'pick-copper':1, 'silver-mist-stone':4, 'iron-scrap':3, charcoal:2 });
  const r = buy(p, SHOPS.forge, 'pick-silver', 1, NOON);
  assert.equal(r.ok, true);
  assert.equal(p.state.gold, 400); assert.equal(p.count('pick-silver'), 1); assert.equal(p.count('pick-copper'), 0);
  assert.equal(p.count('silver-mist-stone'), 1); assert.equal(p.count('iron-scrap'), 0); assert.equal(p.count('charcoal'), 0);
});
test('강화: 재료가 모자라면 거절하고 아무것도 차감하지 않는다', () => {
  const p = fresh(); p.state.gold = 1000; Object.assign(p.state.items, { 'pick-copper':1, 'silver-mist-stone':2, 'iron-scrap':3, charcoal:2 });
  const before = JSON.stringify(p.state);
  const r = buy(p, SHOPS.forge, 'pick-silver', 1, NOON);
  assert.equal(r.ok, false); assert.equal(r.reason, 'need'); assert.equal(JSON.stringify(p.state), before);
  const q = fresh(); q.state.gold = 100; Object.assign(q.state.items, { 'pick-copper':1, 'silver-mist-stone':3, 'iron-scrap':3, charcoal:2 });
  assert.equal(buy(q, SHOPS.forge, 'pick-silver', 1, NOON).reason, 'gold'); assert.equal(q.count('pick-copper'), 1);
});

/* ---- 판매 ---- */
test('판매: 골드 증가·물건 감소, 같은 물건을 중복 판매할 수 없다', () => {
  const p = fresh(); p.add('reed-crucian', 2);
  const r = sell(p, SHOPS.clover, 'reed-crucian', 2, NOON);
  assert.equal(r.ok, true); assert.equal(r.total, 40); assert.equal(p.state.gold, 540); assert.equal(p.count('reed-crucian'), 0);
  const again = sell(p, SHOPS.clover, 'reed-crucian', 1, NOON);
  assert.equal(again.ok, false); assert.equal(again.reason, 'lack'); assert.equal(p.state.gold, 540);
});
test('판매: 보유 수량보다 많이는 불가(골드·수량 그대로)', () => {
  const p = fresh(); p.add('moss-copper', 3);
  const r = sell(p, SHOPS.forge, 'moss-copper', 4, NOON);
  assert.equal(r.ok, false); assert.equal(r.reason, 'lack'); assert.equal(p.count('moss-copper'), 3); assert.equal(p.state.gold, 500);
  for (const q of [0, -2, NaN]) assert.equal(sell(p, SHOPS.forge, 'moss-copper', q, NOON).ok, false);
  assert.equal(p.state.gold, 500);
});
test('판매: 없는 물건은 못 판다', () => {
  const p = fresh(); assert.equal(sell(p, SHOPS.clover, 'moon-carp', 1, NOON).ok, false); assert.equal(p.state.gold, 500);
});
test('매입은 전문 분야별: 대장간은 광석만, 약방은 약초·포션, 로웬은 대부분', () => {
  const p = fresh(); p.add('mist-trout', 1); p.add('moss-copper', 1); p.add('herb', 1); p.add('potion-small', 1);
  assert.equal(sell(p, SHOPS.forge, 'mist-trout', 1, NOON).reason, 'nobuy');
  assert.equal(sell(p, SHOPS.apothecary, 'moss-copper', 1, NOON).reason, 'nobuy');
  assert.equal(sell(p, SHOPS.bakery, 'moss-copper', 1, NOON).reason, 'nobuy');
  assert.ok(sellPrice(SHOPS.clover, 'mist-trout') > 0 && sellPrice(SHOPS.clover, 'moss-copper') > 0 && sellPrice(SHOPS.clover, 'herb') > 0 && sellPrice(SHOPS.clover, 'potion-small') > 0);
  assert.ok(sellPrice(SHOPS.forge, 'moss-copper') > sellPrice(SHOPS.clover, 'moss-copper'), '전문 상점이 더 후하게 쳐 줌');
  assert.ok(sellPrice(SHOPS.apothecary, 'herb') > sellPrice(SHOPS.clover, 'herb'));
  assert.equal(sell(p, SHOPS.pub, 'mist-trout', 1, NOON).reason, 'closed', '주점은 낮에 영업하지 않음');
  assert.equal(sell(p, SHOPS.pub, 'mist-trout', 1, 20 * 60).ok, true);
});
test('요리 가격: 품질 배율을 따르고, 실패작은 1G', () => {
  const p = fresh();
  for (const [recipe, base] of Object.entries(DISH_BASE)) for (const q of DISH_QUALITY) {
    const id = `dish:${recipe}:${q.id}`; if (q.id === 'burnt') continue;
    assert.equal(baseSell(id), Math.round(base * q.mult)); assert.ok(sellPrice(SHOPS.clover, id) >= baseSell(id));
  }
  assert.ok(sellPrice(SHOPS.bakery, 'dish:dew-berry-jam:good') > sellPrice(SHOPS.clover, 'dish:dew-berry-jam:good'));
  p.add('dish:burnt', 2); assert.equal(sell(p, SHOPS.clover, 'dish:burnt', 2, NOON).total, 2);
});
test('고유 장비·도구는 어느 상점에도 팔 수 없다', () => {
  const p = fresh(); p.add('pick-copper', 1); p.add('rod-bamboo', 1);
  for (const shop of Object.values(SHOPS)) for (const id of ['pick-copper', 'rod-bamboo', 'hoe']) { p.add(id, id === 'hoe' ? 1 : 0); assert.equal(sell(p, shop, id, 1, NOON).ok, false); }
  assert.equal(p.count('pick-copper'), 1); assert.equal(p.state.gold, 500);
  assert.equal(sellables(SHOPS.clover, p.state.items).some(r => isProtected(r.info)), false);
});

/* ---- 영업시간 ---- */
test('영업시간: 닫혀 있으면 거래 불가, 자정을 넘기는 영업 지원', () => {
  const p = fresh(); p.state.gold = 1000;
  assert.equal(buy(p, SHOPS.clover, 'candle', 1, 8 * 60 + 59).reason, 'closed');
  assert.equal(buy(p, SHOPS.clover, 'candle', 1, 18 * 60).reason, 'closed');
  assert.equal(buy(p, SHOPS.clover, 'candle', 1, 9 * 60).ok, true); assert.equal(buy(p, SHOPS.clover, 'candle', 1, 17 * 60 + 59).ok, true);
  assert.equal(p.state.gold, 1000 - 48);
  const pub = SHOPS.pub; assert.equal(isOpen(pub, 16 * 60), true); assert.equal(isOpen(pub, 23 * 60 + 59), true); assert.equal(isOpen(pub, 60), true); assert.equal(isOpen(pub, 2 * 60), false); assert.equal(isOpen(pub, 15 * 60), false);
  assert.equal(parseClock('9:05'), 545); assert.equal(parseClock('24:00'), null); assert.equal(parseClock('abc'), null);
});

/* ---- 복제·안정성 ---- */
test('연속 판매(중복 클릭)해도 한 번만 처리된다', () => {
  const p = fresh(); p.add('tide-mackerel', 1);
  const results = [1, 2, 3, 4, 5].map(() => sell(p, SHOPS.clover, 'tide-mackerel', 1, NOON));
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal(p.state.gold, 518); assert.equal(p.count('tide-mackerel'), 0);
});
test('다른 탭이 먼저 판 물건을 이 탭의 오래된 상태로 다시 팔 수 없다', () => {
  const store = memoryStorage(), a = new Progress(store); a.add('reef-bream', 1);
  const b = new Progress(store);                       // 같은 저장소를 보는 두 번째 탭
  assert.equal(sell(a, SHOPS.clover, 'reef-bream', 1, NOON).ok, true);
  const second = sell(b, SHOPS.clover, 'reef-bream', 1, NOON);
  assert.equal(second.ok, false); assert.equal(second.reason, 'lack');
  const c = new Progress(store); assert.equal(c.state.gold, 528); assert.equal(c.count('reef-bream'), 0);
});
test('transact: 하나라도 어긋나면 전부 취소', () => {
  const p = fresh(); p.add('herb', 1);
  assert.equal(p.transact({ gold:-100, items:{ herb:-2 } }), false); assert.equal(p.state.gold, 500); assert.equal(p.count('herb'), 1);
  assert.equal(p.transact({ gold:-600 }), false); assert.equal(p.transact({ gold:0.5 }), false); assert.equal(p.transact({ items:{ herb:1.5 } }), false);
  assert.equal(p.transact({ gold:-100, items:{ herb:-1, mint:2 } }), true); assert.equal(p.state.gold, 400); assert.equal(p.count('herb'), 0); assert.equal(p.count('mint'), 2);
});
test('골드 상한을 넘기는 판매는 거절', () => {
  const p = fresh(); p.state.gold = 999990; p.add('moon-carp', 1);
  assert.equal(sell(p, SHOPS.clover, 'moon-carp', 1, NOON).reason, 'goldcap'); assert.equal(p.count('moon-carp'), 1);
});
test('저장·불러오기: 거래 결과가 새로고침 뒤에도 남는다', () => {
  const store = memoryStorage(), a = new Progress(store); a.add('silver-minnow', 3);
  sell(a, SHOPS.clover, 'silver-minnow', 2, NOON); buy(a, SHOPS.clover, 'herb', 2, NOON);
  const b = new Progress(store); assert.equal(b.state.gold, 500 + 28 - 32); assert.equal(b.count('silver-minnow'), 1); assert.equal(b.count('herb'), 2);
});

/* ---- 경제 균형 ---- */
test('균형: 희귀할수록 비싸고, 흔한 물고기·광석은 싸다', () => {
  for (const spot of ['silver-lake', 'blue-coast']) {
    const fish = Object.values(FISH).filter(f => f.habitat === spot), tiers = { common:[], rare:[], special:[] };
    for (const f of fish) tiers[f.tier].push(baseSell(f.id));
    assert.ok(Math.max(...tiers.common) < Math.min(...tiers.rare)); assert.ok(Math.max(...tiers.rare) < Math.min(...tiers.special));
  }
  assert.ok(baseSell('moss-copper') < baseSell('silver-mist-stone') && baseSell('silver-mist-stone') < baseSell('moondrop-crystal'));
});
test('균형: 직접 요리하면 재료를 사서 만들어도 잘 만들수록 이익, 흔한 실패는 손해', () => {
  const cost = recipe => Object.entries(RECIPES[recipe].need).reduce((sum, [id, n]) => sum + buyPrice(id) * n, 0) + (RECIPES[recipe].fishAny ? baseSell('silver-minnow') : 0);
  for (const recipe of Object.keys(RECIPES)) {
    const normal = baseSell(`dish:${recipe}:normal`), good = baseSell(`dish:${recipe}:good`), great = baseSell(`dish:${recipe}:great`);
    assert.ok(great > cost(recipe), recipe + ' 훌륭한 요리는 이익'); assert.ok(good >= cost(recipe) - 2, recipe + ' 잘 만든 요리는 본전 이상');
    assert.ok(normal < great * 0.6);
  }
});
test('균형: 흔한 물고기 몇 마리로는 좋은 장비를 못 산다(저축 필요)', () => {
  assert.ok(buyPrice('pick-copper') >= 10 * baseSell('reef-bream')); assert.ok(buyPrice('pick-silver') > buyPrice('pick-copper'));
  assert.ok(START_GOLD < buyPrice('pick-silver') + buyPrice('pick-copper'));
});
test('균형: 작물은 씨앗값보다 비싸게 팔리고, 오래 걸리는 작물일수록 이익이 크다', () => {
  const crops = Object.values(GOODS).filter(g => g.kind === 'crop');
  const profits = crops.map(c => { const seed = GOODS['seed-' + c.id.slice(5)]; assert.ok(seed, c.id + ' 씨앗'); const gain = baseSell(c.id) - buyPrice(seed.id); assert.ok(gain > 0); return { days:c.growDays, gain, perDay:gain / c.growDays }; });
  for (const c of profits) assert.ok(c.perDay >= 3.5 && c.perDay <= 16, '하루 수익 ' + c.perDay.toFixed(1));
});

/* ---- 효과 ---- */
test('장비 효과가 실제 미니게임 값에 반영된다', () => {
  assert.deepEqual(equipmentBonus({}), { mineSwings:0, biteWindow:1 });
  assert.equal(equipmentBonus({ 'pick-copper':1 }).mineSwings, 1); assert.equal(equipmentBonus({ 'pick-copper':1, 'pick-silver':1 }).mineSwings, 2);
  const ore = ORES['moss-copper'];
  assert.equal(new MineSession(ore).swings, ore.mine.swings);
  assert.equal(new MineSession(ore, undefined, { extraSwings:2 }).swings, ore.mine.swings + 2);
  assert.equal(new MineSession(ore, undefined, { extraSwings:2 }).swingsMax, ore.mine.swings + 2);
  const pool = [FISH['silver-minnow']];
  assert.equal(new BiteSession(pool, 0).window, FISH['silver-minnow'].bite.window);
  assert.ok(Math.abs(new BiteSession(pool, 0, undefined, 1.25).window - FISH['silver-minnow'].bite.window * 1.25) < 1e-9);
});

/* ---- 분류·설명 ---- */
test('모든 소지품은 분류·이름·설명이 있고 같은 id 는 한 번만 정의된다', () => {
  const ids = [...Object.keys(PRICES), ...Object.keys(GOODS)];
  for (const id of new Set(ids)) { const info = describeItem(id); assert.notEqual(info.kind, 'unknown', id); assert.ok(info.name && info.name !== id, id + ' 이름'); if (!id.startsWith('dish:')) assert.ok(info.desc, id + ' 설명'); assert.ok(GROUPS.some(g => g.id === groupOf(info.kind)), id); }
  for (const shop of Object.values(SHOPS)) { const seen = new Set(); for (const row of shop.stock) { assert.equal(seen.has(row.id), false, shop.id + ' 중복 ' + row.id); seen.add(row.id); } }
});
test('상점 목록: 구매 목록이 5개 상점 모두 비어 있지 않고 가격이 정수', () => {
  for (const shop of Object.values(SHOPS)) for (const row of stockFor(shop)) assert.ok(Number.isInteger(row.price) && row.price > 0, row.id);
});
