// 광산 안 화면: 어두운 갱도(배경 그림) 위에 광맥 6곳이 놓여 있고, 하나를 골라 누르면 기존 채광 미니게임(mining-ui.js)이 열립니다.
// 캔 광맥은 잠시 비었다가(남은 시간 표시) 다시 나타납니다. 규칙·저장은 mine-engine.js, 곡괭이질 자체는 mining-ui.js 가 그대로 맡습니다.
import { createMining } from './mining-ui.js?v=mine1';
import { ORES, josa } from './items.js?v=mine1';
import { rockSprite } from './art.js?v=mine1';
import { hash, clamp, lerp, mix, light } from './pixel.js?v=mine1';
import { VEINS, VEIN_TYPES, MineState, veinInfo, fmtTime } from './mine-engine.js?v=mine1';

const ART = { w:762, h:506, src:new URL('../../assets/minigames/mine.webp', import.meta.url).href };
const LANTERN = { u:.127, v:.25 };
const GLINTS = [{ u:.76, v:.17, c:'#7ff2e0' }, { u:.15, v:.66, c:'#7ff2e0' }, { u:.9, v:.6, c:'#c9a8ff' }, { u:.88, v:.7, c:'#c9a8ff' }, { u:.3, v:.1, c:'#7ff2e0' }];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const stars = n => '★'.repeat(n);

