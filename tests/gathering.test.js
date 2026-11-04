import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, TEMPLATES, HIDES, GatherSession, generateField, clueLevel, HOLD, ASPECT } from '../js/game/gathering-engine.js';
import { createRng } from '../js/game/rng.js';

const tpls = Object.keys(TEMPLATES), zones = Object.keys(ZONES);

test('채집: 모든 구역·배치·화면비에서 필드가 유효하다(수·겹침·재료 위치 규칙)', () => {
  for (const z of zones) for (const t of tpls) for (const a of [ASPECT.min, 1.2, ASPECT.max]) for (let seed = 1; seed <= 25; seed++) {
    const f = generateField(z, createRng(seed * 977 + a * 10), t, a), zone = ZONES[z];
    assert.ok(f.spots.length >= zone.spots[0] - 2, `${z}/${t}/${a} spots ${f.spots.length}`);
    const targets = f.spots.filter(s => s.hides);
    assert.ok(targets.length >= zone.targets[0] && targets.length <= zone.targets[1], `targets ${targets.length}`);
    for (const s of targets) assert.ok(HIDES[s.hides.item].includes(s.kind), `${s.hides.item} hidden in ${s.kind}`);
    for (const s of f.spots) { assert.ok(s.x > 0 && s.x < f.aspect && s.y > 0 && s.y < 1); assert.ok(!TEMPLATES[t].blocked(s.x / f.aspect, s.y, f.aspect)); }
    assert.equal(new Set(targets.map(s => s.id)).size, targets.length);
  }
});

test('채집: 재료 종류가 최소 3가지 모두 등장하고 희귀 재료 수가 제한된다', () => {
  for (const z of zones) for (let seed = 1; seed <= 20; seed++) {
    const f = generateField(z, createRng(seed)), items = f.spots.filter(s => s.hides);
    assert.equal(new Set(items.map(s => s.hides.item)).size, 3);
    assert.ok(items.filter(s => s.hides.special).length <= Math.ceil(items.length / 3));
  }
});

test('채집: 같은 구역을 반복해도 정답 위치가 그대로 나오지 않는다', () => {
  for (const z of zones) {
    const sigs = new Set();
    for (let seed = 1; seed <= 12; seed++) { const f = generateField(z, createRng(seed * 31)); sigs.add(f.template.id + ':' + f.spots.filter(s => s.hides).map(s => `${Math.round(s.x * 20)},${Math.round(s.y * 20)}`).join('|')); }
    assert.ok(sigs.size >= 11, `${z} unique ${sigs.size}`);
  }
  const names = new Set(); for (let seed = 1; seed <= 40; seed++) names.add(generateField('meadow', createRng(seed)).template.id);
  assert.equal(names.size, tpls.length);
});

test('채집: 난이도가 구역마다 확실히 다르다(단서 가시성·헛손질·재료 수)', () => {
  const [m, t, s] = zones.map(z => ZONES[z]);
  assert.ok(m.misses > t.misses && t.misses > s.misses);
  assert.ok(m.peek > t.peek && t.peek > s.peek);
  assert.ok(m.targets[0] < s.targets[0] && s.spots[0] > m.spots[1]);
  const mk = (z, id) => ({ hides:{ item:'herb', special:false, collected:false, lost:false }, id });
  const spot = mk(z => z), far = { d:.5, dwell:0 }, near = { d:.05, dwell:0 }, still = { d:.05, dwell:5 };
  assert.equal(clueLevel(m, spot, far), 2);                                    // 쉬움: 늘 보임
  assert.equal(clueLevel(t, spot, far), 0); assert.equal(clueLevel(t, spot, near), 2);   // 보통: 가까이 가야 보임
  assert.equal(clueLevel(s, spot, near), 1); assert.equal(clueLevel(s, spot, still), 2);  // 어려움: 렌즈+지켜보기
  assert.equal(clueLevel(s, spot, far), 0);
  const empty = { hides:null }; assert.equal(clueLevel(s, empty, still), 0);
});

