import test from 'node:test';
import assert from 'node:assert/strict';
import { Progress, levelOf, normalizeState, START_COINS } from '../js/game/progress.js';
import { FISH, FISHING_SPOTS, ORES, MINING_SPOTS, RECIPES, GATHER_SPOTS, INGREDIENTS, describeItem, qualityOf, josa } from '../js/game/items.js';
import { places } from '../js/world/place-data.js';
import { BiteSession, Fight, TUNING } from '../js/game/fishing-engine.js';
import { runFight } from '../scripts/fishing-sim.mjs';
import { HeatFlip, DropStep, ChopStep, StirStep, FinishStep, buildSteps, dishScore } from '../js/game/cooking-engine.js';
import { MineSession } from '../js/game/mining-engine.js';
import { createRng } from '../js/game/rng.js';

const memoryStorage = () => { let v = null; return { getItem:() => v, setItem:(_k, x) => { v = x; }, dump:() => v }; };

/* ---------- 진행 상태 ---------- */
test('진행 상태: 시작 소지금은 오프닝의 500G, 아이템 증감·부족 시 소비 거부', () => {
  const p = new Progress(memoryStorage());
  assert.equal(p.state.coins, START_COINS);
  p.add('herb', 2); assert.equal(p.count('herb'), 2);
  assert.equal(p.remove({ herb:3 }), false); assert.equal(p.count('herb'), 2);
  assert.equal(p.remove({ herb:2 }), true); assert.equal(p.count('herb'), 0);
});
test('진행 상태: 저장 후 다시 읽으면 같고, 깨진 값은 안전하게 무시', () => {
  const s = memoryStorage(); const a = new Progress(s); a.add('moss-copper', 3); a.addXp('mining', 40); a.recordCatch('silver-minnow', 12);
  const b = new Progress(s); assert.equal(b.count('moss-copper'), 3); assert.equal(b.skill('mining').level, 2); assert.equal(b.state.caught['silver-minnow'].best, 12);
  const bad = normalizeState({ gold:-5, items:{ x:-1, y:'a', z:2 }, skills:{ fishing:'?' } }); assert.equal(bad.coins, 0); assert.deepEqual(bad.items, { z:2 }); assert.equal(bad.skills.fishing, 0);
});
test('진행 상태: 저장소가 막혀 있어도 메모리로 동작하고 persistent=false 로 알린다', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const p = new Progress(blocked); p.add('herb', 1); assert.equal(p.count('herb'), 1); assert.equal(p.persistent, false);
});
test('숙련도 레벨은 경험치에 따라 오르고 최대 레벨에서 멈춘다', () => {
  assert.equal(levelOf(0).level, 1); assert.equal(levelOf(30).level, 2); assert.ok(levelOf(10000).max);
});

/* ---------- 데이터 정합성 ---------- */
test('물고기·광석·요리 데이터는 장소·재료와 서로 연결되어 있다', () => {
  for (const spot of Object.values(FISHING_SPOTS)) { assert.equal(spot.fish.length, 4); spot.fish.forEach((id, i) => { assert.ok(FISH[id], id); assert.equal(FISH[id].tier, ['common', 'common', 'rare', 'special'][i], id + ' 등급 순서'); }); }
  for (const spot of Object.values(MINING_SPOTS)) spot.ores.forEach(id => assert.ok(ORES[id], id));
  for (const spot of Object.values(GATHER_SPOTS)) spot.picks.forEach(p => assert.ok(INGREDIENTS[p.id]));
  for (const r of Object.values(RECIPES)) { for (const id of Object.keys(r.need)) assert.ok(INGREDIENTS[id], r.id + ' 재료 ' + id); assert.ok(r.steps.length >= 1 && r.steps.length <= 2, r.id + ' 동작 1~2개'); assert.ok(buildSteps(r).length >= 1); }
});
test('활동이 있는 장소(낚시·채광·채집·요리)가 모두 실제 장소로 연결된다', () => {
  assert.deepEqual(places['silver-lake'].activities, ['fishing']); assert.deepEqual(places['blue-coast'].activities, ['fishing']);
  assert.deepEqual(places['wet-cave'].activities, ['mining']); assert.deepEqual(places['whisper-forest'].activities, ['gather']); assert.deepEqual(places.farmhouse.activities, ['cooking']);
  for (const [id, place] of Object.entries(places)) for (const kind of place.activities || []) assert.ok(['fishing', 'cooking', 'mining', 'gather'].includes(kind), id + ' ' + kind);
  for (const id of Object.keys(FISHING_SPOTS)) assert.ok(places[id].activities.includes('fishing'));
  assert.ok(Object.keys(GATHER_SPOTS).every(id => places[id].activities.includes('gather')));
});
test('소지품 id 는 사람이 읽을 이름으로 설명된다(요리 품질 포함)', () => {
  assert.equal(describeItem('dish:forest-mushroom-soup:great').name, '훌륭한 숲 버섯 수프'); assert.equal(describeItem('dish:forest-mushroom-soup:normal').name, '숲 버섯 수프');
  assert.equal(describeItem('dish:burnt').name, '검게 탄 덩어리'); assert.equal(describeItem('moon-carp').kind, 'fish');
  assert.equal(josa('고등어', '은/는'), '는'); assert.equal(josa('송어', '이/가'), '가'); assert.equal(qualityOf(10).id, 'burnt'); assert.equal(qualityOf(90).id, 'great');
});

