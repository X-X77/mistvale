// 미니게임용 픽셀 그림 만들기: 물고기·광석 바위·소지품 아이콘을 코드로 그립니다(별도 이미지 파일 없음).
// 그림은 한 번 만들어 두고(캐시) 재사용합니다. 윤곽선은 모두 같은 어두운 숲색입니다.
import { Pix, INK, mix, light, dark, clamp, hash, PAL } from './pixel.js?v=sh2';
import { goodsIconDraw } from './goods-art.js?v=sh2';

const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

/* =====================================================================
   물고기 (옆모습, 오른쪽이 머리). 종마다 크기·체형·무늬가 다릅니다.
   ===================================================================== */
export const FISH_ART = {
  'silver-minnow':   { len:15, hgt:6,  body:'#cfe3ee', pattern:'line',   fin:'#e8f4fa' },
  'reed-crucian':    { len:18, hgt:11, body:'#c9a35c', pattern:'scale',  fin:'#e29a4a' },
  'mist-trout':      { len:24, hgt:9,  body:'#9fc3b0', pattern:'spots',  fin:'#cfe6d8' },
  'moon-carp':       { len:32, hgt:14, body:'#e6cf7c', pattern:'moon',   fin:'#f4a95a' },
  'tide-mackerel':   { len:20, hgt:7,  body:'#6f9fc6', pattern:'tiger',  fin:'#9cc4e0' },
  'reef-bream':      { len:22, hgt:13, body:'#e08f8a', pattern:'bream',  fin:'#f2b8a8' },
  'lighthouse-bass': { len:28, hgt:10, body:'#b3c6d4', pattern:'stripe', fin:'#d8e4ec' },
  'fog-anglerfish':  { len:28, hgt:19, body:'#8a76a8', pattern:'angler', fin:'#b9a5d4' },
};

export function fishSprite(id, bend = 0, fallbackColor = '#a9c7d8') {
  const spec = FISH_ART[id] || { len:18, hgt:9, body:fallbackColor, pattern:'none', fin:light(fallbackColor, .3) };
  return memo(`fish:${id}:${bend}`, () => makeFish(spec, bend));
}

