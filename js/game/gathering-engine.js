// 채집 엔진 (화면과 무관한 순수 계산). 화면은 gathering-ui.js, 규칙 검증은 tests/gathering.test.js 가 이 파일을 그대로 씁니다.
//
// 작은 숲 한 구역(가로 4/3 × 세로 1)에 풀숲·덤불·통나무·바위·낙엽 더미 같은 '숨을 곳'이 깔리고, 재료는 그중 일부 아래에 숨어 있습니다.
//   - 재료마다 숨는 곳이 정해져 있습니다(허브=높은 풀·낙엽, 버섯=통나무·바위·낙엽, 베리=덤불·낙엽). 환경을 보고 짐작할 수 있습니다.
//   - 재료가 숨은 곳에는 단서(허브=초록 반짝임, 버섯=보랏빛 포자, 베리=붉은 반짝임과 나비)가 떠오릅니다.
//     구역이 어려울수록 단서가 가까이 가야 / 잠시 지켜봐야만 또렷해집니다.
//   - 들췄는데 아무것도 없으면 '헛손질'. 헛손질을 다 쓰면 손이 지쳐 거기서 끝납니다. 무작정 다 눌러 보는 방식은 통하지 않습니다.
//   - 들춰서 나온 재료는 직접 눌러 담습니다. 반짝이는 희귀 재료는 손을 떼지 않고 '살금살금' 담아야 합니다(손이 흔들리면 달아납니다).
//   - 배치는 템플릿(4가지) × 난수로 매번 달라집니다.
import { createRng } from './rng.js?v=mine1';

export const FIELD = { w:4 / 3, h:1 };
export const SPOT_KINDS = ['tallgrass', 'bush', 'log', 'rock', 'leaves'];
export const SPOT_NAMES = { tallgrass:'높은 풀', bush:'덤불', log:'쓰러진 통나무', rock:'바위', leaves:'낙엽 더미' };
export const HIDES = { herb:['tallgrass', 'leaves'], mushroom:['log', 'rock', 'leaves'], berry:['bush', 'leaves'] };
export const CLUE_NAMES = { herb:'초록 반짝임', mushroom:'보랏빛 포자', berry:'붉은 반짝임·나비' };

/* 구역(난이도) */
export const ZONES = {
  meadow:  { id:'meadow',  name:'양지바른 풀밭', grade:1, label:'쉬움',   desc:'재료가 비교적 눈에 잘 띄어요. 단서가 늘 보이고 가려진 곳도 살짝 비쳐요.',
    targets:[4, 5], spots:[16, 19], misses:6, gold:.12, yield:1, goldYield:3, peek:.55, clue:'always', color:'#8fcf6a' },
  thicket: { id:'thicket', name:'덤불 우거진 숲길', grade:2, label:'보통',  desc:'일부가 풀과 덤불에 가려져 있어요. 단서는 가까이 가야 보여요.',
    targets:[5, 6], spots:[22, 25], misses:5, gold:.2, yield:1, goldYield:3, peek:.2, clue:'near', clueR:.24, color:'#5fa35a' },
  mist:    { id:'mist',    name:'안개 낀 깊은 숲', grade:3, label:'어려움', desc:'안개 속에서 주변 환경과 같은 빛깔로 숨어 있어요. 렌즈로 비춰 보고 잠시 지켜봐야 해요.',
    targets:[6, 7], spots:[28, 32], misses:4, gold:.28, yield:2, goldYield:4, peek:0, clue:'still', faintR:.2, stillR:.1, dwell:.55, color:'#4a7a78' },
};
export const GOLD_DWELL = .4;                                     // 반짝이는 희귀 재료의 단서는 어느 구역이든 잠시 지켜봐야 보입니다
export const HOLD = { need:.9, calm:.4, shakyLimit:.7 };          // 희귀 재료 담기: 필요한 시간(초), 손이 흔들린다고 보는 속도(필드/초), 허용되는 흔들림 누적 시간

/* 배치 템플릿: blocked = 아무것도 놓지 않는 곳(개울·오솔길·빈터), weight = 종류별 놓이기 쉬운 정도.
   (u = 가로 위치를 0~1 로 나타낸 값, a = 필드 가로 길이(화면 비율에 따라 1.0~1.4), y = 세로 0~1) */
