// 상점 중앙 데이터: 가격표, 상점별 판매 목록·매입 목록·영업시간·NPC 대사.
// 가격을 바꾸고 싶으면 아래 PRICES 표만 고치면 됩니다. (buy: 상점에서 사는 값, sell: 상점이 쳐 주는 기본 값)
// 판매가는 상점마다 '매입 배율'이 곱해집니다(전문 상점은 자기 분야를 더 후하게 쳐 줍니다).
// 규칙(tests 가 검사합니다): 어떤 상점에서 팔아도 구매가의 60%를 넘지 못합니다 → 사고팔기만 해서는 돈이 불어나지 않습니다.
import { DISH_QUALITY } from './items.js?v=sh1';

/* ---------------- 가격표 (G) ---------------- */
export const PRICES = {
  // 물고기 — 흔한 것은 적게, 희귀·특수는 크게
  'silver-minnow':{ sell:14 }, 'reed-crucian':{ sell:20 }, 'mist-trout':{ sell:70 }, 'moon-carp':{ sell:190 },
  'tide-mackerel':{ sell:18 }, 'reef-bream':{ sell:28 }, 'lighthouse-bass':{ sell:80 }, 'fog-anglerfish':{ sell:210 },
  // 광석
  'moss-copper':{ sell:16 }, 'silver-mist-stone':{ sell:60 }, 'moondrop-crystal':{ sell:170 },
  // 채집·요리 재료 (직접 채집하면 팔 때 값이 낮고, 사 오면 비쌉니다)
  herb:{ buy:16, sell:7 }, mushroom:{ buy:20, sell:9 }, berry:{ buy:18, sell:8 },
  // 씨앗 (growDays 는 goods.js. 작물 판매가는 씨앗값과 자라는 날수에 맞춰 둠)
  'seed-turnip':{ buy:30, sell:12 }, 'seed-pea':{ buy:40, sell:16 }, 'seed-tomato':{ buy:55, sell:22 }, 'seed-corn':{ buy:70, sell:28 },
  'seed-pumpkin':{ buy:85, sell:34 }, 'seed-sweet-potato':{ buy:60, sell:24 }, 'seed-leek':{ buy:50, sell:20 },
  // 작물 (수확물. 상점에서는 팔지 않습니다)
  'crop-turnip':{ sell:45 }, 'crop-pea':{ sell:60 }, 'crop-tomato':{ sell:78 }, 'crop-corn':{ sell:105 },
  'crop-pumpkin':{ sell:130 }, 'crop-sweet-potato':{ sell:92 }, 'crop-leek':{ sell:75 },
  'fertilizer-basic':{ buy:35, sell:12 }, 'fertilizer-rich':{ buy:90, sell:32 },
  // 생활용품·기초 소모품
  candle:{ buy:24, sell:8 }, rope:{ buy:28, sell:10 }, 'lantern-oil':{ buy:30, sell:10 }, 'cloth-bag':{ buy:40, sell:14 }, torch:{ buy:18, sell:6 }, bandage:{ buy:22, sell:8 },
  // 도구·장비 (되팔 수 없음)
  hoe:{ buy:160 }, 'watering-can':{ buy:140 }, sickle:{ buy:120 },
  'pick-copper':{ buy:280 }, 'pick-silver':{ buy:600 }, 'rod-bamboo':{ buy:180 }, 'rod-steel':{ buy:450 },
  // 수리·강화·목재·제작 재료
  'iron-scrap':{ buy:40, sell:14 }, charcoal:{ buy:28, sell:10 }, whetstone:{ buy:60, sell:22 },
  log:{ buy:20, sell:7 }, plank:{ buy:36, sell:13 }, nails:{ buy:18, sell:6 }, 'wood-glue':{ buy:26, sell:9 }, straw:{ buy:12, sell:4 },
  // 농장 시설·가구
  fence:{ buy:70, sell:24 }, crate:{ buy:90, sell:32 }, 'compost-bin':{ buy:160, sell:56 }, coop:{ buy:480, sell:168 }, scarecrow:{ buy:150, sell:52 },
  chair:{ buy:140, sell:48 }, table:{ buy:260, sell:90 }, shelf:{ buy:210, sell:72 }, bed:{ buy:620, sell:215 }, lamp:{ buy:120, sell:42 }, rug:{ buy:180, sell:62 },
  // 약초·포션·마법 소모품
  mint:{ buy:18, sell:7 }, chamomile:{ buy:22, sell:8 }, moonpetal:{ buy:42, sell:15 },
  'potion-small':{ buy:70, sell:24 }, 'potion-medium':{ buy:160, sell:56 }, 'potion-stamina':{ buy:95, sell:33 }, antidote:{ buy:80, sell:28 },
  'mana-dust':{ buy:55, sell:19 }, 'purify-salt':{ buy:45, sell:16 }, 'charm-candle':{ buy:65, sell:22 },
  // 빵·간식·음료, 베이킹 재료
  'salt-bread':{ buy:28, sell:10 }, 'butter-cookie':{ buy:22, sell:8 }, 'jam-bun':{ buy:36, sell:13 }, 'milk-loaf':{ buy:42, sell:15 }, 'honey-candy':{ buy:12, sell:4 },
  flour:{ buy:24, sell:8 }, sugar:{ buy:20, sell:7 }, butter:{ buy:32, sell:11 },
  'berry-juice':{ buy:18, sell:6 }, 'barley-tea':{ buy:14, sell:5 }, 'herb-tea':{ buy:16, sell:6 },
  // 목장 물품
  milk:{ buy:28, sell:10 }, egg:{ buy:18, sell:6 }, cheese:{ buy:52, sell:18 }, feed:{ buy:30, sell:10 }, hay:{ buy:20, sell:7 },
  // 검게 탄 덩어리: 거름 값으로 1G
  'dish:burnt':{ sell:1 },
};
/* 직접 만든 요리의 기본 판매가. 품질 배율(일반 ×1, 잘 만든 ×1.5, 훌륭한 ×2.2)은 items.js 의 DISH_QUALITY 를 따릅니다.
   재료를 사서 만들면 '일반'은 본전 안팎, 솜씨가 좋을수록 이익이 남도록 맞춘 값입니다. */
