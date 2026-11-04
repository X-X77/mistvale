// 요리 화면(픽셀 캔버스): 주방 한 칸. 썰기(도마·식칼) / 젓기(국자·냄비) / 굽기(프라이팬·불 손잡이) / 졸이기(냄비)가 서로 다른 손맛을 갖도록
// 각각 다른 도구와 다른 입력 방식으로 그립니다. 점수·품질·재료 소비 규칙은 cooking-engine.js 와 items.js 가 그대로 담당합니다.
import { RECIPES, INGREDIENTS, FISH, describeItem, qualityOf } from './items.js?v=sh2';
import { buildSteps, dishScore, JUDGE } from './cooking-engine.js?v=sh2';
import { itemIcon } from './host.js?v=sh2';
import { Pix, pixelSurface, clamp, lerp, mix, light, dark, INK, hash } from './pixel.js?v=sh2';
import { uiIcon } from './art.js?v=sh2';
import { knifeSprite, ingredientStrip, panFish, dishPlate, burntPlate, potSprite, panSprite, BIT_COLORS } from './cook-art.js?v=sh2';

const TAU = Math.PI * 2;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const STEP_NAME = { chop:'썰기', stir:'젓기', heat:'굽기', finish:'졸이기', drop:'넣기' };
const STEP_TEXT = {
  chop:'표시선이 칼 밑에 오면 눌러요!', stir:'국자가 반짝이는 곳을 지날 때 눌러요!', heat:'노릇해지면 뒤집어요. 불은 손잡이로!', finish:'윤기가 반짝! 할 때 내려요.', drop:'냄비 위에서 눌러 넣어요.',
};
const chip = (label, tone = '') => `<span class="demo-chip ${tone}">${label}</span>`;
const key = label => `<span class="demo-key">${label}</span>`;