test('채집: 희귀 재료의 단서는 어느 구역이든 잠시 지켜봐야 또렷해진다', () => {
  const g = { hides:{ item:'herb', special:true, collected:false, lost:false } };
  for (const z of zones) { assert.notEqual(clueLevel(ZONES[z], g, { d:.05, dwell:0 }), 2); assert.equal(clueLevel(ZONES[z], g, { d:.05, dwell:2 }), 2); }
});

function firstTarget(sess, special = false) { return sess.spots.find(s => s.hides && !!s.hides.special === special); }
function emptySpot(sess) { return sess.spots.find(s => !s.hides && s.state === 'closed'); }

test('채집: 재료가 없는 곳을 열면 헛손질이 줄고, 바닥나면 지쳐서 끝난다', () => {
  const s = new GatherSession('mist', createRng(5), 'grove');
  let tired = false;
  for (let i = 0; i < ZONES.mist.misses; i++) { const e = emptySpot(s); const r = s.open(e.id); assert.equal(r.kind, 'empty'); tired = r.tired; }
  assert.ok(tired); assert.equal(s.over, 'tired'); assert.equal(s.misses, 0);
  assert.equal(s.open(emptySpot(s)?.id ?? 0).kind, 'over');
});

test('채집: 재료를 찾으면 헛손질이 줄지 않고, 평범한 재료는 담거나 자동 정산된다', () => {
  const s = new GatherSession('meadow', createRng(9), 'trail'), t = firstTarget(s) || firstTarget(s, true);
  const before = s.misses; const r = s.open(t.id); assert.equal(r.kind, 'found'); assert.equal(s.misses, before);
  if (!t.hides.special) { const c = s.collect(t.id); assert.ok(c.ok); assert.equal(s.basket[t.hides.item], t.hides.amount); assert.equal(s.collect(t.id).ok, false); }
  assert.equal(s.open(t.id).kind, 'again');
});

test('채집: 희귀 재료는 손을 가만히 눌러야 담기고 흔들면 놓친다', () => {
  let s, g;
  for (let seed = 1; seed < 200 && !g; seed++) { s = new GatherSession('mist', createRng(seed)); g = firstTarget(s, true); }
  assert.ok(g, 'gold exists');
  s.open(g.id); assert.equal(s.collect(g.id).ok, false);                       // 클릭만으로는 담기지 않음
  assert.ok(s.startHold(g.id)); let r = null; for (let i = 0; i < 200 && !r; i++) r = s.holdStep(.02, 0.05);
  assert.equal(r, 'done'); assert.equal(s.basket[g.hides.item], g.hides.amount); assert.equal(s.stats.gold, 1);
  // 흔들림
  let s2, g2; for (let seed = 300; seed < 600 && !g2; seed++) { s2 = new GatherSession('mist', createRng(seed)); g2 = firstTarget(s2, true); }
  s2.open(g2.id); s2.startHold(g2.id); r = null; for (let i = 0; i < 100 && !r; i++) r = s2.holdStep(.05, HOLD.calm * 3);
  assert.equal(r, 'spooked'); assert.ok(g2.hides.lost); assert.equal(s2.total, 0);
});

test('채집: 전부 찾으면 complete, 중간에 마치면 담은 만큼만 얻는다(실패해도 보상은 담은 것만)', () => {
  const s = new GatherSession('meadow', createRng(11), 'clearing');
  for (const sp of s.spots.filter(x => x.hides)) { s.open(sp.id); if (sp.hides.special) { s.startHold(sp.id); for (let i = 0; i < 100 && s.hold; i++) s.holdStep(.05, 0); } else s.collect(sp.id); }
  assert.equal(s.over, 'complete'); assert.equal(s.remaining, 0);
  const s2 = new GatherSession('meadow', createRng(11), 'clearing'); const t = firstTarget(s2) || firstTarget(s2, true); s2.open(t.id); s2.finish();
  assert.equal(s2.over, 'done'); assert.ok(s2.total <= t.hides.amount);
  const s3 = new GatherSession('meadow', createRng(11), 'clearing'); s3.finish(); assert.equal(s3.total, 0);   // 아무것도 못 찾으면 보상 없음
});
