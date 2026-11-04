// 낚시 난이도 시뮬레이션: 여러 '플레이어 유형'(봇)이 모든 물고기를 N번씩 낚아 보고 성공률을 냅니다.
// 사용: node scripts/fishing-sim.mjs [횟수]
import { FISH } from '../js/game/items.js';
import { Fight } from '../js/game/fishing-engine.js';
import { createRng } from '../js/game/rng.js';

export function makeBot(kind, rng) {
  const bot = { kind, seen: [] };
  const base = { expert:.2, skilled:.28, average:.38, slow:.55 }[kind] ?? .3;
  const lapse = { expert:.02, skilled:.05, average:.12, slow:.2 }[kind] ?? .05;   // 신호를 놓치는 확률(집중이 흐트러짐)
  const steerSkill = { expert:1, skilled:.95, average:.8, slow:.55 }[kind] ?? .9;
  let mash = 0, mashT = 0, delay = base, lastPhase = '', ignore = false;
  bot.decide = (fight, dt) => {
    bot.seen.push({ phase: fight.phase, x: fight.x, T: fight.tension, t: fight.t });
    if (bot.seen.length > 160) bot.seen.shift();
    if (kind === 'hold') return { reel: true, lean: 0 };
    if (kind === 'mash') { mashT -= dt; if (mashT <= 0) { mash = rng() < .6 ? 1 : 0; mashT = rng.range(.08, .25); } return { reel: !!mash, lean: 0 }; }
    if (fight.phase !== lastPhase) { lastPhase = fight.phase; delay = base * rng.range(.6, 1.9); ignore = fight.phase === 'telegraph' && rng() < lapse; }
    const past = bot.seen.find(s => s.t >= fight.t - delay) || bot.seen[0];
    let reel = true;
    if ((past.phase === 'telegraph' && !ignore) || past.phase === 'dash') reel = false;
    if (past.T > .88) reel = false;                // 장력 표시를 보고 너무 높으면 놓음
    if (past.phase === 'tired') reel = true;
    let lean = 0;
    if (Math.abs(past.x) > .4 && rng() < steerSkill) lean = past.x > 0 ? -1 : 1;
    return { reel, lean };
  };
  return bot;
}
export function runFight(fish, kind, seed, maxT = 90) {
  const rng = createRng(seed), fight = new Fight(fish, rng), bot = makeBot(kind, createRng(seed ^ 0x9e3779b9));
  const dt = 1 / 60;
  while (!fight.over && fight.t < maxT) fight.step(dt, bot.decide(fight, dt));
  return { result: fight.over || 'timeout', t: fight.t, reason: fight.reason };
}
if (process.argv[1]?.endsWith('fishing-sim.mjs')) {
  const N = Number(process.argv[2]) || 300;
  const kinds = ['hold', 'mash', 'slow', 'average', 'skilled', 'expert'];
  console.log('성공률(%)  — 물고기 × 플레이어 유형, 평균 소요시간(초)');
  console.log('물고기'.padEnd(14), ...kinds.map(k => k.padStart(9)), '   avg.t(skilled)');
  for (const fish of Object.values(FISH)) {
    const row = [];
    let tsum = 0, tcount = 0;
    for (const kind of kinds) {
      let win = 0; const causes = {};
      for (let i = 0; i < N; i++) { const r = runFight(fish, kind, 1000 + i); if (r.result === 'caught') { win++; if (kind === 'skilled') { tsum += r.t; tcount++; } } else causes[r.result] = (causes[r.result] || 0) + 1; }
      row.push((100 * win / N).toFixed(0).padStart(9));
    }
    console.log((fish.tier[0] + ' ' + fish.name).padEnd(14), ...row, '   ' + (tcount ? (tsum / tcount).toFixed(1) : '-'));
  }
}
