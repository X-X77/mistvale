// 채집 화면의 그림(픽셀): 숨을 곳 다섯 종류(높은 풀·덤불·통나무·바위·낙엽 더미)와 재료 단서(반짝임·포자·나비).
// 구역이 어려울수록 팔레트가 바닥색과 비슷해져서 눈에 덜 띕니다(위장).
import { Pix, clamp, lerp, mix, light, dark, hash } from './pixel.js?v=mg4';

export const PALS = {
  meadow:  { ground:['#5fb257', '#56a850', '#4f9d4a'], g0:'#2f7a3a', g1:'#4ea04c', g2:'#7fd06a', g3:'#b9f08a', wood:'#8a5a32', wood2:'#c08a52', stone:'#8f9a96', stone2:'#d0d8d3', leaf:['#e0803a', '#f0b84a', '#c0552e'], ink:'#1c2a22' },
  thicket: { ground:['#468a46', '#3f8242', '#397a3e'], g0:'#22583a', g1:'#3c8844', g2:'#5ca858', g3:'#8ed074', wood:'#6a4527', wood2:'#9a6e40', stone:'#727e7a', stone2:'#a8b2ad', leaf:['#b8662e', '#d09c46', '#8a4a2a'], ink:'#16241d' },
  mist:    { ground:['#3d7068', '#386a64', '#33635f'], g0:'#2c5c58', g1:'#3e7672', g2:'#5a9490', g3:'#84b8b2', wood:'#4a5650', wood2:'#6a7a70', stone:'#5f7674', stone2:'#8ca4a2', leaf:['#6c8c7c', '#8ca493', '#5a7c6c'], ink:'#1f3a38' },
};

const memo = new Map();
function cached(key, make) { let v = memo.get(key); if (!v) { v = make(); memo.set(key, v); } return v; }

/* 숨을 곳 그림. size = 한 변 칸 수 기준(가로), variant 0~2 로 모양이 조금씩 다릅니다. */
export function spotSprite(kind, variant, zoneId, size) {
  return cached(`${kind}:${variant}:${zoneId}:${size}`, () => {
    const P = PALS[zoneId], w = Math.max(12, size), h = Math.round(w * (kind === 'tallgrass' ? 1.05 : kind === 'log' ? .55 : kind === 'leaves' ? .6 : .85));
    const p = new Pix(w + 2, h + 2), k = w / 22, R = i => hash(i * 17 + variant * 131 + w);
    if (kind === 'tallgrass') {
      p.ellipse(w / 2 + 1, h - 1, w * .42, 2, P.g0);
      for (let i = 0; i < 11; i++) { const x = 3 + (w - 5) * (i / 10), ht = h * (.45 + R(i) * .5), lean = (R(i + 40) - .5) * 4, c = i % 3 === 0 ? P.g2 : i % 3 === 1 ? P.g1 : P.g0; p.line(x, h - 1, x + lean, h - ht, c); p.line(x + 1, h - 1, x + 1 + lean, h - ht, c); p.px(x + lean, h - ht - 1, P.g3); }
    } else if (kind === 'bush') {
      p.ellipse(w / 2 + 1, h - 3, w * .46, h * .3, P.g0); p.ellipse(w * .34, h * .5, w * .3, h * .38, P.g1); p.ellipse(w * .68, h * .48, w * .3, h * .38, P.g2); p.ellipse(w / 2 + 1, h * .38, w * .3, h * .3, P.g1);
      for (let i = 0; i < 9; i++) { const x = 4 + R(i) * (w - 8), y = 3 + R(i + 20) * (h - 8); p.px(x, y, P.g3); p.px(x + 1, y, P.g3); p.px(x, y + 2, P.g0); }
    } else if (kind === 'log') {
      p.ellipse(w / 2 + 1, h - 1, w * .46, 1.5, P.g0); p.rect(3, 3, w - 5, h - 6, P.wood2); p.rect(3, 3, w - 5, 2, light(P.wood2, .25)); p.rect(3, h - 4, w - 5, 2, P.wood);
      for (let i = 0; i < 4; i++) { const x = 6 + R(i) * (w - 12); p.line(x, 5, x + 1, h - 5, P.wood); }
      p.ellipse(3, h / 2 + 1, 2.4, (h - 5) / 2, light(P.wood2, .4)); p.ellipse(3, h / 2 + 1, 1, 1.6, P.wood);
      for (let i = 0; i < 3; i++) p.rect(7 + R(i + 9) * (w - 16), 2, 4, 2, P.g2);
    } else if (kind === 'rock') {
      p.ellipse(w / 2 + 1, h - 2, w * .46, 2, P.g0); p.ellipse(w / 2 + 1, h * .55, w * .45, h * .42, P.stone); p.ellipse(w * .45, h * .45, w * .32, h * .28, mix(P.stone, P.stone2, .55));
      p.px(w * .3, h * .3, P.stone2); p.px(w * .3 + 1, h * .3, P.stone2); for (let i = 0; i < 3; i++) p.rect(3 + R(i + 3) * (w - 9), h * .65 + R(i) * 3, 3, 2, P.g1);
    } else { // leaves
      p.ellipse(w / 2 + 1, h - 2, w * .46, h * .34, P.leaf[2]);
      for (let i = 0; i < Math.round(26 * k + 8); i++) { const x = 3 + R(i) * (w - 6), y = h * .15 + R(i + 60) * (h * .72), c = P.leaf[i % 3]; p.px(x, y, c); p.px(x + 1, y, c); if (i % 2) p.px(x, y + 1, dark(c, .2)); }
    }
    p.outline(P.ink); return p;
  });
}

