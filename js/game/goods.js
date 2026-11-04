// 상점 물품 정의(이름·분류·설명·그림 종류). 가격은 여기에 없고 shop-data.js 의 가격표 한 곳에서만 관리합니다.
// 이 파일은 다른 파일을 불러오지 않습니다(items.js 가 가져다 씁니다).
//   kind  : 분류.   icon : goods-art.js 가 그리는 그림 종류.   color : 그림 주색
//   soon  : 아직 쓰이는 곳이 없는 물건이면 그 이유(화면에 '준비 중' 표시). 사도 사라지지 않고 소지품에 남습니다.
//   unique: 하나만 가질 수 있는 고유 장비(되팔 수 없음).  effect : 실제로 적용되는 효과(낚시·채광)
const mk = (id, name, kind, icon, color, desc, extra = {}) => ({ id, name, kind, icon, color, desc, ...extra });
const FARM = '농사 기능이 생기면 쓰입니다.', HOME = '내 집·농장을 꾸미는 기능이 생기면 쓰입니다.', EAT = '먹어서 쓰는 기능이 생기면 쓰입니다.', USE = '쓰는 기능이 생기면 쓰입니다.', COOK = '이 재료를 쓰는 요리법은 아직 없습니다.';

export const GOODS = Object.fromEntries([
  // ---- 씨앗 (계절별) ----
  mk('seed-turnip', '안개 순무 씨앗', 'seed', 'seed', '#e8d8f0', '서늘한 안개를 좋아하는 순무 씨앗. 봄에 뿌립니다.', { season:'봄', soon:FARM }),
  mk('seed-pea', '완두콩 씨앗', 'seed', 'seed', '#9fd27a', '덩굴이 타고 오르는 완두콩 씨앗. 봄에 뿌립니다.', { season:'봄', soon:FARM }),
  mk('seed-tomato', '토마토 씨앗', 'seed', 'seed', '#e0503c', '햇볕을 듬뿍 받아야 하는 토마토 씨앗. 여름에 뿌립니다.', { season:'여름', soon:FARM }),
  mk('seed-corn', '옥수수 씨앗', 'seed', 'seed', '#f0cf5a', '키가 훌쩍 크는 옥수수 씨앗. 여름에 뿌립니다.', { season:'여름', soon:FARM }),
  mk('seed-pumpkin', '호박 씨앗', 'seed', 'seed', '#f08a3c', '크고 둥근 호박이 열리는 씨앗. 가을에 뿌립니다.', { season:'가을', soon:FARM }),
  mk('seed-sweet-potato', '고구마 순', 'seed', 'seed', '#b86a8a', '땅속에서 달게 익는 고구마 순. 가을에 심습니다.', { season:'가을', soon:FARM }),
  mk('seed-leek', '대파 씨앗', 'seed', 'seed', '#8fc98a', '추위에도 잘 버티는 대파 씨앗. 겨울에 뿌립니다.', { season:'겨울', soon:FARM }),
  // ---- 작물 (농사로 수확하는 물건. 지금은 얻는 방법이 없어 가격만 정해 둠) ----
  mk('crop-turnip', '안개 순무', 'crop', 'round', '#e8d8f0', '아삭하고 맑은 맛이 나는 순무.', { growDays:4 }),
  mk('crop-pea', '완두콩', 'crop', 'pod', '#8fcf6a', '꼬투리 속에 알이 꽉 찬 완두콩.', { growDays:5 }),
  mk('crop-tomato', '토마토', 'crop', 'round', '#e0503c', '햇볕을 머금은 새빨간 토마토.', { growDays:6 }),
  mk('crop-corn', '옥수수', 'crop', 'corn', '#f0cf5a', '알이 굵게 여문 옥수수.', { growDays:8 }),
  mk('crop-pumpkin', '호박', 'crop', 'round', '#f08a3c', '묵직하고 둥근 호박.', { growDays:9 }),
  mk('crop-sweet-potato', '고구마', 'crop', 'round', '#b86a8a', '달큰한 향이 나는 고구마.', { growDays:7 }),
  mk('crop-leek', '대파', 'crop', 'leek', '#8fc98a', '향이 진한 대파.', { growDays:6 }),
  // ---- 비료 ----
  mk('fertilizer-basic', '기본 비료', 'fertilizer', 'sack', '#8a6a3e', '흙을 살찌우는 평범한 거름.', { soon:FARM }),
  mk('fertilizer-rich', '영양 비료', 'fertilizer', 'sack', '#5a8a4a', '작물이 더 잘 자라도록 영양을 듬뿍 넣은 비료.', { soon:FARM }),
  // ---- 생활용품·기초 소모품 ----
  mk('candle', '양초', 'supply', 'candle', '#f3ecd3', '은은하게 오래 타는 밀랍 양초.', { soon:USE }),
  mk('rope', '튼튼한 밧줄', 'supply', 'rope', '#c9a56a', '삼 줄기를 꼬아 만든 밧줄.', { soon:USE }),
  mk('lantern-oil', '등잔 기름', 'supply', 'bottle', '#e8b84a', '그을음이 적은 등잔 기름.', { soon:USE }),
  mk('cloth-bag', '헝겊 주머니', 'supply', 'pouch', '#c9b27a', '허리춤에 매다는 작은 주머니.', { soon:USE }),
  mk('torch', '횃불', 'supply', 'torch', '#ff9340', '동굴에서 쓰기 좋은 송진 횃불.', { soon:USE }),
  mk('bandage', '붕대', 'supply', 'bandage', '#f3ecd3', '깨끗하게 삶아 둔 무명 붕대.', { soon:USE }),
  // ---- 도구·장비 (고유 장비: 하나만 가질 수 있고 되팔 수 없음) ----
  mk('hoe', '튼튼한 괭이', 'tool', 'hoe', '#a8b4b8', '밭을 일구는 괭이.', { unique:true, soon:FARM }),
  mk('watering-can', '양철 물뿌리개', 'tool', 'can', '#8fb4c8', '작물에 물을 주는 양철 물뿌리개.', { unique:true, soon:FARM }),
  mk('sickle', '곡식 낫', 'tool', 'sickle', '#c5d0d2', '작물을 베는 낫.', { unique:true, soon:FARM }),
  mk('pick-copper', '구리 곡괭이', 'tool', 'pick', '#d68e58', '구리로 머리를 단단히 두른 곡괭이. 채광에서 곡괭이질을 1번 더 할 수 있습니다.', { unique:true, effect:{ mineSwings:1 } }),
  mk('pick-silver', '은빛 곡괭이', 'tool', 'pick', '#c9d8ee', '은빛 안개석을 섞어 벼린 곡괭이. 채광에서 곡괭이질을 2번 더 할 수 있습니다.', { unique:true, effect:{ mineSwings:2 } }),
  mk('rod-bamboo', '대나무 낚싯대', 'tool', 'rod', '#d1a35a', '가볍고 낭창한 대나무 낚싯대. 입질이 왔을 때 챔질할 수 있는 시간이 조금 늘어납니다.', { unique:true, effect:{ biteWindow:1.12 } }),
  mk('rod-steel', '강철 낚싯대', 'tool', 'rod', '#b9c6cc', '쇠심을 넣어 벼린 낚싯대. 입질이 왔을 때 챔질할 수 있는 시간이 꽤 늘어납니다.', { unique:true, effect:{ biteWindow:1.25 } }),
  // ---- 수리·강화 재료, 목재·제작 재료 ----
  mk('iron-scrap', '철 조각', 'material', 'scrap', '#8c98a0', '대장간에서 쓰는 쇳조각. 도구를 강화할 때 들어갑니다.'),
  mk('charcoal', '숯', 'material', 'charcoal', '#3a3430', '화덕을 오래 달구는 참숯.'),
  mk('whetstone', '숫돌', 'material', 'whetstone', '#a9a290', '날을 세우는 고운 숫돌.'),
  mk('log', '통나무', 'material', 'log', '#a77746', '결이 곧은 참나무 통나무.'),
  mk('plank', '다듬은 판자', 'material', 'plank', '#d19a60', '대패질을 마친 매끈한 판자.'),
  mk('nails', '못 한 줌', 'material', 'nails', '#9aa4a8', '크기가 고른 쇠못 한 줌.'),
  mk('wood-glue', '목공풀', 'material', 'bottle', '#f0e2b0', '나무를 붙이는 부드러운 풀.'),
  mk('straw', '짚 단', 'material', 'straw', '#e2c46a', '잘 마른 짚 단.'),
  // ---- 농장 시설·가구 ----
  mk('fence', '나무 울타리 한 칸', 'facility', 'fence', '#c98f55', '농장 가장자리를 두를 울타리.', { soon:HOME }),
  mk('crate', '나무 상자', 'facility', 'crate', '#b8844c', '물건을 차곡차곡 담는 튼튼한 상자.', { soon:HOME }),
  mk('compost-bin', '퇴비통', 'facility', 'bin', '#8a6a3e', '풀과 껍질을 삭혀 거름으로 만드는 통.', { soon:HOME }),
  mk('coop', '작은 닭장', 'facility', 'coop', '#d9a05b', '지붕이 있는 아담한 닭장.', { soon:HOME }),
  mk('scarecrow', '허수아비', 'facility', 'scarecrow', '#d9b36a', '밭을 지키는 짚 허수아비.', { soon:HOME }),
  mk('chair', '나무 의자', 'furniture', 'chair', '#c98f55', '앉으면 삐걱 소리가 나는 정직한 의자.', { soon:HOME }),
  mk('table', '작은 식탁', 'furniture', 'table', '#d19a60', '둘이 마주 앉기 좋은 식탁.', { soon:HOME }),
  mk('shelf', '벽 선반', 'furniture', 'shelf', '#b8844c', '책과 병을 올려 두는 벽 선반.', { soon:HOME }),
  mk('bed', '포근한 침대', 'furniture', 'bed', '#e58db3', '짚 대신 솜을 넣은 아늑한 침대.', { soon:HOME }),
  mk('lamp', '나무 등', 'furniture', 'lamp', '#ffcf70', '따뜻한 빛이 나는 나무 등.', { soon:HOME }),
  mk('rug', '포근한 러그', 'furniture', 'rug', '#c9707a', '발밑이 따뜻해지는 둥근 러그.', { soon:HOME }),
  // ---- 약초·포션·마법 소모품 ----
  mk('mint', '박하잎', 'herb', 'leaf', '#9fe0b0', '씹으면 입안이 시원해지는 박하잎.'),
  mk('chamomile', '카모마일', 'herb', 'flower', '#f7efd6', '마음을 가라앉히는 작은 꽃.'),
  mk('moonpetal', '달꽃잎', 'herb', 'flower', '#c9a6ff', '달빛 아래에서만 피는 옅은 보랏빛 꽃잎.'),
  mk('potion-small', '회복 포션 (소)', 'potion', 'potion', '#e0503c', '붉은 약병. 가벼운 상처와 피로에 씁니다.', { soon:USE }),
  mk('potion-medium', '회복 포션 (중)', 'potion', 'potion', '#d83a78', '진한 분홍빛 약병. 제법 큰 상처에도 듣습니다.', { soon:USE }),
  mk('potion-stamina', '기력 포션', 'potion', 'potion', '#6ec96a', '초록빛 약병. 지친 몸에 기운을 불어넣습니다.', { soon:USE }),
  mk('antidote', '해독약', 'potion', 'potion', '#6aa8e0', '파란 약병. 속이 불편할 때 마십니다.', { soon:USE }),
  mk('mana-dust', '마력 가루', 'magic', 'dust', '#b890ee', '보랏빛으로 반짝이는 마력 가루.', { soon:USE }),
  mk('purify-salt', '정화 소금', 'magic', 'jar', '#e6f1ff', '맑은 기운이 도는 소금 한 병.', { soon:USE }),
  mk('charm-candle', '부적 양초', 'magic', 'candle', '#c9a6ff', '작은 문양이 새겨진 보랏빛 양초.', { soon:USE }),
  // ---- 빵과 간식, 베이킹 재료, 음료 ----
  mk('salt-bread', '소금빵', 'snack', 'bread', '#e0b26a', '겉은 바삭하고 속은 촉촉한 소금빵.', { soon:EAT }),
  mk('butter-cookie', '버터 쿠키', 'snack', 'cookie', '#e8c27a', '입에서 사르르 녹는 쿠키.', { soon:EAT }),
  mk('jam-bun', '잼 빵', 'snack', 'bun', '#d9709c', '속에 베리 잼이 가득한 둥근 빵.', { soon:EAT }),
  mk('milk-loaf', '우유 식빵', 'snack', 'loaf', '#f0d79a', '폭신하고 고소한 식빵 한 덩이.', { soon:EAT }),
  mk('honey-candy', '꿀 사탕', 'snack', 'candy', '#f0b84a', '목이 칼칼할 때 좋은 꿀 사탕.', { soon:EAT }),
  mk('flour', '밀가루', 'ingredient', 'sack', '#f3ecd3', '고운 밀가루 한 포대.', { soon:COOK }),
  mk('sugar', '설탕', 'ingredient', 'jar', '#ffffff', '반짝이는 설탕 한 병.', { soon:COOK }),
  mk('butter', '버터', 'ingredient', 'butter', '#f5dc7a', '고소한 버터 한 덩이.', { soon:COOK }),
  mk('berry-juice', '베리 주스', 'snack', 'cup', '#b04a78', '새콤달콤한 이슬 베리 주스.', { soon:EAT }),
  mk('barley-tea', '보리차', 'snack', 'cup', '#b8844c', '구수하게 끓인 따뜻한 보리차.', { soon:EAT }),
  mk('herb-tea', '허브차', 'snack', 'cup', '#8fc96f', '안개 허브를 우려낸 향긋한 차.', { soon:EAT }),
  // ---- 목장 물품 ----
  mk('milk', '신선한 우유', 'ingredient', 'milk', '#f7f3e6', '아침에 짠 신선한 우유.', { soon:COOK }),
  mk('egg', '달걀', 'ingredient', 'egg', '#f3e2c0', '따끈한 달걀 한 알.', { soon:COOK }),
  mk('cheese', '목장 치즈', 'ingredient', 'cheese', '#f0c24a', '목장에서 숙성한 치즈 한 조각.', { soon:COOK }),
  mk('feed', '가축 사료', 'supply', 'sack', '#c9a56a', '곡식을 섞어 만든 사료 포대.', { soon:FARM }),
  mk('hay', '건초 묶음', 'supply', 'straw', '#d9c05a', '햇볕에 바싹 말린 건초.', { soon:FARM }),
].map(item => [item.id, item]));

