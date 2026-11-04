// 픽셀 아트 도구: 작은 캔버스에 한 칸씩 찍어 그림을 만들고, 크게 확대해도 또렷하게 보여 줍니다.
// 미니게임 세 개가 같은 팔레트·같은 윤곽선 규칙을 쓰도록 모아 둔 공통 모듈입니다.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- 색 ---------- */
const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const hex = a => '#' + a.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => lerp(v, y[i], clamp(t, 0, 1)))); };
export const light = (c, t = .25) => mix(c, '#fff6dc', t);
export const dark = (c, t = .3) => mix(c, '#10161a', t);
// 윤곽선은 순검정 대신 어두운 숲색으로 두어 사이트 분위기와 맞춥니다.
export const INK = '#18241f';
export const PAL = {
  ink:INK, cream:'#f7efd6', gold:'#eed792', goldDeep:'#c9a24a', leaf:'#78b86a', leafDeep:'#3f7a4e', wood:'#a77746', woodDark:'#6a4527', woodLight:'#d19a60',
  water1:'#173a4d', water2:'#25607a', water3:'#4d93a8', stone:'#7c8985', stoneDark:'#4a5654', red:'#e0503c', pink:'#f2a7bd', cloth:'#e9dfc2', steel:'#c5d0d2', steelDark:'#7c8e92',
};

/* ---------- 도화지 ---------- */
export class Pix {
  constructor(w, h, ctx) {
    this.w = w; this.h = h;
    if (ctx) { this.g = ctx; this.cv = ctx.canvas; }
    else { this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h; this.g = this.cv.getContext('2d', { willReadFrequently:true }); }
    this.g.imageSmoothingEnabled = false;
  }
  px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.g.fillStyle = c; this.g.fillRect(x, y, 1, 1); }
  rect(x, y, w, h, c) { this.g.fillStyle = c; this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, guard = 0;
    this.g.fillStyle = c;
    while (guard++ < 4000) { this.g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  disc(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }
  ellipse(cx, cy, rx, ry, c) {
    this.g.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
    for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) { const k = ry ? y / (ry + .35) : 0, w = Math.floor((rx + .35) * Math.sqrt(Math.max(0, 1 - k * k))); this.g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
  }
  ring(cx, cy, rx, ry, c) { // 속이 빈 타원(물결 등)
    cx = Math.round(cx); cy = Math.round(cy); this.g.fillStyle = c; const n = Math.max(12, Math.round((rx + ry) * 4));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
  }
  poly(pts, c) {
    this.g.fillStyle = c; let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5)) xs.push(a[0] + (y + .5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q); for (let i = 0; i + 1 < xs.length; i += 2) this.g.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1);
    }
  }
  // 불투명한 칸의 바깥 한 칸에 윤곽선을 두릅니다(그림 둘레에 1칸 여백이 있어야 합니다).
  outline(c = INK) {
    const img = this.g.getImageData(0, 0, this.w, this.h), d = img.data, w = this.w, h = this.h, add = [];
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) add.push([x, y]);
    this.g.fillStyle = c; for (const [x, y] of add) this.g.fillRect(x, y, 1, 1); return this;
  }
  // 그림 위에서만 칠하기(균열·그림자 등)
  atop(fn) { const old = this.g.globalCompositeOperation; this.g.globalCompositeOperation = 'source-atop'; fn(this); this.g.globalCompositeOperation = old; }
  alpha(a) { this.g.globalAlpha = a; }
  data() { return this.g.getImageData(0, 0, this.w, this.h); }
}

/* ---------- 도장 찍기 ---------- */
// opts: { flip, rot(라디안), alpha, scale(정수 권장), ox, oy(회전 중심, 기본 가운데) }
export function blit(g, src, x, y, opts = {}) {
  const cv = src.cv || src, w = cv.width, h = cv.height, { flip = false, rot = 0, alpha = 1, scale = 1 } = opts;
  g.save(); g.imageSmoothingEnabled = false; if (alpha !== 1) g.globalAlpha = alpha;
  if (rot || flip || scale !== 1) {
    g.translate(Math.round(x), Math.round(y)); if (rot) g.rotate(rot); g.scale(flip ? -scale : scale, scale);
    g.drawImage(cv, -Math.round((opts.ox ?? w / 2)), -Math.round((opts.oy ?? h / 2)));
  } else g.drawImage(cv, Math.round(x - (opts.ox ?? w / 2)), Math.round(y - (opts.oy ?? h / 2)));
  g.restore();
}

/* ---------- 작은 숫자 글꼴(3×5) ---------- */
const FONT = {
  '0':'111101101101111', '1':'010110010010111', '2':'111001111100111', '3':'111001111001111', '4':'101101111001001', '5':'111100111001111',
  '6':'111100111101111', '7':'111001010010010', '8':'111101111101111', '9':'111101111001111', '.':'000000000000010', 'm':'000000111111101',
  '/':'001001010100100', 'x':'000101010101000', '+':'000010111010000', '-':'000000111000000', '!':'010010010000010', '%':'101001010100101',
};
export function text(g, str, x, y, color = '#fff', shadow = INK, align = 'center') {
  str = String(str); const wide = str.length * 4 - 1; let cx = Math.round(align === 'center' ? x - wide / 2 : align === 'right' ? x - wide : x); y = Math.round(y);
  const draw = (dx, dy, c) => { g.fillStyle = c; let px = cx; for (const ch of str) { const bits = FONT[ch]; if (bits) for (let i = 0; i < 15; i++) if (bits[i] === '1') g.fillRect(px + dx + (i % 3), y + dy + Math.floor(i / 3), 1, 1); px += 4; } };
  if (shadow) { draw(1, 0, shadow); draw(-1, 0, shadow); draw(0, 1, shadow); draw(0, -1, shadow); } draw(0, 0, color);
}

/* ---------- 해상도 관리: 화면 크기에 맞춰 '한 칸의 크기(PX)'를 정하고 작은 캔버스를 크게 늘려 보여 줍니다 ---------- */
export function pixelSurface(canvas, stage, { maxH = 220, minPx = 2, maxPx = 4, minW = 140 } = {}) {
  const info = { W:0, H:0, PX:3, vw:0, vh:0, pix:null, g:null };
  const g = canvas.getContext('2d'); info.g = g;
  info.layout = () => {
    const r = stage.getBoundingClientRect(); info.W = Math.max(300, r.width); info.H = Math.max(300, r.height);
    info.PX = clamp(Math.round(Math.min(info.H / maxH, info.W / minW)), minPx, maxPx);
    info.vw = Math.ceil(info.W / info.PX); info.vh = Math.ceil(info.H / info.PX);
    canvas.width = info.vw; canvas.height = info.vh; canvas.style.width = info.W + 'px'; canvas.style.height = info.H + 'px';
    g.imageSmoothingEnabled = false; info.pix = new Pix(info.vw, info.vh, g);
  };
  info.layout();
  return info;
}

/* ---------- 결정적 난수(그림이 프레임마다 흔들리지 않게) ---------- */
export function hash(n) { n = Math.imul(n ^ (n >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