/* 가려진 재료가 비쳐 보이는 정도(쉬움): 겉에 살짝 보이는 색 점 */
export const ITEM_COLOR = { herb:'#7fe07a', mushroom:'#c99a6a', berry:'#d0507c' };
export const GOLD = '#ffe27a';

/* 재료 단서(구역 위에 겹쳐 그림). level 1 = 어렴풋, 2 = 또렷. g = 2D 컨텍스트(가상 픽셀 좌표), t = 시간(초) */
export function drawClue(g, type, x, y, t, level, gold, ph = 0, reduced = false) {
  const a = level >= 2 ? 1 : .42, n = level >= 2 ? 5 : 2, put = (px, py, c, al = 1, s = 1) => { g.globalAlpha = al * a; g.fillStyle = c; g.fillRect(Math.round(px), Math.round(py), s, s); };
  if (gold) { // 반짝이는 희귀: 노란 별 깜빡임
    for (let i = 0; i < n + 1; i++) { const tw = (Math.sin(t * 4 + i * 2.1 + ph) + 1) / 2, px = x + Math.cos(i * 2.4 + ph) * 7, py = y - 3 - i * 1.5 + Math.sin(t * 1.6 + i) * 2; if (tw > .45) { put(px, py, GOLD, tw); put(px - 1, py, '#fff6b8', tw * .7); put(px + 1, py, '#fff6b8', tw * .7); put(px, py - 1, '#fff6b8', tw * .7); put(px, py + 1, '#fff6b8', tw * .7); } }
  } else if (type === 'herb') { // 초록 반짝임이 천천히 떠오름
    for (let i = 0; i < n; i++) { const u = ((t * .5 + i / n + ph) % 1), px = x - 5 + (i / n) * 10 + Math.sin(u * 6 + i) * 1.5, py = y + 2 - u * 12; put(px, py, i % 2 ? '#c6ffb0' : '#7fe07a', Math.sin(u * Math.PI)); if (i % 2 === 0) { put(px - 1, py, '#7fe07a', Math.sin(u * Math.PI) * .6); put(px + 1, py, '#7fe07a', Math.sin(u * Math.PI) * .6); } }
  } else if (type === 'mushroom') { // 보랏빛 포자가 옆으로 흩날림
    for (let i = 0; i < n; i++) { const u = ((t * .35 + i / n + ph) % 1), px = x - 3 + u * 11 + Math.sin(u * 8 + i) * 2, py = y + 1 - u * 9 - (i % 2) * 2; put(px, py, i % 2 ? '#d9b8ff' : '#9a78e0', Math.sin(u * Math.PI) * .9, 2); }
  } else { // berry: 붉은 반짝임 + 나비
    for (let i = 0; i < n - 1; i++) { const tw = (Math.sin(t * 3 + i * 1.9 + ph) + 1) / 2; if (tw > .35) { const px = x - 4 + i * 3, py = y - 2 - (i % 2) * 3; put(px, py, '#ff6a7a', tw); put(px, py - 1, '#ffc0c8', tw * .6); } }
    if (level >= 2 && !reduced) { const a2 = t * 1.7 + ph, bx = x + Math.cos(a2) * 8, by = y - 9 + Math.sin(a2 * 1.3) * 3, flap = Math.sin(t * 16) > 0 ? 2 : 1; g.globalAlpha = 1; g.fillStyle = '#ffd1e0'; g.fillRect(Math.round(bx) - flap, Math.round(by), flap, 1); g.fillRect(Math.round(bx) + 1, Math.round(by), flap, 1); g.fillStyle = '#7a2a48'; g.fillRect(Math.round(bx), Math.round(by), 1, 2); }
  }
  g.globalAlpha = 1;
}