export const DISH_BASE = { 'herb-grilled-fish':46, 'forest-mushroom-soup':40, 'dew-berry-jam':42 };

export function buyPrice(id) { return PRICES[id]?.buy || 0; }
/** 상점 배율을 곱하기 전의 기본 판매가 */
export function baseSell(id) {
  if (PRICES[id]?.sell) return PRICES[id].sell;
  if (id.startsWith('dish:')) {
    const [, recipe, quality] = id.split(':'), mult = DISH_QUALITY.find(q => q.id === quality)?.mult || 0;
    return DISH_BASE[recipe] && mult ? Math.round(DISH_BASE[recipe] * mult) : 0;
  }
  return 0;
}

/* ---------------- 영업시간 ---------------- */
// 분 단위. 닫는 시각이 여는 시각보다 작으면 자정을 넘기는 영업(예: 16:00~02:00)입니다.
const H = (open, close) => ({ open:open * 60, close:close * 60 });

/* ---------------- 상점 ---------------- */
// buys 의 키: '분류id'(fish, ore, farm, ingredient, food, tool, material, goods, furniture) · 'kind:종류' · 'id:물품id'. 값은 매입 배율(없으면 사지 않음). 구체적인 키가 우선합니다.
// stock: 판매 목록. need 가 있으면 그 물건들을 함께 내야 살 수 있는 '강화'이며, 낸 물건은 사라집니다. replaces 는 그 장비가 새것으로 바뀐다는 뜻입니다.
export const SHOPS = {
  clover: {
    id:'clover', placeId:'clover', npcId:'rowen', name:'클로버 잡화점', tagline:'씨앗부터 소소한 살림까지', theme:'clover', hours:H(9, 18),
    stock:[{id:'seed-turnip'}, {id:'seed-pea'}, {id:'seed-tomato'}, {id:'seed-corn'}, {id:'seed-pumpkin'}, {id:'seed-sweet-potato'}, {id:'seed-leek'},
      {id:'fertilizer-basic'}, {id:'fertilizer-rich'}, {id:'herb'}, {id:'mushroom'},
      {id:'candle'}, {id:'rope'}, {id:'lantern-oil'}, {id:'cloth-bag'}, {id:'torch'}, {id:'bandage'}],
    // 로웬은 일반적인 물건이면 대부분 받아 줍니다(도구·장비 같은 고유 물품만 제외).
    buys:{ fish:1, ore:1, farm:1, ingredient:1, food:1, material:1, goods:1, furniture:1, 'id:dish:burnt':1 },
    lines:{
      greet:['어서 오세요, 농장주님. 필요한 건 천천히 골라 보세요.', '오늘 들어온 씨앗도 있어요. 구경만 하셔도 돈은 안 받아요.'],
      buy:['좋은 선택이에요. 포장은 서비스고요.', '딱 필요하던 걸 고르셨네요. 감이 좋은데요?', '네, 여기 있어요. 잘 쓰세요, 농장주님.'],
      sell:['오, 손질이 잘 됐네요. 후하게 쳐 드릴게요.', '네, 받았어요. 장부에 또박또박 적어 둘게요.', '좋아요. 이런 건 금방 나가거든요.'],
      sellBig:['와, 오늘 장사 잘하셨네요. 저까지 기분이 좋아요.', '이만큼이면 짐이 꽤 가벼워지셨겠어요. 하하.'],
      rare:['세상에, 이건 귀한 건데요? 제 눈이 다 반짝이네요.'],
      poor:['음, 주머니가 조금 가볍네요. 물건은 도망 안 가니까 천천히요.'],
      lack:['어라, 그만큼은 안 갖고 계신데요?'],
      full:['이건 더 들고 가시면 가방이 터져요. 조금 비워 볼까요?'],
      owned:['이건 이미 가지고 계시잖아요.'],
      need:['재료가 조금 모자라요. 다 갖춰 오시면 그때 해 드릴게요.'],
      nobuy:['그건 저희 가게에선 받질 않아요.'],
      empty:['팔 만한 물건이 없네요. 나갔다 오시면 제가 기다리고 있을게요.'],
      closed:['오늘 장사는 끝났어요. 내일 아침에 다시 와 주세요.', '문은 닫았지만, 구경은 창밖에서 하셔도 좋아요.'],
      bye:['또 오세요, 농장주님.'],
    },
  },
  forge: {
    id:'forge', placeId:'forge', npcId:'bianca', name:'검은모루 대장간', tagline:'쇠는 거짓말을 안 한다', theme:'forge', hours:H(8, 17),
    stock:[{id:'pick-copper'},
      {id:'pick-silver', need:{ 'pick-copper':1, 'silver-mist-stone':3, 'iron-scrap':3, charcoal:2 }, replaces:'pick-copper'},
      {id:'rod-steel', need:{ 'rod-bamboo':1, 'moss-copper':3, 'iron-scrap':2, whetstone:1 }, replaces:'rod-bamboo'},
      {id:'hoe'}, {id:'watering-can'}, {id:'sickle'}, {id:'iron-scrap'}, {id:'charcoal'}, {id:'whetstone'}],
    buys:{ ore:1.15, 'id:iron-scrap':1.1, 'id:charcoal':1.1, 'id:whetstone':1.1 },
    lines:{
      greet:['어이, 신참. 필요한 거 골라. 불 가까이는 조심하고.', '쇠 사러 왔냐, 팔러 왔냐. 빨리 말해.'],
      buy:['쇠 값은 한다. 잘 써.', '좋아. 계산은 확실하게.', '가져가. 망가뜨리면 다시 벼려 주지.'],
      sell:['흠, 괜찮은 돌이군. 값은 쳐 주지.', '좋아, 받았다.', '이 정도면 불 땐 보람이 있겠어.'],
      sellBig:['오호, 제법 캐 왔는데? 이 값이면 어디 가서 안 밀려.'],
      rare:['…이건 물건이군. 대장장이 손이 떨리는 건 오랜만이야.'],
      poor:['돈이 모자라. 더 모아서 와.'],
      lack:['없는 걸 어떻게 팔아. 장난하냐.'],
      full:['더는 못 들고 가. 좀 비우고 와.'],
      owned:['이미 갖고 있잖아. 하나면 충분해.'],
      need:['재료가 모자라. 다 갖춰 와, 그때 두들겨 주지.'],
      nobuy:['그건 내 소관이 아니다. 광석이나 쇠붙이를 가져와.'],
      empty:['가져온 게 없잖아. 동굴에 한번 다녀와.'],
      closed:['불 껐다. 내일 아침에 와.', '쇠도 쉬어야 단단해진다. 내일 와.'],
      bye:['어이, 또 와라.'],
    },
  },
  workshop: {
    id:'workshop', placeId:'workshop', npcId:'noah', name:'참나무 공방', tagline:'나뭇결을 살려 짓습니다', theme:'workshop', hours:H(8, 17),
    stock:[{id:'rod-bamboo'}, {id:'log'}, {id:'plank'}, {id:'nails'}, {id:'wood-glue'}, {id:'straw'},
      {id:'fence'}, {id:'crate'}, {id:'compost-bin'}, {id:'scarecrow'}, {id:'coop'},
      {id:'chair'}, {id:'table'}, {id:'shelf'}, {id:'lamp'}, {id:'rug'}, {id:'bed'}],
    buys:{ furniture:1, 'id:log':1.1, 'id:plank':1.1, 'id:nails':1.1, 'id:wood-glue':1.1, 'id:straw':1.1 },
    lines:{
      greet:['아, 어서 오세요. 톱밥이 날려서 죄송해요. 편하게 둘러보세요.', '필요한 게 있으면 말씀해 주세요. 마르지 않은 건 만지지 마시고요.'],
      buy:['아, 네. 잘 고르셨어요. 마감은 제대로 해 뒀어요.', '여기요. 나무라서 시간이 지나면 더 좋아질 거예요.', '고맙습니다. 소중히 써 주세요.'],
      sell:['아, 네… 결이 곱네요. 받겠습니다.', '이건 쓸모가 많겠어요. 고맙습니다.'],
      sellBig:['이만큼이나요? 아, 네… 오늘 작업이 한결 수월해지겠어요.'],
      rare:['이건 정말 좋은 거네요. 아, 네… 제가 약간 설렜어요.'],
      poor:['아, 죄송해요. 금액이 조금 모자라요. 천천히 모아도 괜찮아요.'],
      lack:['아, 네… 그만큼은 갖고 계시지 않은 것 같아요.'],
      full:['아, 그만큼은 못 들고 가세요. 조금만 줄여 볼까요?'],
      owned:['이건 이미 가지고 계신 걸로 알고 있어요.'],
      need:['아, 네… 재료가 조금 모자라요. 마감이 중요한 작업이라서요.'],
      nobuy:['죄송해요. 그건 제 쪽 물건이 아니라서요.'],
      empty:['아, 오늘은 가져오신 게 없네요. 괜찮아요, 천천히요.'],
      closed:['아, 죄송해요. 지금은 작업을 쉬고 있어요. 내일 오세요.'],
      bye:['아, 네. 살펴 가세요.'],
    },
  },
  apothecary: {
    id:'apothecary', placeId:'apothecary', npcId:'lillian', name:'보랏빛 약방', tagline:'약효는 정직하게', theme:'apothecary', hours:H(10, 19),
    stock:[{id:'herb'}, {id:'mint'}, {id:'chamomile'}, {id:'moonpetal'},
      {id:'potion-small'}, {id:'potion-medium'}, {id:'potion-stamina'}, {id:'antidote'},
      {id:'mana-dust'}, {id:'purify-salt'}, {id:'charm-candle'}],
    buys:{ 'id:herb':1.2, 'id:mushroom':1.2, 'id:berry':1.2, 'id:mint':1.1, 'id:chamomile':1.1, 'id:moonpetal':1.1, 'id:moondrop-crystal':1.2, 'kind:potion':1, 'kind:magic':1 },
    lines:{
      greet:['필요한 약효가 있으신가요?', '약초인가요, 포션인가요? 말씀해 주세요.'],
      buy:['용법은 지켜 주세요. 아시겠죠?', '계산되었습니다. 보관은 서늘한 곳이 좋아요.', '네. 필요한 만큼만 쓰시는 게 좋습니다.'],
      sell:['상태는 양호하네요. 받겠습니다.', '신선한가요? …네, 신선하군요. 받겠습니다.'],
      sellBig:['양이 많군요. 감사합니다. 쓸 데가 많습니다.'],
      rare:['…이건 흔치 않은 물건이네요. 값을 더 쳐 드려도 될까요?'],
      poor:['금액이 부족합니다. 다른 것으로 하시겠어요?'],
      lack:['수량이 맞지 않습니다. 다시 확인하시겠어요?'],
      full:['그만큼은 가지고 계시기 어렵습니다. 줄이시겠어요?'],
      owned:['이미 가지고 계십니다.'],
      need:['필요한 물건이 모자랍니다.'],
      nobuy:['그건 취급하지 않습니다. 약초나 약병인가요?'],
      empty:['가져오신 약재가 없습니다. 채집은 하셨나요?'],
      closed:['영업 시간이 아닙니다. 급한 증상이라면 진료소로 가세요.'],
      bye:['…살펴 가세요.'],
    },
  },
  bakery: {
    id:'bakery', placeId:'bakery', npcId:'cordelia', name:'햇살 제과점', tagline:'갓 구운 빵 나왔어요!', theme:'bakery', hours:H(7, 16),
    stock:[{id:'salt-bread'}, {id:'milk-loaf'}, {id:'jam-bun'}, {id:'butter-cookie'}, {id:'honey-candy'},
      {id:'flour'}, {id:'sugar'}, {id:'butter'}, {id:'berry'}],
    buys:{ food:1.15, 'id:berry':1.1, 'id:flour':1.05, 'id:sugar':1.05, 'id:butter':1.05, 'id:milk':1.05, 'id:egg':1.05, 'id:cheese':1.05 },
    lines:{
      greet:['어머, 어서 오세요! 마침 빵이 막 나왔답니다!', '오늘은 뭘 드릴까요? 달콤한 것도 담백한 것도 있어요!'],
      buy:['어머, 좋은 선택이에요! 따끈할 때 드세요!', '여기요! 서비스로 마음을 조금 더 담았어요!', '맛있게 드세요! 또 오세요, 단골님!'],
      sell:['어머, 이거 정말 먹음직스러워요! 받을게요!', '와, 솜씨가 좋으시네요! 가게에 내놔도 되겠어요!'],
      sellBig:['어머머, 이렇게나요? 오늘 진열대가 풍성해지겠어요!'],
      rare:['어머! 이렇게 훌륭한 걸요? 사진이라도 남기고 싶어요!'],
      poor:['어머, 조금 모자라네요! 아쉽지만 다음에 꼭 오세요!'],
      lack:['어머, 그만큼은 없으신 것 같은데요?'],
      full:['어머, 그만큼은 두 손에 다 못 드세요!'],
      owned:['어머, 이미 있으시잖아요!'],
      need:['어머, 재료가 조금 모자라요!'],
      nobuy:['어머, 그건 빵집에서는 받질 못해요. 미안해요!'],
      empty:['어머, 오늘은 가져오신 게 없네요! 요리해 오시면 제가 먼저 볼게요!'],
      closed:['어머, 오늘은 다 팔고 문 닫았어요! 내일 아침에 오세요!'],
      bye:['또 오세요! 단골님!'],
    },
  },
  ranch: {
    id:'ranch', placeId:'ranch', npcId:'mariel', name:'푸른목초 목장 매점', tagline:'아침에 짠 우유 있어!', theme:'ranch', hours:H(6, 16),
    stock:[{id:'milk'}, {id:'egg'}, {id:'cheese'}, {id:'feed'}, {id:'hay'}],
    buys:{ 'kind:crop':1.1, 'id:milk':1.15, 'id:egg':1.15, 'id:cheese':1.15, 'id:hay':1, 'id:feed':1, 'id:straw':1, 'id:dish:burnt':1 },
    lines:{
      greet:['하하! 왔어? 우유든 치즈든 필요하면 골라 봐!', '오늘 소들 기분이 최고야! 구경하고 가!'],
      buy:['좋아, 신선할 때 써! 하하!', '자, 여기! 잘 챙겨 가!', '한가득 줬으니까 맛있게 먹어!'],
      sell:['오, 이거 좋은데! 소들도 좋아하겠어!', '좋아, 받았어! 하하!'],
      sellBig:['와하하! 이만큼이면 소들 사료 걱정은 없겠다!'],
      rare:['오오, 이건 귀한 건데! 큰 소리로 자랑해야겠어!'],
      poor:['돈이 좀 모자라네! 다음에 해! 걱정은 소한테나 줘!'],
      lack:['어? 그만큼은 없잖아! 다시 세어 봐!'],
      full:['그만큼은 못 들어! 좀 비우고 와!'],
      owned:['이미 있잖아!'],
      need:['재료가 모자라!'],
      nobuy:['그건 목장에선 안 받아! 작물이나 우유 쪽이면 몰라도!'],
      empty:['가져온 게 없네! 밭에서 수확하면 와!'],
      closed:['오늘은 끝! 소들도 잠자리에 들었어! 내일 일찍 와!'],
      bye:['또 와! 소들이 기다려!'],
    },
  },
  pub: {
    id:'pub', placeId:'pub', npcId:'isabel', name:'달맞이 주점', tagline:'저녁엔 사연이 모입니다', theme:'pub', hours:H(16, 2),
    stock:[{id:'herb-tea'}, {id:'barley-tea'}, {id:'berry-juice'}],
    buys:{ fish:1.1, 'kind:dish':1.2 },
    lines:{
      greet:['어머, 새 얼굴이네. 뭐 줄까? 안주거리 가져왔으면 구경부터 시켜 줘.', '어서 와. 오늘 밤은 기네. 천천히 있다 가.'],
      buy:['자, 한 잔. 천천히 마셔.', '좋은 선택이야. 입에 맞을 거야, 호호.', '여기. 계산은 기억해 둘게.'],
      sell:['호호, 안주로 딱이네. 받을게.', '신선한걸? 이런 건 밤에 불티나게 나가.', '솜씨 좋은데, 자기. 단골 하자.'],
      sellBig:['어머, 이렇게나? 오늘 밤 우리 집 메뉴가 풍성해지겠다.'],
      rare:['어머, 이건 구경거리야. 손님들한테 자랑해야겠어.'],
      poor:['어머, 돈이 모자라네. 외상은 안 되는데, 호호.'],
      lack:['어머, 그만큼은 없는데? 장난치지 마.'],
      full:['그만큼은 못 들어. 좀 비우고 와.'],
      owned:['이미 있잖아, 자기.'],
      need:['재료가 모자라네.'],
      nobuy:['그건 우리 집 메뉴가 아니야. 생선이나 요리를 가져와.'],
      empty:['가져온 게 없네? 요리나 생선이 있으면 언제든 와.'],
      closed:['아직 문 안 열었어. 저녁에 와, 자기.'],
      bye:['또 와. 이야기는 공짜니까.'],
    },
  },
};
export const shopByPlace = placeId => Object.values(SHOPS).find(shop => shop.placeId === placeId) || null;
export const shopByNpc = npcId => Object.values(SHOPS).find(shop => shop.npcId === npcId) || null;

/* ---------------- 장비 계열: 같은 계열은 더 좋은 것을 가지고 있으면 낮은 것을 사지 않습니다 ---------------- */
export const TOOL_LINES = { pick:['pick-copper', 'pick-silver'], rod:['rod-bamboo', 'rod-steel'] };

/* ---------------- 규칙 값 ---------------- */
export const START_GOLD_NOTE = 500;       // 웹사이트의 시작 소지금(케이브덕 본편의 시작 소지금과는 별개)
export const MAX_GOLD = 999999;
export const MAX_STACK = 99;              // 구매로 한 물건을 이만큼까지만 쌓을 수 있습니다
export const MAX_QTY = 99;

/* ---------------- 특별 시작 코드 (일반 상점과 별개) ---------------- */
// 보상 포인트(P)는 골드(G)와 다른 재화입니다. 상점은 G 만 씁니다.
// 아래는 '기획 값'이며, 이 사이트에는 아직 P 를 모으는 기능도, 케이브덕과의 직접 연동·서버 검증도 없습니다.
export const SPECIAL_CODE = { code:'X_X-NYANG', cost:5000, unit:'P', effect:'케이브덕 본편 시작 소지금 500G → 10,000G', implemented:false };
