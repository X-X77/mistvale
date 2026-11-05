import test from 'node:test';
import assert from 'node:assert/strict';
import { VEIN_TYPES, VEINS, MineState, MINE_KEY, veinInfo, fmtTime } from '../js/game/mine-engine.js';
import { ORES, MINING_SPOTS } from '../js/game/items.js';
import { SHOPS } from '../js/game/shop-data.js';
import { sellPrice } from '../js/game/shop-engine.js';
import { places } from '../js/world/place-data.js';
import { MineSession } from '../js/game/mining-engine.js';
import { createRng } from '../js/game/rng.js';

const store = () => { let v = null; return { getItem:() => v, setItem:(_k, x) => { v = x; }, raw:() => v, set:x => { v = x; } }; };
const clock = () => { let t = 1_000_000; return { now:() => t, add:s => { t += s * 1000; } }; };

test('광맥은 세 종류뿐이고 서로 다른 광석·난이도에 연결됩니다', () => {
  assert.deepEqual(Object.keys(VEIN_TYPES), ['common', 'hard', 'rare']);
  const ores = Object.values(VEIN_TYPES).map(t => t.ore);
  assert.equal(new Set(ores).size, 3);
  for (const t of Object.values(VEIN_TYPES)) assert.ok(ORES[t.ore], `${t.ore} 없음`);
  const stars = Object.values(VEIN_TYPES).map(t => t.stars); assert.deepEqual(stars, [1, 2, 3]);
  const respawn = Object.values(VEIN_TYPES).map(t => t.respawn); assert.ok(respawn[0] < respawn[1] && respawn[1] < respawn[2]);
});

test('광맥 배치: id 중복 없음, 좌표 범위, 모든 종류 포함', () => {
  assert.equal(new Set(VEINS.map(v => v.id)).size, VEINS.length);
  for (const v of VEINS) { assert.ok(VEIN_TYPES[v.type]); assert.ok(v.u > .1 && v.u < .9 && v.v > .1 && v.v < .95, v.id); }
  for (const t of Object.keys(VEIN_TYPES)) assert.ok(VEINS.some(v => v.type === t), t);
  assert.equal(veinInfo('r1').ore, 'moondrop-crystal'); assert.equal(veinInfo('nope'), null);
});

test('광맥 광석은 채광 장소에 있고 모든 광석을 상점에서 팔 수 있습니다', () => {
  const spot = MINING_SPOTS['grey-mine']; assert.ok(spot);
  for (const t of Object.values(VEIN_TYPES)) assert.ok(JSON.stringify(spot).includes(t.ore), `${t.ore} 가 회색산 광산 목록에 없음`);
  for (const t of Object.values(VEIN_TYPES)) assert.ok(sellPrice(SHOPS.clover, t.ore) > 0, `${t.ore} 판매가 없음`);
  const price = id => sellPrice(SHOPS.clover, VEIN_TYPES[id].ore);
  assert.ok(price('common') < price('hard') && price('hard') < price('rare'), '위 단계일수록 값이 높아야 함');
});

test('광맥 난이도는 기존 채광 규칙(MineSession)을 그대로 씁니다', () => {
  const hp = Object.values(VEIN_TYPES).map(t => new MineSession(ORES[t.ore], createRng(5)).cfg);
  assert.ok(hp[0].weak.r > hp[1].weak.r && hp[1].weak.r > hp[2].weak.r, '위 단계일수록 약점이 작아야 함');
});

test('회색산 광산 장소가 지도와 연결돼 있습니다', () => {
  const p = places['grey-mine']; assert.ok(p); assert.ok(p.activities.includes('mine'));
});

test('MineState: 비우면 다시 나타날 때까지 못 캐고, 시간이 지나면 돌아옵니다', () => {
  const c = clock(), m = new MineState(store(), c.now);
  assert.ok(m.ready('c1')); assert.equal(m.remaining('c1'), 0);
  assert.ok(m.deplete('c1')); assert.ok(!m.ready('c1')); assert.equal(m.remaining('c1'), VEIN_TYPES.common.respawn);
  assert.deepEqual(m.depleted, ['c1']);
  c.add(VEIN_TYPES.common.respawn - 1); assert.equal(m.remaining('c1'), 1);
  c.add(1); assert.ok(m.ready('c1')); assert.deepEqual(m.depleted, []);
  assert.equal(m.deplete('없는광맥'), false);
});

test('MineState: 종류마다 재등장 시간이 다르고, 서로 영향을 주지 않습니다', () => {
  const c = clock(), m = new MineState(store(), c.now);
  m.deplete('c1'); m.deplete('r1');
  assert.equal(m.remaining('c1'), VEIN_TYPES.common.respawn); assert.equal(m.remaining('r1'), VEIN_TYPES.rare.respawn);
  assert.ok(m.ready('h1'));
  c.add(VEIN_TYPES.common.respawn); assert.ok(m.ready('c1')); assert.ok(!m.ready('r1'));
  assert.deepEqual(m.collectRespawned(new Set(['c1', 'r1'])), ['c1']);
});

test('MineState: 저장되고 다시 불러옵니다', () => {
  const c = clock(), s = store(), a = new MineState(s, c.now); a.deplete('h2');
  const b = new MineState(s, c.now); assert.ok(!b.ready('h2')); assert.equal(b.remaining('h2'), VEIN_TYPES.hard.respawn);
  c.add(VEIN_TYPES.hard.respawn); assert.ok(new MineState(s, c.now).ready('h2'));
});

test('MineState: 손상된 저장값·시계 조작·저장소 없음에도 안전합니다', () => {
  const c = clock();
  for (const bad of ['{{{', 'null', '{"v":2}', '{"v":1,"until":5}', '{"v":1,"until":{"c1":"abc","c2":null}}']) { const s = store(); s.set(bad); const m = new MineState(s, c.now); assert.ok(m.ready('c1'), bad); }
  const s = store(); s.set(JSON.stringify({ v:1, until:{ r1:c.now() + 99_999_999_000 } }));
  assert.ok(new MineState(s, c.now).remaining('r1') <= VEIN_TYPES.rare.respawn, '먼 미래 값은 최대 대기시간으로 자름');
  const noStore = new MineState(null, c.now); assert.ok(noStore.deplete('c3')); assert.ok(!noStore.ready('c3'));
  const failing = { getItem:() => { throw new Error('x'); }, setItem:() => { throw new Error('x'); } };
  const m = new MineState(failing, c.now); assert.ok(m.deplete('c1')); assert.ok(!m.ready('c1'));
  assert.ok(MINE_KEY.startsWith('mistvale.'));
});

test('fmtTime', () => { assert.equal(fmtTime(90), '1:30'); assert.equal(fmtTime(5), '0:05'); });
