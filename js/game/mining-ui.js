// 채광 화면: 동굴 벽의 광맥을 고르고, 바위 면의 약점을 정확한 위치·순간에 내리칩니다.
import { MINING_SPOTS, ORES, TIERS, josa } from './items.js';
import { MineSession } from './mining-engine.js';
import { createRng } from './rng.js';
import { itemIcon } from './host.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const GRADE = { perfect:['정확!', 'perfect'], good:['좋아요', 'good'], weak:['약해요', 'ok'], miss:['빗나감', 'bad'] };

export function createMining({ host, placeId, progress, sfx, reduced }) {
  const spot = MINING_SPOTS[placeId], rng = createRng();
  const stage = host.stage; stage.classList.add('ms-stage');
  stage.innerHTML = `<div class="ms-select"></div>
    <div class="ms-play" hidden><canvas class="ms-canvas" aria-label="광맥 화면"></canvas><div class="ms-top"></div><div class="cs-pop" aria-hidden="true"></div><div class="ms-hint"></div>
      <button type="button" class="ms-strike mg-btn mg-primary">내리치기 (스페이스)</button></div>`;
  const selectEl = stage.querySelector('.ms-select'), playEl = stage.querySelector('.ms-play'), canvas = stage.querySelector('canvas'), ctx = canvas.getContext('2d');
  const topEl = stage.querySelector('.ms-top'), popEl = stage.querySelector('.cs-pop'), hintEl = stage.querySelector('.ms-hint'), strikeBtn = stage.querySelector('.ms-strike');
  const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, time = 0, paused = false, destroyed = false, run = null;
  const S = { rx:.5, ry:.5, swing:0, swingGrade:null, particles:[], shake:0, flash:0, freeze:0, cracks:[], broken:[], pointer:false, keys:{ l:false, r:false, u:false, d:false }, lastPeak:-1, endT:0, rock:null, nodeFlash:0 };

  function layout() { const r = stage.getBoundingClientRect(); W = Math.max(300, r.width); H = Math.max(300, r.height); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
  const ro = new ResizeObserver(layout); ro.observe(stage);
  const rockBox = () => { const size = Math.min(W * .86, (H - (coarse ? 150 : 120)) * .94, 560); return { size, x:W / 2 - size / 2, y:Math.max(66, (H - size) / 2 - 6) }; };
  const toPx = (nx, ny) => { const b = rockBox(); return { x:b.x + nx * b.size, y:b.y + ny * b.size }; };
  const toNorm = (px, py) => { const b = rockBox(); return { x:(px - b.x) / b.size, y:(py - b.y) / b.size }; };

  /* ---------- 광맥 선택 ---------- */
  const weakText = ore => ore.mine.weak.moves ? (ore.tier === 'special' ? '약점이 아주 작고 빠르게 움직임 · 3곳을 차례로' : '약점이 작고 균열을 따라 움직임') : '약점이 넓고 가만히 있음';
  function renderSelect() {
    run = null; playEl.hidden = true; selectEl.hidden = false; stage.dataset.mode = 'select';
    selectEl.innerHTML = `<div class="ms-select-in"><p class="mg-kicker">${esc(spot.name)}</p><h2>어느 광맥을 캘까요?</h2><p class="mg-body">광맥마다 <b>곡괭이로 내리칠 수 있는 횟수</b>가 정해져 있습니다. 약점의 <b>위치</b>와 <b>빛나는 순간</b>을 맞춰야 깨집니다. 어려운 광맥일수록 광석이 귀합니다.</p>
      <div class="ms-veins">${spot.ores.map(id => { const o = ORES[id]; return `<article class="ms-vein tier-${o.tier}" data-ore="${id}" style="--glow:${o.glow};--rock:${o.color}"><div class="ms-vein-art" aria-hidden="true"><i></i><i></i><i></i></div><header><h3>${esc(o.name)}</h3><em class="tier-${o.tier}">${TIERS[o.tier]}</em></header><p>${esc(o.desc)}</p>
        <dl><div><dt>곡괭이</dt><dd>${o.mine.swings}번</dd></div><div><dt>약점</dt><dd>${esc(weakText(o))}</dd></div><div><dt>얻는 양</dt><dd>${o.mine.yield[0] === o.mine.yield[1] ? o.mine.yield[0] : o.mine.yield[0] + '~' + o.mine.yield[1]}개</dd></div></dl>
        <button type="button" class="mg-btn mg-primary">캐기 시작</button></article>`; }).join('')}</div>
      <p class="pack-note">곡괭이 기회는 광맥마다 새로 주어지며, 별도로 소비되는 재료는 없습니다.</p></div>`;
    selectEl.querySelectorAll('.ms-vein').forEach(card => card.querySelector('button').addEventListener('click', () => { sfx.play('ui'); begin(ORES[card.dataset.ore]); }));
    host.say('캘 광맥을 고르세요.');
  }
  function begin(ore) {
    run = { ore, m:new MineSession(ore, rng), phase:'play', hits:[], seed:rng.int(1, 1e6) }; S.rx = .5; S.ry = .62; S.swing = 0; S.cracks = []; S.broken = []; S.particles = []; S.endT = 0; S.nodeFlash = 0; S.lastPeak = -1;
    selectEl.hidden = true; playEl.hidden = false; stage.dataset.mode = 'mine'; layout(); S.rock = makeRock(run.seed);
    hintEl.textContent = coarse ? '빛나는 약점을 눌러 내리치세요. 링이 약점에 딱 맞춰질 때가 가장 강합니다.' : '빛나는 약점 위에 조준하고(마우스·방향키) 클릭/스페이스로 내리치세요. 링이 약점에 딱 맞춰질 때가 가장 강합니다.';
    setTimeout(() => hintEl.classList.add('off'), 7000); hintEl.classList.remove('off'); renderTop(); strikeBtn.hidden = coarse;
  }
  function makeRock(seed) { const r = createRng(seed), pts = []; const n = 14; for (let i = 0; i < n; i++) { const a = i / n * TAU, rad = .4 + r.range(-.05, .06); pts.push({ a, rad }); } const sparkle = Array.from({ length:10 }, () => ({ x:r.range(.2, .8), y:r.range(.2, .8), p:r.range(0, 6) })); return { pts, sparkle }; }
  function renderTop() {
    const m = run.m; topEl.innerHTML = `<span class="ms-name">${esc(run.ore.name)} <em class="tier-${run.ore.tier}">${TIERS[run.ore.tier]}</em></span><span class="ms-swings" aria-label="남은 곡괭이 ${m.swings}번">${Array.from({ length:m.swingsMax }, (_, i) => `<i class="${i < m.swings ? 'on' : ''}"></i>`).join('')}</span>${m.cfg.nodes > 1 ? `<span class="ms-nodes">약점 ${Math.min(m.node + 1, m.cfg.nodes)} / ${m.cfg.nodes}</span>` : ''}`;
  }

  /* ---------- 입력 ---------- */
  function aimFromEvent(e) { const r = canvas.getBoundingClientRect(); const n = toNorm(e.clientX - r.left, e.clientY - r.top); S.rx = n.x; S.ry = n.y; }
  canvas.addEventListener('pointermove', e => { if (!coarse || S.pointer) aimFromEvent(e); });
  canvas.addEventListener('pointerdown', e => { if (!run || run.phase !== 'play' || paused) return; e.preventDefault(); aimFromEvent(e); S.pointer = true; doStrike(); });
  canvas.addEventListener('pointerup', () => { S.pointer = false; }); canvas.addEventListener('pointercancel', () => { S.pointer = false; });
  canvas.style.touchAction = 'none';
  strikeBtn.addEventListener('pointerdown', e => { e.preventDefault(); doStrike(); });
  const kd = e => {
    if (paused || host.closed || !host.layer.hidden || !run || run.phase !== 'play') return;
    const k = { ArrowLeft:'l', a:'l', ArrowRight:'r', d:'r', ArrowUp:'u', w:'u', ArrowDown:'d', s:'d' }[e.key];
    if (k) { e.preventDefault(); S.keys[k] = true; }
    else if (e.key === ' ' || e.key === 'Enter') { if (e.target?.closest?.('button') && !e.target.classList.contains('ms-strike')) return; e.preventDefault(); if (!e.repeat) doStrike(); }
  };
  const ku = e => { const k = { ArrowLeft:'l', a:'l', ArrowRight:'r', d:'r', ArrowUp:'u', w:'u', ArrowDown:'d', s:'d' }[e.key]; if (k) S.keys[k] = false; };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);

  function popup(text, tone) { const n = document.createElement('div'); n.className = 'cs-judge tone-' + tone; n.textContent = text; popEl.append(n); setTimeout(() => n.remove(), 900); }
  function doStrike() {
    if (!run || run.phase !== 'play' || S.freeze > 0) return;
    S.swing = .001; const m = run.m, hit = m.strike(S.rx, S.ry); if (!hit) return;
    const px = toPx(hit.x, hit.y), cfg = { perfect:{ shake:12, n:34, freeze:.09, flash:.35 }, good:{ shake:8, n:20, freeze:.05, flash:.12 }, weak:{ shake:5, n:10, freeze:.02, flash:0 }, miss:{ shake:7, n:8, freeze:0, flash:0 } }[hit.grade];
    sfx.play('hit-' + hit.grade); if (hit.grade === 'perfect' || hit.grade === 'good') setTimeout(() => sfx.play('crack'), 60);
    if (!reduced) { S.shake = cfg.shake; S.flash = cfg.flash; S.freeze = cfg.freeze; }
    const col = hit.grade === 'miss' ? '#a8a090' : run.ore.glow; for (let i = 0; i < (reduced ? Math.ceil(cfg.n / 3) : cfg.n); i++) { const a = rng.range(0, TAU), v = rng.range(60, 360) * (hit.grade === 'perfect' ? 1.3 : 1); S.particles.push({ x:px.x, y:px.y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 120, life:rng.range(.35, .9), max:.9, size:rng.range(1.5, 4.5), color:i % 3 ? col : '#ffffff', rock:i % 4 === 0 }); }
    S.cracks.push({ x:hit.x, y:hit.y, n:hit.grade === 'perfect' ? 7 : hit.grade === 'good' ? 5 : 3, seed:rng.int(1, 9999), grade:hit.grade, born:time });
    popup(GRADE[hit.grade][0], GRADE[hit.grade][1]);
    try { navigator.vibrate?.(hit.grade === 'perfect' ? 50 : hit.grade === 'miss' ? 25 : 35); } catch {}
    if (hit.advanced) { S.nodeFlash = 1; S.broken.push({ x:hit.w.x, y:hit.w.y }); setTimeout(() => popup('다음 약점!', 'perfect'), 380); }
    renderTop();
    if (m.over) { run.phase = 'ending'; S.endT = 0; }
  }

  function finish() {
    const m = run.m, ore = run.ore; run.phase = 'done';
    const again = { label:'다른 광맥 캐기', primary:true, run:() => renderSelect() }, leave = { label:'동굴에서 나가기', run:() => host.close() };
    const summary = `정확 ${m.stats.perfect} · 좋음 ${m.stats.good} · 약함 ${m.stats.weak} · 빗나감 ${m.stats.miss} (곡괭이 ${m.swingsMax - m.swings}번 사용)`;
    if (m.over === 'cracked') {
      const n = m.yieldCount(); progress.add(ore.id, n); const xpAmt = Math.round(ore.xp * (1 + Math.min(.5, m.stats.perfect * .12))), xp = progress.addXp('mining', xpAmt); sfx.play('ore'); if (xp.leveled) sfx.play('level');
      host.showResult({ tone:'win', title:`${ore.name}${josa(ore.name, '을/를')} 캐냈습니다`, message:summary, rewards:[{ item:ore.id, n, note:m.stats.perfect >= 2 && n > ore.mine.yield[0] ? '정확한 타격이 많아 광석을 더 얻었습니다.' : ore.desc }], xp:`채광 경험치 +${xpAmt}`, level:xp.leveled ? `채광 Lv.${xp.after.level} 달성!` : '', actions:[again, leave] });
    } else {
      const xp = progress.addXp('mining', 2); sfx.play('lose');
      const why = m.stats.perfect + m.stats.good === 0 ? '약점을 한 번도 제대로 맞히지 못했습니다. 링이 약점에 딱 맞춰지는 순간에, 약점 한가운데를 노려 보세요.' : ore.tier === 'special' ? '특수 광맥은 정확한 타격이 모자라면 열리지 않습니다. 약점이 움직이는 방향을 보고 미리 조준하세요.' : '곡괭이 횟수를 다 썼습니다. 어설픈 타격(약함)과 빗나감이 쌓여 광맥이 열리지 않았습니다.';
      host.showResult({ tone:'lose', title:'광맥을 캐지 못했습니다', message:summary, detail:why, xp:'채광 경험치 +2 (도전 보상)', actions:[again, leave] });
    }
  }

  /* ---------- 갱신 ---------- */
  function update(dt) {
    time += dt; S.shake = Math.max(0, S.shake - dt * 30); S.flash = Math.max(0, S.flash - dt * 3); S.nodeFlash = Math.max(0, S.nodeFlash - dt * 1.4);
    if (S.swing > 0) { S.swing += dt / .26; if (S.swing >= 1) S.swing = 0; }
    for (const p of S.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt; } S.particles = S.particles.filter(p => p.life > 0);
    if (S.freeze > 0) { S.freeze -= dt; return; }
    if (!run) return;
    const kx = (S.keys.r ? 1 : 0) - (S.keys.l ? 1 : 0), ky = (S.keys.d ? 1 : 0) - (S.keys.u ? 1 : 0);
    if (kx || ky) { S.rx = clamp(S.rx + kx * .55 * dt, .02, .98); S.ry = clamp(S.ry + ky * .55 * dt, .02, .98); }
    if (run.phase === 'play') {
      run.m.step(dt);
      const peak = Math.floor(run.m.t / run.m.pulsePeriod); if (peak !== S.lastPeak) { S.lastPeak = peak; sfx.tone({ f:1500, dur:.04, vol:.025, type:'sine' }); }
    } else if (run.phase === 'ending') { S.endT += dt; if (S.endT > (run.m.over === 'cracked' ? 1.1 : .9)) finish(); }
  }

  /* ---------- 그리기 ---------- */
  function wall() {
    const g = ctx.createRadialGradient(W / 2, H * .45, 40, W / 2, H * .5, Math.max(W, H) * .75); g.addColorStop(0, '#2c3a36'); g.addColorStop(.6, '#16211f'); g.addColorStop(1, '#070d0c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 40; i++) { const x = (i * 137) % W, y = (i * 211) % H; ctx.fillRect(x, y, 30 + (i % 5) * 10, 3); }
    // 물방울 / 안개
    ctx.fillStyle = 'rgba(160,220,200,.05)'; for (let i = 0; i < 5; i++) { const x = ((i * 300 + time * 12) % (W + 300)) - 150; ctx.beginPath(); ctx.ellipse(x, H * (.3 + i * .12), 200, 40, 0, 0, TAU); ctx.fill(); }
  }
  function drawRock() {
    const b = rockBox(), cx = b.x + b.size / 2, cy = b.y + b.size / 2, m = run.m, ore = run.ore, dmgRatio = 1 - m.hp / 100;
    const ending = run.phase === 'ending' || run.phase === 'done', cracked = m.over === 'cracked';
    ctx.save();
    const split = ending && cracked ? Math.min(1, S.endT / .6) : 0;
    if (!(ending && cracked && S.endT > .65)) {
      ctx.translate(cx, cy); ctx.scale(1 - split * .15, 1 - split * .15); ctx.globalAlpha = 1 - split; ctx.translate(-cx, -cy);
      // 몸통
      ctx.beginPath(); S.rock.pts.forEach((p, i) => { const x = cx + Math.cos(p.a) * p.rad * b.size, y = cy + Math.sin(p.a) * p.rad * b.size * .92; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      const g = ctx.createRadialGradient(cx - b.size * .12, cy - b.size * .15, b.size * .05, cx, cy, b.size * .5); g.addColorStop(0, '#4c5654'); g.addColorStop(.6, '#2c3533'); g.addColorStop(1, '#161d1c'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#0a0f0e'; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.clip();
      // 광석 결정이 비치는 면
      ctx.fillStyle = ore.color; ctx.globalAlpha = (1 - split) * (.16 + .1 * dmgRatio); ctx.fillRect(b.x, b.y, b.size, b.size); ctx.globalAlpha = 1 - split;
      // 반짝이는 광물 점
      for (const s of S.rock.sparkle) { const k = (Math.sin(time * 2 + s.p) + 1) / 2; ctx.fillStyle = ore.glow; ctx.globalAlpha = (.15 + .5 * k) * (1 - split); ctx.fillRect(b.x + s.x * b.size - 1.5, b.y + s.y * b.size - 1.5, 3, 3); } ctx.globalAlpha = 1 - split;
      // 균열 경로(약점이 있는 선)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      m.nodes.forEach((n, i) => { if (i < m.node) return; const active = i === m.node; const A = toPx(n.ax, n.ay), B = toPx(n.bx, n.by); const mx = (A.x + B.x) / 2 + Math.sin(i * 2.1) * 10, my = (A.y + B.y) / 2 + Math.cos(i * 2.7) * 10;
        ctx.strokeStyle = ore.glow; ctx.globalAlpha = (active ? .5 : .15) * (1 - split); ctx.lineWidth = active ? 3 : 2; ctx.beginPath(); ctx.moveTo(A.x - (B.x - A.x) * .25, A.y - (B.y - A.y) * .25); ctx.lineTo(mx, my); ctx.lineTo(B.x + (B.x - A.x) * .25, B.y + (B.y - A.y) * .25); ctx.stroke(); });
      ctx.globalAlpha = 1 - split;
      // 타격 흔적(누적 균열)
      for (const c of S.cracks) { const P = toPx(c.x, c.y), r = createRng(c.seed); ctx.strokeStyle = c.grade === 'miss' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = c.grade === 'perfect' ? 2.6 : 1.8; for (let i = 0; i < c.n; i++) { const a = r.range(0, TAU), len = r.range(14, c.grade === 'perfect' ? 70 : 42); ctx.beginPath(); ctx.moveTo(P.x, P.y); let x = P.x, y = P.y; for (let k = 1; k <= 3; k++) { x += Math.cos(a + r.range(-.4, .4)) * len / 3; y += Math.sin(a + r.range(-.4, .4)) * len / 3; ctx.lineTo(x, y); } ctx.stroke(); } }
      ctx.restore();
      ctx.globalAlpha = 1;
      // 약점
      if (run.phase === 'play') drawWeak(b);
      // 이미 깬 약점
      for (const br of S.broken) { const P = toPx(br.x, br.y); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(P.x, P.y, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = ore.glow; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, 9, 0, TAU); ctx.stroke(); }
    }
    if (ending && cracked) { // 쪼개짐: 광석 조각이 튀어 오릅니다
      const t = S.endT; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .3, d = Math.min(1, t / .7) * b.size * (.18 + (i % 3) * .06), y = cy + Math.sin(a) * d - Math.sin(Math.min(1, t / .8) * Math.PI) * 40 + t * t * 120; ctx.save(); ctx.translate(cx + Math.cos(a) * d, y); ctx.rotate(a + t * 4); ctx.fillStyle = i % 2 ? ore.color : ore.glow; ctx.strokeStyle = '#0a0f0e'; ctx.lineWidth = 2; ctx.globalAlpha = clamp(1.4 - t * .7, 0, 1); ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(-4, -14); ctx.lineTo(12, -6); ctx.lineTo(8, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
    ctx.restore();
  }
  function drawWeak(b) {
    const m = run.m, w = m.weak(), P = toPx(w.x, w.y), R = w.r * b.size, p = m.pulse(), ore = run.ore;
    // 접근 링: 맥박이 정점에 가까워질수록 약점에 딱 맞게 줄어듭니다.
    const phase = (m.t / m.pulsePeriod) % 1, near = 1 - Math.abs(Math.cos(phase * Math.PI)), ringR = R * (1 + near * 1.25);
    const gl = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, R * 1.6); gl.addColorStop(0, ore.glow); gl.addColorStop(.35, ore.glow + 'aa'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = .25 + .75 * p; ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(P.x, P.y, R * 1.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fffbe6'; ctx.globalAlpha = .35 + .65 * p; ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(4, R * .35), 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = p > .8 ? '#fff6b8' : '#ffffffaa'; ctx.lineWidth = p > .8 ? 4 : 2.2; ctx.beginPath(); ctx.arc(P.x, P.y, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ore.glow; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(P.x, P.y, ringR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (S.nodeFlash > 0) { ctx.strokeStyle = `rgba(255,255,255,${S.nodeFlash})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P.x, P.y, R * (1 + (1 - S.nodeFlash) * 3), 0, TAU); ctx.stroke(); }
  }
  function drawPick() {
    const P = toPx(S.rx, S.ry), k = S.swing, ang = k ? lerp(-1.15, .25, Math.sin(Math.min(1, k * 2) * Math.PI / 2)) * (k < .5 ? 1 : lerp(1, -.4, (k - .5) * 2)) : -.55;
    // 조준점
    ctx.strokeStyle = '#fff4c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, 11, 0, TAU); ctx.moveTo(P.x - 18, P.y); ctx.lineTo(P.x - 7, P.y); ctx.moveTo(P.x + 7, P.y); ctx.lineTo(P.x + 18, P.y); ctx.moveTo(P.x, P.y - 18); ctx.lineTo(P.x, P.y - 7); ctx.moveTo(P.x, P.y + 7); ctx.lineTo(P.x, P.y + 18); ctx.stroke();
    // 곡괭이
    ctx.save(); ctx.translate(P.x + 26, P.y + 38); ctx.rotate(ang); ctx.lineCap = 'round';
    ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 120); ctx.stroke(); ctx.strokeStyle = '#a77746'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 118); ctx.stroke();
    ctx.strokeStyle = '#1a2a28'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-34, 8); ctx.quadraticCurveTo(0, -14, 34, 8); ctx.stroke(); ctx.strokeStyle = '#c3cfcf'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-34, 8); ctx.quadraticCurveTo(0, -14, 34, 8); ctx.stroke();
    ctx.restore();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save(); if (S.shake > 0) ctx.translate((Math.random() - .5) * S.shake, (Math.random() - .5) * S.shake);
    wall(); if (run && !playEl.hidden) { drawRock(); for (const p of S.particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1; if (run.phase === 'play') drawPick(); }
    ctx.restore();
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${S.flash})`; ctx.fillRect(0, 0, W, H); }
  }
  function frame(now) { raf = requestAnimationFrame(frame); if (destroyed) return; const dt = clamp((now - last) / 1000, 0, .05); last = now; if (!paused) update(dt); draw(); }
  layout(); renderSelect(); last = performance.now(); raf = requestAnimationFrame(frame);

  return {
    tutorial:{ title:'채광', pages:[
      { title:'광맥 고르기', demo:'<div class="demo-fs"><span>일반 · 곡괭이 9번</span><span>희귀 · 7번</span><span>특수 · 5번</span></div>', text:'광맥마다 <b>곡괭이로 내리칠 수 있는 횟수</b>가 다릅니다. 어려울수록 약점이 작고 움직이며, 얻는 광석이 귀합니다.' },
      { title:'약점과 맥박', demo:'<div class="demo-fs"><span>◎ 빛나는 약점</span><span>◌ 줄어드는 링</span><span>= 딱 맞을 때 가장 강함</span></div>', text:'바위의 <b>빛나는 약점</b>을 조준하세요(마우스·방향키·터치). 약점은 맥박처럼 밝아지고, <b>바깥 링이 약점에 딱 맞춰지는 순간</b>이 가장 강한 타격입니다. 희귀·특수 광석은 약점이 균열을 따라 움직입니다.' },
      { title:'내리치기', demo:'<div class="demo-fs"><span>정확!</span><span>좋아요</span><span>약해요</span><span>빗나감</span></div>', text:'클릭·스페이스·탭으로 내리칩니다. <b>정확!</b>이 많을수록 빨리 깨지고 광석도 더 얻습니다. 빗나가도 곡괭이 기회는 줄어듭니다. 곡괭이를 다 쓰면 광맥은 열리지 않습니다.' },
    ] },
    busy: () => !!run && run.phase === 'play' && run.m.hits.length + (run.m.swingsMax - run.m.swings) > 0,
    leaveWarning: () => '채광 중입니다. 지금 나가면 이 광맥은 캐지 못한 채 끝납니다(곡괭이 외에 소비되는 것은 없습니다).',
    pause: () => { paused = true; }, resume: () => { paused = false; }, layerClosed: () => { paused = false; }, abort: () => {},
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); },
    debug: () => ({ mode:stage.dataset.mode, phase:run?.phase, swings:run?.m.swings, hp:run?.m.hp }),
    _S: S, _begin: begin, get _run() { return run; }, _strike: doStrike, _toPx: toPx,
  };
}
