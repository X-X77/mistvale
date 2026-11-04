// 상점 물품 아이콘(16×16 픽셀 그림). goods.js 의 icon 종류마다 한 장씩 코드로 그리고, 색은 물품의 color 를 따라 바뀝니다.
// art.js 의 iconSprite 가 불러다 씁니다. 윤곽선은 art.js 쪽에서 다른 아이콘과 똑같이 둘러 줍니다(그림 둘레에 1칸 여백).
import { INK, mix, light, dark } from './pixel.js?v=mg4';


const WOOD = '#a77746', WOOD_L = '#d19a60', WOOD_D = '#6a4527', STEEL = '#c5d0d2', STEEL_D = '#7c8e92', CREAM = '#f3ecd3', LEAF = '#78b86a', LEAF_D = '#3f7a4e', GLASS = '#dff1f2';

const pick = (p, c) => { p.line(3, 14, 11, 6, WOOD); p.line(4, 14, 12, 6, WOOD_D); p.poly([[2, 6], [6, 2], [11, 2], [14, 5], [13, 8], [10, 5], [7, 5], [4, 8]], c); p.poly([[6, 2], [11, 2], [13, 4], [10, 4], [7, 4]], light(c, .5)); p.rect(7, 5, 3, 1, dark(c, .3)); p.rect(7, 6, 3, 2, WOOD_D); p.px(2, 6, dark(c, .3)); p.px(14, 5, dark(c, .3)); p.px(4, 7, dark(c, .2)); };
const rod = (p, c) => { p.line(2, 14, 12, 2, c); p.line(3, 14, 13, 2, dark(c, .22)); p.line(13, 2, 14, 3, '#f7efd6'); p.line(14, 3, 14, 10, '#f7efd6'); p.rect(13, 10, 3, 1, '#e0503c'); p.px(14, 11, STEEL); p.disc(5, 11, 1, STEEL_D); p.px(5, 11, STEEL); p.px(4, 12, light(c, .4)); p.px(7, 8, light(c, .4)); };

const worm = (p, c) => { p.ellipse(8, 11, 6, 3, '#6a4a32'); p.ellipse(8, 10, 5, 2, '#8a6244'); p.line(3, 9, 5, 7, c); p.line(5, 7, 8, 8, c); p.line(8, 8, 10, 6, c); p.line(10, 6, 13, 7, c); p.line(3, 10, 5, 8, dark(c, .2)); p.line(5, 8, 8, 9, dark(c, .2)); p.line(8, 9, 10, 7, dark(c, .2)); p.line(10, 7, 13, 8, dark(c, .2)); p.px(13, 6, '#2a1c16'); p.px(6, 7, light(c, .4)); p.px(9, 6, light(c, .4)); p.px(3, 12, '#5a3e28'); p.px(12, 12, '#5a3e28'); };
const glow = (p, c) => { p.ellipse(8, 9, 5, 4, '#2a3a5a'); p.ellipse(7, 8, 3, 2, '#3a4e78'); p.disc(8, 8, 3, c); p.disc(7, 7, 1, '#ffffff'); p.px(8, 5, '#fff3a8'); p.px(8, 12, '#fff3a8'); p.px(4, 8, '#fff3a8'); p.px(12, 8, '#fff3a8'); p.px(5, 5, light(c, .5)); p.px(11, 5, light(c, .5)); p.px(5, 12, light(c, .4)); p.px(11, 12, light(c, .4)); };
const gift = (p, c) => { p.rect(2, 7, 12, 7, c); p.rect(2, 7, 12, 1, light(c, .35)); p.rect(2, 13, 12, 1, dark(c, .25)); p.rect(1, 4, 14, 3, dark(c, .08)); p.rect(1, 4, 14, 1, light(c, .4)); p.rect(7, 4, 2, 10, '#f0cf5a'); p.rect(7, 4, 1, 10, '#fff3a8'); p.ellipse(5, 3, 2, 1, '#f0cf5a'); p.ellipse(11, 3, 2, 1, '#f0cf5a'); p.disc(8, 3, 1, '#c9a24a'); p.px(4, 9, light(c, .5)); p.px(12, 11, dark(c, .3)); p.px(13, 1, '#fff3a8'); p.px(2, 2, '#fff3a8'); };

const chest = (p, c) => { p.rect(2, 8, 12, 6, c); p.rect(2, 8, 12, 1, light(c, .3)); p.rect(2, 13, 12, 1, dark(c, .3)); p.rect(2, 8, 1, 6, dark(c, .1)); p.rect(3, 4, 10, 4, light(c, .08)); p.rect(4, 3, 8, 1, light(c, .3)); p.rect(3, 4, 10, 1, light(c, .25)); p.rect(2, 7, 12, 1, '#c9a24a'); p.rect(4, 4, 1, 10, '#c9a24a'); p.rect(11, 4, 1, 10, '#c9a24a'); p.rect(7, 7, 2, 3, '#f0cf5a'); p.px(8, 8, INK); p.px(7, 7, '#fff3a8'); };
const chestOpen = (p, c) => { p.poly([[3, 7], [4, 1], [12, 1], [13, 7]], light(c, .08)); p.poly([[4, 6], [5, 2], [11, 2], [12, 6]], dark(c, .4)); p.rect(4, 1, 8, 1, light(c, .3)); p.rect(2, 8, 12, 6, c); p.rect(2, 8, 12, 1, '#2a1c10'); p.rect(2, 13, 12, 1, dark(c, .3)); p.rect(2, 8, 1, 6, dark(c, .1)); p.rect(4, 9, 8, 1, dark(c, .12)); p.rect(4, 7, 8, 1, '#fff3a8'); p.rect(5, 6, 6, 1, '#ffe27a'); p.rect(4, 8, 1, 6, '#c9a24a'); p.rect(11, 8, 1, 6, '#c9a24a'); p.px(7, 4, '#fff3a8'); p.px(9, 3, '#ffffff'); p.px(5, 5, '#fff3a8'); p.px(11, 4, '#fff3a8'); };

const DRAW = { pick, rod, worm, glow, gift, chest, chestOpen };
export const GOODS_ICON_KINDS = Object.keys(DRAW);
/** 물품 정보(goods.js)에 맞는 그림 함수를 돌려줍니다. 없으면 null */
export function goodsIconDraw(info) { const draw = DRAW[info.icon]; return draw ? p => draw(p, info.color || '#999', info) : null; }
