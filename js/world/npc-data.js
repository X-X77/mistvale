import { npcPresentation } from './npc-presentation.js';
const assetRoot = new URL('../../assets/npc/', import.meta.url);
const asset = path => path ? new URL(path, assetRoot).href : './assets/world/npc-placeholder.svg';
let pack;
try {
  const response = await fetch(new URL('characters.json?v=edelin-front-20261102', assetRoot), { cache: 'no-cache' });
  if (!response.ok) throw new Error('NPC data unavailable');
  pack = await response.json();
} catch {
  pack = { npc: {
    rowen: { name:'로웬', role:'클로버 잡화점 주인', lines:[{text:'캐릭터 정보를 불러오지 못했습니다. 잠시 후 다시 방문해 주세요.'}] },
    edelin: { name:'에델린', role:'작은 도서관 사서', lines:[{text:'캐릭터 정보를 불러오지 못했습니다. 잠시 후 다시 방문해 주세요.'}] },
  }};
}
export const npcs = Object.fromEntries(Object.entries(pack.npc).map(([id, data]) => {
  const presentation = npcPresentation[id] || {};
  const original = presentation.portraitMode === 'original';
  const pixelDefault = data.portrait?.[presentation.expression] || data.portrait?.default;
  return [id, {
    id, name:data.name, note:data.role,
    small: { image:asset(data.sprite?.idle), frames:[], alt:data.name+' 전신 도트', poses:Object.fromEntries(Object.entries(data.sprite || {}).map(([key,path])=>[key,asset(path)])) },
    portrait: {
      default:asset(original ? data.originalPortrait : pixelDefault),
      expressions:original ? {} : Object.fromEntries(Object.entries(data.portrait || {}).map(([key,path])=>[key,asset(path)])),
      mode:original ? 'original' : 'pixel',
      alt:data.name+' 대화용 '+(original ? '일러스트' : '도트 초상'),
    },
    dialogue:(data.lines || []).map(line=>({...line,text:line.text.replace(/\{\{user\}\}님/g,'방문자님').replace(/\{\{user\}\}/g,'방문자')})),
  }];
}));
