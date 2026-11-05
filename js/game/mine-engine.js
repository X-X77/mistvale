// 광산 엔진(순수 계산). 광산 안의 광맥 배치, 광맥 종류, 캔 뒤의 소진·재등장 규칙을 맡습니다.
// 채광 미니게임 규칙은 mining-engine.js 가 그대로 담당하고, 여기서는 "어느 광맥을 골랐는지"만 정합니다.
//
//   광맥 종류(세 가지뿐):
//     일반 광맥   → 이끼 구리석   (기존 채광 「일반」 난이도)
//     단단한 광맥 → 은빛 안개석   (기존 채광 「희귀」 난이도: 약점이 작고 움직임)
//     희귀 광맥   → 달방울 수정   (기존 채광 「특수」 난이도: 아주 작고 빠른 약점 3곳)
//   성공해서 광석을 캐면 그 광맥은 한동안 비어 있다가(소진) 다시 나타납니다. 실패하면 광맥은 그대로입니다.

export const VEIN_TYPES = {
  common: { id:'common', label:'일반 광맥',   ore:'moss-copper',       stars:1, respawn:90,  hint:'넓은 약점이 가만히 있어요' },
  hard:   { id:'hard',   label:'단단한 광맥', ore:'silver-mist-stone', stars:2, respawn:240, hint:'작은 약점이 움직여요' },
  rare:   { id:'rare',   label:'희귀 광맥',   ore:'moondrop-crystal',  stars:3, respawn:480, hint:'아주 작고 빠른 약점 3곳' },
};

/* 광산 배경 그림(762×506) 위의 위치(0~1). depth: 0 가까움 ~ 1 멀리(작고 어둡게 그립니다) */
export const VEINS = [
  { id:'c1', type:'common', u:.27, v:.74, depth:0,  seed:3 },
  { id:'c2', type:'common', u:.50, v:.80, depth:0,  seed:7 },
  { id:'c3', type:'common', u:.73, v:.73, depth:0,  seed:11 },
  { id:'h1', type:'hard',   u:.36, v:.46, depth:.5, seed:5 },
  { id:'h2', type:'hard',   u:.64, v:.44, depth:.5, seed:9 },
  { id:'r1', type:'rare',   u:.50, v:.27, depth:1,  seed:13 },
];

export const MINE_KEY = 'mistvale.mine.v1';
const MAX_COOLDOWN = Math.max(...Object.values(VEIN_TYPES).map(t => t.respawn)) * 1000;

/* 소진 상태: 광맥마다 "다시 나타나는 시각"(ms)을 저장합니다. 저장소를 못 쓰면 메모리로만 동작합니다. */
export class MineState {
  constructor(storage = null, now = () => Date.now()) {
    this.storage = storage; this.now = now; this.until = {};
    try { const raw = JSON.parse(storage?.getItem(MINE_KEY) || 'null'); if (raw && raw.v === 1 && raw.until && typeof raw.until === 'object') this.#load(raw.until); } catch { /* 손상된 저장값은 무시 */ }
  }
  #load(until) { const t = this.now(); for (const vein of VEINS) { const v = Number(until[vein.id]); if (Number.isFinite(v) && v > t) this.until[vein.id] = Math.min(v, t + MAX_COOLDOWN); } }   // 시계를 앞당겨 둔 값은 최대 대기 시간으로 자릅니다
  #save() { try { this.storage?.setItem(MINE_KEY, JSON.stringify({ v:1, until:this.until })); return true; } catch { return false; } }
  /** 남은 초(올림). 0 이면 캘 수 있음 */
  remaining(id) { const u = this.until[id]; if (!u) return 0; const left = u - this.now(); if (left <= 0) { delete this.until[id]; return 0; } return Math.ceil(left / 1000); }
  ready(id) { return this.remaining(id) === 0; }
  /** 성공적으로 캔 광맥을 비웁니다 */
  deplete(id) { const vein = VEINS.find(v => v.id === id); if (!vein) return false; this.until[id] = this.now() + VEIN_TYPES[vein.type].respawn * 1000; this.#save(); return true; }
  /** 시간이 지나 다시 나타난 광맥 목록(알림용). 한 번 알려 주면 비워 둡니다 */
  collectRespawned(previous) { return VEINS.filter(v => previous.has(v.id) && this.ready(v.id)).map(v => v.id); }
  get depleted() { return VEINS.filter(v => !this.ready(v.id)).map(v => v.id); }
}

export const veinInfo = id => { const vein = VEINS.find(v => v.id === id); return vein ? { ...vein, ...VEIN_TYPES[vein.type] } : null; };
export const fmtTime = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