/* ---------- 낚시 ---------- */
const rate = (fish, kind, n = 120) => { let w = 0; for (let i = 0; i < n; i++) if (runFight(fish, kind, 500 + i).result === 'caught') w++; return w / n; };
test('낚시: 모든 돌진에는 신호가 먼저 있고, 장력은 한 프레임에 폭발하지 않는다', () => {
  for (const fish of Object.values(FISH)) for (let seed = 1; seed <= 12; seed++) {
    const rng = createRng(seed), f = new Fight(fish, rng); let prev = f.phase, teleStart = 0, prevT = f.tension, i = 0;
    while (!f.over && f.t < 60) {
      f.step(1 / 60, { reel:(i++ % 90) < 70, lean:0 });
      if (f.phase !== prev) { if (f.phase === 'telegraph') teleStart = f.t; if (f.phase === 'dash') { assert.equal(prev, 'telegraph', fish.id + ' 신호 없이 돌진'); assert.ok(f.t - teleStart >= .25, fish.id + ' 신호가 너무 짧음 ' + (f.t - teleStart)); } prev = f.phase; }
      const jump = f.tension - prevT; if (f.phase !== 'dash' && Math.abs(f.x) <= TUNING.hazardAt) assert.ok(jump < .06, fish.id + ' 신호 없는 장력 급등 ' + jump + ' (' + f.phase + ')'); assert.ok(jump < .16, fish.id + ' 장력 급등 ' + jump); prevT = f.tension;
    }
  }
});
test('낚시: 일반 물고기도 감기만 하면 안정적으로 잡히지 않는다 (조작 학습 필요)', () => {
  for (const id of ['reed-crucian', 'tide-mackerel', 'reef-bream']) assert.ok(rate(FISH[id], 'hold') < .3, id + ' hold');
  assert.ok(rate(FISH['silver-minnow'], 'hold') < .7);
});
test('낚시: 신호를 보고 놓는 법을 익히면 일반 물고기는 안정적으로 잡힌다', () => {
  for (const id of ['silver-minnow', 'reed-crucian', 'tide-mackerel', 'reef-bream']) assert.ok(rate(FISH[id], 'average') >= .95, id);
});
test('낚시: 희귀·특수는 평균 플레이어에게 어렵고, 숙련자가 확실히 더 잘 잡는다 (등급 간 난이도 차)', () => {
  for (const [rare, special] of [['mist-trout', 'moon-carp'], ['lighthouse-bass', 'fog-anglerfish']]) {
    const avg = [rate(FISH[rare], 'average'), rate(FISH[special], 'average')], skl = [rate(FISH[rare], 'skilled'), rate(FISH[special], 'skilled')], slow = rate(FISH[rare], 'slow');
    assert.ok(avg[0] < .6 && avg[0] > .1, rare + ' 평균 ' + avg[0]); assert.ok(avg[1] < .12, special + ' 평균 ' + avg[1]);
    assert.ok(skl[0] > avg[0] + .3 && skl[1] > avg[1] + .1 && skl[1] < .55, '숙련 차이 ' + skl + ' vs ' + avg); assert.ok(skl[1] < skl[0], '특수가 희귀보다 어려움'); assert.ok(slow < .25, rare + ' 느린 반응 ' + slow);
  }
});
test('낚시: 연타(mash)는 희귀 물고기에 통하지 않는다', () => { for (const id of ['mist-trout', 'lighthouse-bass', 'moon-carp', 'fog-anglerfish']) assert.ok(rate(FISH[id], 'mash') < .05, id); });
test('낚시: 평균 싸움 시간은 등급이 높을수록 길고 너무 길지 않다', () => {
  const avg = fish => { let sum = 0, n = 0; for (let i = 0; i < 60; i++) { const r = runFight(fish, 'skilled', 900 + i); if (r.result === 'caught') { sum += r.t; n++; } } return sum / n; };
  const c = avg(FISH['reed-crucian']), r = avg(FISH['mist-trout']), s = avg(FISH['moon-carp']); assert.ok(c < r && r < s + 5 && s < 55, `${c} ${r} ${s}`); assert.ok(c > 5);
});
test('낚시 입질: 가짜 입질에 챔질하면 놓치고, 진짜 입질 제한 시간 안에는 성공, 지나면 놓친다', () => {
  const mk = () => new BiteSession(Object.values(FISH).slice(0, 4), .2, createRng(7));
  let b = mk(); b.step(.01); assert.equal(b.hook(), 'early');
  b = mk(); let ev; while (!(ev = b.step(.02)).includes('bite')) { /* wait */ } assert.equal(b.hook(), 'hooked');
  b = mk(); while (!(ev = b.step(.02)).includes('bite')) { /* wait */ } for (let i = 0; i < 200 && b.state !== 'done'; i++) b.step(.02); assert.equal(b.result, 'missed');
  for (const depth of [0, .3, .6, .9, 1]) { const w = BiteSession.weights(depth); assert.ok(w.every(x => x >= 0)); }
  assert.equal(BiteSession.weights(.1)[3], 0); assert.ok(BiteSession.weights(.95)[3] > .2);
});

