// 미니게임 데이터: 물고기·광석·재료·요리 정의.
// value 는 훗날 상점/판매 시스템을 붙일 때 쓰는 기준값입니다. 지금은 판매 기능이 없어서 화면에 표시하지 않습니다.
// 이름·설명은 시범용 문구입니다. 세계관에 맞게 고쳐도 게임 로직은 id 만 쓰므로 영향이 없습니다.

export const TIERS = { common: '일반', rare: '희귀', special: '특수' };

/* ---------------- 낚시 ---------------- */
// bite    : window(챔질 가능 시간, 초), wait([최소,최대] 초), nibbles(가짜 입질 횟수 범위)
// fight   : engine 이 쓰는 저항 패턴 (fishing-engine.js 참고)
export const FISH = {
  // 은빛 호수 (민물)
  'silver-minnow': { id:'silver-minnow', name:'은빛 피라미', tier:'common', habitat:'silver-lake', value:12, color:'#cfe3ee',
    desc:'호수 가장자리에서 반짝이는 작은 물고기. 힘은 약하지만 돌진 신호를 무시하면 줄이 끊어집니다.', size:[9,16], xp:10,
    bite:{ window:.95, wait:[2.2,5], nibbles:[0,2] },
    fight:{ dist:4.5, stamina:.55, cruise:.24, restForce:.1, swim:[1.6,3.2], rest:[.8,1.6], restP:.25, tele:[.85,1.05], dash:[.7,1], dashForce:[1.25,1.4], lateral:.25, chain:0, dashEvery:[1.0,2.4] } },
  'reed-crucian': { id:'reed-crucian', name:'갈대 붕어', tier:'common', habitat:'silver-lake', value:18, color:'#c9b27a',
    desc:'갈대 밑에서 느긋하게 사는 붕어. 끈질기게 버티지만 패턴이 단순합니다.', size:[18,32], xp:12,
    bite:{ window:.9, wait:[2.5,5.5], nibbles:[1,2] },
    fight:{ dist:5.5, stamina:.7, cruise:.28, restForce:.1, swim:[1.5,3], rest:[.8,1.5], restP:.3, tele:[.8,1], dash:[.8,1.1], dashForce:[1.18,1.32], lateral:.35, chain:0, dashEvery:[1.0,2.2] } },
  'mist-trout': { id:'mist-trout', name:'안개 송어', tier:'rare', habitat:'silver-lake', value:60, color:'#9fc3b0',
    desc:'안개 낀 깊은 물에서 사는 송어. 신호가 짧고, 좌우로 크게 방향을 바꿉니다.', size:[28,44], xp:26,
    bite:{ window:.6, wait:[3,6.5], nibbles:[1,3] },
    fight:{ dist:6.2, stamina:.9, cruise:.34, restForce:.12, swim:[1.1,2.2], rest:[.5,1], restP:.15, tele:[.38,.46], dash:[.9,1.2], dashForce:[1.45,1.6], lateral:.9, chain:0.3, dashEvery:[.8,1.7] } },
  'moon-carp': { id:'moon-carp', name:'달무늬 잉어', tier:'special', habitat:'silver-lake', value:160, color:'#e8d890',
    desc:'등에 달무늬가 있는 잉어. 지친 척 힘을 아끼다가 갑자기 연달아 돌진합니다.', size:[46,70], xp:60,
    bite:{ window:.5, wait:[4,8], nibbles:[2,3] },
    fight:{ dist:7.8, stamina:1, cruise:.38, restForce:.05, swim:[1,1.8], rest:[1.6,2.6], restP:.4, tele:[.3,.38], dash:[1,1.3], dashForce:[1.7,1.9], lateral:1, chain:0.55, dashEvery:[.7,1.4], sulk:true } },
  // 푸른물결 해안 (바다)
  'tide-mackerel': { id:'tide-mackerel', name:'물결 고등어', tier:'common', habitat:'blue-coast', value:16, color:'#7aa6c4',
    desc:'밀물을 따라 오가는 고등어. 빠르게 치고 나가지만 금방 지칩니다.', size:[20,34], xp:11,
    bite:{ window:.9, wait:[2.2,5], nibbles:[0,2] },
    fight:{ dist:5, stamina:.55, cruise:.27, restForce:.1, swim:[1.4,2.8], rest:[.8,1.4], restP:.25, tele:[.8,1], dash:[.7,1], dashForce:[1.18,1.32], lateral:.45, chain:0, dashEvery:[1.0,2.2] } },
  'reef-bream': { id:'reef-bream', name:'암초 도미', tier:'common', habitat:'blue-coast', value:24, color:'#d98a86',
    desc:'암초 사이를 오가는 붉은 도미. 힘이 세고 버티는 시간이 깁니다.', size:[24,40], xp:14,
    bite:{ window:.85, wait:[2.6,5.5], nibbles:[1,2] },
    fight:{ dist:5.8, stamina:.8, cruise:.3, restForce:.1, swim:[1.4,2.8], rest:[.8,1.4], restP:.25, tele:[.78,.95], dash:[.8,1.1], dashForce:[1.2,1.34], lateral:.4, chain:0, dashEvery:[1,2.2] } },
  'lighthouse-bass': { id:'lighthouse-bass', name:'등대 농어', tier:'rare', habitat:'blue-coast', value:70, color:'#b8cad6',
    desc:'등대 불빛 아래를 지나는 농어. 신호가 짧고 연속으로 돌진할 때가 있습니다.', size:[40,66], xp:28,
    bite:{ window:.6, wait:[3,6.5], nibbles:[1,3] },
    fight:{ dist:6.5, stamina:.95, cruise:.35, restForce:.12, swim:[1.1,2.1], rest:[.5,1], restP:.15, tele:[.38,.46], dash:[.9,1.2], dashForce:[1.45,1.65], lateral:.8, chain:0.35, dashEvery:[.8,1.6] } },
  'fog-anglerfish': { id:'fog-anglerfish', name:'안개 아귀', tier:'special', habitat:'blue-coast', value:180, color:'#8d7aa8',
    desc:'밀물 동굴 밖까지 나온 심해 아귀. 한참 버티다 짧은 신호 뒤에 크게 돌진합니다.', size:[55,90], xp:64,
    bite:{ window:.5, wait:[4,8], nibbles:[2,3] },
    fight:{ dist:8.2, stamina:1, cruise:.4, restForce:.06, swim:[1,1.8], rest:[1.4,2.4], restP:.4, tele:[.3,.38], dash:[1.05,1.35], dashForce:[1.7,1.95], lateral:1, chain:0.5, dashEvery:[.7,1.4], sulk:true } },
};
// 장소별 낚시 구역: 가까운 곳(near)은 일반, 먼 곳(far)일수록 희귀·특수가 걸립니다.
export const FISHING_SPOTS = {
  'silver-lake': { name:'은빛 호수', water:{ deep:'#173a4d', mid:'#25607a', shallow:'#4d93a8' }, fish:['silver-minnow','reed-crucian','mist-trout','moon-carp'] },
  'blue-coast':  { name:'푸른물결 해안', water:{ deep:'#0f2a4d', mid:'#1f5b8c', shallow:'#58a6c4' }, fish:['tide-mackerel','reef-bream','lighthouse-bass','fog-anglerfish'] },
};

