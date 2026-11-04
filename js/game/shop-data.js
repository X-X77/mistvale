// 상점 중앙 데이터: 가격표, 상점(클로버 잡화점 하나), 엑스의 비밀 선물.
// 가격을 바꾸고 싶으면 아래 PRICES 표만 고치면 됩니다. (buy: 상점에서 사는 값, sell: 상점이 쳐 주는 값)
// 사 주는 것(물고기·광석·요리)과 파는 것(미끼·장비·식재료)이 겹치지 않아서, 사고팔기만으로는 코인이 불어나지 않습니다.
import { DISH_QUALITY } from './items.js?v=sh2';
import { GIFT_UNLOCK } from './progress.js?v=sh2';

/* ---------------- 가격표 (코인) ---------------- */
export const PRICES = {
  // 물고기 — 흔한 것은 적게, 희귀·특수는 크게
  'silver-minnow':{ sell:22 }, 'reed-crucian':{ sell:32 }, 'mist-trout':{ sell:110 }, 'moon-carp':{ sell:300 },
  'tide-mackerel':{ sell:28 }, 'reef-bream':{ sell:40 }, 'lighthouse-bass':{ sell:125 }, 'fog-anglerfish':{ sell:330 },
  // 광석
  'moss-copper':{ sell:25 }, 'silver-mist-stone':{ sell:95 }, 'moondrop-crystal':{ sell:260 },
  // 요리 재료 (숲에서 채집해도 되고, 급하면 사도 됩니다. 되팔지는 않습니다)
  herb:{ buy:16 }, mushroom:{ buy:20 }, berry:{ buy:18 },
  // 낚시 미끼 (던질 때마다 1개)
  'bait-worm':{ buy:15 }, 'bait-glow':{ buy:45 },
  // 장비 (하나만 살 수 있고 되팔 수 없음)
  'rod-steel':{ buy:400 }, 'pick-copper':{ buy:400 },
};
/* 직접 만든 요리의 기본 판매가. 품질 배율(일반 ×1, 잘 만든 ×1.5, 훌륭한 ×2.2)은 items.js 의 DISH_QUALITY 를 따릅니다.
   실패작(검게 탄 덩어리)은 값이 없고 팔 수도 없습니다. */
export const DISH_BASE = { 'herb-grilled-fish':72, 'forest-mushroom-soup':64, 'dew-berry-jam':66 };

export function buyPrice(id) { return PRICES[id]?.buy || 0; }
/** 상점이 사 주는 기본 값 (1개) */
export function baseSell(id) {
  if (PRICES[id]?.sell) return PRICES[id].sell;
  if (id.startsWith('dish:')) {
    const [, recipe, quality] = id.split(':'), mult = DISH_QUALITY.find(q => q.id === quality)?.mult || 0;
    return DISH_BASE[recipe] && mult ? Math.round(DISH_BASE[recipe] * mult) : 0;
  }
  return 0;
}

/* ---------------- 상점: 클로버 잡화점 하나 ---------------- */
// buys 의 키: '분류id'(fish, ore, food …) · 'kind:종류' · 'id:물품id'. 값은 매입 배율(없으면 사지 않음).
export const SHOPS = {
  clover: {
    id:'clover', placeId:'clover', npcId:'rowen', name:'클로버 잡화점', tagline:'미니게임에 필요한 건 다 있어요',
    stock:[{ id:'bait-worm' }, { id:'bait-glow' }, { id:'rod-steel' }, { id:'pick-copper' }, { id:'herb' }, { id:'mushroom' }, { id:'berry' }],
    buys:{ fish:1, ore:1, food:1 },
    lines:{
      greet:['어서 오세요, 농장주님. 낚시, 채광, 요리 — 필요한 건 여기 다 있어요.', '잡아 오신 건 제가 받아 드릴게요. 편하게 둘러보세요.'],
      buy:['좋은 선택이에요. 포장은 서비스고요.', '딱 필요하던 걸 고르셨네요. 감이 좋은데요?', '네, 여기 있어요. 잘 쓰세요, 농장주님.'],
      sell:['오, 손질이 잘 됐네요. 후하게 쳐 드릴게요.', '네, 받았어요. 장부에 또박또박 적어 둘게요.', '좋아요. 이런 건 금방 나가거든요.'],
      sellBig:['와, 오늘 장사 잘하셨네요. 저까지 기분이 좋아요.', '이만큼이면 짐이 꽤 가벼워지셨겠어요. 하하.'],
      rare:['세상에, 이건 귀한 건데요? 제 눈이 다 반짝이네요.'],
      poor:['음, 코인이 조금 모자라네요. 물건은 도망 안 가니까 천천히요.'],
      lack:['어라, 그만큼은 안 갖고 계신데요?'],
      full:['이건 더 들고 가시면 가방이 터져요. 조금 쓰고 오세요.'],
      owned:['이건 이미 가지고 계시잖아요. 하나면 충분해요.'],
      nobuy:['그건 저희 가게에선 받질 않아요.'],
      empty:['팔 만한 물건이 없네요. 한 번 다녀오시면 제가 기다리고 있을게요.'],
      gift:['……어머, 이건 제가 판 게 아닌데요? 누가 몰래 두고 간 것 같아요.', '이건 저도 처음 보는 상자예요. 어쩐지 시끄러운 기운이…'],
      bye:['또 오세요, 농장주님.'],
    },
  },
};
export const shopByPlace = placeId => Object.values(SHOPS).find(shop => shop.placeId === placeId) || null;
export const shopByNpc = npcId => Object.values(SHOPS).find(shop => shop.npcId === npcId) || null;

/* ---------------- 규칙 값 ---------------- */
export const COIN_NAME = '코인';
export const MAX_COINS = 999999;
export const MAX_STACK = 99;              // 구매로 한 물건을 이만큼까지만 쌓을 수 있습니다
export const MAX_QTY = 99;

/* ---------------- 엑스의 비밀 선물 ---------------- */
export const GIFT = {
  id:'x-gift', name:'엑스의 비밀 선물', unlockEarned:GIFT_UNLOCK, cost:5000,
  effect:'케이브덕 본편 시작 소지금 500G → 10,000G',
  // 코드는 화면 어디에도 미리 그려지지 않고, 구매 뒤 보상 화면에서만 풀어서 보여 줍니다.
  // (정적 사이트라 소스를 열어 보면 찾을 수는 있습니다. 서버 검증이 아니라 '연출상의 가림'입니다.)
  sealed:'WF9YLU5ZQU5H',
};
export const giftCode = () => { try { return atob(GIFT.sealed); } catch { return ''; } };
/* 이 코인은 이 브라우저 안에서만 쓰이고, 케이브덕과의 계정 연동이나 코드 사용 확인은 하지 않습니다. */
export const GIFT_NOTE = '이 코드는 케이브덕 본편에서 직접 입력해 쓰는 특별 시작 코드예요. 이 사이트는 코드가 실제로 쓰였는지 확인하지 않아요.';
