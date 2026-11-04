// 요리 화면 전용 픽셀 그림: 식칼, 도마 위 재료, 구이 생선, 완성 접시. (art.js 의 아이콘과 같은 윤곽선·팔레트)
import { Pix, INK, mix, light, dark, hash } from './pixel.js?v=sh1';

const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

/* ---------- 식칼: 손잡이가 위, 칼날 끝이 아래. 끝 가운데가 (tipX, tipY) ---------- */
export function knifeSprite() {
  return memo('knife', () => {
    const p = new Pix(11, 34);
    p.rect(3, 2, 5, 11, '#b97c45'); p.rect(3, 2, 1, 11, '#d9a06a'); p.rect(7, 2, 1, 11, '#7a4a28'); p.px(5, 5, '#eed792'); p.px(5, 9, '#eed792');
    p.rect(2, 12, 7, 2, '#8e9ea2');
    p.rect(2, 14, 7, 15, '#d6e0e2'); p.rect(2, 14, 2, 15, '#f2f8f8'); p.rect(7, 14, 2, 15, '#9fb0b4');
    p.rect(3, 29, 5, 2, '#d6e0e2'); p.rect(4, 31, 3, 1, '#d6e0e2'); p.px(5, 32, '#d6e0e2');
    p.outline(INK); return { cv:p.cv, w:11, h:34, tipX:5, tipY:33 };
  });
}

/* ---------- 도마 위 재료: 가로로 누운 긴 모양. 오른쪽이 먼저 칼 밑에 옵니다 ---------- */
export function ingredientStrip(id, w, h = 15) {
  return memo(`strip:${id}:${w}:${h}`, () => {
    const p = new Pix(w + 2, h + 2), o = 1, cy = o + Math.round(h / 2);
    if (id === 'mushroom') {
      const capW = Math.round(w * .64);
      p.rect(o + capW - 6, cy - Math.round(h * .23), w - capW + 6, Math.round(h * .46), '#f4ead4');
      p.rect(o + capW - 6, cy - Math.round(h * .23), w - capW + 6, 2, '#fffaf0'); p.rect(o + capW - 6, cy + Math.round(h * .23) - 2, w - capW + 6, 2, '#d9c9a8');
      p.ellipse(o + capW / 2, cy, capW / 2, h / 2 - .5, '#b8744a'); p.rect(o, cy - h / 2 + 1, 2, h - 2, '#b8744a');
      p.ellipse(o + capW / 2 - 1, cy - 2, capW / 2 - 3, h / 2 - 3, '#cf8d5e');
      for (const [fx, fy] of [[.16, -.2], [.34, .18], [.5, -.28], [.26, .04]]) p.rect(o + capW * fx + 2, cy + fy * h, 2, 2, '#f7e6c6');
      p.ellipse(o + capW - 3, cy + h * .28, 3, 1, '#7a4a28');
    } else if (id === 'herb') {
      p.rect(o, cy, w, 2, '#3f7a4e');
      const n = Math.max(4, Math.round(w / 9));
      for (let i = 0; i < n; i++) { const x = o + 5 + i * (w - 10) / (n - 1), up = i % 2 === 0, ly = cy + (up ? -4 : 5); p.ellipse(x, ly, 4, 3, '#78b86a'); p.ellipse(x - 1, ly - 1, 2, 1, '#b6e29a'); p.px(x, up ? cy - 1 : cy + 2, '#3f7a4e'); p.px(x, up ? cy - 2 : cy + 3, '#3f7a4e'); }
      p.ellipse(o + w - 4, cy, 4, 2, '#78b86a');
    } else {
      const n = Math.max(2, Math.round(w / 14));
      for (let i = 0; i < n; i++) { const x = o + 6 + i * (w - 12) / Math.max(1, n - 1); p.disc(x, cy, 5, '#b04a78'); p.disc(x - 1, cy - 2, 2, '#e58db3'); p.px(x - 2, cy - 3, '#ffd1e4'); p.px(x + 2, cy + 2, '#7a2d54'); }
    }
    p.outline(INK); return p.cv;
  });
}