/* ---------------- 채집(재료) ---------------- */
export const INGREDIENTS = {
  herb:     { id:'herb', name:'안개 허브', kind:'ingredient', value:6, color:'#8fc96f', desc:'안개 속에서 자라는 향긋한 허브.' },
  mushroom: { id:'mushroom', name:'숲 버섯', kind:'ingredient', value:8, color:'#c99a6a', desc:'속삭임 숲의 그늘에서 자란 버섯.' },
  berry:    { id:'berry', name:'이슬 베리', kind:'ingredient', value:7, color:'#b04a78', desc:'이슬이 맺힌 작은 베리.' },
};
export const GATHER_SPOTS = {
  'whisper-forest': { name:'속삭임 숲', picks:[
    { id:'herb', label:'허브 덤불', min:1, max:2 }, { id:'mushroom', label:'버섯 군락', min:1, max:2 }, { id:'berry', label:'베리 덤불', min:1, max:3 } ] },
};

/* ---------------- 광석 ---------------- */
export const ORES = {
  'moss-copper': { id:'moss-copper', name:'이끼 구리석', tier:'common', habitat:'wet-cave', value:14, color:'#7aa57a', glow:'#b6e0a0',
    desc:'이끼가 낀 구리 광맥. 약점이 넓고 맥박이 느립니다.', xp:10, kind:'ore',
    mine:{ swings:9, hp:100, weak:{ r:.20, moves:false, pulse:1.7, goodWin:.5 }, nodes:1, yield:[2,3] } },
  'silver-mist-stone': { id:'silver-mist-stone', name:'은빛 안개석', tier:'rare', habitat:'wet-cave', value:55, color:'#aebfd1', glow:'#e6f1ff',
    desc:'은빛으로 빛나는 안개석. 약점이 작고 균열을 따라 움직입니다.', xp:26, kind:'ore',
    mine:{ swings:7, hp:100, weak:{ r:.09, moves:true, pulse:1.2, goodWin:.4 }, nodes:1, yield:[1,2] } },
  'moondrop-crystal': { id:'moondrop-crystal', name:'달방울 수정', tier:'special', habitat:'wet-cave', value:150, color:'#a78bd9', glow:'#e4d4ff',
    desc:'단 몇 번의 정확한 타격만 허락하는 수정. 약점 세 곳을 차례로 깨야 합니다.', xp:58, kind:'ore',
    mine:{ swings:5, hp:100, weak:{ r:.075, moves:true, pulse:1, goodWin:.36 }, nodes:3, yield:[1,1] } },
};
export const MINING_SPOTS = { 'wet-cave': { name:'숲의 습한 동굴', ores:['moss-copper','silver-mist-stone','moondrop-crystal'] } };