export const TEMPLATES = {
  clearing: { id:'clearing', name:'숲속 빈터', blocked:(u, y, a) => Math.hypot((u - .5) * a, y - .52) < .12, weight:(k) => k === 'leaves' ? 1.4 : 1 },
  trail:    { id:'trail',    name:'오솔길',   blocked:(u, y, a) => Math.abs((y - .5) - (u - .5) * a * .55) < .06, weight:(k) => k === 'tallgrass' ? 1.5 : k === 'rock' ? .7 : 1 },
  grove:    { id:'grove',    name:'고목 숲',   blocked:() => false, weight:(k, u) => k === 'log' ? (u < .42 ? 2.4 : .6) : k === 'bush' ? (u > .6 ? 2 : .8) : 1 },
  stream:   { id:'stream',   name:'개울가',   blocked:(u, y, a) => Math.abs((u - .5) * a - Math.sin(y * 5) * .06) < .075, weight:(k) => k === 'rock' ? 1.8 : k === 'tallgrass' ? 1.3 : k === 'log' ? .7 : 1 },
};
export const ASPECT = { min:1, max:1.4 };
const KIND_R = { tallgrass:.06, bush:.075, log:.07, rock:.06, leaves:.06 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- 필드 만들기 ---------- */
export function generateField(zoneId, rng = createRng(), templateId = null, aspect = FIELD.w) {
  const zone = ZONES[zoneId]; if (!zone) throw new Error('unknown zone ' + zoneId);
  const template = TEMPLATES[templateId] || TEMPLATES[rng.pick(Object.keys(TEMPLATES))];
  aspect = clamp(aspect, ASPECT.min, ASPECT.max);
  const nSpots = rng.int(zone.spots[0], zone.spots[1]), spots = [];
  let gap = .02, rs = 1, tries = 0;
  while (spots.length < nSpots && tries < 9000) {
    tries++; if (tries % 1500 === 0) { gap = Math.max(0, gap - .01); rs = Math.max(.8, rs - .06); }   // 자리가 모자라면 간격과 크기를 조금씩 줄입니다
    const x = rng.range(.09, aspect - .09), y = rng.range(.14, .9), u = x / aspect;
    if (template.blocked(u, y, aspect)) continue;
    const w = SPOT_KINDS.map(k => template.weight(k, u, y)), total = w.reduce((a, b) => a + b, 0); let roll = rng() * total, kind = SPOT_KINDS[0];
    for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll <= 0) { kind = SPOT_KINDS[i]; break; } }
    const r = KIND_R[kind] * rs * rng.range(.92, 1.08);
    if (spots.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + gap)) continue;
    spots.push({ id:spots.length, kind, x, y, r, phase:rng.range(0, 6.28), hides:null, state:'closed' });
  }
  // 재료 숨기기
  const n = Math.min(rng.int(zone.targets[0], zone.targets[1]), spots.length), items = [];
  const base = ['herb', 'mushroom', 'berry']; for (let i = 0; i < n; i++) items.push(i < 3 ? base[i] : rng.pick(base));
  for (let i = items.length - 1; i > 0; i--) { const j = rng.int(0, i); [items[i], items[j]] = [items[j], items[i]]; }
  let goldCount = 0;
  for (const item of items) {
    const free = spots.filter(s => !s.hides), fit = free.filter(s => HIDES[item].includes(s.kind));
    let spot = fit.length ? rng.pick(fit) : null;
    if (!spot) { spot = rng.pick(free); spot.kind = HIDES[item][0]; spot.r = KIND_R[spot.kind]; }   // 맞는 곳이 없으면 가까운 자리를 그 종류로 바꿉니다
    const special = goldCount < Math.ceil(n / 3) && rng.chance(zone.gold); if (special) goldCount++;
    spot.hides = { item, special, amount:special ? zone.goldYield : zone.yield, collected:false, lost:false };
  }
  return { zone, template, spots, aspect };
}

/* ---------- 단서가 얼마나 보이는지 (0 없음 / 1 어렴풋 / 2 또렷) ---------- */
export function clueLevel(zone, spot, { d = Infinity, dwell = 0 } = {}) {
  if (!spot.hides || spot.hides.collected || spot.hides.lost) return 0;
  const gold = spot.hides.special;
  if (gold) return d <= (zone.clue === 'always' ? .14 : zone.stillR || .12) && dwell >= GOLD_DWELL ? 2 : d <= .2 ? 1 : 0;   // 희귀 재료는 항상 지켜봐야 합니다
  if (zone.clue === 'always') return 2;
  if (zone.clue === 'near') return d <= zone.clueR ? 2 : 0;
  return d <= zone.stillR && dwell >= zone.dwell ? 2 : d <= zone.faintR ? 1 : 0;
}