function makeFish(spec, bend) {
  const { len, hgt, body, pattern, fin } = spec, tailLen = Math.round(len * .3), pad = 4, lure = pattern === 'angler' ? 9 : 0;
  const W = len + tailLen + pad * 2 + 2, H = hgt + pad * 2 + 10 + lure, ox = tailLen + pad, oy = Math.round(H / 2) + (lure ? 3 : 0);
  const p = new Pix(W, H);
  const back = dark(body, .24), belly = light(body, .38), mid = body, fin2 = dark(fin, .12);
  const shiftAt = x => Math.round(bend * Math.pow(1 - clamp(x / len, 0, 1), 2) * hgt * .55);
  const put = (x, y, c) => p.px(ox + x, oy + y + shiftAt(x), c);
  const half = t => { const u = clamp((t - .12) / .92, 0, 1), h = hgt / 2 * Math.pow(Math.sin(Math.PI * u), .62); return t < .12 ? 0 : Math.max(h, t < .3 ? hgt * .15 : 0); };
  // 꼬리지느러미
  for (let x = -tailLen; x <= len * .16; x++) {
    const s = (len * .16 - x) / (tailLen + len * .16), hh = hgt * .12 + s * hgt * .46, fork = s > .66 ? (s - .66) * hgt * 1.5 : 0;
    for (let y = -Math.round(hh); y <= Math.round(hh); y++) if (Math.abs(y) >= fork) put(x, y, Math.abs(y) > hh * .7 ? fin2 : fin);
  }
  // 몸통
  for (let x = 0; x <= len; x++) {
    const t = x / len, h = half(t); if (h <= 0) continue;
    for (let y = -Math.ceil(h); y <= Math.ceil(h); y++) {
      if (Math.abs(y) > h + .2) continue; const k = y / Math.max(h, 1);
      let c = k < -.3 ? back : k > .45 ? belly : mid;
      if (k > -.3 && k < -.08 && pattern !== 'angler') c = mix(mid, '#ffffff', .12);
      put(x, y, c);
    }
  }
  // 등지느러미·배지느러미·가슴지느러미
  const dorsal = pattern === 'bass' || pattern === 'stripe' ? .34 : .28, d0 = Math.round(len * .42), d1 = Math.round(len * (pattern === 'angler' ? .7 : .66));
  for (let x = d0; x <= d1; x++) { const k = (x - d0) / Math.max(1, d1 - d0), top = Math.round(half(x / len) + hgt * dorsal * (1 - Math.abs(k - .35) * 1.2)); for (let y = Math.round(half(x / len)); y <= top; y++) put(x, -y - 1, y === top ? fin2 : fin); }
  for (let x = Math.round(len * .46); x <= Math.round(len * .58); x++) { const k = (x - len * .46) / (len * .12), bot = Math.round(half(x / len) + hgt * .22 * (1 - k)); for (let y = Math.round(half(x / len)); y <= bot; y++) put(x, y + 1, fin2); }
  const pf = Math.round(len * .66); put(pf, Math.round(hgt * .1), fin); put(pf - 1, Math.round(hgt * .1) + 1, fin2); put(pf - 2, Math.round(hgt * .1) + 1, fin2);
  // 무늬
  const hOf = x => half(clamp(x / len, 0, 1));
  if (pattern === 'line') { for (let x = 3; x < len * .82; x++) put(x, 0, '#ffffff'); }
  else if (pattern === 'scale') { for (let x = 4; x < len * .8; x += 3) for (let y = -2; y <= 3; y += 3) put(x + (y > 0 ? 1 : 0), y, dark(body, .18)); }
  else if (pattern === 'spots') { for (const [x, y] of [[.3, -2], [.4, 0], [.5, -2], [.6, 1], [.45, 2], [.7, -1], [.35, 2]]) put(Math.round(len * x), y, dark(body, .45)); for (let x = 4; x < len * .8; x++) put(x, 1 + (hgt > 8 ? 0 : -1), '#f0a0b0'); }
  else if (pattern === 'moon') { for (let a = -1.2; a <= 1.2; a += .15) put(Math.round(len * .5 + Math.cos(a) * 3.2), Math.round(Math.sin(a) * 4 - 1), '#fff6c8'); put(Math.round(len * .5 + 1), -1, '#fff6c8'); put(Math.round(len * .5), -1, '#fff6c8'); for (const x of [-4, -2]) put(Math.round(len) + 1 + x * 0, 3, dark(body, .3)); const m = len; put(m + 1, 2, '#6a5a2a'); put(m + 2, 3, '#6a5a2a'); }
  else if (pattern === 'tiger') { for (let x = 5; x < len * .78; x += 3) { const h = hOf(x); for (let y = -Math.round(h); y <= 0; y++) put(x, y, dark(body, .5)); } }
  else if (pattern === 'bream') { put(Math.round(len * .74), 1, '#7db5e8'); put(Math.round(len * .74), 2, '#7db5e8'); put(Math.round(len * .74) + 1, 1, '#7db5e8'); for (let x = 5; x < len * .7; x += 3) put(x, -2, '#fff1ee'); }
  else if (pattern === 'stripe') { for (let x = 3; x < len * .86; x++) put(x, 0, dark(body, .5)); for (let x = 4; x < len * .8; x += 4) put(x, -3, dark(body, .3)); }
  else if (pattern === 'angler') {
    for (let x = Math.round(len * .7); x <= len; x++) { put(x, 3, '#ffffff'); if ((x & 1) === 0) put(x, 4, '#ffffff'); } // 이빨
    for (let x = Math.round(len * .72); x <= len; x++) put(x, 2, dark(body, .6));
    for (let i = 0; i < 6; i++) put(Math.round(len * .28 + i * 2.2), -3 + (i % 2) * 2, dark(body, .35));
    const sx = Math.round(len * .78); put(sx, -half(.78) - 1, dark(body, .4)); for (let i = 0; i < 4; i++) put(sx + 1 + i, -Math.round(half(.78)) - 2 - i, dark(body, .5));
    p.disc(ox + sx + 6, oy - Math.round(half(.78)) - 7, 2, '#fff3a8'); p.px(ox + sx + 6, oy - Math.round(half(.78)) - 8, '#ffffff');
  }
  // 눈(조금 크게 — 귀엽게)과 볼터치
  const ex = Math.round(len * .86), ey = -Math.round(hgt * .1);
  if (hgt >= 8) { put(ex, ey, INK); put(ex + 1, ey, INK); put(ex, ey - 1, INK); put(ex + 1, ey - 1, INK); put(ex, ey - 1, '#ffffff'); } else { put(ex, ey, INK); }
  if (hgt >= 9) { put(ex - 2, ey + 2, '#f2a7bd'); put(ex - 3, ey + 2, '#f2a7bd'); }
  p.outline(INK); p.headX = ox + len; p.len = len;
  return p;
}