/* ---------- 요리 ---------- */
const dt = 1 / 60;
test('요리: 불을 방치하면 타고(0점), 알맞게 굽고 뒤집으면 만점', () => {
  let s = new HeatFlip(); while (!s.done && s.t < 60) { s.step(dt); if (s.t > 33) s.press(); } assert.equal(s.score, 0);
  s = new HeatFlip(); s.setHeat(.5); while (!s.done) { s.step(dt); if (s.doneness[s.side] >= s.perfectAt) s.press(); } assert.equal(s.score, 100);
  s = new HeatFlip(); s.setHeat(.95); while (!s.done && s.t < 60) { s.step(dt); if (s.doneness[s.side] >= .93) s.press(); } assert.ok(s.score <= 100);
});
test('요리: 재료 넣기·젓기·내리기는 타이밍이 정확할수록 점수가 높다', () => {
  const rng = createRng(3);
  const drop = sd => { const s = new DropStep(3); let target = null; while (!s.done && s.t < 90) { s.step(dt); if (target === null) { const w = s.speed(), ph = s.index * 1.1; let k = Math.ceil((w * s.t + ph) / Math.PI), tc = (k * Math.PI - ph) / w; if (tc <= s.t + .05) tc = ((k + 1) * Math.PI - ph) / w; target = tc + (rng() - .5) * 2 * sd; } if (s.t >= target) { s.press(); target = null; } } return s.score; };
  assert.ok(drop(.02) > 90 && drop(.02) > drop(.35));
  const stir = jit => { const s = new StirStep({ beats:7, period:1.3 }); const q = []; for (let i = 0; i < 7; i++) q.push(s.beatTime(i) + (rng() - .5) * 2 * jit); let qi = 0; while (!s.done && s.t < 40) { s.step(dt); while (qi < q.length && s.t >= q[qi]) { s.press(); qi++; } } return s.score; };
  assert.ok(stir(.03) >= 95 && stir(.03) > stir(.3));
  const idle = new StirStep(); while (!idle.done && idle.t < 60) idle.step(dt); assert.equal(idle.score, 0);
  const fin = t => { const s = new FinishStep(); while (!s.done) { s.step(dt); if (s.t >= t) s.press(); } return s.score; };
  assert.equal(fin(8), 100); assert.ok(fin(2) < 30); const burn = new FinishStep(); while (!burn.done) burn.step(dt); assert.equal(burn.score, 0);
});
test('요리: 썰기는 표시선이 칼 밑에 올 때 눌러야 점수가 높고, 못 누르면 0점이다', () => {
  const rng = createRng(9);
  const chop = jit => { const s = new ChopStep({ items:3 }); const q = s.times.map(t => t + (rng() - .5) * 2 * jit); let qi = 0; while (!s.done && s.t < 40) { s.step(dt); while (qi < q.length && s.t >= q[qi]) { s.press(); qi++; } } return s; };
  const good = chop(.03), sloppy = chop(.4);
  assert.equal(good.cuts, 6); assert.ok(good.score >= 90, '정확하면 높은 점수'); assert.ok(good.score > sloppy.score);
  assert.ok(good.cutAt.every(v => v !== null), '누른 칼질은 눌린 시각이 기록된다');
  const idle = new ChopStep({ items:2 }); while (!idle.done && idle.t < 60) idle.step(dt); assert.equal(idle.score, 0); assert.ok(idle.cutAt.every(v => v === null));
  const early = new ChopStep({ items:1 }); early.press(); assert.equal(early.stray, 1);
});
test('요리: 헛젓기는 감점되고, 점수→품질 등급이 정해진 구간으로 나뉜다', () => {
  const s = new StirStep({ beats:3, period:1 }); s.t = .5; s.press(); assert.equal(s.stray, 1);
  assert.deepEqual([0, 24, 25, 59, 60, 87, 88, 100].map(v => qualityOf(v).id), ['burnt', 'burnt', 'normal', 'normal', 'good', 'good', 'great', 'great']);
  const steps = buildSteps(RECIPES['forest-mushroom-soup']); assert.deepEqual(steps.map(x => x.id), ['chop', 'stir']); assert.equal(dishScore(steps), 0);
});

