import { npcPresentation } from './npc-presentation.js';
const assetRoot = new URL('../../assets/npc/', import.meta.url);
const asset = path => path ? new URL(path, assetRoot).href : '';
let pack;
try {
  const response = await fetch(new URL('characters.json?v=npc-common-20261102', assetRoot), { cache: 'no-cache' });
  if (!response.ok) throw new Error('NPC data unavailable');
  pack = await response.json();
} catch {
  pack = { npc: {
    rowen: { name:'로웬', role:'클로버 잡화점 주인', lines:[{text:'캐릭터 정보를 불러오지 못했습니다. 잠시 후 다시 방문해 주세요.'}] },
    edelin: { name:'에델린', role:'작은 도서관 사서', lines:[{text:'캐릭터 정보를 불러오지 못했습니다. 잠시 후 다시 방문해 주세요.'}] },
  }};
}
// 모든 NPC가 같은 구조: sprite(장소 화면) + portrait(대화 화면).
export const npcs = Object.fromEntries(Object.entries(pack.npc).map(([id, data]) => [id, {
  id, name:data.name, note:data.role,
  sprite: { src:asset(data.sprite), alt:data.name + ' 전신 도트' },
  portrait: { src:asset(data.portrait), alt:data.name + ' 일러스트' },
  layout: npcPresentation[id] || {},
  dialogue:(data.lines || []).map(line=>({ ...line, text:line.text.replace(/\{\{user\}\}님/g,'방문자님').replace(/\{\{user\}\}/g,'방문자') })),
}]));
