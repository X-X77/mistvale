// 채집 화면(픽셀 캔버스): 작은 숲 한 구역. 렌즈(마우스·손가락)로 주변을 살피며 재료 단서를 찾고, 의심 가는 곳을 들춰 재료를 직접 담습니다.
// 규칙(배치·숨는 곳·단서·헛손질·희귀 재료 담기)은 gathering-engine.js 가 그대로 담당하고, 이 파일은 입력과 그림·소리만 맡습니다.
import { scenePainter } from './scene-art.js';
import { INGREDIENTS, josa } from './items.js?v=mg4';
import { GatherSession, ZONES, TEMPLATES, SPOT_NAMES, CLUE_NAMES, HOLD, clueLevel, ASPECT } from './gathering-engine.js?v=mg4';
import { createRng } from './rng.js?v=mg4';
import { Pix, pixelSurface, blit, clamp, lerp, mix, INK, hash } from './pixel.js?v=mg4';
import { iconSprite, iconImg, uiIcon } from './art.js?v=mg4';
import { spotSprite, drawClue, buildGround, PALS, ITEM_COLOR, GOLD } from './gather-art.js?v=mg-art1';

const TAU = Math.PI * 2;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const chip = (label, tone = '') => `<span class="demo-chip ${tone}">${label}</span>`;
const key = label => `<span class="demo-key">${label}</span>`;
const ITEMS = ['herb', 'mushroom', 'berry'];
const ing = id => ({ ...INGREDIENTS[id], kind:'ingredient' });
const rnd = (a, b) => a + Math.random() * (b - a);