/* ---------- 불 위의 생선(위에서 본 모양). done = 익은 정도(0~1.3) ---------- */
export function panFish(doneBucket, side = 0, w = 36, h = 14) {
  return memo(`panfish:${doneBucket}:${side}:${w}`, () => {
    const d = doneBucket / 10;
    const col = d < .5 ? mix('#f2b9a8', '#e8c48a', d / .5) : d < .93 ? mix('#e8c48a', '#d8963c', (d - .5) / .43) : d < 1.15 ? mix('#d8963c', '#4a2a14', (d - .93) / .22) : '#1e140c';
    const p = new Pix(w + 8, h + 6), cx = 4 + w / 2 + 2, cy = 3 + h / 2;
    p.poly([[cx - w / 2 + 2, cy], [cx - w / 2 - 4, cy - h * .46], [cx - w / 2 - 4, cy + h * .46]], mix(col, '#2a1a0a', .18));
    p.ellipse(cx, cy, w / 2 - 2, h / 2 - .5, col); p.ellipse(cx - 1, cy - 2, w / 2 - 6, h / 2 - 4, mix(col, '#fff3c8', .22));
    p.rect(cx + w / 2 - 9, cy - h / 2 + 2, 1, h - 3, mix(col, '#2a1a0a', .25));
    const sear = Math.min(1, Math.max(0, (d - .3) / .6));
    for (let i = 0; i < 4; i++) { const x = cx - w / 2 + 8 + i * 6, a = Math.round(2 + sear * 3); p.line(x, cy - a, x + 2, cy + a, mix(col, '#3a1e0a', .45 * sear + .08)); }
    p.px(cx + w / 2 - 5, cy - 2 + (side ? 3 : 0), INK); p.px(cx + w / 2 - 5, cy - 3 + (side ? 3 : 0), '#fff');
    if (side === 0) { p.px(cx - 2, cy - h / 2 + 1, mix(col, '#fff', .35)); p.px(cx + 3, cy - h / 2 + 1, mix(col, '#fff', .35)); }
    p.outline(INK); return { cv:p.cv, w:p.w, h:p.h };
  });
}

/* ---------- 완성 접시(44×30): 요리마다 다른 모양, 품질별 접시 테두리 ---------- */
export function dishPlate(recipeId, quality = 'normal') {
  return memo(`dish:${recipeId}:${quality}`, () => {
    const p = new Pix(48, 32), cx = 24, rim = quality === 'great' ? '#f6d86e' : quality === 'good' ? '#fff0b8' : '#f3ecd3';
    p.ellipse(cx, 24, 21, 7, '#b4a888'); p.ellipse(cx, 22, 21, 7, rim); p.ellipse(cx, 22, 16, 5, mix(rim, '#cfc6aa', .45)); p.ellipse(cx, 21, 15, 4, mix(rim, '#fff', .3));
    if (recipeId === 'herb-grilled-fish') {
      p.poly([[cx - 12, 17], [cx - 18, 12], [cx - 18, 22]], '#c4863d'); p.ellipse(cx, 17, 13, 5, '#d9a05b'); p.ellipse(cx - 1, 15, 10, 2, '#ecc07c');
      for (let i = 0; i < 4; i++) p.line(cx - 6 + i * 4, 14, cx - 4 + i * 4, 20, '#a76a2a');
      p.px(cx + 9, 16, INK); p.px(cx + 9, 15, '#fff');
      p.ellipse(cx - 3, 12, 3, 2, '#78b86a'); p.ellipse(cx + 3, 11, 3, 2, '#5ea05a'); p.px(cx - 4, 11, '#b6e29a'); p.px(cx + 2, 10, '#b6e29a');
    } else if (recipeId === 'forest-mushroom-soup') {
      p.ellipse(cx, 18, 13, 7, '#e9dfc2'); p.rect(cx - 13, 12, 27, 5, '#e9dfc2'); p.ellipse(cx, 12, 13, 4, '#fff6dc');
      p.ellipse(cx, 12, 11, 3, '#d9a96a'); p.ellipse(cx - 2, 11, 7, 1, '#ecc58a');
      for (const [x, y] of [[-6, 12], [-1, 13], [4, 11], [7, 13]]) p.ellipse(cx + x, y, 2, 1, '#b8744a');
      p.px(cx - 3, 11, '#78b86a'); p.px(cx + 1, 12, '#78b86a'); p.px(cx + 6, 11, '#78b86a'); p.px(cx - 8, 13, '#f4ead4');
    } else {
      p.rect(cx - 8, 6, 17, 16, '#e9dfc2'); p.rect(cx - 8, 6, 2, 16, '#fff'); p.rect(cx - 8, 12, 17, 10, '#a8456f'); p.rect(cx - 8, 12, 17, 2, '#d9709c'); p.rect(cx + 6, 12, 3, 10, '#7a2d54');
      p.rect(cx - 10, 2, 21, 5, '#c9a24a'); p.rect(cx - 10, 2, 21, 2, '#eed792'); p.rect(cx - 10, 6, 21, 1, '#8c6c26');
      p.px(cx - 3, 16, '#e58db3'); p.px(cx + 2, 18, '#e58db3'); p.px(cx - 5, 19, '#ffd1e4');
      p.ellipse(cx + 17, 21, 5, 2, '#e8c48a'); p.ellipse(cx + 17, 20, 4, 1, '#f3d9a2'); p.ellipse(cx + 17, 20, 2, 1, '#a8456f');
    }
    p.outline(INK); return p.cv;
  });
}