export function createCooking({ host, progress, sfx, reduced }) {
  const stage = host.stage; stage.classList.add('cs-stage');
  stage.innerHTML = `<div class="cs-select"></div>
    <div class="cs-play" hidden><canvas class="cs-canvas" aria-label="주방 화면"></canvas><div class="cs-steps" aria-hidden="true"></div><div class="cs-pop" aria-hidden="true"></div><div class="fs-hint cs-hint" aria-hidden="true"></div>
      <div class="cs-bottom"><div class="cs-heatpad" hidden><button type="button" class="fs-btn side" data-heat="-1" aria-label="불 줄이기"><img class="pxi" src="${uiIcon('down')}" alt=""></button><button type="button" class="fs-btn side" data-heat="1" aria-label="불 키우기"><img class="pxi" src="${uiIcon('up')}" alt=""></button></div><button type="button" class="cs-action px-btn">썰기!</button></div></div>`;
  const selectEl = stage.querySelector('.cs-select'), playEl = stage.querySelector('.cs-play'), canvas = stage.querySelector('canvas');
  const stepsEl = stage.querySelector('.cs-steps'), popEl = stage.querySelector('.cs-pop'), hintEl = stage.querySelector('.cs-hint'), actionBtn = stage.querySelector('.cs-action'), heatPad = stage.querySelector('.cs-heatpad');
  const surf = pixelSurface(canvas, playEl, { maxH:220 }), g = surf.g;
  let VW = 0, VH = 0, PX = 3, bg = null, raf = 0, last = 0, time = 0, paused = false, destroyed = false, cooking = null, hintTimer = 0, hintCache = -1;
  const S = { keys:{ up:false, down:false }, parts:[], bubs:[], rings:[], shake:0, drag:false, V:{} };
  const P = () => surf.pix;

  /* ---------- 화면 크기 ---------- */
  const Y = {};
  function setSlab() { const pan = cooking?.steps?.[cooking.idx]?.id === 'heat'; Y.slab = Y.vy + (pan ? 7 : 15) + Y.ry + 13; }
  function geometry() {
    Y.cx = Math.round(VW / 2); Y.top = 46; Y.bot = VH - 36; Y.mid = Math.round((Y.top + Y.bot) / 2); Y.counter = Math.round(VH * .5);
    Y.rx = clamp(Math.round(VW * .17), 27, 40); Y.ry = Math.round(Y.rx * .4); Y.vy = Y.mid - 6; setSlab();
  }
  function layout() {
    if (playEl.hidden) return; surf.layout(); VW = surf.vw; VH = surf.vh; PX = surf.PX; geometry(); bg = buildBg();
  }
  const ro = new ResizeObserver(layout); ro.observe(stage);

  function buildBg() {
    const b = new Pix(VW, VH), cy = Y.counter;
    b.rect(0, 0, VW, cy, '#4a3522'); b.rect(0, 0, VW, 14, '#33241a');
    for (let x = 6; x < VW; x += 15) { b.rect(x, 14, 1, cy - 14, '#3e2c1b'); b.rect(x + 1, 14, 1, cy - 14, '#563d27'); }
    for (let i = 0; i < 26; i++) { const x = Math.floor(hash(i * 7) * VW), y = 16 + Math.floor(hash(i * 13) * (cy - 20)); b.px(x, y, '#3a2919'); }
    // 선반과 병
    const sx = 6, sy = 62; b.rect(sx, sy, 58, 3, '#7a4a28'); b.rect(sx, sy + 3, 58, 1, '#4a2d18'); b.rect(sx + 4, sy + 4, 3, 5, '#4a2d18'); b.rect(sx + 51, sy + 4, 3, 5, '#4a2d18');
    const jar = (x, h, col, lid) => { b.rect(x - 1, sy - h - 1, 11, h + 1, INK); b.rect(x, sy - h, 9, h, '#cfe3e0'); b.rect(x + 1, sy - h + 3, 7, h - 4, col); b.rect(x + 1, sy - h + 3, 2, h - 4, light(col, .35)); b.rect(x - 1, sy - h - 2, 11, 3, lid); };
    jar(sx + 4, 11, '#b04a78', '#c9a24a'); jar(sx + 18, 14, '#78b86a', '#a77746'); jar(sx + 33, 10, '#d9a05b', '#c9a24a'); b.rect(sx + 46, sy - 8, 8, 8, '#e9dfc2'); b.rect(sx + 46, sy - 10, 8, 2, '#c9a24a');
    // 걸린 도구
    const hx = VW > 200 ? 88 : 80; b.rect(hx - 6, 36, 40, 2, '#2a1d10');
    b.rect(hx, 38, 1, 12, '#2a1d10'); b.ellipse(hx, 56, 4, 6, '#7c8e92'); b.ellipse(hx, 56, 2, 4, '#4a5654'); b.rect(hx + 16, 38, 1, 18, '#6a4527'); b.ellipse(hx + 16, 58, 4, 3, '#c5d0d2'); b.rect(hx + 30, 38, 1, 22, '#c5d0d2'); b.rect(hx + 29, 58, 3, 4, '#d19a60');
    // 창문(넓은 화면에서만)
    if (VW >= 230) {
      const wx = VW - 84, wy = 44; b.rect(wx - 3, wy - 3, 56, 50, '#2a1d10'); b.rect(wx, wy, 50, 44, '#a9d9e4'); b.rect(wx, wy, 50, 14, '#c9ecf0'); b.rect(wx + 24, wy, 2, 44, '#6a4527'); b.rect(wx, wy + 21, 50, 2, '#6a4527');
      b.g.globalAlpha = .13; b.poly([[wx + 4, wy + 44], [wx + 24, wy + 44], [wx - 20, wy + 110], [wx - 60, wy + 110]], '#fff3c0'); b.g.globalAlpha = 1;
    }
    // 조리대
    b.rect(0, cy, VW, VH - cy, '#8a5d36'); b.rect(0, cy, VW, 3, '#c49058'); b.rect(0, cy + 3, VW, 1, '#6a4527');
    for (let y = cy + 22; y < VH; y += 22) b.rect(0, y, VW, 1, '#7a4f2d');
    for (let x = 10; x < VW; x += 36) for (let y = cy + 22; y < VH; y += 22) b.rect(x + ((y / 22) % 2) * 18, y - 19, 1, 19, '#7a4f2d');
    return b;
  }

  /* ---------- 레시피 고르기 ---------- */
  let chosenFish = null;
  function ownedFish() { return Object.keys(progress.state.items).filter(id => FISH[id]).map(id => ({ id, n:progress.count(id), info:FISH[id] })); }
  function renderSelect() {
    cooking = null; playEl.hidden = true; selectEl.hidden = false; stage.dataset.mode = 'select'; clearTimeout(hintTimer);
    const cards = Object.values(RECIPES).map(recipe => {
      const need = Object.entries(recipe.need).map(([id, n]) => ({ id, n, have:progress.count(id), info:INGREDIENTS[id] || describeItem(id) }));
      if (recipe.fishAny) need.unshift({ id:'fish', n:1, have:ownedFish().reduce((a, f) => a + f.n, 0), info:{ ...(ownedFish()[0]?.info || FISH['silver-minnow']), kind:'fish' }, label:'물고기 (아무거나)' });
      const ok = need.every(item => item.have >= item.n);
      const techs = recipe.steps.map(k => STEP_NAME[k === 'flip' ? 'heat' : k]).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
      return `<article class="cs-recipe px ${ok ? '' : 'is-short'}" data-recipe="${recipe.id}"><span class="plate">${itemIcon({ id:`dish:${recipe.id}:good`, kind:'dish', color:recipe.color }, 64)}</span><h3>${esc(recipe.name)}</h3><p>${esc(recipe.desc)}</p>
        <ul class="cs-need">${need.map(item => `<li class="${item.have >= item.n ? 'ok' : 'no'}" title="${esc(item.label || item.info.name)}">${itemIcon(item.info, 34)}<b>${item.have}/${item.n}</b></li>`).join('')}</ul>
        <p class="cs-tech">${esc(techs)}</p><button type="button" class="px-btn ${ok ? '' : 'alt'}" ${ok ? '' : 'disabled'}>${ok ? '요리 시작' : '재료가 부족해요'}</button></article>`;
    }).join('');
    const none = Object.values(RECIPES).every(r => !Object.entries(r.need).every(([id, n]) => progress.count(id) >= n) || (r.fishAny && !ownedFish().length));
    selectEl.innerHTML = `<div class="cs-select-in"><div class="cs-select-head"><h2>무엇을 만들까요?</h2><p class="mg-body">재료는 시작할 때 쓰여요. 잘 만들수록 더 좋은 요리가 돼요.</p>${none ? '<p class="mg-why">만들 수 있는 요리가 없어요. <b>속삭임 숲</b>에서 채집하거나 낚시로 물고기를 잡아 와요.</p>' : ''}</div><div class="cs-recipes">${cards}</div></div>`;
    selectEl.querySelectorAll('.cs-recipe').forEach(card => card.querySelector('button').addEventListener('click', () => { sfx.play('ui'); pickRecipe(RECIPES[card.dataset.recipe]); }));
    host.say('요리를 고르세요.');
  }
  function pickRecipe(recipe) {
    if (recipe.fishAny) {
      const fish = ownedFish(); if (!fish.length) return;
      if (fish.length === 1) { chosenFish = fish[0].id; return begin(recipe); }
      host.showLayer('fishpick', `<div class="mg-card mg-small px"><h2>어떤 물고기를 쓸까요?</h2><ul class="cs-fishlist">${fish.map(f => `<li><button type="button" class="px-btn alt" data-fish="${f.id}">${itemIcon({ ...f.info, kind:'fish' }, 28)}${esc(f.info.name)} <b>×${f.n}</b></button></li>`).join('')}</ul><div class="mg-actions"><button class="px-btn alt" data-a="cancel">취소</button></div></div>`);
      host.layer.querySelectorAll('[data-fish]').forEach(b => b.addEventListener('click', () => { chosenFish = b.dataset.fish; host.hideLayer(); begin(recipe); }));
      host.layer.querySelector('[data-a=cancel]').addEventListener('click', () => host.hideLayer());
      return;
    }
    begin(recipe);
  }
  function begin(recipe) {
    const need = { ...recipe.need }; if (recipe.fishAny) need[chosenFish] = (need[chosenFish] || 0) + 1;
    if (!progress.remove(need)) { renderSelect(); return; }
    const steps = buildSteps(recipe);
    cooking = { recipe, steps, idx:0, consumed:need, phase:'intro', fish:chosenFish, scores:[], rewarded:false, bits:[],
      ing:Object.entries(recipe.need).flatMap(([id, n]) => Array(n).fill(id)) };
    selectEl.hidden = true; playEl.hidden = false; stage.dataset.mode = 'cook'; layout(); S.parts = []; S.bubs = []; S.rings = [];
    startStep();
  }

  /* ---------- 단계 진행 ---------- */
  function setHint(textStr, ttl = 3200) { hintEl.textContent = textStr; hintEl.classList.toggle('on', !!textStr); clearTimeout(hintTimer); if (textStr && ttl) hintTimer = setTimeout(() => hintEl.classList.remove('on'), ttl); }
  function startStep() {
    const step = cooking.steps[cooking.idx]; cooking.phase = 'intro'; S.parts.length = 0; S.bubs.length = 0; S.rings.length = 0; hintCache = -1; setSlab();
    S.V = { introT:0, tt:step.t || 0, knifeT:-1, hop:0, kick:0, swirl:0, pour:0, bowlBump:0, landedSeen:0, flip:-1, plateT:-1, lift:-1, steamT:0, lastBeat:-1, sizzle:0, shakeKnob:0 };
    stepsEl.innerHTML = cooking.steps.map((s, i) => `<span class="cs-dot ${i < cooking.idx ? 'done' : i === cooking.idx ? 'now' : ''}">${STEP_NAME[s.id]}</span>`).join('<i></i>');
    actionBtn.textContent = ({ chop:'썰기!', stir:'젓기!', heat:'뒤집기!', finish:'내리기!', drop:'넣기!' })[step.id]; actionBtn.disabled = false;
    heatPad.hidden = !(step.id === 'heat' && matchMedia('(pointer: coarse)').matches);
    setHint(STEP_TEXT[step.id], 3600); host.say(`${STEP_NAME[step.id]}: ${STEP_TEXT[step.id]}`);
  }
  function popup(textStr, tone) { const node = document.createElement('div'); node.className = 'cs-judge tone-' + tone; node.textContent = textStr; popEl.append(node); setTimeout(() => node.remove(), 900); }
  function judgeFx(judge, label) { const t = judge === 'perfect' ? 'perfect' : judge === 'good' ? 'good' : judge === 'ok' ? 'ok' : 'bad'; popup(label || JUDGE[judge]?.label || '', t); sfx.play(judge === 'perfect' ? 'perfect' : judge === 'good' ? 'good' : 'bad'); }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawn(k, x, y, o = {}) { if (reduced && k !== 'spark') return; S.parts.push({ k, x, y, vx:o.vx ?? 0, vy:o.vy ?? 0, g:o.g ?? 0, life:o.life ?? .8, max:o.life ?? .8, c:o.c ?? '#fff', size:o.size ?? 2 }); }
  function burst(x, y, n, colors, speed = 40, gravity = 150) { if (reduced) n = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.4, 1) * speed; S.parts.push({ k:'bit', x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - speed * .7, g:gravity, life:rnd(.35, .7), max:.7, c:colors[i % colors.length], size:2 }); } }
  function stars(x, y, n, spread = 22) { for (let i = 0; i < n; i++) S.parts.push({ k:'spark', x:x + rnd(-spread, spread), y:y + rnd(-spread * .7, spread * .5), vx:rnd(-8, 8), vy:rnd(-22, -6), g:0, life:rnd(.5, .9), max:.9, c:i % 2 ? '#fff6b8' : '#ffe27a', size:1 }); }

  function press() {
    if (!cooking || paused) return;
    if (cooking.phase === 'intro') { cooking.phase = 'play'; hintEl.classList.remove('on'); return; }
    if (cooking.phase !== 'play') return;
    const step = cooking.steps[cooking.idx], V = S.V; hintEl.classList.remove('on');
    const res = step.press(); if (!res) return;
    if (step.id === 'chop') {
      const ev = step.events[step.events.length - 1], tip = chopGeo();
      V.knifeT = 0; S.shake = 1.2; sfx.play('chop', Math.random());
      if (ev.type === 'stray') { popup('헛썰기', 'bad'); burst(tip.knifeX, tip.iy + 3, 3, ['#d9a56a', '#c58f55'], 24, 120); }
      else {
        judgeFx(ev.judge, ev.judge === 'miss' ? '삐뚤!' : undefined); const ing = cooking.ing[Math.floor(ev.index / 2)] || 'herb', cols = BIT_COLORS[ing] || BIT_COLORS.herb;
        burst(tip.knifeX, tip.iy, ev.judge === 'perfect' ? 8 : ev.judge === 'good' ? 6 : 4, cols, 38, 160); if (ev.judge === 'perfect') stars(tip.knifeX, tip.iy - 6, 5, 12);
      }
    } else if (step.id === 'stir') {
      if (res.judge === 'stray') { popup('헛젓기', 'bad'); sfx.play('bad'); V.kick = Math.max(V.kick, .6); }
      else { judgeFx(res.judge); sfx.play('stir', Math.random()); V.kick = 3.2; V.hop = .14; const t = ladleTip(step); splash(t.x, t.y, res.judge); if (res.judge === 'perfect') stars(Y.cx, Y.vy - 8, 6, 16); }
    } else if (step.id === 'heat') {
      const ev = step.events[step.events.length - 1]; judgeFx(ev.judge, ev.burnt ? '탔어요!' : JUDGE[ev.judge].label); V.hop = .14;
      if (ev.type === 'flip') { V.flip = 0; sfx.play('flip'); V.d0 = ev.d; } else { V.plateT = 0; sfx.play('ok'); stars(panX(), Y.vy - 6, ev.judge === 'perfect' ? 8 : 4, 16); }
    } else if (step.id === 'finish') {
      judgeFx(res.judge, res.judge === 'perfect' ? '딱 좋은 윤기!' : res.judge === 'miss' ? (res.sheen < .6 ? '너무 묽어요' : '눌어붙었어요') : JUDGE[res.judge].label); sfx.play('bell'); V.lift = 0;
      if (res.judge === 'perfect' || res.judge === 'good') stars(Y.cx, Y.vy - 6, 8, 18);
    }
    if (step.done) endStep();
  }
  function splash(x, y, judge) {
    S.rings.push({ x, y, t:0 }); const n = judge === 'perfect' ? 8 : judge === 'good' ? 5 : 3; for (let i = 0; i < n; i++) S.parts.push({ k:'drop', x, y, vx:rnd(-22, 22), vy:rnd(-52, -22), g:200, life:.6, max:.6, c:'#ffe3b0', size:1 });
  }
  function endStep() {
    cooking.phase = 'between'; actionBtn.disabled = true; const step = cooking.steps[cooking.idx]; cooking.scores.push(step.score);
    if (step.id === 'chop') { // 조각 수 → 다음 단계(냄비)에서 알갱이로 떨어집니다
      const bits = []; for (let k = 0; k < step.items; k++) { const ing = cooking.ing[k] || 'herb', cuts = [2 * k, 2 * k + 1].filter(i => step.cutAt[i] !== null).length, cols = BIT_COLORS[ing] || BIT_COLORS.herb; for (let j = 0; j < cuts + 1; j++) { bits.push(cols[(j + k) % cols.length]); bits.push(cols[(j + k + 1) % cols.length]); } }
      cooking.bits = bits.slice(0, 16);
    }
    setTimeout(() => { if (destroyed) return; cooking.idx++; if (cooking.idx >= cooking.steps.length) finishCooking(); else startStep(); }, step.id === 'chop' ? 1500 : step.id === 'heat' ? 1000 : 900);
  }
  function finishCooking() {
    const recipe = cooking.recipe, score = dishScore(cooking.steps), q = qualityOf(score);
    const consumed = Object.entries(cooking.consumed).map(([item, n]) => ({ item, n }));
    let rewards = [], xpAmt;
    if (q.id === 'burnt') { progress.add('dish:burnt', 1); rewards = [{ item:'dish:burnt', n:1, note:'먹을 수 없는 덩어리예요.' }]; xpAmt = 3; }
    else { const id = `dish:${recipe.id}:${q.id}`; progress.add(id, 1); rewards = [{ item:id, n:1 }]; xpAmt = Math.round(recipe.xp * ({ normal:.6, good:1, great:1.5 }[q.id])); }
    const xp = progress.addXp('cooking', xpAmt); if (xp.leveled) sfx.play('level');
    const detail = score < 25 ? '불과 타이밍이 크게 어긋나 요리가 타 버렸어요. 재료는 이미 쓰였어요.' : '';
    cooking.phase = 'serve'; cooking.rewarded = true; stepsEl.innerHTML = ''; heatPad.hidden = true; actionBtn.disabled = true; hintEl.classList.remove('on');
    S.V = { st:0, q:q.id, recipe:recipe.id, sparked:false, landed:false }; S.parts.length = 0; S.bubs.length = 0; S.rings.length = 0;
    const again = { label:'다른 요리 만들기', primary:true, run:() => { renderSelect(); } }, leave = { label:'주방에서 나가기', run:() => host.close() };
    setTimeout(() => {
      if (destroyed || host.closed) return; cooking.phase = 'done'; sfx.play(q.id === 'burnt' ? 'lose' : 'win');
      host.showResult({ tone:q.id === 'burnt' ? 'lose' : 'win', title:q.id === 'burnt' ? '요리를 망쳤어요' : `${q.label === '일반' ? '' : q.label + ' '}${recipe.name} 완성!`, message:`완성도 ${score}점 · ${q.label}`, detail,
        rewards, consumed, xp:`요리 경험치 +${xpAmt}`, level:xp.leveled ? `요리 Lv.${xp.after.level} 달성!` : '', actions:[again, leave] });
    }, reduced ? 500 : 1500);
  }

  /* ---------- 입력 ---------- */
  actionBtn.addEventListener('pointerdown', e => { e.preventDefault(); press(); });
  const keydown = e => {
    if (paused || host.closed || !host.layer.hidden || !cooking || !['intro', 'play'].includes(cooking.phase)) return;
    if (e.key === ' ' || e.key === 'Enter') { if (e.target?.closest?.('button') && !e.target.classList.contains('cs-action')) return; e.preventDefault(); if (!e.repeat) press(); }
    if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); S.keys.up = true; }
    if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); S.keys.down = true; }
  };
  const keyup = e => { if (e.key === 'ArrowUp' || e.key === 'w') S.keys.up = false; if (e.key === 'ArrowDown' || e.key === 's') S.keys.down = false; };
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
  actionBtn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
  heatPad.querySelectorAll('button').forEach(b => { const dir = Number(b.dataset.heat); b.addEventListener('pointerdown', e => { e.preventDefault(); S.keys[dir > 0 ? 'up' : 'down'] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch { /* 무시 */ } }); const up = () => { S.keys.up = S.keys.down = false; b.classList.remove('on'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
  const knobXY = () => ({ x:Y.cx, y:Y.slab + 18 });
  const toVirtual = e => { const r = canvas.getBoundingClientRect(); return { x:(e.clientX - r.left) / r.width * VW, y:(e.clientY - r.top) / r.height * VH }; };
  function dragKnob(e) { const step = cooking?.steps[cooking.idx]; if (step?.id !== 'heat') return; const v = toVirtual(e), k = knobXY(); const a = Math.atan2(v.x - k.x, -(v.y - k.y)); step.setHeat((clamp(a, -2.356, 2.356) + 2.356) / 4.712); }
  canvas.addEventListener('pointerdown', e => {
    if (!cooking || !['intro', 'play'].includes(cooking.phase)) return; const step = cooking.steps[cooking.idx];
    if (step.id === 'heat') { const v = toVirtual(e), k = knobXY(); if (Math.hypot(v.x - k.x, v.y - k.y) < 17) { S.drag = true; try { canvas.setPointerCapture(e.pointerId); } catch { /* 무시 */ } dragKnob(e); S.V.shakeKnob = .15; return; } }
    press();
  });
  canvas.addEventListener('pointermove', e => { if (S.drag) dragKnob(e); });
  const endDrag = () => { S.drag = false; }; canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => { const step = cooking?.steps[cooking.idx]; if (step?.id === 'heat' && cooking.phase === 'play') { e.preventDefault(); step.setHeat(step.heat - Math.sign(e.deltaY) * .08); } }, { passive:false });
  canvas.style.touchAction = 'none';

  /* ---------- 갱신 ---------- */
  function update(dt) {
    time += dt; S.shake = Math.max(0, S.shake - dt * 10);
    for (const q of S.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; } S.parts = S.parts.filter(q => q.life > 0);
    for (const b of S.bubs) b.age += dt; S.bubs = S.bubs.filter(b => b.age < b.life);
    for (const r of S.rings) r.t += dt; S.rings = S.rings.filter(r => r.t < .6);
    const V = S.V;
    if (V.hop > 0) V.hop = Math.max(0, V.hop - dt); if (V.knifeT >= 0) { V.knifeT += dt; if (V.knifeT > .34) V.knifeT = -1; } if (V.shakeKnob > 0) V.shakeKnob -= dt;
    if (V.flip >= 0) { V.flip += dt / .6; if (V.flip >= 1) V.flip = -1; } if (V.plateT >= 0) V.plateT += dt / .7; if (V.lift >= 0) V.lift = Math.min(1, V.lift + dt / .5);
    if (!cooking) return;
    if (cooking.phase === 'serve' || cooking.phase === 'done') { V.st += dt; return; }
    const step = cooking.steps[Math.min(cooking.idx, cooking.steps.length - 1)];
    if (cooking.phase === 'intro') { V.introT += dt; if (V.introT > 1.3) cooking.phase = 'play'; }
    if (cooking.phase === 'intro' || cooking.phase === 'between') {
      if (cooking.phase === 'between') V.tt += dt * (step.id === 'chop' ? 3 : 1);
      V.swirl += dt * (1 + V.kick); V.kick = Math.max(0, V.kick - dt * 2.2); ambient(step, dt); return;
    }
    if (step.id === 'heat') {
      const dir = (S.keys.up ? 1 : 0) - (S.keys.down ? 1 : 0); if (dir) step.setHeat(step.heat + dir * .7 * dt);
      step.step(dt); const want = step.side === 0 ? '뒤집기!' : '접시에!'; if (actionBtn.textContent !== want) actionBtn.textContent = want;
      V.sizzle -= dt; if (V.sizzle <= 0) { V.sizzle = .45; if (step.heat > .12) sfx.play('sizzle', step.heat); }
      for (const ev of step.events) if (ev.burnt) { popup('탔어요!', 'bad'); sfx.play('bad'); S.shake = 5; if (ev.type === 'flip') { V.flip = 0; V.d0 = ev.d; } }
      if (step.done && cooking.phase === 'play') endStep();
    } else if (step.id === 'chop') {
      step.step(dt); V.tt = step.t; for (const ev of step.events) if (ev.type === 'skip') { popup('놓쳤어요', 'bad'); sfx.play('bad'); }
      if (step.done && cooking.phase === 'play') endStep();
    } else if (step.id === 'stir') {
      step.step(dt); V.tt = step.t; V.swirl += dt * (1 + V.kick); V.kick = Math.max(0, V.kick - dt * 2.2); V.pour += dt;
      const beatNo = Math.floor(step.t / step.period); if (beatNo !== V.lastBeat && beatNo >= 0) { V.lastBeat = beatNo; sfx.play('stir', .2); }
      for (const ev of step.events) if (ev.type === 'miss') { popup('놓쳤어요', 'bad'); sfx.play('bad'); }
      if (step.done && cooking.phase === 'play') endStep();
    } else if (step.id === 'finish') {
      step.step(dt); V.sizzle -= dt; if (V.sizzle <= 0) { V.sizzle = .4; sfx.play('sizzle', .3 + step.sheen * .4); }
      for (const ev of step.events) if (ev.burnt) { popup('눌어붙었어요', 'bad'); sfx.play('bad'); S.shake = 4; V.lift = 0; }
      if (step.done && cooking.phase === 'play') endStep();
    }
    ambient(step, dt);
  }
  // 김·기포·연기: 활동마다 다른 환경 효과
  function ambient(step, dt) {
    const V = S.V, cx = Y.cx; V.steamT -= dt; if (V.steamT > 0 || (reduced && Math.random() > .3)) return;
    if (step.id === 'heat') {
      const d = step.state().d, heat = step.heat; V.steamT = .22 - .14 * heat;
      if (heat > .08) spawn('steam', panX() + rnd(-18, 18), Y.vy - 4, { vy:-rnd(10, 18) - heat * 14, vx:rnd(-3, 3), life:rnd(.9, 1.4), c:'#f4f0e4' });
      if (d > 1.0) spawn('steam', panX() + rnd(-16, 16), Y.vy - 4, { vy:-rnd(14, 24), vx:rnd(-3, 3), life:1.3, c:'#3a3633', size:3 });
      if (heat > .12 && Math.random() < .5) S.bubs.push({ x:panX() + rnd(-Y.rx * .7, Y.rx * .7), y:Y.vy + rnd(-2, 3), age:0, life:rnd(.25, .45), r:1 });
    } else if (step.id === 'chop') V.steamT = 9;
    else {
      const fin = step.id === 'finish', hot = fin ? step.sheen : .6, burnt = fin && step.sheen > 1.02; V.steamT = .3 - .12 * hot;
      spawn('steam', cx + rnd(-Y.rx * .6, Y.rx * .6), Y.vy - 3, { vy:-rnd(9, 16), vx:rnd(-3, 3), life:rnd(1, 1.5), c:burnt ? '#3a3633' : '#f7efe0', size:burnt ? 3 : 2 });
      if (Math.random() < (fin ? .35 + step.sheen * .5 : .35)) S.bubs.push({ x:cx + rnd(-Y.rx * .6, Y.rx * .6), y:Y.vy + 1 + rnd(-Y.ry * .5, Y.ry * .5), age:0, life:rnd(.3, .6), r:fin ? 2 : 1 });
    }
  }

  /* ---------- 그리기 도구 ---------- */
  const panX = () => Y.cx - Math.round(Y.rx * .26);
  function slab(cx, w) {
    const p = P(), x = Math.round(cx - w / 2), t = Y.slab;
    p.rect(x - 1, t - 1, w + 2, 29, INK); p.rect(x, t, w, 7, '#4a4744'); p.rect(x, t, w, 1, '#7a7672'); p.rect(x, t + 7, w, 20, '#2f2d2b'); p.rect(x, t + 7, w, 1, '#1c1b1a');
    for (let i = 0; i < 6; i++) p.rect(x + 6 + i * ((w - 12) / 5.5), t + 2, 6, 2, '#2a2826');
  }
  function flames(cx, w, heat) {
    const p = P(), base = Y.slab, n = 7, maxH = 12; if (heat <= .04) return;
    for (let i = 0; i < n; i++) {
      const fx = Math.round(cx - w / 2 + 6 + i * (w - 12) / (n - 1)), h = Math.round((3 + heat * maxH) * (.72 + .28 * Math.sin(time * 13 + i * 2.1))), w0 = 2 + Math.round(heat * 1.5);
      for (let r = 0; r < h; r++) { const k = 1 - r / h, half = Math.max(0, Math.round(w0 * k * 1.1)); p.rect(fx - half, base - 1 - r, half * 2 + 1, 1, '#ff6a1a'); if (r < h * .75) p.rect(fx - Math.round(half * .6), base - 1 - r, Math.round(half * .6) * 2 + 1, 1, '#ffb347'); if (r < h * .45) p.px(fx, base - 1 - r, '#fff0a0'); }
    }
  }
  function beatDots(results, y, activeIdx, cxD = Y.cx) {
    const p = P(), n = results.length, dx = Math.min(9, (VW - 40) / n), x0 = cxD - (n - 1) * dx / 2;
    for (let i = 0; i < n; i++) { const r = results[i], x = Math.round(x0 + i * dx), col = r === 'perfect' ? '#ffe27a' : r === 'good' ? '#9be3a1' : r === 'ok' ? '#9ccbd8' : r === 'miss' ? '#c4604a' : (i === activeIdx && Math.sin(time * 9) > 0 ? '#fff6dc' : '#5a4631'); p.rect(x - 2, y - 2, 5, 5, INK); p.rect(x - 1, y - 1, 3, 3, col); if (r === 'perfect') p.px(x, y - 3, '#fff6b8'); }
  }
  function drawParts() {
    const p = P();
    for (const q of S.parts) {
      const a = clamp(q.life / q.max, 0, 1); g.globalAlpha = q.k === 'steam' ? a * .6 : a;
      if (q.k === 'steam') { const s = Math.round(q.size + (1 - a) * 3); g.fillStyle = q.c; g.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s); }
      else if (q.k === 'spark') { g.fillStyle = q.c; const x = Math.round(q.x), y = Math.round(q.y); g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
      else { g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    }
    g.globalAlpha = 1;
    for (const b of S.bubs) { const a = b.age / b.life, r = b.r + (a > .7 ? 1 : 0); if (a > .85) { p.px(b.x - 2, b.y, '#fff3dc'); p.px(b.x + 2, b.y, '#fff3dc'); p.px(b.x, b.y - 2, '#fff3dc'); } else { g.globalAlpha = .9; p.ring(b.x, b.y - a * 2, r, Math.max(1, r * .7), '#fff3dc'); g.globalAlpha = 1; } }
  }

  /* ---------- 썰기 장면 ---------- */
  function chopGeo() {
    const bw = Math.min(VW - 40, 192), bx0 = Math.round(Y.cx - bw / 2 - 6), boardR = bx0 + bw, knifeX = Math.round(bx0 + bw * .62), by = Y.mid - 14, iy = by + 12, v = 28;
    return { bw, bx0, boardR, knifeX, by, iy, v };
  }
  function drawChop(step) {
    const p = P(), G = chopGeo(), { bx0, bw, boardR, knifeX, by, iy, v } = G, V = S.V, t = V.tt;
    // 도마
    p.rect(bx0 - 1, by - 1, bw + 2, 32, INK); p.rect(bx0, by + 26, bw, 4, '#7a4a28'); p.rect(bx0, by, bw, 26, '#d9a56a'); p.rect(bx0, by, bw, 1, '#f0c488'); p.rect(bx0, by + 25, bw, 1, '#b98350');
    for (let i = 0; i < 5; i++) { const gy = by + 4 + i * 5; p.rect(bx0 + 4 + ((i * 29) % 40), gy, 26 + (i * 13) % 20, 1, '#c58f55'); p.rect(bx0 + 70 + ((i * 17) % 50), gy + 2, 22, 1, '#c58f55'); }
    p.ellipse(bx0 + 7, by + 13, 2, 3, INK); p.px(bx0 + 7, by + 12, '#8a5a2e');
    const bowlX = boardR - 5, rimY = iy + 30, landed = [];
    // 재료 조각
    g.save(); g.beginPath(); g.rect(bx0, 0, VW, VH); g.clip();
    for (let k = 0; k < step.items; k++) {
      const a = step.times[2 * k], b = step.times[2 * k + 1], gap = b - a, Wk = Math.round(gap * v * 2), mid = (a + b) / 2, xc = knifeX + (t - mid) * v, id = cooking.ing[k] || 'herb', spr = ingredientStrip(id, Wk);
      if (xc + Wk / 2 < bx0 - 2) continue;
      const cuts = [2 * k, 2 * k + 1].filter(i => step.cutAt[i] !== null).map(i => ({ i, at:step.cutAt[i], loc:clamp(Wk / 2 - (step.cutAt[i] - mid) * v, 4, Wk - 4) })).sort((m, n) => m.loc - n.loc);
      const edges = [0, ...cuts.map(c => c.loc), Wk + 2]; let shift = 0;
      for (let j = 0; j < edges.length - 1; j++) {
        if (j > 0) shift += Math.min(3, Math.max(0, (t - cuts[j - 1].at) * 16));
        const sx0 = Math.round(edges[j]), sx1 = Math.round(edges[j + 1]), sw = sx1 - sx0; if (sw < 1) continue;
        const hop = j > 0 ? Math.sin(clamp((t - cuts[j - 1].at) / .3, 0, 1) * Math.PI) * 3 : 0;
        let dx = xc - Wk / 2 - 1 + sx0 + shift, dy = iy - 8 - hop; const cxp = dx + sw / 2;
        if (cxp > boardR - 6) { const tau = (cxp - (boardR - 6)) / v, fall = 130 * tau * tau; if (iy + fall > rimY - 2) { landed.push({ k, j, id }); continue; } dx = boardR - 6 - sw / 2 + Math.min(3, tau * 8); dy += fall; }
        g.drawImage(spr, sx0, 0, sw, spr.height, Math.round(dx), Math.round(dy), sw, spr.height);
        if (j > 0) { g.fillStyle = '#fff6b8'; g.globalAlpha = .55; g.fillRect(Math.round(dx), Math.round(dy + 2), 1, spr.height - 4); g.globalAlpha = 1; }
      }
      // 아직 안 썬 표시선(점선): 칼에 가까워지면 반짝
      if (cooking.phase === 'play' || cooking.phase === 'intro') for (const [ci, locBase] of [[2 * k, Wk / 2 + gap * v / 2], [2 * k + 1, Wk / 2 - gap * v / 2]]) {
        if (step.results[ci] !== null) continue; const lx = Math.round(xc - Wk / 2 + locBase), near = clamp(1 - Math.abs(lx - knifeX) / 16, 0, 1);
        for (let yy = iy - 10; yy < iy + 8; yy += 3) { g.fillStyle = near > .45 ? '#ffffff' : '#fff6b8'; g.globalAlpha = .5 + near * .5; g.fillRect(lx, yy, 1, 2); } g.globalAlpha = 1;
        if (near > .2) { g.fillStyle = '#ffe27a'; g.fillRect(lx - 1, iy - 12, 3, 1); }
      }
    }
    g.restore();
    // 그릇
    if (landed.length > V.landedSeen) { V.landedSeen = landed.length; V.bowlBump = .16; if (cooking.phase !== 'intro') sfx.play('drop', .5); }
    V.bowlBump = Math.max(0, V.bowlBump - .016);
    const by2 = rimY + (V.bowlBump > 0 ? 1 : 0);
    p.ellipse(bowlX, by2 + 7, 15, 4, '#1c130c'); p.rect(bowlX - 14, by2, 29, 7, INK); p.ellipse(bowlX, by2 + 7, 13, 5, '#8a5a2e'); p.rect(bowlX - 13, by2 + 1, 27, 6, '#b98350'); p.rect(bowlX - 13, by2 + 1, 3, 5, '#d9a56a'); p.ellipse(bowlX, by2 + 1, 13, 4, '#d9a56a'); p.ellipse(bowlX, by2 + 2, 11, 3, '#4a2d18');
    landed.slice(0, 16).forEach((q, i) => { const cols = BIT_COLORS[q.id] || BIT_COLORS.herb, x = bowlX - 8 + (i % 6) * 3 + Math.round(hash(i * 5) * 2), y = by2 + 1 - Math.floor(i / 6) * 2 + Math.round(hash(i * 3)); p.rect(x, y, 3, 2, cols[(i + q.j) % cols.length]); });
    // 식칼
    const K = knifeSprite(), up = iy - 25, down = iy - 1; let tipY = up + Math.sin(time * 2.2) * .7;
    if (V.knifeT >= 0) { const u = V.knifeT, e = u < .07 ? u / .07 : u < .15 ? 1 : 1 - (u - .15) / .19; tipY = lerp(up, down, clamp(e, 0, 1)); }
    else if (cooking.phase === 'play' && !step.done) { const nxt = step.results.findIndex(r => r === null); if (nxt >= 0) { const dtn = step.times[nxt] - step.t; if (dtn < .22 && dtn > -.05) tipY -= 2; } }
    g.drawImage(K.cv, Math.round(knifeX - K.tipX), Math.round(tipY - K.tipY));
    if (V.knifeT >= 0 && V.knifeT < .12) { g.fillStyle = '#fff6dc'; g.fillRect(knifeX - 3, iy + 1, 7, 1); }
    beatDots(step.results, by + 50, step.results.findIndex(r => r === null), Math.round(bx0 + bw * .4));
  }

  /* ---------- 젓기 / 졸이기 장면 ---------- */
  function ladleTip(step) { const a = step.angle() * TAU - Math.PI / 2; return { x:Y.cx + Math.cos(a) * (Y.rx - 10), y:Y.vy + 1 + Math.sin(a) * (Y.ry - 5) }; }
  const band = s => s < .6 ? 0 : s < .86 ? 1 : s <= 1.02 ? 2 : 3;
  function drawPot(step, kind) {
    const p = P(), V = S.V, cx = Y.cx, rx = Y.rx, ry = Y.ry, spr = potSprite(rx, ry), fin = kind === 'finish';
    slab(cx, Math.min(VW - 24, rx * 2 + 46)); flames(cx, rx * 2 - 6, fin ? (V.lift >= 0 ? Math.max(0, .5 - V.lift) : .35 + step.sheen * .3) : .5);
    const hop = V.hop > 0 ? -1 : 0, lift = fin && V.lift >= 0 ? -Math.sin(Math.min(1, V.lift * 1.1) * Math.PI * .5) * 9 : 0, vy = Y.vy + hop + Math.round(lift);
    g.drawImage(spr.cv, cx - spr.ox, vy - spr.oy);
    // 국물/잼
    const s = fin ? step.sheen : 0;
    const col = fin ? (s < 1 ? mix('#d0507e', '#8a1f4a', s) : mix('#8a1f4a', '#1a0a10', (s - 1) / .18)) : (cooking.recipe.id === 'dew-berry-jam' ? '#b2406f' : '#d9a96a');
    p.ellipse(cx, vy + 1, rx - 3, ry - 2, dark(col, .25)); p.ellipse(cx, vy, rx - 3, ry - 2.5, col);
    const sw = V.swirl; for (let k = 0; k < 3; k++) for (let a = 0; a < 1.25; a += .13) { const ang = sw * 1.3 + k * 2.1 + a, rr = .55 + k * .14; p.px(cx + Math.cos(ang) * (rx - 6) * rr, vy + Math.sin(ang) * (ry - 4) * rr, light(col, .32)); }
    // 알갱이(썰기 결과·베리) — 냄비에 떨어져 빙글빙글 돕니다
    const bits = fin ? [] : cooking.bits.length ? cooking.bits : (cooking.recipe.id === 'dew-berry-jam' ? Array.from({ length:8 }, (_, i) => BIT_COLORS.berry[i % 3]) : []);
    bits.forEach((c, i) => {
      const pr = clamp((V.pour - i * .05) / .35, 0, 1), ang = sw * 1.05 + i * 2.4, rr = .3 + (i % 4) * .14, bx = cx + Math.cos(ang) * (rx - 8) * rr, bY = vy + .5 + Math.sin(ang) * (ry - 4) * rr;
      if (pr <= 0) { if (cooking.phase === 'play' || cooking.phase === 'between') p.rect(bx - 1, vy - 46, 3, 2, c); return; }
      if (pr < 1) { p.rect(bx - 1, lerp(vy - 46, bY, pr * pr), 3, 2, c); return; }
      if (!V['p' + i]) { V['p' + i] = 1; spawn('drop', bx, bY, { vy:-24, g:160, life:.35, c:'#ffe3b0', size:1 }); }
      p.rect(bx - 1, bY, 3, 2, c); p.px(bx - 1, bY + 2, dark(col, .35));
    });
    for (const r of S.rings) { const a = r.t / .6; g.globalAlpha = 1 - a; p.ring(r.x, r.y, 2 + a * 10, 1 + a * 4, '#fff3dc'); g.globalAlpha = 1; }
    if (kind === 'stir') {
      // 박자 표시: 위쪽에 반짝이는 자리
      const near = Math.abs(((step.angle() + .5) % 1) - .5), pulse = clamp(1 - near * 5, 0, 1), mx = cx, my = vy + 1 - (ry - 5);
      g.globalAlpha = .55 + .45 * pulse; p.ring(mx, my, 4 + 3 * pulse, 2 + 1.5 * pulse, '#ffe9a6'); g.globalAlpha = 1; p.px(mx, my, '#fff6dc');
      if (pulse > .5) { p.px(mx, my - 4, '#ffe27a'); p.px(mx - 4, my, '#ffe27a'); p.px(mx + 4, my, '#ffe27a'); }
      // 국자
      const tip = ladleTip(step), gx = cx + Math.round(rx * .5), gy = vy - 40, dx = gx - tip.x, dy = gy - tip.y, len = Math.hypot(dx, dy), ex = gx + dx / len * 9, ey = gy + dy / len * 9;
      p.line(tip.x, tip.y - 1, ex, ey - 1, INK); p.line(tip.x + 1, tip.y - 1, ex + 1, ey - 1, INK); p.line(tip.x - 1, tip.y, ex - 1, ey, INK); p.line(tip.x, tip.y + 2, ex, ey + 2, INK); p.line(tip.x + 2, tip.y, ex + 2, ey, INK);
      p.line(tip.x, tip.y, ex, ey, '#a77746'); p.line(tip.x + 1, tip.y, ex + 1, ey, '#d19a60'); p.line(tip.x, tip.y + 1, ex, ey + 1, '#a77746');
      p.ellipse(tip.x, tip.y + 1, 4, 3, INK); p.ellipse(tip.x, tip.y + 1, 3, 2, '#7a4a28'); p.px(tip.x - 1, tip.y, '#d19a60'); p.rect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3, INK); p.px(Math.round(ex), Math.round(ey), '#2a1d10');
      beatDots(step.results, Y.slab + 36, step.results.findIndex(r => r === null));
    } else {
      // 윤기: 반짝이는 하이라이트와 완성 구간 반짝임
      const gloss = clamp((s - .3) / .6, 0, 1); for (let i = 0; i < Math.round(gloss * 7); i++) p.px(cx - rx * .55 + i * 2, vy - ry * .3 + Math.abs(i - 3) * .6, '#fff');
      if (s >= .86 && s <= 1.02 && cooking.phase === 'play') {
        for (let i = 0; i < 4; i++) { const a = time * 3 + i * 1.6, x = Math.round(cx + Math.cos(a) * rx * .55), y = Math.round(vy + Math.sin(a * 1.3) * ry * .5); if (Math.sin(time * 9 + i * 2) > -.2) { p.px(x, y, '#fff6b8'); p.px(x - 1, y, '#fff6b8'); p.px(x + 1, y, '#fff6b8'); p.px(x, y - 1, '#fff6b8'); p.px(x, y + 1, '#fff6b8'); } }
        p.ring(cx, vy, rx - 1, ry - .5, '#ffe27a');
      }
      if (cooking.phase === 'play' && hintCache !== band(s)) { hintCache = band(s); setHint(['아직 묽어요…', '윤기가 돌기 시작해요', '반짝반짝 — 지금!', '눌어붙어요!'][hintCache], 0); }
    }
  }

  /* ---------- 굽기 장면 ---------- */
  const bucket = d => Math.round(clamp(d, 0, 1.3) * 10);
  function drawHeat(step) {
    const p = P(), V = S.V, cx = Y.cx, rx = Y.rx, ry = Y.ry, spr = panSprite(rx, ry), px = panX(), st = step.state();
    slab(cx, Math.min(VW - 24, rx * 2 + 70)); flames(px, rx * 2 - 6, step.heat);
    const hop = V.hop > 0 ? -1 : 0, vy = Y.vy + hop; g.drawImage(spr.cv, px - spr.ox, vy - spr.oy);
    p.ellipse(px, vy + 1, rx - 3, ry - 2.5, '#3b4346'); p.ellipse(px, vy + 1, rx - 6, ry - 5, '#5a4a22'); // 기름
    // 생선
    const fw = Math.round(rx * .95), perfect = Math.abs(st.d - step.perfectAt) <= .06 && !step.done && cooking.phase === 'play';
    let fy = vy + 1, sy = 1, d = st.d, side = step.side, alpha = 1;
    if (V.flip >= 0) { const u = V.flip; fy -= Math.sin(u * Math.PI) * (VH > 200 ? 34 : 26); sy = Math.cos(u * Math.PI); d = u < .5 ? (V.d0 ?? st.d) : st.d; side = u < .5 ? 0 : 1; }
    if (V.plateT >= 0) { const u = clamp(V.plateT, 0, 1); fy -= Math.sin(u * Math.PI * .8) * 26 + u * 4; alpha = 1 - clamp((u - .6) / .4, 0, 1); }
    const spriteF = panFish(bucket(d), side, fw), hs = Math.max(.18, Math.abs(sy));
    if (alpha > 0) {
      g.save(); g.globalAlpha = alpha; g.translate(px - 2, Math.round(fy)); g.scale(1, sy < 0 ? -hs : hs); g.drawImage(spriteF.cv, -Math.round(spriteF.w / 2), -Math.round(spriteF.h / 2)); g.restore();
      if (V.flip < 0 && V.plateT < 0) { p.ellipse(px - 3, fy - 1, 3, 1.5, '#78b86a'); p.ellipse(px + 3, fy, 3, 1.5, '#5ea05a'); p.px(px - 4, fy - 2, '#b6e29a'); p.px(px + 2, fy - 1, '#b6e29a'); }
    }
    if (perfect) {
      for (let i = 0; i < 3; i++) { const a = time * 2.6 + i * 2.1, x = Math.round(px + Math.cos(a) * fw * .55), y = Math.round(fy + Math.sin(a * 1.4) * 6 - 3); if (Math.sin(time * 10 + i * 2) > -.3) { p.px(x, y, '#fff6b8'); p.px(x - 1, y, '#ffe27a'); p.px(x + 1, y, '#ffe27a'); p.px(x, y - 1, '#ffe27a'); p.px(x, y + 1, '#ffe27a'); } }
      p.ring(px, vy + 1, rx - 1, ry - .5, '#ffe27a');
    }
    // 불 손잡이(굽기 전용 조작)
    const k = knobXY(), act = S.drag || V.shakeKnob > 0, a = -2.356 + step.heat * 4.712;
    for (let i = 0; i < 7; i++) { const aa = -2.356 + i * 4.712 / 6, col = mix('#5b8aa6', '#e0502c', i / 6); p.rect(k.x + Math.sin(aa) * 14.5 - 1, k.y - Math.cos(aa) * 14.5 - 1, 2, 2, step.heat >= i / 6 - .01 ? col : '#40362a'); }
    p.disc(k.x, k.y, 10, INK); p.disc(k.x, k.y, 9, act ? '#fff2a0' : '#7c8985'); p.disc(k.x, k.y, 8, '#d9d2b8'); p.disc(k.x - 1, k.y - 2, 4, '#f4eed8');
    p.line(k.x, k.y, k.x + Math.sin(a) * 7, k.y - Math.cos(a) * 7, INK); p.line(k.x + 1, k.y, k.x + 1 + Math.sin(a) * 7, k.y - Math.cos(a) * 7, '#e0503c');
    for (const dx of [-24, 24]) { const x = Math.round(Y.cx + dx * (VW < 190 ? .8 : 1)); p.disc(x, k.y, 5, INK); p.disc(x, k.y, 4, '#4a4744'); p.px(x - 1, k.y - 1, '#7a7672'); }
    if (cooking.phase === 'play' && step.side === 1 && hintCache !== 7) { hintCache = 7; setHint('다 되면 접시에!', 2200); }
  }

  /* ---------- 완성 장면 ---------- */
  function drawServe() {
    const p = P(), V = S.V, cx = Y.cx, cy = Y.mid + 14, t = V.st, burnt = V.q === 'burnt';
    p.ellipse(cx, cy + 30, 50, 6, '#5a3a1c');
    const enter = clamp(t / .35, 0, 1), spr = burnt ? burntPlate() : dishPlate(V.recipe, V.q);
    const drop = t < .35 ? -(1 - enter) * 70 : 0; let sc = 1, oy = 0;
    if (t >= .35) {
      const u = clamp((t - .35) / .5, 0, 1); oy = -Math.abs(Math.sin(u * Math.PI * 2.5)) * 9 * (1 - u); sc = 1 + (u < .4 ? .12 * Math.sin(u / .4 * Math.PI) : 0);
      if (!V.landed) { V.landed = true; burst(cx, cy + 20, burnt ? 4 : 8, burnt ? ['#4a4440', '#6a6460'] : ['#fff3dc', '#ffe3b0'], 34, 120); }
    }
    if (V.q === 'great' && t > .3) { g.save(); g.globalAlpha = .3 + .12 * Math.sin(time * 4); g.translate(cx, cy + 4); g.rotate(time * .5); for (let i = 0; i < 10; i++) { g.rotate(TAU / 10); g.fillStyle = '#ffe27a'; g.fillRect(14, -1, 34, 2); } g.restore(); }
    g.save(); g.translate(cx, Math.round(cy + oy + drop)); g.scale(2 * sc, 2 * (2 - sc)); g.drawImage(spr, -Math.round(spr.width / 2), -Math.round(spr.height / 2)); g.restore();
    if (t > .5 && !V.sparked && !burnt) { V.sparked = true; stars(cx, cy - 6, V.q === 'great' ? 18 : V.q === 'good' ? 10 : 4, 30); sfx.play(V.q === 'normal' ? 'good' : 'perfect'); }
    if (t > .5) { if (Math.random() < .12) spawn('steam', cx + rnd(-10, 10), cy - 6, { vy:-rnd(10, 16), vx:rnd(-3, 3), life:1.2, c:burnt ? '#4a4440' : '#f7efe0', size:burnt ? 3 : 2 }); if (V.q === 'great' && Math.random() < .08) stars(cx, cy - 8, 1, 30); }
  }

  function draw() {
    if (!cooking || playEl.hidden || !bg) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, VW, VH);
    const sh = S.shake > 0 && !reduced ? Math.round((Math.random() - .5) * S.shake * 1.2) : 0; canvas.style.transform = sh ? `translate(${sh * PX}px,${Math.round((Math.random() - .5) * S.shake) * PX}px)` : '';
    g.drawImage(bg.cv, 0, 0);
    if (cooking.phase === 'serve' || cooking.phase === 'done') { drawServe(); drawParts(); return; }
    const step = cooking.steps[Math.min(cooking.idx, cooking.steps.length - 1)];
    if (step.id === 'chop') drawChop(step); else if (step.id === 'stir') drawPot(step, 'stir'); else if (step.id === 'finish') drawPot(step, 'finish'); else if (step.id === 'heat') drawHeat(step);
    drawParts();
  }
  function frame(now) { raf = requestAnimationFrame(frame); if (destroyed) return; const dt = clamp((now - last) / 1000, 0, .05); last = now; if (!paused) update(dt); draw(); }
  last = performance.now(); raf = requestAnimationFrame(frame); renderSelect();

  const game = {
    tutorial:{ title:'요리', pages:[
      { title:'재료를 고르고 시작', demo:chip('재료 모으기') + chip('요리 고르기', 'ok') + chip('시작!', 'ok'), text:'만들 수 있는 요리만 시작할 수 있어요. <b>재료는 시작할 때 쓰여요.</b>' },
      { title:'요리마다 다른 손놀림', demo:chip('썰기 · 칼') + chip('젓기 · 국자') + chip('굽기 · 팬') + chip('졸이기 · 냄비'), text:'<b>썰기</b>는 표시선이 칼 밑에 올 때, <b>젓기</b>는 국자가 반짝이는 곳을 지날 때 눌러요. <b>굽기</b>는 불 손잡이를 돌려 노릇하게 구워요.' },
      { title:'조작', demo:key('Space') + chip('탭 · 클릭') + key('↑') + key('↓') + chip('불 손잡이'), text:'스페이스·엔터·화면 탭으로 동작해요. 굽기에서는 <b>↑↓ 또는 손잡이를 끌어</b> 불을 조절해요. 실패해도 괜찮아요!' },
    ] },
    busy: () => !!cooking && ['intro', 'play', 'between'].includes(cooking.phase),
    leaveWarning: () => '재료는 이미 써서, 지금 나가면 검게 탄 덩어리 하나만 남아요.',
    pause: () => { paused = true; }, resume: () => { paused = false; }, layerClosed: () => { paused = false; },
    abort: () => { if (cooking && !cooking.rewarded && cooking.phase !== 'done') { progress.add('dish:burnt', 1); cooking.phase = 'done'; cooking.rewarded = true; } },
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(hintTimer); document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); },
    debug: () => ({ mode:stage.dataset.mode, step:cooking?.steps?.[cooking.idx]?.id, phase:cooking?.phase }),
    _S: S, _begin: begin, get _cooking() { return cooking; },
  };
  return game;
}
