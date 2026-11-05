// 채광 화면(픽셀 캔버스): 동굴 안 광석 하나를 가운데 두고, 약점의 위치와 빛나는 순간을 맞춰 곡괭이로 내리칩니다.
// 규칙(약점·맥박·등급·피해)은 mining-engine.js 가 그대로 담당하고, 이 파일은 입력과 그림(바위·균열·곡괭이·파편)을 맡습니다.
import { scenePainter } from './scene-art.js';
import { MINING_SPOTS, ORES, TIERS, josa } from './items.js?v=mine1';
import { equipmentBonus } from './goods.js?v=mine1';
import { MineSession } from './mining-engine.js?v=mine1';
import { createRng } from './rng.js?v=mine1';
import { itemIcon } from './host.js?v=mine1';
import { Pix, pixelSurface, blit, clamp, lerp, mix, light, dark, INK, hash } from './pixel.js?v=mine1';
import { rockSprite, rockShards, iconSprite, uiIcon } from './art.js?v=mine1';

const TAU = Math.PI * 2;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const GRADE = { perfect:['정확!', 'perfect'], good:['좋아요', 'good'], weak:['약해요', 'ok'], miss:['빗나감', 'bad'] };
const chip = (label, tone = '') => `<span class="demo-chip ${tone}">${label}</span>`;
const key = label => `<span class="demo-key">${label}</span>`;