/* =====================================================================
   광석 바위: 화면 크기에 맞춰 n×n 칸으로 그립니다(칸의 크기가 다른 그림과 같아집니다).
   ===================================================================== */
const noise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, f = t => t * t * (3 - 2 * t); const a = hash(xi * 73856093 ^ yi * 19349663 ^ s), b = hash((xi + 1) * 73856093 ^ yi * 19349663 ^ s), c = hash(xi * 73856093 ^ (yi + 1) * 19349663 ^ s), d = hash((xi + 1) * 73856093 ^ (yi + 1) * 19349663 ^ s); return (a + (b - a) * f(xf)) + ((c + (d - c) * f(xf)) - (a + (b - a) * f(xf))) * f(yf); };

export const ROCK_KIND = { 'moss-copper':'copper', 'silver-mist-stone':'silver', 'moondrop-crystal':'crystal' };

export function rockSprite(oreId, n, seed) {
  const key = `rock:${oreId}:${n}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const kind = ROCK_KIND[oreId] || 'copper', p = new Pix(n, n), c = (n - 1) / 2, rs = n * .46;
  const lit = (nx, ny, nz) => clamp(nx * -.45 + ny * -.55 + nz * .7, 0, 1.2); // 왼쪽 위 빛
  let mask;
  if (kind === 'copper') { const k = 11 + (seed % 3), ph = seed * .37; mask = (x, y) => { const a = Math.atan2(y - c, x - c), r = rs * (.9 + .09 * Math.sin(a * 3 + ph) + .05 * Math.sin(a * 7 + ph * 2)); return Math.hypot((x - c) / 1, (y - c) / .92) < r; }; }
  else if (kind === 'silver') { const pts = [[.5, .06], [.86, .3], [.92, .68], [.62, .94], [.22, .88], [.07, .5], [.2, .2]].map(([x, y]) => [x * n, y * n]); mask = (x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if (((pts[i][1] > y) !== (pts[j][1] > y)) && (x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0])) inside = !inside; } return inside; }; }
  else { mask = (x, y) => Math.hypot((x - c) / 1.05, (y - n * .82) / .42) < rs * .95 && y > n * .64; }
  const stone = kind === 'copper' ? ['#2f3a36', '#46554f', '#62746b', '#86998d'] : kind === 'silver' ? ['#3a4658', '#566478', '#7a899d', '#a6b4c6'] : ['#2f2a40', '#473f60', '#615880', '#8279a2'];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!mask(x, y)) continue;
    const dx = (x - c) / rs, dy = (y - c) / rs, d2 = Math.min(1, dx * dx + dy * dy), nz = Math.sqrt(1 - d2 * .85);
    let l = lit(dx * .8, dy * .8, nz) + (noise(x * .35, y * .35, seed) - .5) * .35 + (noise(x * .9, y * .9, seed + 5) - .5) * .12;
    if (kind === 'silver') { // 각진 면: 대각선으로 면을 나눕니다
      const face = (x * .55 + y * .3 + seed) % 40; l = l * .55 + (face < 14 ? .72 : face < 28 ? .4 : .22);
    }
    const bands = (((x + y) & 1) && Math.abs(l % .25 - .125) < .03) ? .04 : 0; // 약한 디더링
    const i = clamp(Math.floor((l + bands) * 3.3), 0, 3); p.px(x, y, stone[i]);
  }
  if (kind === 'copper') {
    // 이끼: 위쪽 윗면에 두껍게
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (!mask(x, y)) continue; const m = noise(x * .12 + 3, y * .12, seed + 9) + (c - y) / n * .6 - .28; if (m > .5) p.px(x, y, m > .72 ? '#9fd27a' : m > .6 ? '#7fb862' : '#5f9a52'); }
    // 구리 알갱이
    for (let i = 0; i < 6; i++) { const a = hash(seed * 10 + i) * 6.28, r = hash(seed * 20 + i) * rs * .62, x = c + Math.cos(a) * r, y = c + Math.sin(a) * r * .9 + 2, rr = Math.max(2, Math.round(n * (.035 + hash(seed + i * 7) * .03))); p.disc(x, y, rr, '#9a5f3a'); p.disc(x - 1, y - 1, Math.max(1, rr - 1), '#d68e58'); p.px(x - 1, y - 1, '#ffd9a8'); p.px(x + rr - 1, y + rr - 1, '#68c4a4'); }
  } else if (kind === 'silver') {
    for (let i = 0; i < 12; i++) { const x = hash(seed + i * 3) * n, y = hash(seed + i * 5 + 1) * n; if (!mask(x, y)) continue; p.px(x, y, '#ffffff'); if (i % 3 === 0) { p.px(x + 1, y, '#dfe9f6'); p.px(x, y + 1, '#dfe9f6'); } }
    p.line(n * .3, n * .62, n * .55, n * .5, '#dfe9f6'); p.line(n * .55, n * .5, n * .7, n * .56, '#c8d6ea');
  } else {
    // 달방울 수정: 바위 위로 솟은 보랏빛 결정 세 개
    const crystals = [[.5, .86, .74, .3], [.27, .84, .5, .2], [.74, .85, .56, .22]];
    for (const [cx, by, hh, ww] of crystals) {
      const x0 = cx * n, yb = by * n, top = yb - hh * n, w = ww * n / 2, pts = [[x0 - w, yb], [x0 - w * .85, top + w * 1.1], [x0, top], [x0 + w * .85, top + w * 1.1], [x0 + w, yb]];
      p.poly(pts, '#7e63c4'); p.poly([[x0 - w, yb], [x0 - w * .85, top + w * 1.1], [x0, top], [x0, yb]], '#a78bd9'); p.poly([[x0 - w * .5, yb - 2], [x0 - w * .5, top + w * 1.8], [x0 - w * .15, top + w * .6], [x0 - w * .15, yb - 2]], '#cdb8f5');
      p.px(x0 - w * .3, top + w * 1.4, '#ffffff'); p.px(x0 - w * .3, top + w * 1.4 + 1, '#ffffff');
    }
  }
  p.outline(INK);
  cache.set(key, p); return p;
}

// 바위를 조각으로 쪼개 흩날리게 합니다(마지막 타격).
export function rockShards(rock, count, seed) {
  const key = `shards:${rock.w}:${count}:${seed}`; if (cache.has(key)) return cache.get(key);
  const img = rock.data(), n = rock.w, pieces = Array.from({ length:count }, (_, i) => ({ x:hash(seed + i * 13) * n, y:hash(seed + i * 29) * n, px:new Pix(n, n), cx:0, cy:0, k:0 }));
  const d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4; if (d[o + 3] < 40) continue; let best = 0, bd = 1e9; pieces.forEach((q, i) => { const dd = (q.x - x) ** 2 + (q.y - y) ** 2; if (dd < bd) { bd = dd; best = i; } }); const q = pieces[best]; q.px.px(x, y, `rgb(${d[o]},${d[o + 1]},${d[o + 2]})`); q.cx += x; q.cy += y; q.k++; }
  const out = pieces.filter(q => q.k > 8).map(q => ({ pix:q.px, cx:q.cx / q.k, cy:q.cy / q.k }));
  cache.set(key, out); return out;
}

/* =====================================================================
   소지품 아이콘 (16×16) — 물고기·재료·광석·요리 각각의 모양
   ===================================================================== */
const ICON = 16;
function bounds(p) { const d = p.data().data; let x0 = p.w, y0 = p.h, x1 = 0, y1 = 0; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (d[(y * p.w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x:x0, y:y0, w:x1 - x0 + 1, h:y1 - y0 + 1 }; }
function iconCanvas(draw) { const p = new Pix(ICON, ICON); draw(p); p.outline(INK); return p; }

function herbIcon(p) { p.line(8, 14, 8, 6, '#3f7a4e'); for (const [x, y, dx] of [[8, 11, -1], [8, 8, 1], [8, 5, -1], [8, 3, 1]]) { p.ellipse(x + dx * 3, y, 3, 1.5, '#78b86a'); p.px(x + dx * 4, y - 1, '#b6e29a'); } p.px(8, 2, '#b6e29a'); p.px(8, 1, '#78b86a'); }
function mushroomIcon(p) { p.rect(6, 9, 4, 5, '#f4ead4'); p.rect(6, 9, 1, 5, '#fff8e8'); p.rect(9, 9, 1, 5, '#d9c9a8'); p.ellipse(8, 8, 6, 4, '#b8744a'); p.rect(2, 8, 13, 2, '#b8744a'); p.ellipse(8, 7, 5, 3, '#cf8d5e'); p.px(5, 6, '#f7e6c6'); p.px(8, 5, '#f7e6c6'); p.px(10, 7, '#f7e6c6'); p.px(6, 7, '#f7e6c6'); }
function berryIcon(p) { for (const [x, y] of [[5, 10], [10, 10], [8, 6]]) { p.disc(x, y, 3, '#b04a78'); p.disc(x - 1, y - 1, 1, '#e58db3'); p.px(x - 1, y - 1, '#ffd1e4'); p.px(x + 1, y + 2, '#7a2d54'); } p.line(8, 3, 8, 4, '#3f7a4e'); p.ellipse(10, 3, 2, 1, '#78b86a'); p.ellipse(6, 3, 2, 1, '#78b86a'); }
const oreIcon = kind => p => {
  if (kind === 'copper') { p.ellipse(8, 10, 6, 4, '#62746b'); p.ellipse(7, 9, 5, 3, '#86998d'); p.rect(3, 9, 9, 2, '#6fa05a'); p.disc(6, 9, 2, '#d68e58'); p.disc(10, 11, 1, '#9a5f3a'); p.px(5, 8, '#ffd9a8'); p.px(9, 7, '#9fd27a'); p.px(4, 7, '#9fd27a'); }
  else if (kind === 'silver') { p.poly([[8, 2], [14, 6], [13, 12], [8, 14], [3, 11], [2, 6]], '#7a899d'); p.poly([[8, 2], [2, 6], [3, 11], [8, 8]], '#a6b4c6'); p.poly([[8, 8], [13, 12], [8, 14], [3, 11]], '#566478'); p.px(6, 5, '#ffffff'); p.px(7, 5, '#ffffff'); p.px(10, 9, '#dfe9f6'); }
  else { p.poly([[8, 1], [11, 6], [10, 14], [6, 14], [5, 6]], '#8f72d4'); p.poly([[8, 1], [5, 6], [6, 14], [8, 14]], '#b8a0ee'); p.poly([[8, 1], [11, 6], [10, 14], [8, 14]], '#6c52b0'); p.px(7, 4, '#ffffff'); p.px(7, 5, '#ffffff'); p.px(12, 3, '#fff3a8'); p.px(3, 9, '#fff3a8'); }
};
function plate(p, rim = '#f3ecd3') { p.ellipse(8, 12, 7, 3, '#cfc6aa'); p.ellipse(8, 11, 7, 3, rim); p.ellipse(8, 11, 5, 2, '#e2d9bc'); }
function dishIcon(recipeId, quality) {
  return p => {
    if (recipeId === 'herb-grilled-fish') { plate(p); p.ellipse(8, 9, 5, 2.5, '#d9a05b'); p.poly([[2, 9], [0, 7], [0, 11]], '#c4863d'); p.ellipse(8, 8, 4, 1.5, '#ecc07c'); p.px(12, 8, INK); p.px(6, 9, '#a76a2a'); p.px(8, 9, '#a76a2a'); p.px(10, 9, '#a76a2a'); p.ellipse(5, 11, 2, 1, '#78b86a'); p.px(4, 11, '#b6e29a'); }
    else if (recipeId === 'forest-mushroom-soup') { p.ellipse(8, 12, 6, 2, '#b4a888'); p.ellipse(8, 9, 6, 4, '#f3ecd3'); p.rect(2, 7, 13, 3, '#f3ecd3'); p.ellipse(8, 7, 5, 2, '#d9a96a'); p.px(6, 7, '#b8744a'); p.px(9, 6, '#b8744a'); p.px(10, 8, '#78b86a'); p.px(7, 8, '#f4ead4'); p.px(11, 7, '#f4ead4'); }
    else { p.rect(4, 6, 8, 8, '#e9dfc2'); p.rect(4, 6, 1, 8, '#fff'); p.rect(4, 9, 8, 4, '#a8456f'); p.rect(4, 9, 8, 1, '#d9709c'); p.rect(3, 4, 10, 3, '#c9a24a'); p.rect(3, 4, 10, 1, '#eed792'); p.px(6, 11, '#e58db3'); p.px(9, 12, '#e58db3'); }
    if (quality === 'good' || quality === 'great') { p.px(14, 2, '#fff3a8'); p.px(13, 2, '#fff3a8'); p.px(15, 2, '#fff3a8'); p.px(14, 1, '#fff3a8'); p.px(14, 3, '#fff3a8'); }
    if (quality === 'great') { p.px(2, 2, '#fff3a8'); p.px(1, 2, '#fff3a8'); p.px(3, 2, '#fff3a8'); p.px(2, 1, '#fff3a8'); p.px(2, 3, '#fff3a8'); }
  };
}
function burntIcon(p) { p.ellipse(8, 11, 6, 3, '#2b2622'); p.ellipse(8, 9, 5, 4, '#3a3430'); p.px(6, 7, '#5a524c'); p.px(10, 9, '#5a524c'); p.px(8, 4, '#8f8a84'); p.px(9, 3, '#b0aba4'); p.px(8, 2, '#8f8a84'); p.px(10, 1, '#b0aba4'); }

export function iconSprite(info) {
  const key = 'icon:' + info.id + ':' + (info.kind || ''); if (cache.has(key)) return cache.get(key);
  let p;
  if (info.kind === 'fish') {
    const f = fishSprite(info.id, 0, info.color), box = bounds(f), w = box.w, h = box.h, sc = Math.min(1, (ICON - 1) / Math.max(w, h));
    p = new Pix(ICON, ICON); const dw = Math.max(1, Math.round(w * sc)), dh = Math.max(1, Math.round(h * sc));
    p.g.drawImage(f.cv, box.x, box.y, w, h, Math.round((ICON - dw) / 2), Math.round((ICON - dh) / 2), dw, dh);
  }
  else if (info.id === 'herb') p = iconCanvas(herbIcon);
  else if (info.id === 'mushroom') p = iconCanvas(mushroomIcon);
  else if (info.id === 'berry') p = iconCanvas(berryIcon);
  else if (ROCK_KIND[info.id]) p = iconCanvas(oreIcon(ROCK_KIND[info.id]));
  else if (info.kind === 'dish') { const [, recipe, quality] = info.id.split(':'); p = iconCanvas(dishIcon(recipe, quality)); }
  else if (info.kind === 'junk') p = iconCanvas(burntIcon);
  else if (goodsIconDraw(info)) p = iconCanvas(goodsIconDraw(info));
  else p = iconCanvas(pp => { pp.ellipse(8, 9, 5, 4, info.color || '#999'); });
  cache.set(key, p); return p;
}

const urlCache = new Map();
export function iconURL(info) { const key = info.id; if (!urlCache.has(key)) urlCache.set(key, iconSprite(info).cv.toDataURL()); return urlCache.get(key); }
export function iconImg(info, size = 32, cls = 'pxi') { return `<img class="${cls}" src="${iconURL(info)}" width="${size}" height="${size}" alt="" draggable="false">`; }

/* ---------- 작은 인터페이스 아이콘 (버튼 위에 얹는 그림) ---------- */
const uiCache = new Map();
export function uiIcon(name, color = '#f7efd6') {
  const key = name + color; if (uiCache.has(key)) return uiCache.get(key);
  const p = new Pix(13, 13), c = color;
  if (name === 'sound' || name === 'mute') { p.rect(2, 5, 2, 3, c); for (let i = 0; i < 4; i++) p.rect(4 + i, 4 - i, 1, 5 + i * 2, c); if (name === 'sound') { p.rect(9, 5, 1, 3, c); p.rect(11, 3, 1, 7, c); } else { p.line(9, 4, 12, 9, '#ff9d8a'); p.line(12, 4, 9, 9, '#ff9d8a'); } }
  else if (name === 'help') { p.rect(4, 2, 5, 1, c); p.rect(8, 3, 2, 3, c); p.rect(6, 6, 2, 1, c); p.rect(5, 7, 2, 2, c); p.rect(4, 3, 1, 2, c); p.rect(5, 11, 2, 1, c); p.rect(5, 10, 2, 1, c); }
  else if (name === 'close') { p.line(3, 3, 9, 9, c); p.line(4, 3, 10, 9, c); p.line(9, 3, 3, 9, c); p.line(10, 3, 4, 9, c); }
  else if (name === 'right') { for (let i = 0; i < 6; i++) p.rect(8 - i, 6 - i, 1, 1 + i * 2, c); }
  else if (name === 'left') { for (let i = 0; i < 6; i++) p.rect(3 + i, 6 - i, 1, 1 + i * 2, c); }
  else if (name === 'up') { for (let i = 0; i < 6; i++) p.rect(6 - i, 3 + i, 1 + i * 2, 1, c); }
  else if (name === 'down') { for (let i = 0; i < 6; i++) p.rect(6 - i, 9 - i, 1 + i * 2, 1, c); }
  else if (name === 'rod') { p.line(2, 11, 9, 3, '#d19a60'); p.line(3, 11, 10, 3, '#a77746'); p.line(10, 3, 11, 4, '#f7efd6'); p.line(11, 4, 11, 9, '#f7efd6'); p.disc(11, 10, 2, '#f7efd6'); p.rect(10, 9, 3, 2, '#e0503c'); }
  else if (name === 'pan') { p.ellipse(5, 7, 5, 3, '#4a5256'); p.ellipse(5, 6, 4, 2, '#7c8a90'); p.line(9, 6, 12, 3, '#d19a60'); p.line(9, 7, 12, 4, '#a77746'); p.px(3, 2, '#f7efd6'); p.px(5, 1, '#f7efd6'); p.px(7, 2, '#f7efd6'); }
  else if (name === 'pick') { p.line(3, 11, 9, 5, '#d19a60'); p.line(4, 11, 10, 5, '#a77746'); p.line(3, 5, 6, 3, '#c5d0d2'); p.line(6, 3, 10, 3, '#e6eef0'); p.line(10, 3, 12, 6, '#c5d0d2'); p.line(4, 5, 7, 4, '#7c8e92'); }
  else if (name === 'leaf') { p.ellipse(6, 6, 4, 3, '#78b86a'); p.line(2, 10, 10, 3, '#3f7a4e'); p.px(4, 5, '#b6e29a'); p.px(6, 4, '#b6e29a'); p.px(2, 11, '#3f7a4e'); }
  else if (name === 'coin') { p.disc(6, 6, 5, '#c9a24a'); p.disc(6, 6, 4, '#f0cf5a'); p.disc(6, 6, 2, '#c9a24a'); p.rect(5, 4, 2, 5, '#ffe9a0'); p.px(3, 3, '#fff6c8'); p.px(4, 2, '#fff6c8'); p.outline(INK); }
  else if (name === 'plus') { p.rect(5, 2, 3, 9, c); p.rect(2, 5, 9, 3, c); }
  else if (name === 'minus') { p.rect(2, 5, 9, 3, c); }
  else if (name === 'spark') { p.px(6, 1, c); p.rect(6, 2, 1, 3, c); p.px(6, 11, c); p.rect(6, 8, 1, 3, c); p.px(1, 6, c); p.rect(2, 6, 3, 1, c); p.px(11, 6, c); p.rect(8, 6, 3, 1, c); p.rect(5, 5, 3, 3, '#ffffff'); }
  const url = p.cv.toDataURL(); uiCache.set(key, url); return url;
}

export { PAL };
