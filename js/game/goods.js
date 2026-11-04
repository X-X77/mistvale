// 상점 물품 정의(이름·분류·설명·그림 종류·실제 효과). 가격은 여기에 없고 shop-data.js 의 가격표 한 곳에서만 관리합니다.
// 이 파일은 다른 파일을 불러오지 않습니다(items.js 가 가져다 씁니다).
//   kind  : 분류.   icon : goods-art.js 가 그리는 그림 종류.   color : 그림 주색
//   unique: 하나만 가질 수 있는 고유 장비(되팔 수 없음).   legacy: 지금은 팔지 않지만 이미 가진 사람의 효과는 유지됩니다.
//   effect: 낚시·채광 미니게임에서 실제로 적용되는 효과
//     mineSwings : 채광에서 곡괭이질 횟수 추가
//     biteWindow : 낚시에서 입질이 왔을 때 챔질할 수 있는 시간 배율
//     waitMul    : (미끼) 입질이 올 때까지 기다리는 시간 배율 — 작을수록 빨리 옵니다
//     rareMul    : (미끼) 희귀·특수 물고기가 걸릴 확률 배율
const mk = (id, name, kind, icon, color, desc, extra = {}) => ({ id, name, kind, icon, color, desc, ...extra });

export const GOODS = Object.fromEntries([
  // ---- 낚시 미끼 (던질 때마다 1개씩 씁니다) ----
  mk('bait-worm', '흙 지렁이 미끼', 'bait', 'worm', '#d98a86', '촉촉한 흙에서 캔 지렁이. 던지고 입질이 오기까지 기다리는 시간이 짧아집니다.', { short:'지렁이', effect:{ waitMul:.55 } }),
  mk('bait-glow', '반짝 반딧 미끼', 'bait', 'glow', '#f0cf5a', '은은하게 빛나는 반딧 미끼. 희귀하고 특별한 물고기가 걸릴 확률이 높아집니다.', { short:'반딧', effect:{ rareMul:1.8 } }),
  // ---- 장비 (고유 장비: 하나만 가질 수 있고 되팔 수 없음) ----
  mk('rod-steel', '강철 낚싯대', 'tool', 'rod', '#b9c6cc', '쇠심을 넣어 벼린 낚싯대. 입질이 왔을 때 챔질할 수 있는 시간이 25% 늘어납니다.', { unique:true, effect:{ biteWindow:1.25 } }),
  mk('pick-copper', '구리 곡괭이', 'tool', 'pick', '#d68e58', '구리로 머리를 단단히 두른 곡괭이. 채광에서 곡괭이질을 1번 더 할 수 있습니다.', { unique:true, effect:{ mineSwings:1 } }),
  // ---- 이전 버전에서 이미 받은 사람을 위한 장비 (더는 팔지 않습니다) ----
  mk('rod-bamboo', '대나무 낚싯대', 'tool', 'rod', '#d1a35a', '가볍고 낭창한 대나무 낚싯대. 입질이 왔을 때 챔질할 수 있는 시간이 조금 늘어납니다.', { unique:true, legacy:true, effect:{ biteWindow:1.12 } }),
  mk('pick-silver', '은빛 곡괭이', 'tool', 'pick', '#c9d8ee', '은빛 안개석을 섞어 벼린 곡괭이. 채광에서 곡괭이질을 2번 더 할 수 있습니다.', { unique:true, legacy:true, effect:{ mineSwings:2 } }),
].map(item => [item.id, item]));

/* 소지품 분류(소지품 패널의 구역 순서) */
export const GROUPS = [
  { id:'fish', label:'물고기', kinds:['fish'] },
  { id:'ore', label:'광석', kinds:['ore'] },
  { id:'ingredient', label:'재료', kinds:['ingredient'] },
  { id:'food', label:'요리', kinds:['dish'] },
  { id:'bait', label:'미끼', kinds:['bait'] },
  { id:'tool', label:'장비', kinds:['tool'] },
  { id:'junk', label:'기타', kinds:['junk', 'quest', 'unknown'] },
];
export const groupOf = kind => (GROUPS.find(group => group.kinds.includes(kind)) || GROUPS[GROUPS.length - 1]).id;

/* 되팔 수 없는 물건: 고유 장비, 중요 물건(quest) */
export const isProtected = info => Boolean(info && (info.unique || info.kind === 'quest' || info.kind === 'tool'));

/* 가진 장비가 주는 실제 효과. 같은 종류는 가장 좋은 것 하나만 적용됩니다. */
export function equipmentBonus(items = {}) {
  const bonus = { mineSwings:0, biteWindow:1 };
  for (const [id, n] of Object.entries(items)) {
    const effect = n > 0 && GOODS[id]?.kind === 'tool' && GOODS[id].effect; if (!effect) continue;
    if (effect.mineSwings) bonus.mineSwings = Math.max(bonus.mineSwings, effect.mineSwings);
    if (effect.biteWindow) bonus.biteWindow = Math.max(bonus.biteWindow, effect.biteWindow);
  }
  return bonus;
}
/* 미끼 효과(없으면 효과 없음). baitId 가 미끼가 아니면 무시합니다. */
export function baitEffect(baitId) {
  const effect = GOODS[baitId]?.kind === 'bait' && GOODS[baitId].effect;
  return { waitMul:effect?.waitMul || 1, rareMul:effect?.rareMul || 1 };
}
export const BAIT_IDS = Object.values(GOODS).filter(item => item.kind === 'bait').map(item => item.id);