/* ---------- 채광 ---------- */
const mine = (ore, kind, seed) => {
  const rng = createRng(seed), m = new MineSession(ore, createRng(seed * 7 + 1));
  const posSd = { expert:.012, skilled:.025, average:.05, sloppy:.09 }[kind], timeSd = { expert:.06, skilled:.1, average:.17, sloppy:.3 }[kind];
  while (!m.over) { if (kind === 'random') { m.t += rng.range(.3, 1.2); m.strike(rng.range(.2, .8), rng.range(.2, .8)); continue; }
    const P = m.pulsePeriod, k = Math.ceil((m.t + .25) / P); let ts = k * P + (rng() + rng() + rng() - 1.5) * 2 * timeSd; if (ts < m.t + .05) ts = m.t + .05; m.t = ts;
    const w = m.weak(), mv = m.cfg.weak.moves ? 1.5 : 1; m.strike(w.x + (rng() + rng() - 1) * posSd * mv * 2, w.y + (rng() + rng() - 1) * posSd * mv * 2); }
  return m;
};
const mrate = (ore, kind, n = 200) => { let w = 0; for (let i = 0; i < n; i++) if (mine(ore, kind, i + 1).over === 'cracked') w++; return w / n; };
test('채광: 광석 등급이 오를수록 약점이 작고 곡괭이 횟수가 적다', () => {
  const [c, r, s] = ['moss-copper', 'silver-mist-stone', 'moondrop-crystal'].map(id => ORES[id].mine);
  assert.ok(c.weak.r > r.weak.r && r.weak.r > s.weak.r); assert.ok(c.swings > r.swings && r.swings > s.swings); assert.ok(!c.weak.moves && r.weak.moves && s.weak.moves); assert.equal(s.nodes, 3);
});
test('채광: 난이도 차이 — 일반은 쉽고, 희귀는 평균에 어렵고, 특수는 숙련자만 도전할 만하다', () => {
  assert.ok(mrate(ORES['moss-copper'], 'average') > .9); assert.ok(mrate(ORES['moss-copper'], 'random') < .6);
  const r = ORES['silver-mist-stone']; assert.ok(mrate(r, 'average') < .8 && mrate(r, 'average') > .2); assert.ok(mrate(r, 'skilled') > mrate(r, 'average') + .15); assert.ok(mrate(r, 'sloppy') < .15); assert.equal(mrate(r, 'random'), 0);
  const s = ORES['moondrop-crystal']; assert.ok(mrate(s, 'average') < .15); assert.ok(mrate(s, 'skilled') > .35 && mrate(s, 'skilled') < .95); assert.ok(mrate(s, 'expert') > mrate(s, 'skilled') - .01); assert.equal(mrate(s, 'sloppy'), 0);
});
test('채광: 모든 스윙은 횟수를 소모하고, 횟수가 끝나면 종료되며, 정확한 타격이 많으면 광석을 더 얻는다', () => {
  const m = new MineSession(ORES['moss-copper'], createRng(1)); const w = m.weak(); const hit = m.strike(w.x + .6, w.y + .6); assert.equal(hit.grade, 'miss'); assert.equal(m.swings, ORES['moss-copper'].mine.swings - 1);
  for (let i = 0; i < 20 && !m.over; i++) m.strike(.02, .02); assert.ok(m.over); assert.equal(m.strike(.5, .5), null);
  const good = mine(ORES['moss-copper'], 'expert', 5); assert.equal(good.over, 'cracked'); assert.ok(good.yieldCount() >= ORES['moss-copper'].mine.yield[0]);
  const bad = new MineSession(ORES['moondrop-crystal'], createRng(2)); for (let i = 0; i < 5; i++) bad.strike(.1, .1); assert.equal(bad.over, 'out'); assert.equal(bad.yieldCount(), 0);
});

