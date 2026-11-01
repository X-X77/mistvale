import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { villageMap } from '../js/world/map-data.js';
import { places } from '../js/world/place-data.js';

const root = new URL('../', import.meta.url);
const raw = readFileSync(new URL('assets/npc/characters.json', root), 'utf8');
const pack = JSON.parse(raw);
const entries = Object.entries(pack.npc);

test('NPC 23명(인간 15, 인외 8)이 등록되어 있다', () => {
  assert.equal(entries.length, 23);
  assert.equal(entries.filter(([, n]) => n.kind === 'human').length, 15);
  assert.equal(entries.filter(([, n]) => n.kind === 'nonhuman').length, 8);
});

test('모든 NPC가 이름·직업·장소·말투·호칭·초기 대사를 갖고, 장소가 실제로 있다', () => {
  for (const [id, n] of entries) {
    assert.ok(n.name && n.role && n.placeId, id + ' 기본 정보');
    assert.ok(places[n.placeId], id + ' 장소 ' + n.placeId);
    assert.ok(n.speech?.style && n.speech?.first, id + ' 말투/호칭');
    assert.ok(Array.isArray(n.lines) && n.lines.length >= 2, id + ' 대사');
  }
});

test('원화 경로는 실제로 존재하는 파일만 참조한다 (없으면 null)', () => {
  const missing = [];
  for (const [id, n] of entries) {
    if (n.illustration === null) { missing.push(n.name); continue; }
    assert.ok(existsSync(new URL('assets/npc/' + n.illustration, root)), id + ' 원화 파일 없음: ' + n.illustration);
  }
  console.log('원화 준비 중(' + missing.length + '명): ' + missing.join(', '));
});

test('지도 핀은 모든 장소를 가리키고 서로 겹치지 않는다', () => {
  const ids = villageMap.locations.map(l => l.placeId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of Object.keys(places)) assert.ok(ids.includes(id), id + ' 지도 핀 없음');
  for (const l of villageMap.locations) assert.ok(places[l.placeId], l.placeId);
  for (let i = 0; i < villageMap.locations.length; i++) for (let j = i + 1; j < villageMap.locations.length; j++) {
    const a = villageMap.locations[i], b = villageMap.locations[j];
    assert.ok(Math.abs(a.x - b.x) >= 4 || Math.abs(a.y - b.y) >= 7, a.placeId + ' / ' + b.placeId + ' 핀이 겹침');
  }
});

test('모든 장소에 최소 한 명 이상의 인물이 있다', () => {
  for (const id of Object.keys(places)) assert.ok(entries.some(([, n]) => n.placeId === id), id + ' 인물 없음');
});

test('공개 데이터에 비밀 설정·성인 설정 표현이 없고 성별 호칭을 쓰지 않는다', () => {
  assert.doesNotMatch(JSON.stringify(pack.npc), /BDSM|클럽|자위|노출|관음|번식|성인|비설|지배|탑|주도형|인분|짝짓|구애|임신|산란/);
  for (const [id, n] of entries) for (const line of n.lines) assert.doesNotMatch(line, /{{user}}(군|양)|오빠|누나/, id);
});
