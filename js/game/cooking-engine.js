// 요리 엔진(순수 계산). 요리 하나는 1~2개의 '조리 동작'(step)으로 이루어집니다.
//   heat   : 불 세기를 조절해 한쪽 면을 굽다가 알맞을 때 뒤집고, 반대쪽도 구워 접시에 담기 (구이)
//   drop   : 좌우로 흔들리는 재료를 냄비 위에서 정확히 떨어뜨리기 (수프)
//   stir   : 돌아가는 국자가 위쪽 표시를 지날 때 박자에 맞춰 젓기 (수프·잼)
//   finish : 윤기가 오르는 것을 보고 알맞은 때 불에서 내리기 (잼)
// 각 step 은 0~100 점을 내고, 요리 점수는 step 점수의 평균입니다. 점수 → 품질(items.js qualityOf).

export const JUDGE = { perfect:{ label:'완벽!', pts:100 }, good:{ label:'좋아요', pts:70 }, ok:{ label:'아슬아슬', pts:40 }, miss:{ label:'아쉬워요', pts:0 } };

/* ---------- 구이: 불 조절 + 뒤집기 ---------- */
export class HeatFlip {
  constructor() {
    this.id = 'heat'; this.title = '불 조절과 뒤집기'; this.action = '뒤집기'; this.t = 0; this.heat = .45; this.side = 0; this.done = false;
    this.doneness = [0, 0]; this.flipAt = null; this.sideScore = [null, null]; this.burnt = false; this.events = []; this.limit = 34;
    this.sideTime = [0, 0]; this.perfectAt = .93;
  }
  static rate(heat) { return heat < .15 ? .015 : .02 + .17 * heat * heat + .11 * heat; } // 불이 셀수록 급격히 빨리 익음
  setHeat(v) { this.heat = Math.max(0, Math.min(1, v)); }
  step(dt) {
    if (this.done) return; this.events.length = 0; this.t += dt;
    const D = this.doneness; D[this.side] += HeatFlip.rate(this.heat) * dt; this.sideTime[this.side] += dt;
    if (D[this.side] > 1.3) { this.#settle(this.side, true); }
    if (this.t > this.limit && !this.done) this.#settle(this.side, false);
  }
  state() { return { side:this.side, d:this.doneness[this.side], heat:this.heat }; }
  // 뒤집기/접시에 담기
  press() { if (this.done) return null; return this.#settle(this.side, false); }
  #score(d) { const e = Math.abs(d - this.perfectAt); if (d > 1.12) return 0; return e <= .06 ? 100 : e <= .13 ? 75 : e <= .22 ? 45 : e <= .35 ? 20 : 5; }
  #settle(side, burnt) {
    const d = this.doneness[side], pts = burnt ? 0 : this.#score(d); this.sideScore[side] = pts;
    const judge = pts >= 100 ? 'perfect' : pts >= 75 ? 'good' : pts >= 40 ? 'ok' : 'miss';
    this.events.push({ type:side === 0 ? 'flip' : 'plate', judge, d, burnt });
    if (side === 0) { this.side = 1; } else this.done = true;
    return { judge, d, burnt };
  }
  get score() { return this.done ? Math.round(((this.sideScore[0] ?? 0) + (this.sideScore[1] ?? 0)) / 2) : 0; }
}

/* ---------- 수프: 재료 넣기 ---------- */
export class DropStep {
  constructor(count = 3) {
    this.id = 'drop'; this.title = '재료 넣기'; this.action = '넣기'; this.count = count; this.index = 0; this.t = 0; this.done = false; this.results = []; this.events = [];
    this.potR = .16; // 화면 폭 대비 냄비 반지름(0~1 좌표계, 중심 0.5)
  }
  speed(i = this.index) { return 1.35 + .35 * i; } // rad/s
  x(t = this.t, i = this.index) { return .5 + .36 * Math.sin(t * this.speed(i) + i * 1.1); }
  step(dt) { if (!this.done) { this.t += dt; this.events.length = 0; } }
  press() {
    if (this.done) return null;
    const dx = Math.abs(this.x() - .5) / this.potR; const judge = dx <= .22 ? 'perfect' : dx <= .55 ? 'good' : dx <= 1 ? 'ok' : 'miss';
    this.results.push({ judge, dx }); this.events.push({ type:'drop', judge, x:this.x(), index:this.index }); this.index++;
    if (this.index >= this.count) this.done = true; return { judge, dx };
  }
  get score() { return this.results.length ? Math.round(this.results.reduce((a, r) => a + JUDGE[r.judge].pts, 0) / this.count) : 0; }
}

/* ---------- 젓기 박자 ---------- */
export class StirStep {
  constructor({ beats = 8, period = 1.25 } = {}) {
    this.id = 'stir'; this.title = '박자에 맞춰 젓기'; this.action = '젓기'; this.beats = beats; this.period = period; this.t = -period * .75; // 시작 전 준비 시간
    this.done = false; this.results = new Array(beats).fill(null); this.events = []; this.stray = 0; this.window = { perfect:.09, good:.18, ok:.30 };
  }
  beatTime(i) { return (i + 1) * this.period - 0; }               // i 번째 박자 시각(국자가 위쪽을 지나는 때)
  angle() { return ((this.t / this.period) % 1 + 1) % 1; }        // 0~1 (0 이 위쪽)
  step(dt) {
    if (this.done) return; this.events.length = 0; this.t += dt;
    for (let i = 0; i < this.beats; i++) if (this.results[i] === null && this.t > this.beatTime(i) + this.window.ok) { this.results[i] = 'miss'; this.events.push({ type:'miss', index:i }); }
    if (this.results.every(r => r !== null) && this.t > this.beatTime(this.beats - 1) + .35) this.done = true;
  }
  press() {
    if (this.done) return null;
    let best = -1, bestErr = 9;
    for (let i = 0; i < this.beats; i++) if (this.results[i] === null) { const e = Math.abs(this.t - this.beatTime(i)); if (e < bestErr) { bestErr = e; best = i; } }
    if (best < 0 || bestErr > this.window.ok + .12) { this.stray++; this.events.push({ type:'stray' }); return { judge:'stray' }; }
    const judge = bestErr <= this.window.perfect ? 'perfect' : bestErr <= this.window.good ? 'good' : bestErr <= this.window.ok ? 'ok' : 'miss';
    this.results[best] = judge; this.events.push({ type:'stir', judge, index:best, err:this.t - this.beatTime(best) });
    return { judge, err:this.t - this.beatTime(best) };
  }
  get score() { const pts = this.results.reduce((a, r) => a + (r ? JUDGE[r].pts : 0), 0) / this.beats; return Math.max(0, Math.round(pts - this.stray * 4)); }
}

/* ---------- 마무리: 불에서 내리기 ---------- */
export class FinishStep {
  constructor() { this.id = 'finish'; this.title = '불에서 내리기'; this.action = '내리기'; this.t = 0; this.sheen = 0; this.done = false; this.events = []; this.judge = null; this.pts = 0; }
  static sheenAt(t) { return .1 + .105 * t; }  // 약 8.5초에 1.0
  step(dt) { if (this.done) return; this.events.length = 0; this.t += dt; this.sheen = FinishStep.sheenAt(this.t); if (this.sheen > 1.18) this.#end('burnt'); }
  press() { if (this.done) return null; return this.#end('press'); }
  #end(kind) {
    const s = this.sheen; let judge = 'miss'; if (kind === 'burnt') judge = 'miss'; else if (s >= .86 && s <= 1.02) judge = 'perfect'; else if (s >= .76 && s <= 1.1) judge = 'good'; else if (s >= .6) judge = 'ok';
    this.judge = judge; this.pts = kind === 'burnt' ? 0 : JUDGE[judge].pts; this.done = true; this.events.push({ type:'finish', judge, sheen:s, burnt:kind === 'burnt' }); return { judge, sheen:s };
  }
  get score() { return this.pts; }
}

/* ---------- 요리 진행 ---------- */
export function buildSteps(recipe) {
  const count = Object.values(recipe.need).reduce((a, b) => a + b, 0);
  return recipe.steps.map(kind => kind === 'heat' ? new HeatFlip() : kind === 'flip' ? null : kind === 'drop' ? new DropStep(Math.min(3, count)) : kind === 'stir' ? new StirStep(recipe.id === 'dew-berry-jam' ? { beats:8, period:1.05 } : { beats:7, period:1.3 }) : kind === 'finish' ? new FinishStep() : null).filter(Boolean);
}
export function dishScore(steps) { return Math.round(steps.reduce((a, s) => a + s.score, 0) / steps.length); }