/* ---------- 낚시: 난이도 등급·지그재그·그림자 낚시 ---------- */
test('낚시: 모든 돌진(지그재그 포함)은 신호 뒤에 오고, 방향 전환은 돌진 도중 신호(zig)가 있는 물고기만 한다', () => {
  for (const fish of Object.values(FISH)) for (let seed = 1; seed <= 6; seed++) {
    const f = new Fight(fish, createRng(seed)); let prev = f.phase, turns = 0;
    for (let i = 0; i < 60 * 40 && !f.over; i++) {
      f.step(1 / 60, { reel: i % 90 < 50, lean: 0 });
      if (f.phase === 'dash') assert.ok(prev === 'dash' || prev === 'telegraph', `${fish.id}: ${prev} → dash`);
      if (f.events.includes('turn')) { turns++; assert.ok(fish.fight.zig > 0, `${fish.id} turned without zig`); }
      prev = f.phase;
    }
  }
});

test('낚시: 등급(쉬움→최고 난도)이 높을수록 같은 숙련 플레이어의 성공률이 낮다', () => {
  const rate = (g, kind) => { const fs = Object.values(FISH).filter(f => f.grade === g); let w = 0, n = 0; for (const f of fs) for (let s = 0; s < 60; s++) { n++; if (runFight(f, kind, 500 + s).result === 'caught') w++; } return w / n; };
  const r = [1, 2, 3, 4].map(g => rate(g, 'average'));
  assert.ok(r[0] >= r[1] && r[1] > r[2] && r[2] >= r[3], r.join(','));
  assert.ok(r[0] > .9 && r[3] < .1, '쉬움은 평균 실력으로 안정적, 최고 난도는 평균 실력으로 거의 불가: ' + r.join(','));
});

test('낚시: 그림자 낚시 — 지정한 물고기가 그대로 입질한다', () => {
  const fish = FISH['mist-trout'] || Object.values(FISH).find(f => f.grade === 3);
  const b = new BiteSession(Object.values(FISH), 1, createRng(3), 1, {}, fish); assert.equal(b.fish.id, fish.id);
});
