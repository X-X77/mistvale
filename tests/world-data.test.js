import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { atlas } from '../js/world/map-data.js';
import { places } from '../js/world/place-data.js';
import { chibiResidents } from '../js/world/chibi-data.js';
import { portraitAssets } from '../js/world/portrait-data.js';

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

test('원화 23장이 모두 연결되어 있고, 실제 파일이며, 서로 다른 파일이다', () => {
  const used = new Map();
  for (const [id, n] of entries) {
    assert.ok(n.illustration, id + ' 원화 미연결');
    assert.ok(existsSync(new URL('assets/npc/' + n.illustration, root)), id + ' 원화 파일 없음: ' + n.illustration);
    assert.ok(!used.has(n.illustration), id + ' 와 ' + used.get(n.illustration) + ' 가 같은 원화를 씀');
    used.set(n.illustration, id);
  }
  assert.equal(used.size, 23);
});

test('두 지도에서 기존 장소는 한 번씩 연결되고 명소는 안내를 제공한다', () => {
  const sites = Object.values(atlas).flatMap(sheet => sheet.sites);
  assert.equal(new Set(sites.map(s => s.id)).size, sites.length);
  for (const id of Object.keys(places)) assert.ok(sites.some(site => site.id === id), id);
  for (const site of sites) assert.ok(places[site.id] || site.name && site.note);
});

test('각 그림의 클릭 영역이 지도 안에 있고 서로 겹치지 않는다', () => {
  for (const { sites, art } of Object.values(atlas)) {
    assert.ok(existsSync(new URL(art, root)));
    for (const [i, a] of sites.entries()) {
      assert.ok(a.x >= a.w/2 && a.x <= 100-a.w/2 && a.y >= a.h/2 && a.y <= 100-a.h/2);
      for (const b of sites.slice(i+1)) assert.ok(Math.abs(a.x-b.x) >= (a.w+b.w)/2 || Math.abs(a.y-b.y) >= (a.h+b.h)/2, a.id+' / '+b.id);
    }
  }
});

test('모든 장소에 최소 한 명 이상의 인물이 있다', () => {
  for (const id of Object.keys(places)) if (!places[id].home) assert.ok(entries.some(([, n]) => n.placeId === id), id + ' 인물 없음');
});

test('공개 데이터에 비밀 설정·성인 설정 표현이 없고 성별 호칭을 쓰지 않는다', () => {
  assert.doesNotMatch(JSON.stringify(pack.npc), /BDSM|클럽|자위|노출|관음|번식|성인|비설|지배|탑|주도형|인분|짝짓|구애|임신|산란/);
  for (const [id, n] of entries) for (const line of n.lines) assert.doesNotMatch(line, /{{user}}(군|양)|오빠|누나/, id);
});

test('치비(탐색용)와 대형 원화(대화용)가 NPC마다 따로 연결되어 있고 서로 겹치지 않는다', () => {
  const chibiFiles = new Set(), portraitFiles = new Set();
  for (const [id] of entries) {
    const c = chibiResidents[id], p = portraitAssets[id];
    assert.ok(c && p, id + ' 치비/원화 설정');
    assert.ok(existsSync(new URL(c.src.replace('./', ''), root)), id + ' 치비 파일 없음');
    assert.ok(c.ratio > 0.4 && c.ratio < 1.1, id + ' 비율');
    assert.ok(c.height >= 30 && c.mobileHeight >= 24, id + ' 치비 크기가 너무 작음');
    assert.ok(!c.src.includes('..') && c.src.includes(id), id + ' 다른 NPC 치비 경로');
    assert.ok(p.src.includes('/' + id + '.'), id + ' 대화 원화가 다른 NPC 파일을 가리킴');
    assert.ok(!chibiFiles.has(c.src) && !portraitFiles.has(p.src), id + ' 중복 경로');
    chibiFiles.add(c.src); portraitFiles.add(p.src);
  }
});

test('누끼 완성본이 투명 배경 WebP 로 23장 있다', () => {
  for (const [id] of entries) {
    const buf = readFileSync(new URL('assets/characters/chibis-matted/' + id + '.webp', root));
    assert.equal(buf.subarray(0, 4).toString(), 'RIFF', id);
    assert.equal(buf.subarray(8, 12).toString(), 'WEBP', id);
  }
});