/* 바닥(배경): 풀빛 바닥 + 잔풀·꽃 + 템플릿 장식(빈터·오솔길·개울·고목). 한 번 만들어 두고 재사용합니다. */
export function buildGround(vw, vh, fx, fy, fs, aspect, zoneId, templateId, seed) {
  const P = PALS[zoneId], p = new Pix(vw, vh), R = i => hash(i * 7 + seed), fw = aspect * fs;
  p.rect(0, 0, vw, vh, '#16241d');                                  // 화면 가장자리(어두운 숲)
  const x0 = Math.round(fx), y0 = Math.round(fy), W = Math.round(fw), H = Math.round(fs);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = hash(x * 3 + y * 11 + seed); p.px(x0 + x, y0 + y, P.ground[h < .5 ? 0 : h < .85 ? 1 : 2]); }
  const u = (ux, uy) => [x0 + ux * W, y0 + uy * H];
  if (templateId === 'clearing') { const [cx, cy] = u(.5, .52); p.ellipse(cx, cy, fs * .14, fs * .12, mix(P.ground[0], '#d8c48a', .35)); p.ellipse(cx, cy, fs * .08, fs * .07, mix(P.ground[0], '#d8c48a', .5)); }
  if (templateId === 'trail') for (let x = 0; x < W; x++) { const uu = x / W, yy = .5 + (uu - .5) * aspect * .55; for (let dy = -4; dy <= 4; dy++) p.px(x0 + x, y0 + yy * H + dy, hash(x * 5 + dy) < .6 ? '#b59a62' : '#a88c58'); }
  if (templateId === 'stream') for (let y = 0; y < H; y++) { const uy = y / H, cxu = .5 + (Math.sin(uy * 5) * .06) / aspect, cx = x0 + cxu * W; for (let dx = -Math.round(fs * .07); dx <= Math.round(fs * .07); dx++) p.px(cx + dx, y0 + y, Math.abs(dx) > fs * .062 ? '#c8d8c0' : (y + dx) % 7 === 0 ? '#9fd4e8' : '#5a9cc0'); }
  // 잔풀, 꽃, 돌멩이
  for (let i = 0; i < 80; i++) { const x = x0 + R(i) * W, y = y0 + R(i + 99) * H, c = i % 4 ? P.g1 : P.g2; p.px(x, y, c); p.px(x, y - 1, c); if (i % 5 === 0) p.px(x + 1, y - 1, P.g3); }
  const fl = zoneId === 'mist' ? ['#b8c8e8', '#d8e0f0'] : ['#fff0a0', '#ffb8d0', '#ffffff'];
  for (let i = 0; i < 14; i++) { const x = x0 + R(i + 200) * W, y = y0 + R(i + 300) * H; p.px(x, y, fl[i % fl.length]); }
  // 가장자리 나무 줄기(고목 숲은 더 굵게)
  const trees = templateId === 'grove' ? 7 : 4; for (let i = 0; i < trees; i++) { const x = x0 + R(i + 500) * W, big = templateId === 'grove'; p.rect(x, y0 - 2, big ? 3 : 2, 4 + R(i) * 3, P.wood); p.rect(x, y0 - 2, 1, 5, light(P.wood, .25)); }
  // 필드 테두리 어둡게(비네팅)
  for (let i = 0; i < 6; i++) { p.g.globalAlpha = .12; p.rect(x0, y0 + i, W, 1, '#0a140f'); p.rect(x0, y0 + H - 1 - i, W, 1, '#0a140f'); p.rect(x0 + i, y0, 1, H, '#0a140f'); p.rect(x0 + W - 1 - i, y0, 1, H, '#0a140f'); } p.g.globalAlpha = 1;
  return p;
}