/* ---------- 한 판 ---------- */
export class GatherSession {
  constructor(zoneId, rng = createRng(), templateId = null, aspect = FIELD.w) {
    this.rng = rng; this.field = generateField(zoneId, rng, templateId, aspect); this.zone = this.field.zone; this.spots = this.field.spots;
    this.missesMax = this.zone.misses; this.misses = this.missesMax; this.basket = { herb:0, mushroom:0, berry:0 }; this.over = null; this.t = 0;
    this.targets = this.spots.filter(s => s.hides).length; this.hold = null; this.stats = { found:0, gold:0, lost:0, empty:0 };
  }
  step(dt) { if (!this.over) this.t += dt; }
  spotAt(id) { return this.spots[id] || null; }
  /** 숨을 곳 하나를 들춥니다. 반환: {kind:'found'|'empty'|'again'|'over', spot} */
  open(id) {
    const spot = this.spotAt(id); if (this.over || !spot) return { kind:'over' };
    if (spot.state !== 'closed') return { kind:'again', spot };
    this.settle();   // 들춰 놓고 아직 안 담은 평범한 재료는 알아서 담깁니다
    spot.state = 'open';
    if (spot.hides) { this.stats.found++; return { kind:'found', spot, item:spot.hides.item, special:spot.hides.special }; }
    this.stats.empty++; this.misses--; if (this.misses <= 0) { this.over = 'tired'; this.settle(); }
    return { kind:'empty', spot, tired:this.over === 'tired' };
  }
  #checkDone() { if (!this.over && this.spots.every(s => !s.hides || s.hides.collected || s.hides.lost)) this.over = 'complete'; }
  /** 들춰 낸 평범한 재료를 담습니다 */
  collect(id) {
    const spot = this.spotAt(id), h = spot?.hides; if (!h || spot.state !== 'open' || h.collected || h.lost || h.special) return { ok:false };
    h.collected = true; this.basket[h.item] += h.amount; const out = { ok:true, item:h.item, n:h.amount }; this.#checkDone(); return out;
  }
  /* 희귀 재료: 손을 떼지 않고 천천히 담습니다. speed = 포인터가 움직이는 속도(필드 길이/초) */
  startHold(id) {
    const spot = this.spotAt(id), h = spot?.hides; if (!h || !h.special || spot.state !== 'open' || h.collected || h.lost || this.over) return false;
    this.hold = { id, progress:0, shaky:0 }; return true;
  }
  /** 반환: null | 'done' | 'spooked' */
  holdStep(dt, speed = 0) {
    const hold = this.hold; if (!hold) return null;
    if (speed > HOLD.calm) { hold.shaky += dt; hold.progress = Math.max(0, hold.progress - dt * .6); } else hold.progress += dt / HOLD.need;
    const spot = this.spotAt(hold.id), h = spot.hides;
    if (hold.progress >= 1) { h.collected = true; this.basket[h.item] += h.amount; this.stats.gold++; this.hold = null; this.#checkDone(); return 'done'; }
    if (hold.shaky >= HOLD.shakyLimit) { h.lost = true; this.stats.lost++; this.hold = null; this.#checkDone(); return 'spooked'; }
    return null;
  }
  cancelHold() { if (this.hold) this.hold.progress = 0; this.hold = null; }
  /** 들춰서 드러났지만 아직 담지 않은 평범한 재료를 바구니에 넣습니다(희귀 재료는 직접 담아야 해서 그대로 둡니다) */
  settle() { for (const s of this.spots) if (s.state === 'open' && s.hides && !s.hides.special && !s.hides.collected && !s.hides.lost) this.collect(s.id); }
  /** 바구니를 들고 마칩니다 */
  finish() { this.settle(); if (!this.over) this.over = 'done'; }
  get total() { return Object.values(this.basket).reduce((a, b) => a + b, 0); }
  get remaining() { return this.spots.filter(s => s.hides && !s.hides.collected && !s.hides.lost).length; }
}
