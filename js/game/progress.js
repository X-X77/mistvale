// 미스트베일 진행 상태: 소지금·소지품·활동 숙련도(경험치). 이 브라우저의 localStorage 에 보관합니다.
// 저장이 막혀 있으면 이 탭 메모리에서만 유지되고, 화면에 그 사실을 알립니다(persistent === false).
const KEY = 'mistvale.progress.v1';
export const SKILLS = ['fishing', 'cooking', 'mining'];
export const START_GOLD = 500;           // 오프닝 '소지금 500G' 와 같은 값
const LEVEL_XP = [0, 30, 80, 150, 250, 400, 600]; // 레벨 n 에 필요한 누적 경험치(레벨 1~7)

export function levelOf(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  const next = LEVEL_XP[level] ?? null;
  return { level, xp, base: LEVEL_XP[level - 1], next, max: next === null };
}
export function freshState() {
  return { v:1, gold:START_GOLD, items:{}, skills:{ fishing:0, cooking:0, mining:0 }, caught:{}, log:[] };
}
export function normalizeState(raw) {
  const state = freshState();
  if (!raw || typeof raw !== 'object') return state;
  if (Number.isFinite(raw.gold)) state.gold = Math.max(0, Math.floor(raw.gold));
  if (raw.items && typeof raw.items === 'object') for (const [id, count] of Object.entries(raw.items)) if (Number.isFinite(count) && count > 0) state.items[id] = Math.floor(count);
  for (const skill of SKILLS) if (Number.isFinite(raw.skills?.[skill])) state.skills[skill] = Math.max(0, Math.floor(raw.skills[skill]));
  if (raw.caught && typeof raw.caught === 'object') for (const [id, value] of Object.entries(raw.caught)) if (value && Number.isFinite(value.count)) state.caught[id] = { count:Math.floor(value.count), best:Number.isFinite(value.best) ? value.best : 0 };
  if (Array.isArray(raw.log)) state.log = raw.log.filter(line => typeof line === 'string').slice(0, 20);
  return state;
}

export class Progress {
  constructor(storage) {
    this.storage = storage === undefined ? (() => { try { return globalThis.localStorage; } catch { return null; } })() : storage;
    this.persistent = true; this.listeners = new Set();
    this.state = this.#read();
  }
  #read() {
    try { const text = this.storage?.getItem(KEY); if (!this.storage) { this.persistent = false; return freshState(); } return normalizeState(text ? JSON.parse(text) : null); }
    catch { this.persistent = false; return freshState(); }
  }
  #write() {
    try { this.storage.setItem(KEY, JSON.stringify(this.state)); this.persistent = true; }
    catch { this.persistent = false; }
    for (const listener of this.listeners) listener(this.state);
  }
  // 같은 브라우저의 다른 탭이 먼저 바꾼 값을 다시 읽어 옵니다(거래 직전에 불러서, 오래된 값으로 거래해 복제되는 일을 막습니다).
  refresh() {
    if (!this.storage) return;
    try { const text = this.storage.getItem(KEY); if (text) { this.state = normalizeState(JSON.parse(text)); this.persistent = true; } } catch { /* 읽을 수 없으면 지금 값을 씁니다 */ }
  }
  // 거래(골드 + 여러 소지품)를 한 번에 처리합니다. 하나라도 어긋나면 아무것도 바꾸지 않고 false 를 돌려줍니다.
  //   change: { gold: ±정수, items: { id: ±정수 } }   — 결과가 음수이거나 골드 상한(maxGold)을 넘으면 거절
  transact(change, { maxGold = Infinity } = {}) {
    this.refresh();
    const gold = Number.isInteger(change.gold || 0) ? (change.gold || 0) : NaN, items = change.items || {};
    if (!Number.isFinite(gold) || this.state.gold + gold < 0 || this.state.gold + gold > maxGold) return false;
    for (const [id, delta] of Object.entries(items)) if (!Number.isInteger(delta) || this.count(id) + delta < 0) return false;
    this.state.gold += gold;
    for (const [id, delta] of Object.entries(items)) { const n = this.count(id) + delta; if (n > 0) this.state.items[id] = n; else delete this.state.items[id]; }
    this.#write(); return true;
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  count(id) { return this.state.items[id] || 0; }
  has(need) { return Object.entries(need).every(([id, n]) => this.count(id) >= n); }
  add(id, n = 1) { if (n > 0) { this.refresh(); this.state.items[id] = this.count(id) + n; this.#write(); } }
  remove(need) {
    this.refresh();
    if (!this.has(need)) return false;
    for (const [id, n] of Object.entries(need)) { this.state.items[id] -= n; if (this.state.items[id] <= 0) delete this.state.items[id]; }
    this.#write(); return true;
  }
  addXp(skill, amount) {
    if (!SKILLS.includes(skill)) return { before:null, after:null, leveled:false };
    this.refresh();
    const before = levelOf(this.state.skills[skill]);
    this.state.skills[skill] += Math.max(0, Math.floor(amount));
    const after = levelOf(this.state.skills[skill]); this.#write();
    return { before, after, leveled:after.level > before.level };
  }
  skill(skill) { return levelOf(this.state.skills[skill] || 0); }
  recordCatch(id, size) {
    const entry = this.state.caught[id] || { count:0, best:0 };
    const first = entry.count === 0;
    entry.count++; entry.best = Math.max(entry.best, size || 0); this.state.caught[id] = entry; this.#write();
    return { first, best:entry.best };
  }
  reset() { this.state = freshState(); this.#write(); }
}