// mine: 광산 안에서 광맥을 골라 들어온 경우 { ore, onResult({success, ore, n}), onBack() } — 광맥 고르기 화면을 건너뛰고 그 광석으로 바로 시작하며,
//       끝나면 「광산으로 돌아가기」로 이어집니다. 조작·난이도·보상은 평소 채광과 똑같습니다.
export function createMining({ host, placeId, progress, sfx, reduced, mine = null }) {
  const paintScene = scenePainter('mine', 0);
  const spot = MINING_SPOTS[placeId], rng = createRng();
  const stage = host.stage; stage.classList.add('ms-stage');
  stage.innerHTML = `<div class="ms-select"></div>
    <div class="ms-play" hidden><canvas class="ms-canvas" aria-label="광맥 화면"></canvas><div class="ms-top"></div><div class="cs-pop" aria-hidden="true"></div><div class="ms-hint fs-hint"></div>
      <button type="button" class="ms-strike px-btn">내리치기!</button></div>`;
  const selectEl = stage.querySelector('.ms-select'), playEl = stage.querySelector('.ms-play'), canvas = stage.querySelector('canvas');
  const topEl = stage.querySelector('.ms-top'), popEl = stage.querySelector('.cs-pop'), hintEl = stage.querySelector('.ms-hint'), strikeBtn = stage.querySelector('.ms-strike');
  const surf = pixelSurface(canvas, playEl, { maxH:200 }), g = surf.g;
  const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
  let VW = 0, VH = 0, PX = 3, N = 96, X0 = 0, Y0 = 0, bg = null, raf = 0, last = 0, time = 0, paused = false, destroyed = false, run = null, hintTimer = 0;
  const S = { rx:.5, ry:.5, swing:0, grade:null, parts:[], shards:[], pops:[], shake:0, flash:0, freeze:0, cracks:[], broken:[], pointer:false, keys:{ l:false, r:false, u:false, d:false },
    lastPeak:-1, endT:0, nodeFlash:0, squash:0, live:null, hitFlash:0, bounce:0, dust:[] };
  const P = () => surf.pix;

  function layout() {
    if (playEl.hidden) return; surf.layout(); VW = surf.vw; VH = surf.vh; PX = surf.PX;
    N = clamp(Math.min(VW - 16, VH - 104, 116), 64, 116); X0 = Math.round((VW - N) / 2); Y0 = Math.round(46 + (VH - 46 - 40 - N) / 2); bg = buildBg();
    if (run) rebuildRock();
  }
  const ro = new ResizeObserver(layout); ro.observe(stage);
  const toV = (nx, ny) => ({ x:X0 + nx * N, y:Y0 + ny * N });
  const toNorm = (vx, vy) => ({ x:(vx - X0) / N, y:(vy - Y0) / N });

  function buildBg() {
    const b = new Pix(VW, VH); b.rect(0, 0, VW, VH, '#1a2523');
    // 돌 벽돌 무늬
    for (let y = 0; y < VH; y += 14) for (let x = -((y / 14) % 2) * 12; x < VW; x += 24) { const h = hash(x * 3 + y * 7); b.rect(x + 1, y + 1, 22, 12, h < .33 ? '#1f2c29' : h < .66 ? '#223230' : '#1c2926'); b.rect(x + 1, y + 1, 22, 1, '#2c3d39'); b.rect(x + 1, y + 12, 22, 1, '#111a18'); }
    // 아래쪽 어둠 / 가장자리 어둠
    for (let y = 0; y < VH; y++) { const d = Math.pow(Math.abs(y - VH * .45) / (VH * .6), 2); b.g.globalAlpha = clamp(d * .55, 0, .6); b.rect(0, y, VW, 1, '#050a09'); } b.g.globalAlpha = 1;
    for (let x = 0; x < VW; x++) { const d = Math.pow(Math.abs(x - VW / 2) / (VW / 2), 3); b.g.globalAlpha = clamp(d * .55, 0, .6); b.rect(x, 0, 1, VH, '#050a09'); } b.g.globalAlpha = 1;
    // 종유석
    for (let i = 0; i < Math.ceil(VW / 40); i++) { const x = Math.round(i * 40 + 12 + hash(i * 5) * 16), h = 10 + Math.round(hash(i * 9) * 16); for (let r = 0; r < h; r++) { const w = Math.max(0, Math.round((1 - r / h) * 6)); b.rect(x - w, r, w * 2 + 1, 1, r % 5 === 0 ? '#34463f' : '#2a3a35'); } b.rect(x, h, 1, 1, '#4a6158'); }
    // 바닥 자갈
    b.rect(0, VH - 36, VW, 36, '#141c1a'); b.rect(0, VH - 36, VW, 1, '#2a3a35');
    for (let i = 0; i < 26; i++) { const x = Math.round(hash(i * 11) * VW), y = VH - 34 + Math.round(hash(i * 17) * 30); b.rect(x, y, 3 + (i % 3), 2, i % 2 ? '#2a3a35' : '#202e2b'); }
    // 빛나는 버섯(양 옆) + 랜턴
    const mush = (x, y, s, c) => { b.rect(x, y + 2 * s, s, 3 * s, '#cfe3e0'); b.ellipse(x + s / 2, y + s, 2 * s + 1, s + 1, c); b.px(x, y, light(c, .6)); };
    mush(14, VH - 52, 2, '#5fd1c0'); mush(24, VH - 48, 1, '#8fe3d3'); mush(VW - 22, VH - 50, 2, '#7cc7ff'); mush(VW - 32, VH - 46, 1, '#a9dcff');
    const lx = Math.round(VW * .13), ly = 60; b.rect(lx, 14, 1, ly - 14, '#2a1d10'); for (const [r, a] of [[40, .04], [32, .05], [24, .06], [16, .08]]) { b.g.globalAlpha = a; b.disc(lx, ly + 6, r, '#ffcf70'); } b.g.globalAlpha = 1;
    b.rect(lx - 4, ly - 2, 9, 3, '#6a4527'); b.rect(lx - 3, ly + 1, 7, 9, '#ffcf70'); b.rect(lx - 2, ly + 2, 2, 7, '#fff3c0'); b.rect(lx - 4, ly + 10, 9, 2, '#6a4527'); b.px(lx - 4, ly + 1, INK); b.px(lx + 4, ly + 1, INK);
    return b;
  }

  /* ---------- 광맥 선택 ---------- */
  const weakText = ore => ore.mine.weak.moves ? (ore.tier === 'special' ? '아주 작고 빨라요 · 3곳' : '작고 움직여요') : '넓고 가만히 있어요';
  function renderSelect() {
    run = null; playEl.hidden = true; selectEl.hidden = false; stage.dataset.mode = 'select'; clearTimeout(hintTimer);
    selectEl.innerHTML = `<div class="ms-select-in"><h2>어느 광맥을 캘까요?</h2><p class="mg-body">약점이 가장 밝을 때, 약점 한가운데를 내리쳐요.</p>
      <div class="ms-veins">${spot.ores.map(id => { const o = ORES[id]; return `<article class="ms-vein px tier-${o.tier}" data-ore="${id}"><span class="rock">${itemIcon({ id:o.id, kind:'ore', color:o.color }, 72)}</span><h3>${esc(o.name)}</h3><em class="tier-${o.tier}">${TIERS[o.tier]}</em>
        <dl><div><dt>곡괭이</dt><dd>${o.mine.swings + equipmentBonus(progress.state.items).mineSwings}번${equipmentBonus(progress.state.items).mineSwings ? ' (장비 +' + equipmentBonus(progress.state.items).mineSwings + ')' : ''}</dd></div><div><dt>약점</dt><dd>${esc(weakText(o))}</dd></div><div><dt>얻는 양</dt><dd>${o.mine.yield[0] === o.mine.yield[1] ? o.mine.yield[0] : o.mine.yield[0] + '~' + o.mine.yield[1]}개</dd></div></dl>
        <button type="button" class="px-btn">캐기 시작</button></article>`; }).join('')}</div></div>`;
    selectEl.querySelectorAll('.ms-vein').forEach(card => card.querySelector('button').addEventListener('click', () => { sfx.play('ui'); begin(ORES[card.dataset.ore]); }));
    host.say('캘 광맥을 고르세요.');
  }
  function begin(ore) {
    run = { ore, m:new MineSession(ore, rng, { extraSwings:equipmentBonus(progress.state.items).mineSwings }), phase:'play', seed:rng.int(1, 1e6) }; S.rx = .5; S.ry = .62; S.swing = 0; S.cracks = []; S.broken = []; S.parts = []; S.shards = []; S.pops = []; S.dust = []; S.endT = 0; S.nodeFlash = 0; S.lastPeak = -1; S.squash = 0; S.hitFlash = 0; S.bounce = 0;
    selectEl.hidden = true; playEl.hidden = false; stage.dataset.mode = 'mine'; layout(); rebuildRock();
    setHint(coarse ? '약점이 가장 밝을 때 눌러요!' : '약점에 조준하고, 가장 밝을 때 클릭!', 5200); renderTop(); strikeBtn.hidden = coarse;
  }
  function setHint(t, ttl = 0) { hintEl.textContent = t; hintEl.classList.toggle('on', !!t); clearTimeout(hintTimer); if (t && ttl) hintTimer = setTimeout(() => hintEl.classList.remove('on'), ttl); }
  function renderTop() {
    const m = run.m, pick = uiIcon('pick', '#f7efd6'), off = uiIcon('pick', '#4a5654');
    topEl.innerHTML = `<span class="ms-name">${esc(run.ore.name)}</span><span class="ms-swings px" aria-label="남은 곡괭이 ${m.swings}번">${Array.from({ length:m.swingsMax }, (_, i) => `<img class="pxi ${i < m.swings ? '' : 'off'}" src="${i < m.swings ? pick : off}" alt="" width="20" height="20">`).join('')}</span>${m.nodes.length > 1 ? `<span class="ms-nodes">약점 ${Math.min(m.node + (m.over === 'cracked' ? 0 : 1), m.nodes.length)}/${m.nodes.length}</span>` : ''}`;
  }

  /* ---------- 바위 그림(균열을 얹어 다시 만듦) ---------- */
  const baseRock = () => rockSprite(run.ore.id, N, run.seed % 997);
  function rebuildRock() {
    const live = new Pix(N, N); live.g.drawImage(baseRock().cv, 0, 0);
    live.atop(pp => {
      for (const c of S.cracks) {
        const r = createRng(c.seed), hx = c.x * N, hy = c.y * N, big = c.grade === 'perfect', glow = run.ore.glow;
        for (let i = 0; i < c.n; i++) {
          let a = r.range(0, TAU), x = hx, y = hy; const len = r.range(8, big ? 38 : c.grade === 'good' ? 26 : 15);
          for (let s = 0; s < len; s += 3) { a += r.range(-.7, .7); const nx = x + Math.cos(a) * 3, ny = y + Math.sin(a) * 3; if (c.grade === 'miss') { pp.line(x, y, nx, ny, '#c9d3cd'); } else { pp.line(x + 1, y, nx + 1, ny, '#9fb0a8'); pp.line(x, y, nx, ny, '#0b100f'); if (big && s % 6 === 0) pp.px(nx, ny, glow); } x = nx; y = ny; }
        }
      }
      for (const br of S.broken) { const bx = br.x * N, by = br.y * N; pp.disc(bx, by, 4, '#0b100f'); pp.ring(bx, by, 4, 4, run.ore.glow); pp.px(bx - 1, by - 1, light(run.ore.glow, .5)); }
    });
    S.live = live;
  }

  /* ---------- 입력 ---------- */
  const toVirtual = e => { const r = canvas.getBoundingClientRect(); return { x:(e.clientX - r.left) / r.width * VW, y:(e.clientY - r.top) / r.height * VH }; };
  function aimFromEvent(e) { const v = toVirtual(e), n = toNorm(v.x, v.y); S.rx = n.x; S.ry = n.y; }
  canvas.addEventListener('pointermove', e => { if (!coarse || S.pointer) aimFromEvent(e); });
  canvas.addEventListener('pointerdown', e => { if (!run || run.phase !== 'play' || paused) return; e.preventDefault(); aimFromEvent(e); S.pointer = true; doStrike(); });
  canvas.addEventListener('pointerup', () => { S.pointer = false; }); canvas.addEventListener('pointercancel', () => { S.pointer = false; });
  canvas.style.touchAction = 'none';
  strikeBtn.addEventListener('pointerdown', e => { e.preventDefault(); doStrike(); });
  const dirOf = k => ({ ArrowLeft:'l', a:'l', ArrowRight:'r', d:'r', ArrowUp:'u', w:'u', ArrowDown:'d', s:'d' }[k]);
  const kd = e => {
    if (paused || host.closed || !host.layer.hidden || !run || run.phase !== 'play') return;
    const k = dirOf(e.key);
    if (k) { e.preventDefault(); S.keys[k] = true; }
    else if (e.key === ' ' || e.key === 'Enter') { if (e.target?.closest?.('button') && !e.target.classList.contains('ms-strike')) return; e.preventDefault(); if (!e.repeat) doStrike(); }
  };
  const ku = e => { const k = dirOf(e.key); if (k) S.keys[k] = false; };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);

  function popup(t, tone) { const n = document.createElement('div'); n.className = 'cs-judge tone-' + tone; n.textContent = t; popEl.append(n); setTimeout(() => n.remove(), 900); }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function chips(x, y, n, colors, speed) { if (reduced) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = rnd(-Math.PI * 1.05, -Math.PI * -.05) , v = rnd(.35, 1) * speed; S.parts.push({ k:'chip', x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:rnd(.4, .9), max:.9, c:colors[i % colors.length], s:i % 3 ? 2 : 1 }); } }
  function sparks(x, y, n, speed) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.4, 1) * speed; S.parts.push({ k:'spark', x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 10, life:rnd(.3, .7), max:.7, c:i % 2 ? '#fff6b8' : run.ore.glow, s:1 }); } }
  function dust(x, y, n) { if (reduced) n = 1; for (let i = 0; i < n; i++) S.parts.push({ k:'dust', x:x + rnd(-6, 6), y:y + rnd(-3, 3), vx:rnd(-14, 14), vy:rnd(-14, -3), life:rnd(.5, .9), max:.9, c:'#9aa59f', s:2 }); }

  function doStrike() {
    if (!run || run.phase !== 'play' || S.freeze > 0) return;
    S.swing = .001; const m = run.m, hit = m.strike(S.rx, S.ry); if (!hit) return;
    const v = toV(hit.x, hit.y), cfg = { perfect:{ shake:3, n:20, freeze:.09, flash:.35 }, good:{ shake:2, n:12, freeze:.05, flash:.12 }, weak:{ shake:1.4, n:7, freeze:.02, flash:0 }, miss:{ shake:2, n:4, freeze:0, flash:0 } }[hit.grade];
    sfx.play('hit-' + hit.grade); if (hit.grade === 'perfect' || hit.grade === 'good') { setTimeout(() => sfx.play('crack'), 60); setTimeout(() => sfx.play('rubble'), 220); }   // 금 가는 소리 → 파편 떨어지는 소리
    if (!reduced) { S.shake = cfg.shake; S.flash = cfg.flash; S.freeze = cfg.freeze; } S.squash = .16; S.grade = hit.grade; if (hit.grade === 'miss') S.bounce = .3;
    const tone = hit.grade === 'miss' ? ['#7a8580', '#9aa59f', '#5a6560'] : [run.ore.color, run.ore.glow, light(run.ore.color, .4), '#cfd8d4'];
    chips(v.x, v.y, cfg.n, tone, hit.grade === 'perfect' ? 78 : 58); dust(v.x, v.y + 2, hit.grade === 'miss' ? 4 : 2);
    if (hit.grade !== 'miss') sparks(v.x, v.y, hit.grade === 'perfect' ? 14 : hit.grade === 'good' ? 8 : 3, 52);
    S.cracks.push({ x:hit.x, y:hit.y, n:hit.grade === 'perfect' ? 6 : hit.grade === 'good' ? 4 : hit.grade === 'weak' ? 3 : 2, seed:rng.int(1, 9999), grade:hit.grade });
    popup(GRADE[hit.grade][0], GRADE[hit.grade][1]);
    try { navigator.vibrate?.(hit.grade === 'perfect' ? 50 : hit.grade === 'miss' ? 25 : 35); } catch { /* 지원 안 함 */ }
    if (hit.advanced) { S.nodeFlash = 1; S.broken.push({ x:hit.w.x, y:hit.w.y }); setTimeout(() => popup('다음 약점!', 'perfect'), 380); }
    rebuildRock(); renderTop(); hintEl.classList.remove('on');
    if (m.over) { run.phase = 'ending'; S.endT = 0; if (m.over === 'cracked') shatter(); else { dust(X0 + N / 2, Y0 + N * .6, 5); S.bounce = .5; } }
  }
  function shatter() {
    const n = run.m.yieldCount(), cx = X0 + N / 2, cy = Y0 + N / 2, pcs = rockShards(baseRock(), 9, run.seed % 991);
    S.shards = pcs.map((q, i) => { const a = Math.atan2(q.cy - N / 2, q.cx - N / 2) + rnd(-.3, .3), v = rnd(40, 90); return { pix:q.pix, cx:q.cx, cy:q.cy, x:X0 + q.cx, y:Y0 + q.cy, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 70, rot:0, vr:rnd(-5, 5), life:1.2, max:1.2 }; });
    const spr = iconSprite({ id:run.ore.id, kind:'ore', color:run.ore.color }).cv;
    S.pops = Array.from({ length:n }, (_, i) => ({ spr, x:cx, y:cy, vx:(i - (n - 1) / 2) * 26 + rnd(-6, 6), vy:-rnd(90, 130), floor:Y0 + N + 6 + (i % 2) * 5, t:0, land:0, delay:.18 + i * .09 }));
    sfx.play('rubble'); setTimeout(() => sfx.play('rubble'), 260); dust(cx, cy, 8); sparks(cx, cy, 24, 80); chips(cx, cy, 22, [run.ore.color, run.ore.glow, light(run.ore.color, .4)], 90);
  }

  function finish() {
    const m = run.m, ore = run.ore; run.phase = 'done';
    const again = mine ? { label:'다시 도전', primary:true, run:() => begin(ore) } : { label:'다른 광맥 캐기', primary:true, run:() => renderSelect() }, leave = mine ? { label:'광산으로 돌아가기', run:() => mine.onBack() } : { label:'동굴에서 나가기', run:() => host.close() };
    const summary = `정확 ${m.stats.perfect} · 좋음 ${m.stats.good} · 약함 ${m.stats.weak} · 빗나감 ${m.stats.miss}`;
    if (m.over === 'cracked') {
      const n = m.yieldCount(); progress.add(ore.id, n); const xpAmt = Math.round(ore.xp * (1 + Math.min(.5, m.stats.perfect * .12))), xp = progress.addXp('mining', xpAmt); sfx.play('ore'); if (xp.leveled) sfx.play('level');
      host.showResult({ tone:'win', title:`${ore.name}${josa(ore.name, '을/를')} 캐냈어요!`, message:summary, rewards:[{ item:ore.id, n, note:m.stats.perfect >= 2 && n > ore.mine.yield[0] ? '정확한 타격이 많아 광석을 더 얻었어요.' : ore.desc }], xp:`채광 경험치 +${xpAmt}`, level:xp.leveled ? `채광 Lv.${xp.after.level} 달성!` : '', actions:mine ? [{ ...leave, primary:true }] : [again, leave] });
      mine?.onResult?.({ success:true, ore, n });
    } else {
      const xp = progress.addXp('mining', 2); sfx.play('lose');
      const why = m.stats.perfect + m.stats.good === 0 ? '약점을 제대로 맞히지 못했어요. 링이 약점에 딱 맞는 순간, 한가운데를 노려 봐요.' : ore.tier === 'special' ? '특수 광맥은 정확한 타격이 모자라면 열리지 않아요. 움직이는 약점을 따라가 봐요.' : '곡괭이를 다 썼어요. 약점이 가장 밝을 때 노려 봐요.';
      host.showResult({ tone:'lose', title:'광맥을 캐지 못했어요', message:summary, detail:why, xp:'채광 경험치 +2 (도전 보상)', actions:[again, leave] });
      mine?.onResult?.({ success:false, ore, n:0 });
    }
  }

  /* ---------- 갱신 ---------- */
  function update(dt) {
    time += dt; S.shake = Math.max(0, S.shake - dt * 14); S.flash = Math.max(0, S.flash - dt * 3); S.nodeFlash = Math.max(0, S.nodeFlash - dt * 1.4); S.squash = Math.max(0, S.squash - dt); S.bounce = Math.max(0, S.bounce - dt);
    if (S.swing > 0) { S.swing += dt / .3; if (S.swing >= 1) S.swing = 0; }
    for (const q of S.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 'chip') q.vy += 260 * dt; else if (q.k === 'spark') q.vy += 40 * dt; else q.vy -= 6 * dt; } S.parts = S.parts.filter(q => q.life > 0);
    for (const q of S.shards) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 240 * dt; q.rot += q.vr * dt; } S.shards = S.shards.filter(q => q.life > 0);
    for (const q of S.pops) { q.t += dt; if (q.t < q.delay) continue; if (!q.land) { q.x += q.vx * dt; q.vy += 300 * dt; q.y += q.vy * dt; if (q.y >= q.floor) { q.y = q.floor; if (Math.abs(q.vy) > 40) { q.vy = -q.vy * .38; q.vx *= .5; sfx.play('ok'); sparks(q.x, q.y - 4, 3, 30); } else q.land = 1; } } }
    if (S.freeze > 0) { S.freeze -= dt; return; }
    if (!run) return;
    const kx = (S.keys.r ? 1 : 0) - (S.keys.l ? 1 : 0), ky = (S.keys.d ? 1 : 0) - (S.keys.u ? 1 : 0);
    if (kx || ky) { S.rx = clamp(S.rx + kx * .55 * dt, .02, .98); S.ry = clamp(S.ry + ky * .55 * dt, .02, .98); }
    if (run.phase === 'play') {
      run.m.step(dt);
      const peak = Math.floor(run.m.t / run.m.pulsePeriod); if (peak !== S.lastPeak) { S.lastPeak = peak; sfx.tone({ f:1500, dur:.04, vol:.025, type:'sine' }); }
      if (Math.random() < dt * 1.2) S.parts.push({ k:'mote', x:rnd(0, VW), y:rnd(40, VH - 40), vx:rnd(-3, 3), vy:rnd(-4, -1), life:rnd(2, 4), max:4, c:'#9fd7c8', s:1 });
    } else if (run.phase === 'ending') { S.endT += dt; if (S.endT > (run.m.over === 'cracked' ? 1.5 : .9)) finish(); }
  }

  /* ---------- 그리기 ---------- */
  function drawNodePaths(m) {
    const p = P(), ore = run.ore;
    m.nodes.forEach((n, i) => {
      if (i < m.node) return; const active = i === m.node, A = toV(n.ax, n.ay), B = toV(n.bx, n.by), len = Math.max(1, Math.hypot(B.x - A.x, B.y - A.y)); if (len < 2) return;
      g.globalAlpha = active ? .6 : .22; for (let s = 0; s <= len; s += 2) { const t = s / len; p.px(lerp(A.x, B.x, t) + Math.sin(t * 9 + i) * 1.2, lerp(A.y, B.y, t) + Math.cos(t * 7 + i) * 1.2, ore.glow); } g.globalAlpha = 1;
    });
  }
  function drawWeak() {
    const p = P(), m = run.m, w = m.weak(), V = toV(w.x, w.y), R = Math.max(3, w.r * N), pulse = m.pulse(), ore = run.ore;
    const phase = (m.t / m.pulsePeriod) % 1, near = 1 - Math.abs(Math.cos(phase * Math.PI)), ringR = R * (1 + near * 1.25);
    // 광채(두 겹)
    g.globalAlpha = (.12 + .3 * pulse); p.disc(V.x, V.y, R * 1.5, ore.glow); g.globalAlpha = (.2 + .45 * pulse); p.disc(V.x, V.y, R * 1.05, ore.glow); g.globalAlpha = 1;
    // 중심 별
    const c = pulse > .8 ? '#ffffff' : '#fff3c0', s = pulse > .6 ? 2 : 1; p.px(V.x, V.y, c); for (let i = 1; i <= s + 1; i++) { p.px(V.x - i, V.y, c); p.px(V.x + i, V.y, c); p.px(V.x, V.y - i, c); p.px(V.x, V.y + i, c); }
    // 약점 테두리(고정) + 줄어드는 점선 링
    p.ring(V.x, V.y, R, R, pulse > .8 ? '#fff6b8' : '#ffffffaa'); if (pulse > .8) p.ring(V.x, V.y, R + 1, R + 1, '#ffe27a');
    const nPts = Math.max(14, Math.round(ringR * 3.2)); for (let i = 0; i < nPts; i += 2) { const a = i / nPts * TAU; p.px(V.x + Math.cos(a) * ringR, V.y + Math.sin(a) * ringR, ore.glow); }
    if (S.nodeFlash > 0) { g.globalAlpha = S.nodeFlash; const rr = R * (1 + (1 - S.nodeFlash) * 3); p.ring(V.x, V.y, rr, rr, '#fff'); g.globalAlpha = 1; }
  }
  function px(x, y, c) { P().px(x, y, c); }
  function drawPick() {
    const p = P(), V = toV(S.rx, S.ry), k = S.swing; let ex = 0, ey = 0, phi = .9; // 헤드 중심 위치와 손잡이 기울기
    const rest = { x:20, y:-16, phi:.95 }, wind = { x:26, y:-36, phi:1.35 }, hitp = { x:14, y:-2, phi:.38 };
    let A = rest;
    if (k > 0) { if (k < .22) { const u = k / .22; A = { x:lerp(rest.x, wind.x, u), y:lerp(rest.y, wind.y, u), phi:lerp(rest.phi, wind.phi, u) }; } else if (k < .36) { const u = (k - .22) / .14, e = u * u; A = { x:lerp(wind.x, hitp.x, e), y:lerp(wind.y, hitp.y, e), phi:lerp(wind.phi, hitp.phi, e) }; } else { const u = clamp((k - .36) / .5, 0, 1), e = 1 - Math.pow(1 - u, 2), bounceOff = S.grade === 'miss' ? Math.sin(u * Math.PI) * 5 : 0; A = { x:lerp(hitp.x, rest.x, e), y:lerp(hitp.y, rest.y, e) - bounceOff, phi:lerp(hitp.phi, rest.phi, e) }; } }
    else { A = { x:rest.x, y:rest.y + Math.sin(time * 3) * 1.2, phi:rest.phi }; }
    ex = V.x + A.x; ey = V.y + A.y; phi = A.phi;
    const dx = Math.sin(phi), dy = Math.cos(phi), pxv = Math.cos(phi), pyv = -Math.sin(phi), L = 34;
    const gx = ex + dx * L, gy = ey + dy * L;
    // 손잡이
    p.line(ex, ey, gx, gy, INK); p.line(ex + 1, ey, gx + 1, gy, INK); p.line(ex - 1, ey, gx - 1, gy, INK); p.line(ex, ey + 1, gx, gy + 1, INK);
    p.line(ex, ey, gx, gy, '#a77746'); p.line(ex + 1, ey, gx + 1, gy, '#d19a60'); p.rect(Math.round(gx) - 1, Math.round(gy) - 1, 3, 2, '#6a4527');
    for (const grip of [21, 24, 27, 30]) {
      const x = ex + dx * grip, y = ey + dy * grip;
      p.line(x - pxv, y - pyv, x + pxv, y + pyv, '#623e31');
      p.px(x + pxv, y + pyv, '#efa86a');
    }
    // 헤드(양 끝이 휘어 내려옴)
    const pts = [[-15, 4], [-10, 1], [-5, -1], [0, -1.5], [5, -1], [10, 1], [15, 4]].map(([a, b]) => [ex + pxv * a - dx * b, ey + pyv * a - dy * b]);
    for (let i = 0; i < pts.length - 1; i++) { for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1]]) p.line(pts[i][0] + ox, pts[i][1] + oy, pts[i + 1][0] + ox, pts[i + 1][1] + oy, INK); }
    for (let i = 0; i < pts.length - 1; i++) { p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#9fb0b4'); p.line(pts[i][0], pts[i][1] - 1, pts[i + 1][0], pts[i + 1][1] - 1, '#e6eef0'); }
    p.rect(Math.round(ex) - 2, Math.round(ey) - 2, 4, 4, INK); p.rect(Math.round(ex) - 1, Math.round(ey) - 1, 2, 2, '#c5d0d2');
    // 스윙 궤적
    if (k > .22 && k < .4) { g.globalAlpha = .5; p.line(V.x + wind.x, V.y + wind.y, ex, ey, '#fff6dc'); g.globalAlpha = 1; }
  }
  function drawReticle() {
    const p = P(), V = toV(S.rx, S.ry), w = run.m.weak(), W = toV(w.x, w.y), on = Math.hypot(V.x - W.x, V.y - W.y) < w.r * N * 1.1, c = on ? '#ffe27a' : '#fff4c8';
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.ring(V.x + ox, V.y + oy, 5, 5, INK); p.ring(V.x, V.y, 5, 5, c);
    for (const [a, b, d, e] of [[-9, 0, -7, 0], [7, 0, 9, 0], [0, -9, 0, -7], [0, 7, 0, 9]]) { p.line(V.x + a, V.y + b, V.x + d, V.y + e, c); }
  }
  function draw() {
    if (!run || playEl.hidden || !bg) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, VW, VH);
    const sh = S.shake > 0 && !reduced ? S.shake : 0; canvas.style.transform = sh ? `translate(${Math.round((Math.random() - .5) * sh) * PX}px,${Math.round((Math.random() - .5) * sh) * PX}px)` : '';
    paintScene(g, bg.cv);
    const m = run.m, ending = run.phase === 'ending' || run.phase === 'done', cracked = m.over === 'cracked';
    // 바닥 그림자
    const p = P(); g.globalAlpha = .35; p.ellipse(X0 + N / 2, Y0 + N + 1, N * .42, 4, '#000'); g.globalAlpha = 1;
    // 바위
    if (!(ending && cracked)) {
      const sq = S.squash > 0 ? Math.sin(S.squash / .16 * Math.PI) * .06 : 0, w = Math.round(N * (1 + sq)), h = Math.round(N * (1 - sq)); g.drawImage(S.live.cv, X0 - Math.round((w - N) / 2), Y0 + (N - h), w, h);
      if (S.flash > .05) { g.globalAlpha = S.flash * .6; g.globalCompositeOperation = 'lighter'; g.drawImage(S.live.cv, X0, Y0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      if (run.phase === 'play') { drawNodePaths(m); drawWeak(); }
    }
    for (const q of S.shards) { const a = clamp(q.life / q.max * 1.6, 0, 1); blit(g, q.pix, q.x, q.y, { rot:q.rot, alpha:a, ox:q.cx, oy:q.cy }); }
    for (const q of S.parts) {
      const a = clamp(q.life / q.max, 0, 1); g.globalAlpha = q.k === 'dust' ? a * .55 : q.k === 'mote' ? Math.min(1, a * 2) * .5 : a;
      if (q.k === 'spark') { g.fillStyle = q.c; const x = Math.round(q.x), y = Math.round(q.y); g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
      else { g.fillStyle = q.c; const s = q.k === 'dust' ? Math.round(q.s + (1 - a) * 3) : q.s; g.fillRect(Math.round(q.x), Math.round(q.y), s, s); }
    }
    g.globalAlpha = 1;
    for (const q of S.pops) { if (q.t < q.delay) continue; const bob = q.land ? Math.round(Math.sin(time * 4 + q.x) * 1) : 0; g.save(); g.translate(Math.round(q.x), Math.round(q.y + bob)); g.scale(2, 2); g.drawImage(q.spr, -8, -15); g.restore(); if (q.land && Math.sin(time * 6 + q.x) > .6) { px(q.x + 8, q.y - 24, '#fff6b8'); px(q.x + 7, q.y - 24, '#fff6b8'); px(q.x + 9, q.y - 24, '#fff6b8'); px(q.x + 8, q.y - 25, '#fff6b8'); px(q.x + 8, q.y - 23, '#fff6b8'); } }
    if (run.phase === 'play' || (run.phase === 'ending' && !cracked)) { drawReticle(); drawPick(); }
    if (S.flash > 0) { g.globalAlpha = S.flash * .5; g.fillStyle = '#fff'; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }
  }
  function frame(now) { raf = requestAnimationFrame(frame); if (destroyed) return; const dt = clamp((now - last) / 1000, 0, .05); last = now; if (!paused) update(dt); draw(); }
  last = performance.now(); raf = requestAnimationFrame(frame);
  if (mine) begin(mine.ore); else renderSelect();

  return {
    tutorial:{ title:'채광', pages:[
      { title:'광맥 고르기', demo:chip('일반 · 9번') + chip('희귀 · 7번', 'warn') + chip('특수 · 5번', 'bad'), text:'광맥마다 <b>곡괭이 횟수</b>가 달라요. 어려울수록 약점이 작고 움직여요.' },
      { title:'약점과 링', demo:chip('빛나는 약점') + chip('줄어드는 링') + chip('딱 맞으면 정확!', 'ok'), text:'<b>빛나는 약점</b>에 조준하고, 바깥 링이 약점에 <b>딱 맞춰질 때</b> 내리쳐요.' },
      { title:'내리치기', demo:key('클릭') + key('Space') + key('←') + key('→') + chip('탭'), text:'마우스 클릭·스페이스·탭으로 내리쳐요. 방향키로 조준도 돼요. 정확할수록 빨리 깨지고 광석도 더 나와요.' },
    ].slice(mine ? 1 : 0) },
    busy: () => !!run && run.phase === 'play' && run.m.swingsMax - run.m.swings > 0,
    leaveWarning: () => '채광 중이에요. 지금 나가면 이 광맥은 캐지 못한 채 끝나요. (곡괭이 말고 쓰이는 건 없어요)',
    pause: () => { paused = true; }, resume: () => { paused = false; }, layerClosed: () => { paused = false; }, abort: () => {},
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(hintTimer); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); },
    debug: () => ({ mode:stage.dataset.mode, phase:run?.phase, swings:run?.m.swings, hp:run?.m.hp }),
    _S: S, _begin: begin, get _run() { return run; }, _strike: doStrike, _toPx: (nx, ny) => { const v = toV(nx, ny), r = canvas.getBoundingClientRect(); return { x:v.x / VW * r.width, y:v.y / VH * r.height }; },
  };
}
