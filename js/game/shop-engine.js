// 상점 거래 규칙(화면 없이 계산만 합니다). 사고팔기는 모두 progress.transact 한 번으로 처리됩니다.
//   검증 → (골드·소지품을 한꺼번에) 반영 → 저장 순서라서, 중복 클릭·새로고침·수량 오류가 있어도 골드나 물건이 복제되지 않습니다.
import { describeItem } from './items.js?v=sh1';
import { GOODS, groupOf, isProtected } from './goods.js?v=sh1';
import { SHOPS, PRICES, buyPrice, baseSell, TOOL_LINES, MAX_GOLD, MAX_STACK, MAX_QTY } from './shop-data.js?v=sh1';

/* ---------------- 영업시간 ---------------- */
export const toMinutes = (date = new Date()) => date.getHours() * 60 + date.getMinutes();
/** 지금 시각(분). 주소 끝에 ?time=14:30 을 붙이면 그 시각으로 확인해 볼 수 있습니다(영업시간 점검용). */
export function currentMinutes(search = globalThis.location?.search || '') { const m = /[?&]time=(\d{1,2}:\d{2})/.exec(search); const forced = m ? parseClock(m[1]) : null; return forced ?? toMinutes(new Date()); }
/** '14:30' 같은 글자를 분으로. 형식이 틀리면 null */
export function parseClock(text) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; }
export const clockText = minutes => String(Math.floor(minutes / 60) % 24).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
export function isOpen(shop, minutes) {
  const { open, close } = shop.hours;
  return open <= close ? minutes >= open && minutes < close : minutes >= open || minutes < close;   // 자정을 넘기는 영업 지원
}
export const hoursText = shop => clockText(shop.hours.open) + '–' + clockText(shop.hours.close === 24 * 60 ? 0 : shop.hours.close);

/* ---------------- 가격 ---------------- */
export function sellRate(shop, id) {
  const info = describeItem(id), buys = shop.buys;
  const rate = buys['id:' + id] ?? buys['kind:' + info.kind] ?? buys[groupOf(info.kind)] ?? 0;
  return rate;
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
  return shop.stock.map(entry => ({ ...entry, info:describeItem(entry.id), price:buyPrice(entry.id), need:entry.need || null }));
}
/** 지금 가진 물건 중 이 상점이 사 주는 것 */
export function sellables(shop, items) {
  return Object.entries(items).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, info:describeItem(id), price:sellPrice(shop, id) })).filter(row => row.price > 0);
}

/* ---------------- 구매 ---------------- */
// 반환: { ok, reason, total, ... }  reason: closed | unknown | qty | owned | better | need | gold | full | goldcap
export function quoteBuy(state, shop, id, qty, minutes) {
  qty = Math.floor(qty);
  const entry = shop.stock.find(row => row.id === id);
  if (!entry || !buyPrice(id)) return { ok:false, reason:'unknown' };
  if (!(qty >= 1 && qty <= MAX_QTY)) return { ok:false, reason:'qty' };
  if (minutes !== undefined && !isOpen(shop, minutes)) return { ok:false, reason:'closed' };
  const info = describeItem(id), have = state.items[id] || 0, unit = buyPrice(id);
  const unique = Boolean(info.unique);
  if (unique) {
    if (qty !== 1) return { ok:false, reason:'qty' };
    if (have > 0) return { ok:false, reason:'owned' };
    const line = Object.values(TOOL_LINES).find(ids => ids.includes(id));
    if (line && line.slice(line.indexOf(id) + 1).some(better => (state.items[better] || 0) > 0)) return { ok:false, reason:'better' };
  }
  const need = entry.need ? Object.entries(entry.need).map(([item, n]) => ({ item, n: n * qty, have: state.items[item] || 0 })) : [];
  const total = unit * qty;
  if (need.some(row => row.have < row.n)) return { ok:false, reason:'need', total, need };
  if (have + qty > MAX_STACK && !unique) return { ok:false, reason:'full', total };
  if ((state.gold || 0) < total) return { ok:false, reason:'gold', total, need };
  return { ok:true, total, need, unit, qty };
}
export function buy(progress, shop, id, qty, minutes) {
  progress.refresh();
  const quote = quoteBuy(progress.state, shop, id, qty, minutes);
  if (!quote.ok) return quote;
  const items = { [id]:quote.qty };
  for (const row of quote.need) items[row.item] = (items[row.item] || 0) - row.n;
  if (!progress.transact({ gold:-quote.total, items })) return { ok:false, reason:'conflict' };
  return { ...quote, kind:'buy', id };
}

/* ---------------- 판매 ---------------- */
// reason: closed | nobuy | qty | lack | goldcap
export function quoteSell(state, shop, id, qty, minutes) {
  qty = Math.floor(qty);
  const price = sellPrice(shop, id);
  if (!price) return { ok:false, reason:'nobuy' };
  if (!(qty >= 1)) return { ok:false, reason:'qty' };
  if (minutes !== undefined && !isOpen(shop, minutes)) return { ok:false, reason:'closed' };
  const have = state.items[id] || 0;
  if (have < qty) return { ok:false, reason:'lack', have };
  const total = price * qty;
  if ((state.gold || 0) + total > MAX_GOLD) return { ok:false, reason:'goldcap', total };
  return { ok:true, total, unit:price, qty, have };
}
export function sell(progress, shop, id, qty, minutes) {
  progress.refresh();
  const quote = quoteSell(progress.state, shop, id, qty, minutes);
  if (!quote.ok) return quote;
  if (!progress.transact({ gold:quote.total, items:{ [id]:-quote.qty } }, { maxGold:MAX_GOLD })) return { ok:false, reason:'conflict' };
  return { ...quote, kind:'sell', id, rare:['rare', 'special'].includes(describeItem(id).tier) };
}

/* ---------------- 점검: 가격표가 규칙을 지키는지 ---------------- */
export function auditEconomy() {
  const problems = [];
  const shops = Object.values(SHOPS);
  for (const shop of shops) for (const entry of shop.stock) {
    const info = describeItem(entry.id);
    if (info.kind === 'unknown') problems.push(`${shop.id}: 알 수 없는 물품 ${entry.id}`);
    if (!buyPrice(entry.id)) problems.push(`${shop.id}: ${entry.id} 구매가 없음`);
    for (const item of Object.keys(entry.need || {})) if (describeItem(item).kind === 'unknown') problems.push(`${shop.id}: ${entry.id} 강화 재료 ${item} 알 수 없음`);
    if (entry.replaces && !entry.need?.[entry.replaces]) problems.push(`${shop.id}: ${entry.id} 가 ${entry.replaces} 를 대체하지만 재료에 없음`);
  }
  // 사고팔기 이익 금지: 어떤 상점이든 판매가 ≤ 구매가의 60%
  for (const id of Object.keys(PRICES)) {
    const buyAt = buyPrice(id); if (!buyAt) continue;
    for (const shop of shops) { const p = sellPrice(shop, id); if (p > buyAt * 0.6) problems.push(`${id}: ${shop.id} 매입가 ${p}G 가 구매가 ${buyAt}G 의 60%를 넘음`); }
  }
  // 고유 장비는 어느 상점에서도 사 주지 않음
  for (const good of Object.values(GOODS)) if (isProtected(good)) for (const shop of shops) if (sellPrice(shop, good.id) > 0) problems.push(`${good.id}: 보호 대상인데 ${shop.id} 가 매입`);
  return problems;
}