export function createMine({ host, placeId, progress, sfx, reduced, state = null, justDepleted = null }) {
  const mine = state || new MineState(safeStorage());
  const stage = host.stage; stage.classList.add('mn-stage');
  stage.innerHTML = `<canvas class="mn-canvas" aria-hidden="true"></canvas><div class="mn-veins" role="group" aria-label="광맥"></div>
    <div class="mn-tag" hidden></div><div class="mn-pop" aria-live="polite"></div>
    <div class="mn-legend" aria-hidden="true">${Object.values(VEIN_TYPES).map(t => `<span class="mn-lg ${t.id}"><b>${stars(t.stars)}</b> ${t.label} <i>${esc(ORES[t.ore].name)}</i></span>`).join('')}</div>`;
  const canvas = stage.querySelector('canvas'), g = canvas.getContext('2d'), veinBox = stage.querySelector('.mn-veins'), tag = stage.querySelector('.mn-tag'), pop = stage.querySelector('.mn-pop');
  const dark = document.createElement('canvas'), dg = dark.getContext('2d');
  const art = new Image(); art.src = ART.src;
  const S = { W:0, H:0, dpr:1, scale:1, ax:0, ay:0, hover:null, locked:false, parts:[], twinkle:0, drip:3 + Math.random() * 3, pebble:9 + Math.random() * 6, depleted:new Set(), second:0, flash:0, rise:{}, puff:{} };
  let raf = 0, last = 0, time = 0, destroyed = false, paused = false, popTimer = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- 배치 ---------- */
  function layout() {
    const r = stage.getBoundingClientRect(); S.W = Math.max(280, r.width); S.H = Math.max(280, r.height); S.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(S.W * S.dpr); canvas.height = Math.round(S.H * S.dpr); canvas.style.width = S.W + 'px'; canvas.style.height = S.H + 'px';
    dark.width = Math.ceil(S.W / 2); dark.height = Math.ceil(S.H / 2);
    const wide = S.W / S.H >= 1.2;   // 가로 화면은 꽉 채우고, 세로(모바일)는 가로폭에 맞춰 위아래를 어둡게 이어 붙입니다
    S.scale = wide ? Math.max(S.W / ART.w, S.H / ART.h) : Math.min(S.W / (ART.w * .74), Math.max(S.W / ART.w, S.H * .62 / ART.h));   // 세로 화면: 광맥이 모여 있는 가운데 74%만 크게 보여 줍니다(양옆은 잘림)
    S.ax = (S.W - ART.w * S.scale) / 2; S.ay = wide ? (S.H - ART.h * S.scale) / 2 : (S.H - ART.h * S.scale) * .4;
    for (const vein of VEINS) {
      const p = at(vein.u, vein.v), size = sizeOf(vein), btn = veinBox.querySelector(`[data-id=${vein.id}]`); if (!btn) continue;
      const hit = Math.max(size * 1.05, 52); btn.style.cssText = `left:${p.x - hit / 2}px;top:${p.y - hit / 2}px;width:${hit}px;height:${hit}px`;
    }
  }
  const at = (u, v) => ({ x:S.ax + u * ART.w * S.scale, y:S.ay + v * ART.h * S.scale });
  const sizeOf = vein => Math.max(ART.w * S.scale * (.125 - .05 * vein.depth), 56 - vein.depth * 12);

  /* ---------- 광맥 버튼(키보드·스크린리더·터치용 실제 버튼) ---------- */
  function buildButtons() {
    veinBox.innerHTML = VEINS.map(v => `<button type="button" class="mn-vein" data-id="${v.id}"></button>`).join('');
    for (const btn of veinBox.querySelectorAll('.mn-vein')) {
      const id = btn.dataset.id;
      btn.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') setHover(id); }); btn.addEventListener('pointerleave', () => setHover(null));
      btn.addEventListener('focus', () => setHover(id)); btn.addEventListener('blur', () => setHover(null));
      btn.addEventListener('click', () => choose(id));
    }
    refreshLabels();
  }
  function refreshLabels() {
    for (const vein of VEINS) {
      const info = veinInfo(vein.id), left = mine.remaining(vein.id), btn = veinBox.querySelector(`[data-id=${vein.id}]`);
      btn.setAttribute('aria-label', left ? `${info.label}, 비어 있음, ${fmtTime(left)} 뒤에 다시 나타남` : `${info.label}, ${ORES[info.ore].name}, 난이도 ${info.stars}단계`);
      btn.classList.toggle('empty', !!left);
    }
  }
  function setHover(id) {
    if (S.locked) return; S.hover = id;
    if (!id) { tag.hidden = true; return; }
    const info = veinInfo(id), left = mine.remaining(id), p = at(info.u, info.v), size = sizeOf(info);
    tag.innerHTML = left ? `<b>${info.label}</b><span>비어 있음 · ${fmtTime(left)} 뒤에 다시 나타나요</span>` : `<b>${info.label} <em>${stars(info.stars)}</em></b><span>${esc(ORES[info.ore].name)} · ${info.hint}</span>`;
    tag.hidden = false; const w = tag.offsetWidth; tag.style.left = clamp(p.x - w / 2, 8, S.W - w - 8) + 'px'; tag.style.top = Math.max(60, p.y - size / 2 - tag.offsetHeight - 10) + 'px';
    if (!left) { sfx.play('tick', .6); burst(p.x, p.y, 4, ORES[info.ore].glow, 30); }
  }

  /* ---------- 광맥 선택 → 채광 미니게임 ---------- */
  function choose(id) {
    if (S.locked || paused) return; const info = veinInfo(id), left = mine.remaining(id), p = at(info.u, info.v);
    if (left) { sfx.play('deny'); say(`${info.label}은 아직 비어 있어요. ${fmtTime(left)} 뒤에 다시 나타나요.`); burst(p.x, p.y, 6, '#9aa59f', 26); return; }
    S.locked = true; const ore = ORES[info.ore]; sfx.play('hit-good'); burst(p.x, p.y, 16, ore.glow, 90); S.flash = .5; S.rise[id] = .3; tag.hidden = true;
    setTimeout(() => {
      if (destroyed) return;
      const back = (extra = {}) => host.switchGame('mine', '광산', () => createMine({ host, placeId, progress, sfx, reduced, state:mine, ...extra }));
      host.switchGame('mining', '채광', () => createMining({ host, placeId, progress, sfx, reduced, mine:{ ore,
        onResult: res => { if (res.success) mine.deplete(id); },
        onBack: () => { const done = mine.remaining(id) > 0; back(done ? { justDepleted:id } : {}); } } }));
      host.showTutorial(false);
    }, reduced ? 60 : 260);
  }
  function say(text) { pop.textContent = text; pop.classList.add('on'); clearTimeout(popTimer); popTimer = setTimeout(() => pop.classList.remove('on'), 3200); host.say(text); }

  /* ---------- 입자·환경 ---------- */
  function burst(x, y, n, color, speed) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(.3, 1) * speed; S.parts.push({ k:'chip', x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - speed * .5, life:rnd(.4, .8), max:.8, c:color, s:rnd(2, 4), g:260 }); } }
  function puff(x, y, n) { for (let i = 0; i < n; i++) S.parts.push({ k:'dust', x:x + rnd(-14, 14), y:y + rnd(-6, 8), vx:rnd(-12, 12), vy:rnd(-22, -6), life:rnd(.7, 1.3), max:1.3, c:'#b8b2a6', s:rnd(5, 10), g:-6 }); }
  const motes = Array.from({ length:34 }, (_, i) => ({ u:hash(i * 7), v:hash(i * 13 + 1), ph:hash(i * 29) * 6.28, sp:.02 + hash(i * 5) * .04 }));

  function update(dt) {
    time += dt; S.flash = Math.max(0, S.flash - dt * 2.4);
    for (const q of S.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; if (q.k === 'pebble' && q.y >= q.ground) { q.life = 0; puff(q.x, q.ground, 4); sfx.play('rubble'); } } S.parts = S.parts.filter(q => q.life > 0);
    for (const k of Object.keys(S.rise)) { S.rise[k] -= dt; if (S.rise[k] <= 0) delete S.rise[k]; }
    // 물 떨어지는 소리, 가끔 떨어지는 잔돌
    if (!reduced) {
      S.drip -= dt; if (S.drip <= 0) { S.drip = rnd(5, 9); const x = S.ax + rnd(.3, .7) * ART.w * S.scale, y = S.ay + rnd(.78, .92) * ART.h * S.scale; sfx.play('drip'); S.parts.push({ k:'ring', x, y, vx:0, vy:0, life:.9, max:.9, c:'#bfe6ee', s:2, g:0 }); }
      S.pebble -= dt; if (S.pebble <= 0) { S.pebble = rnd(13, 22); const x = S.ax + rnd(.25, .75) * ART.w * S.scale, y0 = S.ay + .1 * ART.h * S.scale; S.parts.push({ k:'pebble', x, y:y0, vx:0, vy:30, life:3, max:3, c:'#8a8f98', s:3, g:420, ground:S.ay + rnd(.8, .9) * ART.h * S.scale }); }
      S.twinkle -= dt; if (S.twinkle <= 0) { S.twinkle = rnd(.35, .9); const t = GLINTS[Math.floor(Math.random() * GLINTS.length)], p = at(t.u, t.v); S.parts.push({ k:'glint', x:p.x + rnd(-8, 8), y:p.y + rnd(-8, 8), vx:0, vy:0, life:.8, max:.8, c:t.c, s:3, g:0 }); }
    }
    // 시간이 지나 다시 나타난 광맥
    S.second += dt; if (S.second >= 1) {
      S.second = 0; const before = S.depleted; const back = mine.collectRespawned(before); S.depleted = new Set(mine.depleted);
      for (const id of back) { const info = veinInfo(id), p = at(info.u, info.v); burst(p.x, p.y, 14, ORES[info.ore].glow, 70); S.rise[id] = .5; sfx.play('find'); say(`${info.label}이 다시 나타났어요!`); }
      refreshLabels(); if (S.hover) setHover(S.hover);
    }
  }

  /* ---------- 그리기 ---------- */
  function drawRubble(p, size, seed) {
    for (let i = 0; i < 7; i++) { const a = hash(seed * 9 + i) * 6.28, r = hash(seed * 17 + i) * size * .3, w = 6 + hash(seed + i * 3) * size * .12; g.fillStyle = i % 2 ? '#4a4f58' : '#646a74'; g.fillRect(Math.round(p.x + Math.cos(a) * r - w / 2), Math.round(p.y + size * .12 + Math.sin(a) * r * .45), Math.round(w), Math.round(w * .6)); g.fillStyle = '#8a909a'; g.fillRect(Math.round(p.x + Math.cos(a) * r - w / 2), Math.round(p.y + size * .12 + Math.sin(a) * r * .45), Math.round(w), 2); }
  }
  function draw() {
    const W = S.W, H = S.H; g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); g.globalAlpha = 1; g.fillStyle = '#080b0f'; g.fillRect(0, 0, W, H);
    if (art.complete && art.naturalWidth) {
      g.imageSmoothingEnabled = true; g.drawImage(art, S.ax, S.ay, ART.w * S.scale, ART.h * S.scale);
      // 세로 화면: 그림 위아래 가장자리를 어둠으로 이어 줍니다
      const fade = 46, top = S.ay, bot = S.ay + ART.h * S.scale;
      let gr = g.createLinearGradient(0, top - 2, 0, top + fade); gr.addColorStop(0, '#080b0f'); gr.addColorStop(1, '#080b0f00'); g.fillStyle = gr; g.fillRect(0, Math.max(0, top - 2), W, fade + 2);
      gr = g.createLinearGradient(0, bot - fade, 0, bot + 2); gr.addColorStop(0, '#080b0f00'); gr.addColorStop(1, '#080b0f'); g.fillStyle = gr; g.fillRect(0, bot - fade, W, Math.max(0, H - bot + fade));
    }
    const flick = reduced ? 1 : .92 + .08 * Math.sin(time * 9) * Math.sin(time * 5.3 + 1) + .03 * Math.sin(time * 23);
    // 어둠 + 불빛(랜턴, 빛나는 광맥)
    dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, dark.width, dark.height); dg.fillStyle = 'rgba(3,5,9,.5)'; dg.fillRect(0, 0, dark.width, dark.height);
    dg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { const gr = dg.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, r / 2); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, dark.width, dark.height); };
    const L = at(LANTERN.u, LANTERN.v); hole(L.x, L.y, ART.w * S.scale * .6 * flick, .95); hole(S.W * .5, S.ay + ART.h * S.scale * .62, ART.w * S.scale * .7, .55);
    for (const vein of VEINS) { if (!mine.ready(vein.id)) continue; const p = at(vein.u, vein.v); hole(p.x, p.y, sizeOf(vein) * (1.5 + vein.depth * .6) * (S.hover === vein.id ? 1.3 : 1), .6 + vein.depth * .3); }
    g.imageSmoothingEnabled = true; g.drawImage(dark, 0, 0, W, H);
    // 따뜻한 랜턴 빛
    g.globalCompositeOperation = 'lighter'; let gr = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, ART.w * S.scale * .32 * flick); gr.addColorStop(0, `rgba(255,190,90,${.3 * flick})`); gr.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 광맥
    for (const vein of VEINS) {
      const info = veinInfo(vein.id), ore = ORES[info.ore], p = at(vein.u, vein.v), size = sizeOf(vein), ready = mine.ready(vein.id), hov = S.hover === vein.id, pulse = .5 + .5 * Math.sin(time * 2.2 + vein.seed);
      g.globalCompositeOperation = 'source-over';
      // 바닥 그림자
      g.globalAlpha = .4; g.fillStyle = '#000'; g.beginPath(); g.ellipse(p.x, p.y + size * .38, size * .42, size * .1, 0, 0, 6.28); g.fill(); g.globalAlpha = 1;
      if (ready) {
        const n = 44, spr = rockSprite(info.ore, n, vein.seed), k = Math.max(2, Math.round(size / n)), w = n * k, lift = (hov ? -4 : 0) + (S.rise[vein.id] ? -Math.sin(S.rise[vein.id] / .5 * Math.PI) * 8 : 0);
        // 빛 번짐(희귀할수록 크게)
        g.globalCompositeOperation = 'lighter'; const gl = size * (.8 + vein.depth * .3) * (hov ? 1.35 : 1), a = (.16 + .1 * pulse + (hov ? .25 : 0)) * (.6 + vein.depth * .5);
        const gg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, gl); gg.addColorStop(0, hexA(ore.glow, a)); gg.addColorStop(1, hexA(ore.glow, 0)); g.fillStyle = gg; g.fillRect(p.x - gl, p.y - gl, gl * 2, gl * 2);
        g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.drawImage(spr.cv, Math.round(p.x - w / 2), Math.round(p.y - w / 2 + lift), w, w);
        if (hov) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = .25; g.drawImage(spr.cv, Math.round(p.x - w / 2), Math.round(p.y - w / 2 + lift), w, w); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; ring(p.x, p.y + lift * .5, w * .55, ore.glow, 3); }
        // 반짝임(귀한 광맥일수록 자주)
        if (!reduced) { const tw = Math.sin(time * (1.5 + vein.depth) + vein.seed * 3); if (tw > .93 - vein.depth * .05) star(p.x + (hash(vein.seed) - .5) * size * .5, p.y + (hash(vein.seed + 3) - .5) * size * .4, 4 + vein.depth * 2, '#ffffff'); }
      } else {
        drawRubble(p, size, vein.seed);
        const left = mine.remaining(vein.id); g.font = '400 12px Jua, "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#18241f'; g.fillText(fmtTime(left), p.x + 1, p.y - size * .15 + 1); g.fillStyle = '#d6dde0'; g.fillText(fmtTime(left), p.x, p.y - size * .15);
        if (S.puff[vein.id] === undefined) S.puff[vein.id] = 0;
      }
    }
    g.globalCompositeOperation = 'lighter';
    // 먼지(랜턴 근처에서 더 또렷하게)
    if (!reduced) for (const m of motes) { const x = S.ax + ((m.u + Math.sin(time * m.sp * 6 + m.ph) * .02 + time * m.sp * .15) % 1) * ART.w * S.scale, y = S.ay + ((m.v + time * m.sp * .3) % 1) * ART.h * S.scale, near = clamp(1 - Math.hypot(x - L.x, y - L.y) / (ART.w * S.scale * .45), 0, 1); if (near <= 0) continue; g.fillStyle = `rgba(255,225,160,${.5 * near})`; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
    g.globalCompositeOperation = 'source-over';
    for (const q of S.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      if (q.k === 'dust') { g.globalAlpha = a * .5; g.fillStyle = q.c; const s = q.s + (1 - a) * 6; g.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), Math.round(s), Math.round(s)); }
      else if (q.k === 'ring') { g.globalAlpha = a * .7; ring(q.x, q.y, (1 - a) * 14 + 2, q.c, 1.5, .35); }
      else if (q.k === 'glint') { g.globalAlpha = Math.sin(a * Math.PI); star(q.x, q.y, q.s + 2, q.c); }
      else { g.globalAlpha = a; g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), Math.round(q.s), Math.round(q.s)); }
    }
    g.globalAlpha = 1; if (S.flash > 0) { g.globalAlpha = S.flash * .4; g.fillStyle = '#fff6dc'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }
  function ring(x, y, r, c, w, squash = 1) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.ellipse(x, y, r, r * squash, 0, 0, 6.28); g.stroke(); }
  function star(x, y, s, c) { g.fillStyle = c; g.fillRect(Math.round(x - s / 2), Math.round(y), Math.round(s), 1); g.fillRect(Math.round(x), Math.round(y - s / 2), 1, Math.round(s)); g.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3); }
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  function frame(now) { raf = requestAnimationFrame(frame); if (destroyed) return; const dt = clamp((now - last) / 1000, 0, .05); last = now; if (!paused) update(dt); draw(); }
  const ro = new ResizeObserver(() => { layout(); if (S.hover) setHover(S.hover); }); ro.observe(stage);
  buildButtons(); layout(); S.depleted = new Set(mine.depleted);
  art.addEventListener('load', () => draw());
  if (justDepleted) { const info = veinInfo(justDepleted), p = at(info.u, info.v); puff(p.x, p.y, 12); burst(p.x, p.y, 14, ORES[info.ore].color, 80); sfx.play('rubble'); say(`${info.label}을 비웠어요. ${fmtTime(mine.remaining(justDepleted))} 뒤에 다시 나타나요.`); }
  host.say('회색산 광산 안이에요. 광맥을 골라 캘 수 있어요.');
  last = performance.now(); raf = requestAnimationFrame(frame);

  return {
    tutorial:{ title:'광산', pages:[
      { title:'광맥을 골라요', demo:`<span class="demo-chip">★ 일반</span><span class="demo-chip warn">★★ 단단함</span><span class="demo-chip bad">★★★ 희귀</span>`, text:'빛나는 <b>광맥</b>을 눌러 곡괭이질을 시작해요. 더 단단하고 귀한 광맥일수록 어렵지만 좋은 광석이 나와요. 캔 광맥은 잠시 뒤 <b>다시 나타나요</b>.' },
    ] },
    busy: () => false, pause: () => { paused = true; }, resume: () => { paused = false; }, layerClosed: () => { paused = false; }, abort: () => {},
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(popTimer); },
    debug: () => ({ mode:'mine', depleted:mine.depleted, locked:S.locked }),
    _state: mine, _choose: choose, _S: S,
  };
}

function safeStorage() { try { return window.localStorage; } catch { return null; } }
