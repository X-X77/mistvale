// 낚시 엔진 (화면과 무관한 순수 계산). 화면은 fishing-ui.js, 난이도 검증은 tests/fishing.test.js 가 이 파일을 그대로 씁니다.
//
// ① 입질(BiteSession): 던진 위치(깊이)에 따라 걸리는 물고기가 달라집니다. 가짜 입질(작게 까딱)에는 챔질하지 않고,
//    진짜 입질(찌가 푹 잠김)이 오면 제한 시간 안에 챔질합니다. 일찍 당기면 놀라 달아나고, 늦으면 놓칩니다.
// ② 힘겨루기(Fight): 줄 장력 T, 물고기 체력, 거리, 좌우 위치를 함께 다룹니다.
//    - 감기(reel)를 누르고 있으면 거리가 줄지만 장력이 오릅니다. 물고기의 힘이 클수록 더 높이 오릅니다.
//    - 장력이 위험선(0.92)을 넘은 채 오래 있으면 줄이 끊어집니다(strain).
//    - 놓으면 장력은 내려가지만 물고기가 멀어지고, 너무 오래 풀어 두면 바늘이 빠집니다(loose).
//    - 모든 '돌진'은 신호(telegraph)가 먼저 나옵니다. 장력이 갑자기 터지는 일은 없습니다.
//    - 좌우(lean)로 물고기를 중앙에 붙잡아 두어야 합니다. 갈대·바위 쪽으로 몰리면 줄이 쓸려 장력이 오르고 물고기가 힘을 되찾습니다.
import { createRng } from './rng.js?v=px2';

export const TUNING = {
  dangerT: .92, snapStrain: .2, strainRecover: .6,
  reelTarget: .30, reelPerForce: .75, releaseTargetPerForce: .10,
  reelRate: 2.4, reelRateBoost: 2.2, releaseRate: 4,
  reelSpeed: 1.05, reelSlowdown: .8,             // m/s, 물고기 힘에 따라 느려지는 정도
  pullAway: [.16, .55],                          // 놓았을 때 물고기가 멀어지는 속도 = a + b*힘 (m/s)
  pullAwayWhileReeling: .35,                     // 감는 중에는 이 비율만큼만 멀어집니다
  looseLimit: 2.2, escapeFactor: 1.4,
  sweetLow: .45, sweetHigh: .88, sweetDrain: .06, dashDrain: .05, restRegen: .025, tiredAt: .22,
  momentumUp: .55, momentumDown: .25, hazardAt: .82, hazardTension: .3, steer: 1.6, leanDecay: 3.5, fishLateralDrift: .9,
};

/* ---------- 입질 ---------- */
export class BiteSession {
  // depth: 0(가까움)~1(멀리). fishPool: 이 장소의 FISH 정의 목록(일반→특수 순).
  constructor(fishPool, depth, rng = createRng()) {
    this.rng = rng; this.depth = depth;
    this.fish = BiteSession.pickFish(fishPool, depth, rng);
    const bite = this.fish.bite;
    this.t = 0; this.state = 'waiting'; this.result = null;
    this.nibbles = []; // 가짜 입질 시각들
    const wait = rng.range(bite.wait[0], bite.wait[1]) * (.8 + depth * .5);
    this.biteAt = wait;
    const n = rng.int(bite.nibbles[0], bite.nibbles[1]);
    for (let i = 0; i < n; i++) this.nibbles.push(wait * (.2 + .7 * (i + rng()) / Math.max(1, n)));
    this.nibbles.sort((a, b) => a - b);
    this.window = bite.window; this.lastNibble = -9; this.nibbleCount = 0;
  }
  static weights(depth) {
    // [일반1, 일반2, 희귀, 특수] — 깊을수록 희귀·특수 비중이 커집니다.
    const d = Math.max(0, Math.min(1, depth));
    return [1.2 - .8 * d, 1.1 - .7 * d, .05 + .55 * d * d + .15 * d, d < .62 ? 0 : (d - .62) * 1.15];
  }
  static pickFish(pool, depth, rng) {
    const w = BiteSession.weights(depth), total = w.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    for (let i = 0; i < pool.length; i++) { roll -= w[i]; if (roll <= 0) return pool[i]; }
    return pool[0];
  }
  // 반환: 이번 프레임에 생긴 이벤트 ['nibble'|'bite'|'missed']
  step(dt) {
    const events = [];
    if (this.state === 'done') return events;
    this.t += dt;
    if (this.state === 'waiting') {
      while (this.nibbles.length && this.t >= this.nibbles[0]) { this.nibbles.shift(); this.lastNibble = this.t; this.nibbleCount++; events.push('nibble'); }
      if (this.t >= this.biteAt) { this.state = 'bite'; this.biteStart = this.t; events.push('bite'); }
    } else if (this.state === 'bite' && this.t - this.biteStart > this.window) {
      this.state = 'done'; this.result = 'missed'; events.push('missed');
    }
    return events;
  }
  // 플레이어가 챔질(누름). 반환: 'hooked' | 'early'
  hook() {
    if (this.state === 'bite') { this.state = 'done'; this.result = 'hooked'; this.reaction = this.t - this.biteStart; return 'hooked'; }
    if (this.state === 'waiting') {
      // 가짜 입질 직후(0.35초 안)에 반응해 당기면 '너무 일찍'
      this.state = 'done'; this.result = 'early'; return 'early';
    }
    return null;
  }
}