/* 탄 덩어리 접시 */
export function burntPlate() {
  return memo('burntPlate', () => {
    const p = new Pix(48, 32), cx = 24;
    p.ellipse(cx, 24, 21, 7, '#b4a888'); p.ellipse(cx, 22, 21, 7, '#f3ecd3'); p.ellipse(cx, 22, 16, 5, '#cfc6aa');
    p.ellipse(cx, 17, 9, 5, '#2b2622'); p.ellipse(cx - 1, 15, 7, 3, '#3a3430'); p.px(cx - 4, 15, '#5a524c'); p.px(cx + 2, 14, '#5a524c'); p.px(cx + 4, 17, '#5a524c');
    p.outline(INK); return p.cv;
  });
}

/* 재료 조각(그릇에 담기는 작은 알갱이) 색 */
export const BIT_COLORS = { mushroom:['#b8744a', '#f4ead4', '#cf8d5e'], herb:['#78b86a', '#3f7a4e', '#b6e29a'], berry:['#b04a78', '#e58db3', '#7a2d54'] };
export { hash };

/* ---------- 구리 냄비 / 팬 (림 가운데가 (ox, oy)) ---------- */
export function potSprite(rx, ry) {
  return memo(`pot:${rx}:${ry}`, () => {
    const ox = rx + 7, oy = ry + 3, p = new Pix(rx * 2 + 14, ry * 2 + 22);
    p.rect(ox - rx - 4, oy + 4, 5, 4, '#4a3a30'); p.rect(ox + rx, oy + 4, 5, 4, '#4a3a30');
    p.ellipse(ox, oy + 15, rx, ry, '#a65f36'); p.rect(ox - rx, oy, rx * 2 + 1, 15, '#c47a4a');
    p.rect(ox - rx + 2, oy + 3, 2, 11, '#e6a070'); p.rect(ox - rx + 5, oy + 5, 1, 6, '#e6a070'); p.rect(ox + rx - 3, oy + 3, 3, 12, '#8a4f2c');
    p.ellipse(ox, oy + 15, rx - 1, ry - 1, '#a65f36'); p.rect(ox - rx + 1, oy, rx * 2 - 1, 15, '#c47a4a'); p.rect(ox - rx + 2, oy + 3, 2, 11, '#e6a070'); p.rect(ox + rx - 3, oy + 3, 3, 12, '#8a4f2c');
    p.ellipse(ox, oy, rx, ry, '#e6dcc4'); p.ellipse(ox, oy + 1, rx - 2, ry - 1.5, '#3a2a20');
    p.outline(INK); return { cv:p.cv, ox, oy, w:p.w, h:p.h };
  });
}
export function panSprite(rx, ry) {
  return memo(`pan:${rx}:${ry}`, () => {
    const hl = Math.round(rx * .62) + 6, ox = rx + 6, oy = ry + 3, p = new Pix(rx * 2 + hl + 14, ry * 2 + 14);
    p.line(ox + rx - 2, oy + 1, ox + rx + hl, oy - 3, '#7a4a28'); p.line(ox + rx - 2, oy + 2, ox + rx + hl, oy - 2, '#a77746'); p.line(ox + rx - 2, oy + 3, ox + rx + hl, oy - 1, '#d19a60'); p.rect(ox + rx + hl - 2, oy - 4, 3, 5, '#d19a60'); p.px(ox + rx + hl, oy - 2, INK);
    p.ellipse(ox, oy + 7, rx, ry, '#3a4144'); p.rect(ox - rx, oy, rx * 2 + 1, 7, '#4f585c'); p.rect(ox - rx + 2, oy + 2, 2, 4, '#7c8a90');
    p.ellipse(ox, oy + 7, rx - 1, ry - 1, '#3a4144'); p.rect(ox - rx + 1, oy, rx * 2 - 1, 7, '#4f585c');
    p.ellipse(ox, oy, rx, ry, '#8a9aa0'); p.ellipse(ox, oy + 1, rx - 2, ry - 1.5, '#262c2e'); p.ellipse(ox, oy + 1, rx - 3, ry - 2.5, '#3b4346');
    p.outline(INK); return { cv:p.cv, ox, oy, w:p.w, h:p.h };
  });
}
