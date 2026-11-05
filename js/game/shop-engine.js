// 상점 거래 규칙(화면 없이 계산만 합니다). 사고팔기는 모두 progress.transact 한 번으로 처리됩니다.
//   다시 읽기 → 검증 → (코인·소지품을 한꺼번에) 반영 → 저장 순서라서, 중복 클릭·다른 탭·수량 오류가 있어도 코인이나 물건이 복제되지 않습니다.
import { describeItem } from './items.js?v=mine1';
import { groupOf, isProtected } from './goods.js?v=mine1';
import { SHOPS, PRICES, GIFT, buyPrice, baseSell, MAX_COINS, MAX_STACK, MAX_QTY } from './shop-data.js?v=mine1';

/* ---------------- 가격 ---------------- */
export function sellRate(shop, id) {
  const info = describeItem(id), buys = shop.buys;
  return buys['id:' + id] ?? buys['kind:' + info.kind] ?? buys[groupOf(info.kind)] ?? 0;
}
/** 이 상점이 이 물건을 사 주는 값(1개). 사지 않거나 되팔 수 없는 물건이면 0 */
export function sellPrice(shop, id) {
  if (isProtected(describeItem(id))) return 0;
  const base = baseSell(id), rate = sellRate(shop, id);
  return base > 0 && rate > 0 ? Math.max(1, Math.round(base * rate)) : 0;
}
export const canSellHere = (shop, id) => sellPrice(shop, id) > 0;

/* ---------------- 판매 목록 / 매입 목록 ---------------- */
export function stockFor(shop) {
  return shop.stock.map(entry => ({ ...entry, info:describeItem(entry.id), price:buyPrice(entry.id) }));
}
/** 지금 가진 물건 중 상점이 사 주는 것 */
export function sellables(shop, items) {
  return Object.entries(items).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, info:describeItem(id), price:sellPrice(shop, id) })).filter(row => row.price > 0);
}

/* ---------------- 구매 ---------------- */
// 반환: { ok, reason, total, ... }   reason: unknown | qty | owned | coins | full
export function quoteBuy(state, shop, id, qty) {
  if (!shop.stock.some(row => row.id === id) || !buyPrice(id)) return { ok:false, reason:'unknown' };
  if (!(Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY)) return { ok:false, reason:'qty' };
  const info = describeItem(id), have = state.items[id] || 0, unit = buyPrice(id), unique = Boolean(info.unique);
  if (unique) {
    if (qty !== 1) return { ok:false, reason:'qty' };
    if (have > 0) return { ok:false, reason:'owned' };
  }
  const total = unit * qty;
  if (have + qty > MAX_STACK && !unique) return { ok:false, reason:'full', total };
  if ((state.coins || 0) < total) return { ok:false, reason:'coins', total };
  return { ok:true, total, unit, qty };
}
export function buy(progress, shop, id, qty) {
  progress.refresh();
  const quote = quoteBuy(progress.state, shop, id, qty);
  if (!quote.ok) return quote;
  // 거래 순간에 한 번 더(최신 저장값으로) 확인합니다: 다른 탭에서 이미 샀다면 취소됩니다.
  const guard = state => quoteBuy(state, shop, id, quote.qty).ok;
  if (!progress.transact({ coins:-quote.total, items:{ [id]:quote.qty } }, { guard })) return { ok:false, reason:'conflict' };
  return { ...quote, kind:'buy', id };
}

/* ---------------- 판매 ---------------- */
// reason: nobuy | qty | lack | cap
export function quoteSell(state, shop, id, qty) {
  const price = sellPrice(shop, id);
  if (!price) return { ok:false, reason:'nobuy' };
  if (!(Number.isInteger(qty) && qty >= 1)) return { ok:false, reason:'qty' };
  const have = state.items[id] || 0;
  if (have < qty) return { ok:false, reason:'lack', have };
  const total = price * qty;
  if ((state.coins || 0) + total > MAX_COINS) return { ok:false, reason:'cap', total };
  return { ok:true, total, unit:price, qty, have };
}
/** 판매. 번 코인은 누적 획득액(earned)에도 더해지고, 5,000 에 닿으면 선물이 같은 저장에서 열립니다. */
export function sell(progress, shop, id, qty) {
  progress.refresh();
  const quote = quoteSell(progress.state, shop, id, qty);
  if (!quote.ok) return quote;
  const wasLocked = !progress.state.gift.unlocked;
  const guard = state => quoteSell(state, shop, id, quote.qty).ok;
  if (!progress.transact({ coins:quote.total, earn:quote.total, items:{ [id]:-quote.qty } }, { maxCoins:MAX_COINS, guard })) return { ok:false, reason:'conflict' };
  return { ...quote, kind:'sell', id, rare:['rare', 'special'].includes(describeItem(id).tier), unlockedNow:wasLocked && progress.state.gift.unlocked };
}
/** 가진 만큼 전부 판매 */
export function sellAll(progress, shop, id) { progress.refresh(); return sell(progress, shop, id, progress.state.items[id] || 0); }

/* ---------------- 엑스의 비밀 선물 ---------------- */
/** 'hidden'(아직 안 열림) | 'open'(살 수 있음) | 'bought'(이미 삼) */
export const giftStatus = state => state.gift.bought ? 'bought' : state.gift.unlocked ? 'open' : 'hidden';
// reason: locked | owned | coins
export function quoteGift(state) {
  if (state.gift.bought) return { ok:false, reason:'owned' };
  if (!state.gift.unlocked) return { ok:false, reason:'locked' };
  if ((state.coins || 0) < GIFT.cost) return { ok:false, reason:'coins', total:GIFT.cost };
  return { ok:true, total:GIFT.cost };
}
export function buyGift(progress) {
  progress.refresh();
  const quote = quoteGift(progress.state);
  if (!quote.ok) return quote;
  const guard = state => quoteGift(state).ok;
  if (!progress.transact({ coins:-GIFT.cost, giftBought:true }, { guard })) return { ok:false, reason:'conflict' };
  return { ...quote, kind:'gift' };
}

/* ---------------- 점검: 가격표가 규칙을 지키는지 ---------------- */
export function auditEconomy() {
  const problems = [], shops = Object.values(SHOPS);
  for (const shop of shops) for (const entry of shop.stock) {
    const info = describeItem(entry.id);
    if (info.kind === 'unknown') problems.push(`${shop.id}: 알 수 없는 물품 ${entry.id}`);
    if (!buyPrice(entry.id)) problems.push(`${shop.id}: ${entry.id} 구매가 없음`);
    // 실제 미니게임에서 효과가 없는 물품은 팔지 않습니다
    const useful = info.effect || ['herb', 'mushroom', 'berry'].includes(entry.id);
    if (!useful) problems.push(`${shop.id}: ${entry.id} 는 미니게임에서 쓰이지 않음`);
  }
  // 사고팔기 이익 금지: 파는 물건은 사 주지 않습니다(사고팔기만으로 코인이 불어날 수 없음)
  for (const id of Object.keys(PRICES)) if (buyPrice(id)) for (const shop of shops) if (sellPrice(shop, id) > 0) problems.push(`${id}: 살 수 있는데 ${shop.id} 가 다시 사 줌`);
  // 고유 장비는 어느 상점에서도 사 주지 않음
  for (const id of Object.keys(PRICES)) if (isProtected(describeItem(id))) for (const shop of shops) if (sellPrice(shop, id) > 0) problems.push(`${id}: 보호 대상인데 ${shop.id} 가 매입`);
  return problems;
}