/* ---------------- 요리 ---------------- */
// steps: 조리 단계(요리마다 1~2가지 핵심 동작)
export const RECIPES = {
  'herb-grilled-fish': { id:'herb-grilled-fish', name:'허브 구이 생선', desc:'프라이팬에서 불 세기를 맞추고, 알맞은 때에 뒤집어 굽습니다.',
    need:{ herb:1 }, fishAny:true, steps:['heat','flip'], value:40, xp:16, color:'#d9a05b' },
  'forest-mushroom-soup': { id:'forest-mushroom-soup', name:'숲 버섯 수프', desc:'재료를 넣을 때를 맞추고, 박자에 맞춰 저어 끓입니다.',
    need:{ mushroom:2, herb:1 }, steps:['drop','stir'], value:34, xp:15, color:'#b98c5c' },
  'dew-berry-jam': { id:'dew-berry-jam', name:'이슬 베리 잼', desc:'베리를 박자에 맞춰 저으며 졸이다가, 윤기가 돌 때 불에서 내립니다.',
    need:{ berry:3 }, steps:['stir','finish'], value:36, xp:15, color:'#a8456f' },
};
export const DISH_QUALITY = [
  { id:'burnt',   label:'실패작', min:0,  mult:0 },
  { id:'normal',  label:'일반',   min:25, mult:1 },
  { id:'good',    label:'잘 만든', min:60, mult:1.5 },
  { id:'great',   label:'훌륭한', min:88, mult:2.2 },
];
export function qualityOf(score) {
  let result = DISH_QUALITY[0];
  for (const quality of DISH_QUALITY) if (score >= quality.min) result = quality;
  return result;
}
// 요리 결과물은 '요리 id + 품질'로 소지품에 쌓입니다. 예) dish:herb-grilled-fish:good
export const JUNK = { 'dish:burnt': { id:'dish:burnt', name:'검게 탄 덩어리', kind:'junk', value:0, color:'#2b2622', desc:'먹을 수 없는 무언가.' } };

/* 소지품 id → 표시 정보 */
export function describeItem(id) {
  if (FISH[id]) return { ...FISH[id], kind:'fish' };
  if (INGREDIENTS[id]) return INGREDIENTS[id];
  if (ORES[id]) return ORES[id];
  if (JUNK[id]) return JUNK[id];
  if (id.startsWith('dish:')) {
    const [, recipeId, qualityId] = id.split(':'), recipe = RECIPES[recipeId], quality = DISH_QUALITY.find(q => q.id === qualityId);
    if (recipe && quality) return { id, name:(quality.id === 'normal' ? '' : quality.label + ' ') + recipe.name, kind:'dish', tier:'dish', value:Math.round(recipe.value * quality.mult), color:recipe.color, desc:recipe.desc, quality:quality.id };
  }
  return { id, name:id, kind:'unknown', value:0, color:'#888', desc:'' };
}
export const ACTIVITIES = {
  fishing: { id:'fishing', label:'낚시', verb:'낚시하기', skill:'낚시' },
  cooking: { id:'cooking', label:'요리', verb:'요리하기', skill:'요리' },
  mining:  { id:'mining',  label:'채광', verb:'광맥 캐기', skill:'채광' },
};

/* 한국어 조사: 받침 유무에 따라 을/를, 이/가, 은/는 */
export function josa(word, pair) {
  const [a, b] = pair.split('/'); const code = String(word).trim().slice(-1).charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return a + '(' + b + ')';
  return (code - 0xac00) % 28 ? a : b;
}