export function createGathering({ host, placeId, progress, sfx, reduced }) {
  const paintScene = scenePainter('clearing', .24);
  const stage = host.stage; stage.classList.add('gt-stage');
  const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
  stage.innerHTML = `<div class="gt-select"></div>
    <div class="gt-play" hidden><canvas class="gt-canvas" aria-label="숲 채집 구역"></canvas><div class="gt-top"></div><div class="cs-pop" aria-hidden="true"></div><div class="fs-hint gt-hint" aria-hidden="true"></div>
      <div class="gt-legend" aria-hidden="true"></div><button type="button" class="gt-done px-btn alt">바구니 챙기기</button></div>`;
  const selectEl = stage.querySelector('.gt-select'), playEl = stage.querySelector('.gt-play'), canvas = stage.querySelector('canvas'), topEl = stage.querySelector('.gt-top');
  const popEl = stage.querySelector('.cs-pop'), hintEl = stage.querySelector('.gt-hint'), legendEl = stage.querySelector('.gt-legend'), doneBtn = stage.querySelector('.gt-done');
  const surf = pixelSurface(canvas, playEl, { maxH:230, minW:150 }), g = surf.g;
  const rng = createRng();
  let VW = 0, VH = 0, PX = 3, FX = 0, FY = 0, FS = 90, raf = 0, last = 0, time = 0, paused = false, destroyed = false, run = null, ground = null, hintTimer = 0, committed = false;
  const S = { lens:{ x:.6, y:.5 }, speed:0, dwell:0, hover:-1, selected:-1, parts:[], flights:[], shake:0, keys:{ l:false, r:false, u:false, d:false }, spaceHold:false,
    pointerDown:false, holdSpot:-1, lastRustle:0, nextGust:2, endT:0, missShake:0, tick:0, lastHoldTick:0 };

  /* ---------- 화면 배치 ---------- */
  const areaOf = () => { const top = Math.ceil((coarse ? 84 : 80) / PX), bottom = Math.ceil((coarse ? 74 : 64) / PX); return { x:4, y:top, w:VW - 8, h:VH - top - bottom }; };
  function layout() {
    if (playEl.hidden) return; surf.layout(); VW = surf.vw; VH = surf.vh; PX = surf.PX; place();
  }
  function place() {
    const a = areaOf(), aspect = run ? run.g.field.aspect : 1.2;
    FS = Math.max(40, Math.min(a.w / aspect, a.h)); FX = Math.round(a.x + (a.w - aspect * FS) / 2); FY = Math.round(a.y + (a.h - FS) / 2);
    if (run) ground = buildGround(VW, VH, FX, FY, FS, aspect, run.zone.id, run.g.field.template.id, run.seed);
  }
  const ro = new ResizeObserver(layout); ro.observe(stage);
  const toV = (x, y) => ({ x:FX + x * FS, y:FY + y * FS });
  const toF = (vx, vy) => ({ x:(vx - FX) / FS, y:(vy - FY) / FS });
  const aspectNow = () => { const a = areaOf(); return clamp(a.w / a.h, ASPECT.min, ASPECT.max); };

  /* ---------- 구역 고르기 ---------- */
  function renderSelect() {
    run = null; playEl.hidden = true; selectEl.hidden = false; stage.dataset.mode = 'select'; clearTimeout(hintTimer);
    selectEl.innerHTML = `<div class="gt-select-in"><h2>어디서 찾아볼까요?</h2><p class="mg-body">재료는 풀숲 아래에 숨어 있어요. 단서를 보고 의심 가는 곳만 들춰요. <b>헛손질</b>을 다 쓰면 손이 지쳐요.</p>
      <div class="gt-zones">${Object.values(ZONES).map(z => `<article class="gt-zone px g${z.grade}" data-zone="${z.id}"><span class="gt-swatch" style="--c:${z.color}"></span><h3>${esc(z.name)}</h3><em class="gt-grade g${z.grade}">${'★'.repeat(z.grade)} ${z.label}</em><p>${esc(z.desc)}</p>
        <dl><div><dt>숨은 재료</dt><dd>${z.targets[0]}~${z.targets[1]}곳</dd></div><div><dt>헛손질</dt><dd>${z.misses}번</dd></div><div><dt>찾으면</dt><dd>재료 ${z.yield}개${z.yield > 1 ? '씩' : ''}</dd></div></dl>
        <button type="button" class="px-btn">들어가기</button></article>`).join('')}</div></div>`;
    selectEl.querySelectorAll('.gt-zone').forEach(card => card.querySelector('button').addEventListener('click', () => { sfx.play('ui'); begin(card.dataset.zone); }));
    host.say('채집할 구역을 고르세요.');
  }

  function begin(zoneId, templateId = null) {
    const zone = ZONES[zoneId]; selectEl.hidden = true; playEl.hidden = false; stage.dataset.mode = 'play'; committed = false;
    surf.layout(); VW = surf.vw; VH = surf.vh; PX = surf.PX;
    const aspect = aspectNow(); run = { zone, g:new GatherSession(zoneId, rng, templateId, aspect), seed:rng.int(1, 99999), phase:'play' };
    place(); S.lens = { x:aspect / 2, y:.5 }; S.speed = 0; S.dwell = 0; S.hover = -1; S.selected = -1; S.parts = []; S.flights = []; S.holdSpot = -1; S.endT = 0; S.nextGust = 1.5; S.pointerDown = false;
    for (const sp of run.g.spots) { sp.t = -1; sp.pulse = 0; sp.shake = 0; }
    renderTop(); renderLegend(); popEl.replaceChildren(); doneBtn.hidden = false;
    setHint(coarse ? '손가락으로 문질러 단서를 찾고, 의심 가는 곳을 두 번 눌러 들춰요' : '마우스를 천천히 움직여 단서를 찾고, 의심 가는 곳을 클릭해 들춰요', 7000);
    host.say(`${zone.name}에 들어왔어요. 숨은 재료 ${run.g.targets}곳.`);
  }

  /* ---------- 상단 표시(헛손질·바구니) / 단서 안내 ---------- */
  function renderTop(bump = '') {
    const s = run.g, tpl = s.field.template.name;
    topEl.innerHTML = `<span class="gt-zname px"><b>${esc(run.zone.name)}</b><small>${esc(tpl)}</small></span>
      <span class="gt-miss px" aria-label="남은 헛손질 ${s.misses}번" title="들췄는데 아무것도 없으면 하나씩 줄어요">${Array.from({ length:s.missesMax }, (_, i) => `<i class="${i < s.misses ? 'on' : 'off'}"></i>`).join('')}</span>
      <span class="gt-basket px">${ITEMS.map(id => `<span class="${bump === id ? 'bump' : ''}" title="${esc(INGREDIENTS[id].name)}">${iconImg(ing(id), 22)}<b>${s.basket[id]}</b></span>`).join('')}</span>`;
  }
  function renderLegend() {
    legendEl.innerHTML = `<span class="gt-lg herb">초록 반짝임 = 허브</span><span class="gt-lg mushroom">보랏빛 포자 = 버섯</span><span class="gt-lg berry">붉은 반짝임·나비 = 베리</span><span class="gt-lg gold">금빛 별 = 희귀</span>`;
  }
  function setHint(text, ttl = 0) { hintEl.textContent = text; hintEl.classList.toggle('on', !!text); clearTimeout(hintTimer); if (text && ttl) hintTimer = setTimeout(() => hintEl.classList.remove('on'), ttl); }
  function popup(text, tone) { const node = document.createElement('div'); node.className = 'cs-judge gt-judge tone-' + tone; node.textContent = text; popEl.append(node); setTimeout(() => node.remove(), 900); }

  /* ---------- 입력 ---------- */
  const rect = () => canvas.getBoundingClientRect();
  function fieldPoint(event) { const r = rect(), v = { x:(event.clientX - r.left) / r.width * VW, y:(event.clientY - r.top) / r.height * VH }; return toF(v.x, v.y); }
  function spotAt(fx, fy, scale = 1.2) {
    let best = null, bd = Infinity; for (const sp of run.g.spots) { const d = Math.hypot(sp.x - fx, sp.y - fy); if (d <= sp.r * scale && d < bd) { best = sp; bd = d; } } return best;
  }
  function moveLens(p) { S.lens = { x:clamp(p.x, 0, run.g.field.aspect), y:clamp(p.y, 0, 1) }; }
  function interact(sp, byTouch) {
    if (!run || run.phase !== 'play' || !sp) return;
    const s = run.g, h = sp.hides;
    if (sp.state === 'closed') {
      if (byTouch && S.selected !== sp.id) { S.selected = sp.id; sfx.play('rustle'); setHint('한 번 더 누르면 들춰요', 1800); return; }
      S.selected = -1; openSpot(sp); return;
    }
    if (h && !h.collected && !h.lost) {
      if (h.special) { if (s.startHold(sp.id)) { S.holdSpot = sp.id; S.lastHoldTick = 0; sfx.play('ui'); setHint('손을 가만히! 흔들리면 달아나요', 2500); } }
      else collectSpot(sp);
    }
  }
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointermove', event => { if (!run) return; if (event.pointerType === 'mouse' || S.pointerDown) moveLens(fieldPoint(event)); });
  canvas.addEventListener('pointerdown', event => {
    if (!run || run.phase !== 'play' || paused) return; event.preventDefault();
    const p = fieldPoint(event); moveLens(p); S.pointerDown = true; try { canvas.setPointerCapture(event.pointerId); } catch { /* noop */ }
    interact(spotAt(p.x, p.y, event.pointerType === 'mouse' ? 1.15 : 1.5), event.pointerType !== 'mouse');
  });
  const release = () => { S.pointerDown = false; if (run && S.holdSpot >= 0) { run.g.cancelHold(); S.holdSpot = -1; } };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
  const dirOf = k => ({ ArrowLeft:'l', a:'l', ArrowRight:'r', d:'r', ArrowUp:'u', w:'u', ArrowDown:'d', s:'d' }[k]);
  const kd = e => {
    if (paused || host.closed || !host.layer.hidden || !run || run.phase !== 'play') return;
    const k = dirOf(e.key);
    if (k) { e.preventDefault(); S.keys[k] = true; return; }
    if ((e.key === ' ' || e.key === 'Enter') && !(e.target?.closest?.('button'))) { e.preventDefault(); if (!e.repeat) { S.spaceHold = true; interact(spotAt(S.lens.x, S.lens.y, 1.7), false); } }
  };
  const ku = e => { const k = dirOf(e.key); if (k) S.keys[k] = false; if (e.key === ' ' || e.key === 'Enter') { S.spaceHold = false; release(); } };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  doneBtn.addEventListener('click', () => { if (!run || run.phase !== 'play') return; sfx.play('ui'); run.g.finish(); renderTop(); checkEnd(); });

  /* ---------- 행동 ---------- */
  function burst(x, y, n, colors, speed = 46) { if (reduced) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.4, 1) * speed; S.parts.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - speed * .5, life:rnd(.35, .8), max:.8, c:colors[i % colors.length], s:i % 3 ? 1 : 2, g:150 }); } }
  function openSpot(sp) {
    const res = run.g.open(sp.id); if (res.kind === 'again' || res.kind === 'over') return;
    const v = toV(sp.x, sp.y), P = PALS[run.zone.id]; sp.t = 0; sfx.play('leaf');
    burst(v.x, v.y, 10, [P.g2, P.g3, P.leaf[0], P.leaf[1]], 40);
    if (res.kind === 'found') {
      setTimeout(() => { sfx.play(res.special ? 'gold' : 'find'); burst(v.x, v.y - 4, res.special ? 16 : 8, res.special ? [GOLD, '#fff6b8'] : ['#ffffff', ITEM_COLOR[res.item]], 54); }, reduced ? 0 : 180);
      popup(res.special ? '반짝이는 희귀 재료!' : INGREDIENTS[res.item].name + ' 발견!', res.special ? 'perfect' : 'good');
      setHint(res.special ? '꾹 누른 채 손을 가만히 두면 조심스럽게 담아요' : (coarse ? '재료를 눌러 담아요' : '재료를 눌러 담아요'), 3000);
    } else {
      sfx.play('miss'); S.missShake = .4; popup('아무것도 없어요', 'bad'); renderTop();
      if (res.tired) { setHint('헛손질을 다 썼어요. 손이 지쳤어요', 0); popup('손이 지쳤어요', 'bad'); }
    }
    renderTop(); checkEnd();
  }
  function collectSpot(sp) {
    const res = run.g.collect(sp.id); if (!res.ok) return; const v = toV(sp.x, sp.y);
    flyToBasket(v.x, v.y - 4, res.item, false); sfx.play('collect'); renderTop(); checkEnd(); hintEl.classList.remove('on');
  }
  function flyToBasket(x, y, item, gold) { S.flights.push({ item, x0:x, y0:y, t:0, dur:reduced ? .01 : .55, gold }); }
  function checkEnd() { if (run.g.over && run.phase === 'play') { run.phase = 'ending'; S.endT = 0; doneBtn.hidden = true; } }

  /* ---------- 마무리 ---------- */
  function commit() {
    if (committed) return { items:{}, xp:0, leveled:false, after:null }; committed = true;
    const s = run.g, items = {}; for (const id of ITEMS) if (s.basket[id] > 0) items[id] = s.basket[id];
    for (const [id, n] of Object.entries(items)) progress.add(id, n);
    const xpAmt = s.total > 0 ? s.total * 5 + s.stats.gold * 6 : 1, xp = progress.addXp('gathering', xpAmt);
    return { items, xp:xpAmt, leveled:xp.leveled, after:xp.after };
  }
  function finish() {
    const s = run.g, zone = run.zone; run.phase = 'done'; const out = commit();
    const again = { label:'같은 구역 한 번 더', primary:true, run:() => begin(zone.id) }, other = { label:'구역 바꾸기', run:() => renderSelect() }, leave = { label:'숲 구경 마치기', run:() => host.close() };
    const stats = `찾은 곳 ${s.stats.found}/${s.targets}${s.stats.gold ? ` · 희귀 ${s.stats.gold}` : ''} · 헛손질 ${s.stats.empty}번`;
    const rewards = Object.entries(out.items).map(([id, n]) => ({ item:id, n, note:INGREDIENTS[id].desc }));
    if (s.total > 0) {
      sfx.play(s.over === 'complete' ? 'win' : 'ok'); if (out.leveled) sfx.play('level');
      const title = s.over === 'complete' ? '구역을 모두 찾았어요!' : s.over === 'tired' ? '손이 지쳤어요' : '바구니를 챙겼어요';
      const why = s.over === 'complete' ? '숨은 재료를 하나도 놓치지 않았어요.' : s.over === 'tired' ? '헛손질이 다 떨어졌어요. 단서가 있는 곳만 골라 들춰 보세요.' : '';
      host.showResult({ tone:'win', title, message:stats, detail:why, rewards, xp:`채집 경험치 +${out.xp}`, level:out.leveled ? `채집 Lv.${out.after.level} 달성!` : '', actions:[again, other, leave] });
    } else {
      sfx.play('lose');
      host.showResult({ tone:'lose', title:'빈 바구니예요', message:stats, detail:'재료를 하나도 담지 못했어요. 풀숲 위로 단서(반짝임·포자·나비)가 떠오르는 곳을 먼저 찾아봐요.', xp:'채집 경험치 +1 (도전 보상)', actions:[again, other, leave] });
    }
  }

  /* ---------- 갱신 ---------- */
  function update(dt) {
    time += dt; S.shake = Math.max(0, S.shake - dt * 14); S.missShake = Math.max(0, S.missShake - dt);
    for (const q of S.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; } S.parts = S.parts.filter(q => q.life > 0);
    for (const f of S.flights) { f.t += dt; if (!f.done && f.t >= f.dur) { f.done = true; renderTop(f.item); } } S.flights = S.flights.filter(f => f.t < f.dur + .02);
    if (!run) return; const s = run.g;
    for (const sp of s.spots) if (sp.t >= 0) sp.t += dt;
    if (run.phase === 'play') {
      if (s.over) checkEnd();   // 어떤 경로로든 끝났다면 마무리로 넘어갑니다
      s.step(dt);
      // 렌즈: 키보드 이동, 속도·머무른 시간(단서가 또렷해지는 조건)
      const kx = (S.keys.r ? 1 : 0) - (S.keys.l ? 1 : 0), ky = (S.keys.d ? 1 : 0) - (S.keys.u ? 1 : 0);
      const px = S.lens.x, py = S.lens.y; if (kx || ky) moveLens({ x:S.lens.x + kx * .55 * dt, y:S.lens.y + ky * .55 * dt });
      const inst = Math.hypot(S.lens.x - px, S.lens.y - py) / Math.max(dt, .001); S.speed = lerp(S.speed, inst, 1 - Math.exp(-dt * 10));
      if (S.speed < .1) S.dwell += dt; else S.dwell = Math.max(0, S.dwell - dt * 3);
      const hov = spotAt(S.lens.x, S.lens.y, 1.2); S.hover = hov ? hov.id : -1;
      // 풀잎 스치는 소리: 렌즈가 풀숲 위를 빠르게 지나갈 때
      if (S.speed > .25 && hov && time - S.lastRustle > .16) { S.lastRustle = time; sfx.play('rustle'); const v = toV(hov.x, hov.y); S.parts.push({ x:v.x, y:v.y, vx:rnd(-8, 8), vy:rnd(-14, -4), life:.5, max:.5, c:PALS[run.zone.id].g3, s:1, g:40 }); }
      // 바람(가짜 단서): 아무 데서나 잎이 흩날립니다
      S.nextGust -= dt; if (S.nextGust <= 0) { S.nextGust = rnd(1.4, 3); const sp = rng.pick(s.spots.filter(q => q.state === 'closed')); if (sp) { const v = toV(sp.x, sp.y), P = PALS[run.zone.id]; for (let i = 0; i < 4; i++) S.parts.push({ x:v.x, y:v.y - 3, vx:rnd(8, 22), vy:rnd(-12, -3), life:rnd(.6, 1.1), max:1.1, c:P.leaf[i % 3], s:1, g:18 }); } }
      // 희귀 재료 담기(손이 흔들리면 달아남)
      if (s.hold) {
        const r = s.holdStep(dt, S.speed); const sp = s.spotAt(S.holdSpot); const v = sp ? toV(sp.x, sp.y) : { x:0, y:0 };
        if (time - S.lastHoldTick > .16 && s.hold) { S.lastHoldTick = time; sfx.play('tick', s.hold.progress); }
        if (r === 'done') { S.holdSpot = -1; flyToBasket(v.x, v.y - 4, sp.hides.item, true); sfx.play('gold'); sfx.play('collect'); burst(v.x, v.y - 4, 18, [GOLD, '#fff6b8', '#ffffff'], 60); popup('조심조심 담았어요!', 'perfect'); renderTop(); checkEnd(); }
        else if (r === 'spooked') { S.holdSpot = -1; sfx.play('bad'); burst(v.x, v.y - 4, 8, ['#9aa59f', '#cfd8d4'], 40); popup('놀라서 달아났어요', 'bad'); renderTop(); checkEnd(); setHint('손을 가만히 두면 되는 거였어요. 천천히!', 3000); }
      }
    } else if (run.phase === 'ending') { S.endT += dt; if (S.endT > .7) finish(); }
  }

  /* ---------- 그리기 ---------- */
  const iconCache = {}; const itemSpr = id => iconCache[id] || (iconCache[id] = iconSprite({ id, kind:'ingredient', color:ITEM_COLOR[id] }));
  function drawSpot(sp, lensVis) {
    const s = run.g, zone = run.zone, P = PALS[zone.id], v = toV(sp.x, sp.y), size = clamp(Math.round(sp.r * 2.25 * FS), 12, 30);
    const spr = spotSprite(sp.kind, sp.id % 3, zone.id, size), hovered = S.hover === sp.id || S.selected === sp.id;
    const sway = sp.state === 'closed' && !reduced ? Math.round(Math.sin(time * 1.3 + sp.phase) * .6) : 0;
    let dx = sway, dy = hovered && sp.state === 'closed' ? -1 : 0;
    if (sp.t >= 0 && sp.t < .25 && !reduced) dx += (Math.floor(sp.t * 40) % 2 ? 1 : -1);
    if (sp.state === 'open') { g.fillStyle = '#2f2014'; g.globalAlpha = .9; g.beginPath(); g.ellipse(v.x, v.y + size * .12, size * .4, size * .17, 0, 0, TAU); g.fill(); g.globalAlpha = 1; blit(g, spr, v.x + size * .32, v.y - 1, { rot:.55, alpha:.9 }); }
    else {
      g.globalAlpha = .25; g.fillStyle = '#000'; g.beginPath(); g.ellipse(v.x, v.y + size * .36, size * .42, size * .12, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
      blit(g, spr, v.x + dx, v.y + dy);
      if (sp.hides && zone.peek > 0 && !sp.hides.special) { g.globalAlpha = zone.peek; g.fillStyle = ITEM_COLOR[sp.hides.item]; const ox = Math.round(Math.sin(sp.phase * 3) * size * .25); g.fillRect(Math.round(v.x + ox), Math.round(v.y + size * .2), 2, 2); g.fillRect(Math.round(v.x + ox + 3), Math.round(v.y + size * .26), 1, 1); g.globalAlpha = 1; }
    }
    if (hovered && sp.state === 'closed') { g.strokeStyle = '#fff4c8'; g.globalAlpha = .75; g.lineWidth = 1; g.beginPath(); g.ellipse(v.x, v.y + 1, size * .56, size * .46, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
  }
  function drawItems() {
    const s = run.g;
    for (const sp of s.spots) {
      const h = sp.hides; if (sp.state !== 'open' || !h || h.collected || h.lost) continue;
      const v = toV(sp.x, sp.y), appear = clamp((sp.t - .12) / .25, 0, 1), bob = Math.round(Math.sin(time * 4 + sp.id) * 1.2), y = v.y - 6 - (1 - appear) * 4 + bob, spr = itemSpr(h.item);
      const glow = h.special ? GOLD : '#ffffff'; g.globalAlpha = appear * (.35 + .25 * Math.sin(time * 5)); g.fillStyle = glow; g.beginPath(); g.ellipse(v.x, y + 1, 9, 8, 0, 0, TAU); g.fill(); g.globalAlpha = appear;
      g.save(); g.translate(Math.round(v.x), Math.round(y)); g.drawImage(spr.cv, -8, -12); g.restore(); g.globalAlpha = 1;
      if (h.special && s.hold?.id === sp.id) { const k = clamp(s.hold.progress, 0, 1), shake = clamp(s.hold.shaky / HOLD.shakyLimit, 0, 1); g.strokeStyle = shake > .5 ? '#ff8a72' : GOLD; g.lineWidth = 2; g.beginPath(); g.arc(v.x, y - 3, 11, -Math.PI / 2, -Math.PI / 2 + TAU * k); g.stroke(); }
      else if (appear > .9 && (Math.floor(time * 2) & 1)) { g.fillStyle = '#fff'; g.fillRect(Math.round(v.x + 7), Math.round(y - 12), 1, 1); }
    }
  }
  function drawFog() {
    if (run.zone.id !== 'mist') return; const a = run.g.field.aspect, w = a * FS, L = toV(S.lens.x, S.lens.y), R0 = FS * .12, R1 = FS * .3;
    const grad = g.createRadialGradient(L.x, L.y, R0, L.x, L.y, R1); grad.addColorStop(0, 'rgba(190,215,222,0)'); grad.addColorStop(1, 'rgba(190,215,222,.66)');
    g.save(); g.beginPath(); g.rect(FX, FY, w, FS); g.clip(); g.fillStyle = grad; g.fillRect(FX, FY, w, FS);
    if (!reduced) for (let i = 0; i < 6; i++) { const mx = FX + ((hash(i * 9) * w + time * (5 + i)) % w), my = FY + hash(i * 21) * FS; g.globalAlpha = .14; g.fillStyle = '#e8f6f8'; g.fillRect(Math.round(mx), Math.round(my), 14, 2); }
    g.restore();
  }
  function drawLens() {
    if (coarse && !S.pointerDown && S.selected < 0) return; const v = toV(S.lens.x, S.lens.y), r = Math.max(4, FS * .045); const hot = S.hover >= 0;
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(v.x, v.y, r, 0, TAU); g.stroke(); g.strokeStyle = hot ? '#ffe27a' : '#fff4c8'; g.lineWidth = 1; g.beginPath(); g.arc(v.x, v.y, r, 0, TAU); g.stroke();
    // 머무르면 차오르는 집중 표시
    const need = run.zone.clue === 'still' ? run.zone.dwell : .4, k = clamp(S.dwell / need, 0, 1); if (k > 0 && k < 1) { g.strokeStyle = '#b8f2b0'; g.lineWidth = 1; g.beginPath(); g.arc(v.x, v.y, r + 3, -Math.PI / 2, -Math.PI / 2 + TAU * k); g.stroke(); }
    g.fillStyle = hot ? '#ffe27a' : '#fff4c8'; g.fillRect(Math.round(v.x), Math.round(v.y), 1, 1);
  }
  function draw() {
    if (!run || playEl.hidden || !ground) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, VW, VH);
    const sh = S.shake > 0 && !reduced ? S.shake : 0; canvas.style.transform = sh ? `translate(${Math.round((Math.random() - .5) * sh) * PX}px,${Math.round((Math.random() - .5) * sh) * PX}px)` : '';
    paintScene(g, ground.cv);
    const s = run.g, zone = run.zone, order = [...s.spots].sort((a, b) => a.y - b.y);
    for (const sp of order) drawSpot(sp);
    // 단서
    for (const sp of s.spots) {
      const d = Math.hypot(sp.x - S.lens.x, sp.y - S.lens.y), level = clueLevel(zone, sp, { d, dwell:S.dwell }); if (!level) continue;
      const v = toV(sp.x, sp.y); drawClue(g, sp.hides.item, v.x, v.y - Math.round(sp.r * FS * .2), time, level, sp.hides.special, sp.phase, reduced);
    }
    drawItems(); drawFog();
    for (const q of S.parts) { g.globalAlpha = clamp(q.life / q.max, 0, 1); g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); } g.globalAlpha = 1;
    for (const f of S.flights) { const k = clamp(f.t / f.dur, 0, 1), e = k * k, tx = VW - 14, ty = 6, x = lerp(f.x0, tx, e), y = lerp(f.y0, ty, e) - Math.sin(k * Math.PI) * 14, spr = itemSpr(f.item); g.globalAlpha = 1 - k * .3; g.drawImage(spr.cv, Math.round(x) - 8, Math.round(y) - 12); g.globalAlpha = 1; }
    if (run.phase === 'play' || run.phase === 'ending') drawLens();
  }
  function frame(now) { raf = requestAnimationFrame(frame); if (destroyed) return; const dt = clamp((now - last) / 1000, 0, .05); last = now; if (!paused) update(dt); draw(); }
  last = performance.now(); raf = requestAnimationFrame(frame); renderSelect();

  return {
    tutorial:{ title:'채집', pages:[
      { title:'구역 고르기', demo:chip('★ 풀밭') + chip('★★ 숲길', 'warn') + chip('★★★ 안개 숲', 'bad'), text:'구역이 어려울수록 재료가 <b>풀과 비슷한 색</b>으로 숨고 단서도 늦게 나타나요. 대신 한 번에 얻는 재료가 많아요.' },
      { title:'단서 읽기', demo:chip('초록 반짝임=허브', 'ok') + chip('보랏빛 포자=버섯') + chip('붉은 반짝임·나비=베리', 'bad'), text:'재료가 숨은 풀숲 위로 <b>단서</b>가 떠올라요. 허브는 높은 풀·낙엽, 버섯은 통나무·바위, 베리는 덤불 아래에 있어요. 그냥 흩날리는 잎은 바람이에요.' },
      { title:'들추고 담기', demo:key('클릭') + key('탭 두 번') + key('Space') + chip('헛손질 ♥'), text:'의심 가는 곳을 눌러 <b>들춰요</b>. 아무것도 없으면 헛손질 하나가 줄고, 다 쓰면 손이 지쳐요. 나온 재료를 눌러 담아요.' },
      { title:'반짝이는 희귀 재료', demo:chip('금빛 별', 'warn') + key('꾹') + chip('손을 가만히', 'ok'), text:'렌즈를 한곳에 <b>잠시 멈추면</b> 금빛 별이 보여요. 들춘 뒤 <b>꾹 누르고 손을 가만히</b> 두면 담아요. 손이 흔들리면 달아나요.' },
    ] },
    busy: () => !!run && run.phase === 'play' && (run.g.stats.found + run.g.stats.empty) > 0,
    leaveWarning: () => '채집 중이에요. 지금 나가면 지금까지 바구니에 담은 재료만 가져가요.',
    pause: () => { paused = true; release(); }, resume: () => { paused = false; }, layerClosed: () => { paused = false; },
    abort: () => { if (run && run.phase !== 'done') { run.g.finish(); commit(); } },
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(hintTimer); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); },
    debug: () => ({ mode:stage.dataset.mode, phase:run?.phase, over:run?.g.over, misses:run?.g.misses, basket:run?.g.basket, targets:run?.g.targets }),
    _S: S, _begin: begin, get _run() { return run; }, _interact: interact, _open: openSpot, _collect: collectSpot,
    _toPx: sp => { const v = toV(sp.x, sp.y), r = canvas.getBoundingClientRect(); return { x:v.x / VW * r.width, y:v.y / VH * r.height }; },
    _lensTo: (x, y) => moveLens({ x, y }),
  };
}
