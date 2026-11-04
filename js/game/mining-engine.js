// 채광 엔진(순수 계산).
// 바위 면 위에서 약점(균열 위의 빛나는 점)을 찾아, 알맞은 위치(정확도)와 알맞은 순간(맥박)에 곡괭이를 내리칩니다.
//   좌표: 바위 면 0~1 (가운데 0.5, 0.5).  약점은 맥박(pulse)에 맞춰 밝아졌다 어두워지고, 희귀·특수 광석에서는 균열을 따라 움직입니다.
//   등급: perfect(약점 한가운데 + 가장 밝을 때) / good / weak(약점은 맞췄지만 어설픔) / miss(바위만 맞힘). 모든 스윙은 1회 소모입니다.
import { createRng } from './rng.js?v=mg4';

export const DAMAGE = {
  common:  { perfect:42, good:30, weak:14, miss:4 },
  rare:    { perfect:46, good:26, weak:7,  miss:3 },
  special: { perfect:42, good:24, weak:6,  miss:0 },
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class MineSession {
  // bonus.extraSwings: 곡괭이 장비가 주는 추가 곡괭이질(goods.js 의 equipmentBonus)
  constructor(ore, rng = createRng(), bonus = {}) {
    const extra = Math.max(0, Math.floor(bonus.extraSwings || 0));
    this.ore = ore; this.cfg = ore.mine; this.rng = rng; this.t = 0; this.swings = this.cfg.swings + extra; this.swingsMax = this.cfg.swings + extra;
    this.hp = this.cfg.hp; this.node = 0; this.over = null; this.stats = { perfect:0, good:0, weak:0, miss:0 }; this.hits = [];
    this.pulsePeriod = this.cfg.weak.pulse; this.dmg = DAMAGE[ore.tier];
    // 약점 후보 위치(균열)
    this.nodes = [];
    for (let i = 0; i < this.cfg.nodes; i++) {
      const ang = rng.range(0, Math.PI * 2) + i * (Math.PI * 2 / this.cfg.nodes), rad = this.cfg.weak.moves ? rng.range(.08, .24) : rng.range(.17, .27);   // 가만히 있는 약점도 한가운데는 아니라서, 가운데만 두드려서는 깨지지 않습니다
      
      const cx = .5 + Math.cos(ang) * rad, cy = .5 + Math.sin(ang) * rad * .85;
      const dir = rng.range(0, Math.PI), len = this.cfg.weak.moves ? (ore.tier === 'special' ? .2 : .17) : 0;
      this.nodes.push({ ax:cx - Math.cos(dir) * len / 2, ay:cy - Math.sin(dir) * len / 2, bx:cx + Math.cos(dir) * len / 2, by:cy + Math.sin(dir) * len / 2, phase:rng.range(0, 6.28), cx, cy });
    }
  }
  get speed() { return this.ore.tier === 'special' ? 1.5 : .95; }
  weak(t = this.t) {
    const n = this.nodes[Math.min(this.node, this.nodes.length - 1)];
    const u = this.cfg.weak.moves ? .5 + .5 * Math.sin(t * this.speed + n.phase) : .5;
    return { x:n.ax + (n.bx - n.ax) * u, y:n.ay + (n.by - n.ay) * u, r:this.cfg.weak.r };
  }
  // 맥박 밝기 0~1 (t=0 에서 최대)
  pulse(t = this.t) { const p = .5 + .5 * Math.cos((t / this.pulsePeriod) * Math.PI * 2); return Math.pow(p, 1.5); }
  step(dt) { if (!this.over) this.t += dt; }
  strike(x, y) {
    if (this.over) return null;
    const w = this.weak(), d = Math.hypot(x - w.x, y - w.y), acc = clamp(1 - d / w.r, 0, 1), tau = this.pulse();
    let grade;
    if (d > w.r * 1.3) grade = 'miss';
    else { const q = acc * .6 + tau * .4; grade = (q >= .84 && acc >= .55 && tau >= .72) ? 'perfect' : q >= .56 && acc > .12 ? 'good' : 'weak'; }
    this.swings--; this.stats[grade]++;
    const dmg = this.dmg[grade]; this.hp = Math.max(0, this.hp - dmg);
    const advanced = (grade === 'perfect' || grade === 'good') && this.cfg.nodes > 1 && this.node < this.nodes.length - 1;
    if (advanced) this.node++;
    const hit = { grade, dmg, acc, tau, x, y, w, advanced }; this.hits.push(hit);
    if (this.hp <= 0) this.over = 'cracked'; else if (this.swings <= 0) this.over = 'out';
    return hit;
  }
  // 얻는 광석 수: 깨뜨리면 기본 + 정확한 타격이 많으면 보너스
  yieldCount() {
    if (this.over !== 'cracked') return 0;
    const [lo, hi] = this.cfg.yield; return clamp(lo + (this.stats.perfect >= 2 && hi > lo ? 1 : 0) + (this.stats.perfect >= 3 && hi - lo > 1 ? 1 : 0) + (this.swings >= 3 && hi - lo > 1 ? 0 : 0), lo, hi);
  }
}