/* 소지품·상점 목록의 분류(탭) */
export const GROUPS = [
  { id:'fish', label:'물고기', kinds:['fish'] },
  { id:'ore', label:'광석', kinds:['ore'] },
  { id:'farm', label:'농사', kinds:['seed', 'crop', 'fertilizer'] },
  { id:'ingredient', label:'재료', kinds:['ingredient', 'herb'] },
  { id:'food', label:'음식', kinds:['dish', 'snack'] },
  { id:'tool', label:'도구·장비', kinds:['tool'] },
  { id:'material', label:'자재', kinds:['material'] },
  { id:'goods', label:'생활·약품', kinds:['supply', 'potion', 'magic'] },
  { id:'furniture', label:'가구·시설', kinds:['furniture', 'facility'] },
  { id:'junk', label:'기타', kinds:['junk', 'quest', 'unknown'] },
];
export const groupOf = kind => (GROUPS.find(group => group.kinds.includes(kind)) || GROUPS[GROUPS.length - 1]).id;

/* 되팔 수 없는 물건: 고유 장비, 중요 물건(quest) */
export const isProtected = info => Boolean(info && (info.unique || info.kind === 'quest' || info.kind === 'tool'));

/* 가진 도구가 주는 실제 효과. 같은 종류는 가장 좋은 것 하나만 적용됩니다. */
export function equipmentBonus(items = {}) {
  const bonus = { mineSwings:0, biteWindow:1 };
  for (const [id, n] of Object.entries(items)) {
    const effect = n > 0 && GOODS[id]?.effect; if (!effect) continue;
    if (effect.mineSwings) bonus.mineSwings = Math.max(bonus.mineSwings, effect.mineSwings);
    if (effect.biteWindow) bonus.biteWindow = Math.max(bonus.biteWindow, effect.biteWindow);
  }
  return bonus;
}
