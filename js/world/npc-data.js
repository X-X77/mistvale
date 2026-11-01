import { npcPresentation } from './npc-presentation.js';
const assetRoot = new URL('../../assets/npc/', import.meta.url);
const asset = path => path ? new URL(path, assetRoot).href : '';
let pack;
try {
  const response = await fetch(new URL('characters.json?v=npc-roster-20261102', assetRoot), { cache: 'no-cache' });
  if (!response.ok) throw new Error('NPC data unavailable');
  pack = await response.json();
} catch {
  pack = { npc: {} };   // 불러오지 못하면 장소 화면에서 안내 문구만 보여 줍니다.
}
const visitor = text => text.replace(/\{\{user\}\}님/g, '방문자님').replace(/\{\{user\}\}/g, '방문자');
// 모든 NPC가 같은 구조입니다. 이름·직업·장소·원화 경로·대사만 바꾸면 새 NPC가 됩니다.
//   illustration 이 null 이면 '원화 준비 중' 카드가 나옵니다(다른 그림으로 대신하지 않습니다).
export const npcs = Object.fromEntries(Object.entries(pack.npc).map(([id, data]) => [id, {
  id, name:data.name, kind:data.kind || 'human', role:data.role || '', placeId:data.placeId,
  spot:data.spot || '', appears:data.appears || '',
  note:[data.role, data.kind === 'nonhuman' ? data.spot : '', data.appears].filter(Boolean).join(' · '),
  illustration: { src:asset(data.illustration), alt:data.name + ' 원화', ready:Boolean(data.illustration) },
  layout: npcPresentation[id] || {},
  dialogue:(data.lines || []).map(line => ({ text: visitor(typeof line === 'string' ? line : line.text) })),
}]));
// 장소 id → 그 장소에 있는 NPC 목록 (characters.json 순서)
export const npcsAt = placeId => Object.values(npcs).filter(npc => npc.placeId === placeId);