/* ---------- 힘겨루기 ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export class Fight {
  constructor(fish, rng = createRng(), tuning = TUNING) {
    this.fish = fish; this.f = fish.fight; this.rng = rng; this.k = tuning;
    this.dist0 = this.f.dist; this.dist = this.f.dist * .9; // 챔질 직후엔 살짝 끌려와 있습니다
    this.stamina = this.f.stamina; this.tension = .25; this.strain = 0; this.loose = 0;
    this.x = rng.range(-.2, .2); this.vx = 0; this.lean = 0;
    this.phase = 'swim'; this.timer = rng.range(1.2, 2.2); this.dashDir = 1; this.dashForce = 0; this.chainLeft = 0;
    this.sinceDash = 0; this.nextDashIn = rng.range(this.f.dashEvery[0], this.f.dashEvery[1]) + 1.2;
    this.reeling = false; this.momentum = 0; this.over = null; this.reason = ''; this.t = 0;
    this.time = { reeling: 0 }; this.tele = 0;           // tele: 신호 진행도(0~1), UI 연출용
    this.lastCause = ''; this.events = [];
    this.history = []; // 마지막 몇 초의 장력 기록(실패 설명용)
  }
  get force() {
    const f = this.f, s = clamp(this.stamina, 0, 1);
    if (this.phase === 'dash') return this.dashForce * (.65 + .35 * Math.min(1, s * 1.4));
    if (this.phase === 'telegraph') return f.cruise * .8;
    if (this.phase === 'rest') return f.restForce;
    if (this.phase === 'tired') return .12;
    return f.cruise * (.6 + .4 * s);
  }
  get tired() { return this.phase === 'tired'; }
  #setPhase(phase, duration) { this.phase = phase; this.timer = duration; this.events.push('phase:' + phase); }
  #nextBehavior() {
    const f = this.f, rng = this.rng;
    if (this.stamina < this.k.tiredAt) { this.#setPhase('tired', 99); return; }
    // 연속 돌진(chain): 방향을 바꿔 한 번 더. 신호는 더 짧습니다.
    if (this.chainLeft > 0) { this.chainLeft--; this.dashDir *= -1; this.#startTelegraph(.78); return; }
    if (this.phase === 'dash' || this.phase === 'telegraph') { this.#setPhase('rest', rng.range(f.rest[0], f.rest[1])); return; }
    if (this.phase === 'rest') { this.#setPhase('swim', rng.range(f.swim[0], f.swim[1])); this.nextDashIn = Math.max(.4, this.nextDashIn - this.timer * .4); return; }
    // swim 이 끝났으면: 돌진 시기가 되었으면 신호, 아니면 쉬거나 계속 헤엄
    if (this.sinceDash >= this.nextDashIn) { this.dashDir = rng.chance(.5) ? 1 : -1; if (Math.abs(this.x) > .45) this.dashDir = this.x > 0 ? -1 : 1; this.#startTelegraph(1); return; }
    if (rng.chance(f.restP)) this.#setPhase('rest', rng.range(f.rest[0], f.rest[1]));
    else this.#setPhase('swim', rng.range(f.swim[0], f.swim[1]));
  }
  #startTelegraph(scale) {
    const f = this.f, d = this.rng.range(f.tele[0], f.tele[1]) * scale;
    // 지친 척(sulk) 물고기는 쉬는 동안 신호가 짧아집니다.
    this.#setPhase('telegraph', d); this.teleLen = d;
    this.dashForce = this.rng.range(f.dashForce[0], f.dashForce[1]);
    this.chainPlanned = false;
  }
  step(dt, input = {}) {
    if (this.over) return;
    const k = this.k, f = this.f; this.t += dt; this.events.length = 0;
    this.reeling = !!input.reel; this.lean = clamp(input.lean || 0, -1, 1);
    if (this.reeling) this.time.reeling += dt;
    // 감기 가속: 꾹 눌러야 속도가 붙습니다(짧게 연타하면 거의 감기지 않음).
    this.momentum = this.reeling ? Math.min(1, this.momentum + dt / k.momentumUp) : Math.max(0, this.momentum - dt / k.momentumDown);

    // --- 물고기 행동 ---
    this.timer -= dt; this.sinceDash += dt;
    if (this.phase === 'telegraph') this.tele = clamp(1 - this.timer / this.teleLen, 0, 1); else this.tele = 0;
    if (this.timer <= 0) {
      if (this.phase === 'telegraph') {
        this.#setPhase('dash', this.rng.range(f.dash[0], f.dash[1]));
        this.sinceDash = 0; this.nextDashIn = this.rng.range(f.dashEvery[0], f.dashEvery[1]) * (f.sulk && this.rng.chance(.5) ? 1.5 : 1);
        this.chainLeft = this.rng.chance(f.chain) ? 1 : 0;
      } else this.#nextBehavior();
    }
    if (this.phase !== 'tired' && this.stamina < k.tiredAt && this.phase !== 'dash' && this.phase !== 'telegraph') this.#setPhase('tired', 99);

    const force = this.force;
    // --- 좌우 위치 ---
    let push = 0;
    if (this.phase === 'dash') push = this.dashDir * 1.25 * f.lateral * force;
    else if (this.phase === 'telegraph') push = this.dashDir * .15 * f.lateral;
    else if (this.phase === 'swim') push = Math.sin(this.t * 1.3 + (this.fish.id.length)) * .28 * f.lateral;
    this.vx += (push + this.lean * k.steer * (this.reeling ? 1 : .55) - this.vx * 2.6) * dt * 2.2;
    this.x = clamp(this.x + this.vx * dt, -1.05, 1.05);
    const hazard = Math.abs(this.x) > k.hazardAt;

    // --- 장력 ---
    const releasedTarget = k.releaseTargetPerForce * force;
    const reelTarget = k.reelTarget + k.reelPerForce * force + (hazard ? k.hazardTension : 0);
    const target = this.reeling ? reelTarget : releasedTarget;
    const rate = this.reeling ? k.reelRate + k.reelRateBoost * Math.max(0, force - .6) : k.releaseRate;
    this.tension += (target - this.tension) * Math.min(1, rate * dt);
    if (this.tension > k.dangerT) this.strain += dt * (1 + (this.tension - k.dangerT) * 3); else this.strain = Math.max(0, this.strain - dt * k.strainRecover);
    if (!this.reeling && this.tension < .08) this.loose += dt; else this.loose = Math.max(0, this.loose - dt * 2);

    // --- 거리 ---
    const fc = Math.min(1, force);
    if (this.reeling) this.dist -= k.reelSpeed * (.15 + .85 * this.momentum) * (1 - k.reelSlowdown * fc) * dt;
    const away = (k.pullAway[0] * (this.phase === 'rest' || this.phase === 'tired' ? .4 : 1) + k.pullAway[1] * Math.min(1.2, force));
    this.dist += away * (this.reeling ? k.pullAwayWhileReeling : 1) * dt * (this.phase === 'rest' && !this.reeling ? .5 : 1);
    if (hazard) this.dist += .25 * dt;

    // --- 체력 ---
    let drain = 0;
    if (this.phase === 'dash') drain += k.dashDrain;
    if (this.reeling && this.tension > k.sweetLow && this.tension < k.sweetHigh) drain += k.sweetDrain * this.tension;
    let regen = 0;
    if ((this.phase === 'rest' || this.phase === 'swim') && !this.reeling && this.tension < .25) regen = k.restRegen;
    if (hazard) regen += .03;
    if (this.phase !== 'tired') this.stamina = clamp(this.stamina + (regen - drain) * dt, 0, f.stamina);
    else this.stamina = Math.min(f.stamina, this.stamina + (hazard ? .03 : 0) * dt);
    if (this.phase === 'tired' && this.stamina > .5) this.#setPhase('swim', 1.2); // 힘을 되찾음(갈대에 몰렸을 때)

    this.history.push({ t:this.t, T:this.tension, phase:this.phase, reeling:this.reeling });
    if (this.history.length > 240) this.history.shift();

    // --- 결과 ---
    if (this.strain >= k.snapStrain) return this.#finish('snap', this.#snapReason());
    if (this.loose >= k.looseLimit) return this.#finish('loose', '줄을 너무 오래 풀어 두어 바늘이 빠졌습니다. 돌진이 끝나면 다시 감아야 합니다.');
    if (this.dist > this.dist0 * k.escapeFactor) return this.#finish('escaped', '물고기가 줄을 끌고 멀리 달아났습니다. 쉬는 틈에 거리를 좁혀 두어야 합니다.');
    if (this.dist <= 0) return this.#finish('caught', '');
  }
  #snapReason() {
    const hz = Math.abs(this.x) > this.k.hazardAt;
    if (hz) return '물고기가 갈대·바위 쪽으로 쓸려 가 줄이 쓸려 끊어졌습니다. 좌우로 방향을 잡아 중앙으로 되돌려야 합니다.';
    if (this.phase === 'dash' || this.phase === 'telegraph') return '돌진하는 동안 계속 감아서 줄이 끊어졌습니다. 신호(물보라)가 보이면 놓아 장력을 낮추세요.';
    return '장력이 위험선 위에 너무 오래 머물러 줄이 끊어졌습니다. 붉은 눈금이 보이면 잠깐 놓으세요.';
  }
  #finish(result, reason) { this.over = result; this.reason = reason; this.events.push('over:' + result); }
}

/* ---------- 결과 크기 ---------- */
export function rollSize(fish, rng = createRng()) {
  const [lo, hi] = fish.size; const r = (rng() + rng()) / 2; // 가운데가 흔하도록
  return Math.round(lo + (hi - lo) * r);
}
