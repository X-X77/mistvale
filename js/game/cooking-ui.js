// 요리 화면: 레시피 고르기 → (재료 소비) → 조리 동작 1~2개 → 품질 판정 → 요리 획득.
import { RECIPES, INGREDIENTS, FISH, describeItem, qualityOf, DISH_QUALITY, josa } from './items.js';
import { buildSteps, dishScore, JUDGE, HeatFlip } from './cooking-engine.js';
import { itemIcon } from './host.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const mix = (c1, c2, t) => { const a = [1, 3, 5].map(i => parseInt(c1.slice(i, i + 2), 16)), b = [1, 3, 5].map(i => parseInt(c2.slice(i, i + 2), 16)); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join(''); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

export function createCooking({ host, progress, sfx, reduced }) {
  const stage = host.stage; stage.classList.add('cs-stage');
  stage.innerHTML = `<div class="cs-select"></div>
    <div class="cs-play" hidden><canvas class="cs-canvas" aria-label="주방 화면"></canvas><div class="cs-top"></div><div class="cs-pop" aria-hidden="true"></div><div class="cs-intro" hidden></div>
      <div class="cs-bottom"><div class="cs-heatpad" hidden><button type="button" class="fs-btn" data-heat="-1" aria-label="불 줄이기">불 ▼</button><button type="button" class="fs-btn" data-heat="1" aria-label="불 키우기">불 ▲</button></div><button type="button" class="cs-action mg-btn mg-primary">뒤집기</button></div></div>`;
  const selectEl = stage.querySelector('.cs-select'), playEl = stage.querySelector('.cs-play'), canvas = stage.querySelector('canvas'), ctx = canvas.getContext('2d');
  const topEl = stage.querySelector('.cs-top'), popEl = stage.querySelector('.cs-pop'), introEl = stage.querySelector('.cs-intro'), actionBtn = stage.querySelector('.cs-action'), heatPad = stage.querySelector('.cs-heatpad');
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, time = 0, paused = false, destroyed = false, cooking = null; // cooking: { recipe, steps, idx, consumed, fish, phase }
  const S = { keys:{ up:false, down:false }, particles:[], falling:null, flipAnim:0, lastJudge:null, drag:false, stepDone:0, potItems:[], shake:0 };

  function layout() { const r = stage.getBoundingClientRect(); W = Math.max(300, r.width); H = Math.max(300, r.height); dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
  const ro = new ResizeObserver(layout); ro.observe(stage);

  /* ---------- 레시피 선택 ---------- */
  let chosenFish = null;
  function ownedFish() { return Object.keys(progress.state.items).filter(id => FISH[id]).map(id => ({ id, n:progress.count(id), info:FISH[id] })); }
  function renderSelect() {
    cooking = null; playEl.hidden = true; selectEl.hidden = false; stage.dataset.mode = 'select';
    const cards = Object.values(RECIPES).map(recipe => {
      const need = Object.entries(recipe.need).map(([id, n]) => ({ id, n, have:progress.count(id), info:INGREDIENTS[id] || describeItem(id) }));
      if (recipe.fishAny) need.unshift({ id:'fish', n:1, have:ownedFish().reduce((a, f) => a + f.n, 0), info:{ name:'물고기 (아무 종류)', kind:'fish', color:'#a9c7d8' } });
      const ok = need.every(item => item.have >= item.n);
      const techs = recipe.steps.map(k => ({ heat:'불 조절', flip:'뒤집기', drop:'재료 넣기', stir:'박자 젓기', finish:'불에서 내리기' }[k])).join(' · ');
      return `<article class="cs-recipe ${ok ? '' : 'is-short'}" data-recipe="${recipe.id}"><header><span class="mg-ico">${itemIcon({ kind:'dish', color:recipe.color }, 30)}</span><div><h3>${esc(recipe.name)}</h3><p>${esc(recipe.desc)}</p></div></header>
        <ul class="cs-need">${need.map(item => `<li class="${item.have >= item.n ? 'ok' : 'no'}"><span class="mg-ico">${itemIcon({ kind:item.info.kind || 'ingredient', color:item.info.color }, 22)}</span>${esc(item.info.name)}<b>${item.have}/${item.n}</b></li>`).join('')}</ul>
        <p class="cs-tech">조리 동작 · ${esc(techs)}</p><button type="button" class="mg-btn ${ok ? 'mg-primary' : ''}" ${ok ? '' : 'disabled'}>${ok ? '요리 시작' : '재료가 부족합니다'}</button></article>`;
    }).join('');
    const none = Object.values(RECIPES).every(r => !Object.entries(r.need).every(([id, n]) => progress.count(id) >= n) || (r.fishAny && !ownedFish().length));
    selectEl.innerHTML = `<div class="cs-select-in"><div class="cs-select-head"><p class="mg-kicker">KITCHEN</p><h2>무엇을 만들까요?</h2><p class="mg-body">재료는 요리를 시작하는 순간 소비됩니다. 완성도에 따라 <b>일반 / 잘 만든 / 훌륭한</b> 요리가 되고, 크게 망치면 <b>실패작</b>이 됩니다.</p>${none ? '<p class="mg-why">지금은 만들 수 있는 요리가 없습니다. <b>속삭임 숲</b>에서 허브·버섯·베리를 채집하거나, <b>은빛 호수·푸른물결 해안</b>에서 물고기를 낚아 오세요.</p>' : ''}</div><div class="cs-recipes">${cards}</div></div>`;
    selectEl.querySelectorAll('.cs-recipe').forEach(card => card.querySelector('button').addEventListener('click', () => { sfx.play('ui'); pickRecipe(RECIPES[card.dataset.recipe]); }));
    host.say('요리를 고르세요.');
  }
  function pickRecipe(recipe) {
    if (recipe.fishAny) {
      const fish = ownedFish(); if (!fish.length) return;
      if (fish.length === 1) { chosenFish = fish[0].id; return begin(recipe); }
      host.showLayer('fishpick', `<div class="mg-card mg-small"><h2>어떤 물고기를 쓸까요?</h2><ul class="cs-fishlist">${fish.map(f => `<li><button type="button" class="mg-btn" data-fish="${f.id}"><span class="mg-ico">${itemIcon({ ...f.info, kind:'fish' }, 26)}</span>${esc(f.info.name)} <b>×${f.n}</b></button></li>`).join('')}</ul><div class="mg-actions"><button class="mg-btn" data-a="cancel">취소</button></div></div>`);
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
    cooking = { recipe, steps, idx:0, consumed:need, phase:'intro', fish:chosenFish, scores:[], ingredientList:Object.entries(recipe.need).flatMap(([id, n]) => Array(n).fill(id)) };
    selectEl.hidden = true; playEl.hidden = false; stage.dataset.mode = 'cook'; layout(); S.potItems = []; S.particles = [];
    startStep();
  }
  const STEP_INFO = {
    heat:{ title:'불 조절과 뒤집기', text:'<b>불(↑↓ 또는 오른쪽 손잡이)</b>을 조절해 생선 앞면을 노릇하게 굽다가, <b>황금빛으로 반짝일 때</b> 뒤집기! 센 불은 빨리 익지만 순식간에 탑니다. 뒷면도 같은 때에 접시에 담으세요.', action:'뒤집기' },
    drop:{ title:'재료 넣기', text:'위에서 흔들리는 재료가 <b>냄비 한가운데에 올 때</b> 눌러서 떨어뜨리세요 (스페이스 / 탭). 재료마다 속도가 조금씩 빨라집니다.', action:'넣기' },
    stir:{ title:'박자에 맞춰 젓기', text:'국자가 돌다가 <b>위쪽 표시를 지날 때</b> 눌러 저으세요 (스페이스 / 탭). 박자에서 벗어난 헛젓기는 감점입니다.', action:'젓기' },
    finish:{ title:'불에서 내리기', text:'잼이 졸아들며 <b>윤기가 돌고 반짝이면</b> 불에서 내리세요. 너무 일찍 내리면 묽고, 늦으면 눌어붙습니다.', action:'내리기' },
  };
  function startStep() {
    const step = cooking.steps[cooking.idx], info = STEP_INFO[step.id]; cooking.phase = 'intro'; S.falling = null;
    topEl.innerHTML = cooking.steps.map((s, i) => `<span class="cs-dot ${i < cooking.idx ? 'done' : i === cooking.idx ? 'now' : ''}">${i + 1}. ${esc(STEP_INFO[s.id].title)}</span>`).join('') + `<span class="cs-name">${esc(cooking.recipe.name)}</span>`;
    actionBtn.textContent = info.action; actionBtn.disabled = true; heatPad.hidden = !(step.id === 'heat' && matchMedia('(pointer: coarse)').matches);
    introEl.hidden = false; introEl.innerHTML = `<div class="mg-card"><p class="mg-kicker">STEP ${cooking.idx + 1} / ${cooking.steps.length}</p><h2>${esc(info.title)}</h2><p class="mg-body">${info.text}</p><div class="mg-actions"><button class="mg-btn mg-primary" data-a="go">준비됐어요</button></div></div>`;
    introEl.querySelector('[data-a=go]').addEventListener('click', () => { sfx.play('ui'); introEl.hidden = true; cooking.phase = 'play'; actionBtn.disabled = false; actionBtn.focus({ preventScroll:true }); if (step.id === 'finish') step.t = 0; });
    introEl.querySelector('[data-a=go]').focus();
  }
  function popup(text, tone) { const node = document.createElement('div'); node.className = 'cs-judge tone-' + tone; node.textContent = text; popEl.append(node); setTimeout(() => node.remove(), 900); }
  function judgeFx(judge, label) { const t = judge === 'perfect' ? 'perfect' : judge === 'good' ? 'good' : judge === 'ok' ? 'ok' : 'bad'; popup(label || JUDGE[judge]?.label || '', t); sfx.play(judge === 'perfect' ? 'perfect' : judge === 'good' ? 'good' : 'bad'); }

  function press() {
    if (!cooking || cooking.phase !== 'play' || paused) return;
    const step = cooking.steps[cooking.idx], res = step.press(); if (!res) return;
    if (step.id === 'heat') { const ev = step.events[step.events.length - 1]; judgeFx(ev.judge, ev.burnt ? '탔어요!' : JUDGE[ev.judge].label); if (ev.type === 'flip') { S.flipAnim = .001; sfx.play('flip'); } else { sfx.play('ok'); } }
    else if (step.id === 'drop') { const ev = step.events[step.events.length - 1]; S.falling = { x:ev.x, y:0, vy:0, kind:ev.index, judge:ev.judge }; sfx.play('drop', ev.index * .3); }
    else if (step.id === 'stir') { if (res.judge === 'stray') { popup('헛젓기', 'bad'); sfx.play('bad'); } else { judgeFx(res.judge); sfx.play('stir', Math.random()); } }
    else if (step.id === 'finish') { judgeFx(res.judge, res.judge === 'perfect' ? '딱 좋은 윤기!' : res.judge === 'miss' ? (res.sheen < .6 ? '너무 묽어요' : '눌어붙었어요') : JUDGE[res.judge].label); sfx.play('bell'); }
    if (step.done) endStep();
  }
  function endStep() {
    cooking.phase = 'between'; actionBtn.disabled = true; const step = cooking.steps[cooking.idx]; cooking.scores.push(step.score);
    setTimeout(() => { if (destroyed) return; cooking.idx++; if (cooking.idx >= cooking.steps.length) finishCooking(); else startStep(); }, step.id === 'drop' ? 1300 : 900);
  }
  function finishCooking() {
    const recipe = cooking.recipe, score = dishScore(cooking.steps), q = qualityOf(score); cooking.phase = 'done';
    const consumed = Object.entries(cooking.consumed).map(([item, n]) => ({ item, n }));
    let rewards = [], xpAmt;
    if (q.id === 'burnt') { progress.add('dish:burnt', 1); rewards = [{ item:'dish:burnt', n:1, note:'먹을 수 없는 덩어리입니다.' }]; xpAmt = 3; }
    else { const id = `dish:${recipe.id}:${q.id}`; progress.add(id, 1); rewards = [{ item:id, n:1 }]; xpAmt = Math.round(recipe.xp * ({ normal:.6, good:1, great:1.5 }[q.id])); }
    const xp = progress.addXp('cooking', xpAmt); if (xp.leveled) sfx.play('level');
    const detail = score < 25 ? '불·타이밍이 크게 어긋나 요리가 타 버렸습니다. 재료는 이미 쓰였습니다.' : '';
    sfx.play(q.id === 'burnt' ? 'lose' : 'win');
    const again = { label:'다른 요리 만들기', primary:true, run:() => { renderSelect(); } }, leave = { label:'주방에서 나가기', run:() => host.close() };
    host.showResult({ tone:q.id === 'burnt' ? 'lose' : 'win', title:q.id === 'burnt' ? '요리를 망쳤습니다' : `${q.label === '일반' ? '' : q.label + ' '}${recipe.name} 완성!`, message:`완성도 ${score}점 · ${q.label} 품질`, detail,
      rewards, consumed, xp:`요리 경험치 +${xpAmt}`, level:xp.leveled ? `요리 Lv.${xp.after.level} 달성!` : '', actions:[again, leave] });
  }

  /* ---------- 입력 ---------- */
  actionBtn.addEventListener('pointerdown', e => { e.preventDefault(); press(); });
  const keydown = e => {
    if (paused || host.closed || !host.layer.hidden || !cooking || cooking.phase !== 'play') return;
    if (e.key === ' ' || e.key === 'Enter') { if (e.target?.closest?.('button') && !e.target.classList.contains('cs-action')) return; e.preventDefault(); if (!e.repeat) press(); }
    if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); S.keys.up = true; }
    if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); S.keys.down = true; }
  };
  const keyup = e => { if (e.key === 'ArrowUp' || e.key === 'w') S.keys.up = false; if (e.key === 'ArrowDown' || e.key === 's') S.keys.down = false; };
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
  actionBtn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
  heatPad.querySelectorAll('button').forEach(b => { const dir = Number(b.dataset.heat); b.addEventListener('pointerdown', e => { e.preventDefault(); S.keys[dir > 0 ? 'up' : 'down'] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} }); const up = () => { S.keys.up = S.keys.down = false; b.classList.remove('on'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
  const leverRect = () => ({ x:W - 70, y:H * .2, w:44, h:H * .5 });
  function dragLever(e) { const r = canvas.getBoundingClientRect(), y = e.clientY - r.top, L = leverRect(); const step = cooking?.steps[cooking.idx]; if (step?.id === 'heat') step.setHeat(1 - (y - L.y) / L.h); }
  canvas.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, L = leverRect(); if (cooking?.phase === 'play' && cooking.steps[cooking.idx]?.id === 'heat' && x > L.x - 30) { S.drag = true; try { canvas.setPointerCapture(e.pointerId); } catch {} dragLever(e); } else if (cooking?.phase === 'play' && cooking.steps[cooking.idx]?.id !== 'heat') press(); });
  canvas.addEventListener('pointermove', e => { if (S.drag) dragLever(e); });
  canvas.addEventListener('pointerup', () => { S.drag = false; }); canvas.addEventListener('pointercancel', () => { S.drag = false; });
  canvas.style.touchAction = 'none';

  /* ---------- 갱신 ---------- */
  let sizzleT = 0, lastBeat = -1;
  function update(dt) {
    time += dt; S.shake = Math.max(0, S.shake - dt * 20);
    for (const p of S.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 120) * dt; } S.particles = S.particles.filter(p => p.life > 0);
    if (S.flipAnim > 0) { S.flipAnim += dt / .55; if (S.flipAnim >= 1) S.flipAnim = 0; }
    if (!cooking || cooking.phase !== 'play') return;
    const step = cooking.steps[cooking.idx];
    if (step.id === 'heat') {
      const dir = (S.keys.up ? 1 : 0) - (S.keys.down ? 1 : 0); if (dir) step.setHeat(step.heat + dir * .7 * dt);
      step.step(dt); const wantLabel = step.side === 0 ? '뒤집기' : '접시에 담기'; if (actionBtn.textContent !== wantLabel) actionBtn.textContent = wantLabel;
      sizzleT -= dt; if (sizzleT <= 0) { sizzleT = .45; if (step.heat > .12) sfx.play('sizzle', step.heat); }
      const st = step.state(); if (st.d > 1.0 && Math.random() < dt * 6) smoke('#2a2420');
      if (step.events.length) for (const ev of step.events) { if (ev.burnt) { popup('탔어요!', 'bad'); sfx.play('bad'); S.shake = 6; } }
      if (step.done) { endStep(); }
    } else if (step.id === 'drop') {
      step.step(dt);
      if (S.falling) { const f = S.falling; f.vy += 900 * dt; f.y += f.vy * dt; const potY = H * .66; if (f.y >= potY - H * .2 && !f.landed) { f.landed = true; if (f.judge !== 'miss') { S.potItems.push({ kind:f.kind, jitter:Math.random() }); burstAt(f.x * W, potY - H * .1, 14, '#ffe8b0'); S.shake = 3; } else { burstAt(f.x * W, potY - H * .1, 10, '#a5a08a'); popup('냄비 밖!', 'bad'); } } if (f.y > H) S.falling = null; }
    } else if (step.id === 'stir') {
      step.step(dt);
      const a = step.angle(); const beatNo = Math.floor(step.t / step.period); if (beatNo !== lastBeat && beatNo >= 0) { lastBeat = beatNo; sfx.play('stir', .2); }
      for (const ev of step.events) if (ev.type === 'miss') { popup('놓쳤어요', 'bad'); sfx.play('bad'); }
      if (step.done) endStep();
    } else if (step.id === 'finish') {
      step.step(dt);
      if (Math.random() < dt * (3 + step.sheen * 14)) { S.particles.push({ x:W / 2 + (Math.random() - .5) * 120, y:H * .56, vx:(Math.random() - .5) * 20, vy:-30 - Math.random() * 40, life:.7, max:.7, size:3 + Math.random() * 3, color:'#f7a6c2', g:60 }); }
      sizzleT -= dt; if (sizzleT <= 0) { sizzleT = .4; sfx.play('sizzle', .3 + step.sheen * .4); }
      for (const ev of step.events) if (ev.burnt) { popup('눌어붙었어요', 'bad'); sfx.play('bad'); }
      if (step.done) endStep();
    }
  }
  function smoke(color) { S.particles.push({ x:W / 2 + (Math.random() - .5) * 100, y:H * .45, vx:(Math.random() - .5) * 12, vy:-40 - Math.random() * 30, life:1.1, max:1.1, size:6 + Math.random() * 8, color, g:-10, a:.4 }); }
  function burstAt(x, y, n, color) { if (reduced) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 50 + Math.random() * 140; S.particles.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 80, life:.5 + Math.random() * .4, max:.9, size:2 + Math.random() * 3, color }); } }

  /* ---------- 그리기 ---------- */
  function kitchenBg() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2a1a'); g.addColorStop(.5, '#4a3520'); g.addColorStop(.5, '#6b4b2a'); g.addColorStop(1, '#4f351c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 56) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * .5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,220,150,.08)'; for (let y = H * .5 + 24; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 6); ctx.stroke(); }
    // 창가 빛
    const lg = ctx.createRadialGradient(W * .8, H * .08, 10, W * .8, H * .08, W * .6); lg.addColorStop(0, 'rgba(255,226,160,.28)'); lg.addColorStop(1, 'rgba(255,226,160,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    // 걸린 도구
    ctx.fillStyle = '#2a1d10'; for (let i = 0; i < 4; i++) { const x = W * (.12 + i * .1); ctx.fillRect(x, 20, 4, 60 + i * 8); ctx.beginPath(); ctx.ellipse(x + 2, 90 + i * 8, 14, 18, 0, 0, TAU); ctx.fill(); }
  }
  function stove(cy) { // 화덕 윗면
    ctx.fillStyle = '#24211f'; ctx.strokeStyle = '#0d0c0b'; ctx.lineWidth = 4; const w = Math.min(W * .82, 640), x = (W - w) / 2; ctx.beginPath(); ctx.roundRect(x, cy, w, H - cy + 20, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a3633'; ctx.fillRect(x + 8, cy + 8, w - 16, 10);
  }
  function fishColor(d) { return d < .5 ? mix('#f2b9a8', '#e8c48a', d / .5) : d < .93 ? mix('#e8c48a', '#d8963c', (d - .5) / .43) : d < 1.15 ? mix('#d8963c', '#4a2a14', (d - .93) / .22) : '#1e140c'; }
  function drawHeat(step) {
    kitchenBg(); const cx = W / 2, cy = H * .5, st = step.state(), rw = Math.min(W * .32, 230), rh = rw * .42; stove(H * .62);
    // 불꽃
    const fl = step.heat; for (let i = 0; i < 9; i++) { const x = cx + (i - 4) * rw * .2, h = (14 + fl * 70) * (.7 + .3 * Math.sin(time * 14 + i * 2)); const g = ctx.createLinearGradient(x, H * .66, x, H * .66 - h); g.addColorStop(0, '#ff6a1a'); g.addColorStop(.6, '#ffc64a'); g.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 9, H * .66); ctx.quadraticCurveTo(x, H * .66 - h * 1.1, x + 9, H * .66); ctx.fill(); }
    // 팬
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(cx, cy + 14, rw + 6, rh + 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2f2f2f'; ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#3d3d3d'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, rw - 12, rh - 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#262626'; ctx.save(); ctx.translate(cx + rw + 4, cy + 4); ctx.rotate(-.1); ctx.fillRect(0, -7, rw * .9, 14); ctx.restore();
    // 기름 반짝임
    ctx.fillStyle = 'rgba(255,214,120,.12)'; ctx.beginPath(); ctx.ellipse(cx, cy, rw - 14, rh - 10, 0, 0, TAU); ctx.fill();
    // 생선(뒤집기 애니메이션)
    const fa = S.flipAnim, lift = fa > 0 ? Math.sin(fa * Math.PI) * 110 : 0, sc = fa > 0 ? Math.cos(fa * Math.PI * 2) : 1;
    const d = st.d, perfect = Math.abs(d - step.perfectAt) <= .06 && !step.done;
    ctx.save(); ctx.translate(cx, cy - lift); ctx.scale(1, Math.abs(sc) * .999 + .001);
    const body = fishColor(step.side === 1 && fa === 0 ? d : (fa > 0 ? 0.3 : d));
    ctx.fillStyle = body; ctx.strokeStyle = perfect ? '#fff2a0' : '#4a2a14'; ctx.lineWidth = perfect ? 4 : 2.5;
    if (perfect && !reduced) { ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 18 + 8 * Math.sin(time * 12); }
    ctx.beginPath(); ctx.moveTo(rw * .62, 0); ctx.bezierCurveTo(rw * .35, -rh * .78, -rw * .28, -rh * .72, -rw * .46, -rh * .1); ctx.lineTo(-rw * .74, -rh * .42); ctx.lineTo(-rw * .72, rh * .42); ctx.lineTo(-rw * .46, rh * .1); ctx.bezierCurveTo(-rw * .28, rh * .72, rw * .35, rh * .78, rw * .62, 0); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(60,30,10,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-rw * .2 + i * rw * .16, -rh * .4); ctx.quadraticCurveTo(-rw * .26 + i * rw * .16, 0, -rw * .2 + i * rw * .16, rh * .4); ctx.stroke(); }
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(rw * .45, -rh * .1, 4, 0, TAU); ctx.fill();
    // 허브
    ctx.fillStyle = '#6fa55a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-rw * .05 + i * rw * .17, rh * .05, 9, 4, .6 + i, 0, TAU); ctx.fill(); }
    ctx.restore();
    // 지글지글 거품
    if (!reduced) for (let i = 0; i < 7; i++) { const a = (time * (1 + step.heat * 3) + i * 1.3) % 1; ctx.fillStyle = `rgba(255,236,190,${(1 - a) * .6})`; ctx.beginPath(); ctx.arc(cx + Math.cos(i * 2.4) * rw * .8, cy + Math.sin(i * 3.1) * rh * .7 - a * 12, 2 + a * 2, 0, TAU); ctx.fill(); }
    // 불 조절 손잡이
    const L = leverRect(); ctx.fillStyle = '#1b130c'; ctx.strokeStyle = '#d8c58a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(L.x + 14, L.y, 16, L.h, 8); ctx.fill(); ctx.stroke();
    const lg = ctx.createLinearGradient(0, L.y + L.h, 0, L.y); lg.addColorStop(0, '#5b8aa6'); lg.addColorStop(.5, '#e8b04a'); lg.addColorStop(1, '#e0502c'); ctx.fillStyle = lg; ctx.beginPath(); ctx.roundRect(L.x + 17, L.y + 3, 10, L.h - 6, 5); ctx.fill();
    const hy = L.y + (1 - step.heat) * L.h; ctx.fillStyle = '#f3ecd3'; ctx.strokeStyle = '#2a1e07'; ctx.beginPath(); ctx.roundRect(L.x, hy - 11, 44, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9d2b0'; ctx.font = '600 12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('불', L.x + 22, L.y - 8); ctx.fillText(`${step.side === 0 ? '앞면' : '뒷면'}`, cx, cy - rh - 28);
    ctx.fillText(step.side === 0 ? '노릇해지면 뒤집기' : '노릇해지면 접시에', cx, cy - rh - 12);
  }
  function drawPot(cx, cy, rw, fill) {
    ctx.fillStyle = '#16120f'; ctx.beginPath(); ctx.ellipse(cx, cy + 10, rw + 10, rw * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.ellipse(cx, cy, rw + 8, rw * .42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(cx, cy, rw - 6, rw * .34, 0, 0, TAU); ctx.fill();
  }
  function drawIngredient(kind, x, y, s = 1) {
    const id = cooking.ingredientList[kind % cooking.ingredientList.length], info = INGREDIENTS[id]; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (id === 'mushroom') { ctx.fillStyle = '#f0e6d2'; ctx.fillRect(-5, 0, 10, 16); ctx.fillStyle = info.color; ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#ffffff55'; ctx.fillRect(-6, -8, 4, 4); ctx.fillRect(3, -5, 4, 4); }
    else if (id === 'berry') { ctx.fillStyle = info.color; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff66'; ctx.beginPath(); ctx.arc(-4, -4, 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#4f8a3a'; ctx.fillRect(-2, -15, 4, 6); }
    else { ctx.fillStyle = info.color; ctx.beginPath(); ctx.ellipse(-6, 0, 14, 7, -.5, 0, TAU); ctx.ellipse(7, 2, 12, 6, .6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2f5a24'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(10, -2); ctx.stroke(); }
    ctx.restore();
  }
  function drawDrop(step) {
    kitchenBg(); stove(H * .72); const cx = W / 2, cy = H * .66, rw = Math.min(W * .22, 170); const R = step.potR * W;
    drawPot(cx, cy, Math.max(rw, R * 1.2), '#c58b4a'); const rr = Math.max(rw, R * 1.2);
    // 끓는 국물
    ctx.fillStyle = 'rgba(255,230,170,.45)'; for (let i = 0; i < 6; i++) { const a = (time * .8 + i / 6) % 1; ctx.beginPath(); ctx.arc(cx + Math.sin(i * 5.1) * rr * .6, cy + Math.cos(i * 3.7) * rr * .12, 3 + a * 4, 0, TAU); ctx.globalAlpha = 1 - a; ctx.fill(); } ctx.globalAlpha = 1;
    S.potItems.forEach((it, i) => drawIngredient(it.kind, cx + Math.sin(i * 2.3 + it.jitter) * rr * .5, cy + Math.cos(i * 1.7) * rr * .08, .55));
    // 목표선
    ctx.setLineDash([5, 7]); ctx.strokeStyle = 'rgba(255,240,180,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, H * .16); ctx.lineTo(cx, cy - 10); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,240,180,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * .42, 0, 0, TAU); ctx.stroke();
    // 매달린 재료 (진자)
    if (!step.done) { const x = step.x() * W, y = H * .3 + Math.abs(Math.sin(time * 2)) * 4; ctx.strokeStyle = '#d8c58a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 14); ctx.stroke(); drawIngredient(step.index, x, y, 1.15); }
    if (S.falling && !S.falling.landed) drawIngredient(S.falling.kind, S.falling.x * W, H * .3 + S.falling.y, 1.15);
    ctx.fillStyle = '#e9e2c6'; ctx.font = '600 13px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.min(step.index + (step.done ? 0 : 1), step.count)} / ${step.count}`, cx, H * .12);
  }
  function drawStirPot(step, fill, spoonLabel) {
    kitchenBg(); const cx = W / 2, cy = H * .52, R = Math.min(W * .3, H * .34, 220);
    ctx.fillStyle = '#16120f'; ctx.beginPath(); ctx.arc(cx, cy + 8, R + 16, 0, TAU); ctx.fill(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, TAU); ctx.fill(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // 소용돌이 + 거품
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let a = 0; a < 5.5; a += .2) { const r = R * (.15 + .22 * k) + a * R * .03, ang = a + time * 1.2 + k; a ? ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r) : ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); } ctx.stroke(); }
    // 박자 표시(위쪽 목표)
    const near = Math.abs(((step.angle() + .5) % 1) - .5); const pulse = clamp(1 - near * 6, 0, 1);
    ctx.strokeStyle = `rgba(255,236,150,${.4 + .6 * pulse})`; ctx.lineWidth = 3 + 4 * pulse; ctx.beginPath(); ctx.arc(cx, cy - R + 4, 20 + 6 * pulse, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffe9a6'; ctx.font = '700 12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('여기!', cx, cy - R - 24);
    // 국자
    const ang = step.angle() * TAU - Math.PI / 2, sx = cx + Math.cos(ang) * (R - 24), sy = cy + Math.sin(ang) * (R - 24);
    ctx.strokeStyle = '#8a6236'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * (R * .1), cy + Math.sin(ang) * R * .1); ctx.lineTo(sx, sy); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#b98650'; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4a2f14'; ctx.lineWidth = 3; ctx.stroke();
    // 박자 점
    const n = step.beats, dx = Math.min(28, (W - 60) / n), x0 = cx - (n - 1) * dx / 2; for (let i = 0; i < n; i++) { const r = step.results[i]; ctx.fillStyle = r === 'perfect' ? '#ffe27a' : r === 'good' ? '#9be3a1' : r === 'ok' ? '#9ccbd8' : r === 'miss' ? '#c4553f' : 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(x0 + i * dx, H - 96, 7, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillText(spoonLabel || '', cx, cy);
  }
  function drawFinish(step) {
    kitchenBg(); const cx = W / 2, cy = H * .52, R = Math.min(W * .3, H * .34, 220), s = step.sheen;
    ctx.fillStyle = '#16120f'; ctx.beginPath(); ctx.arc(cx, cy + 8, R + 16, 0, TAU); ctx.fill(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, TAU); ctx.fill();
    const base = s < 1 ? mix('#d0507e', '#8a1f4a', s) : mix('#8a1f4a', '#1a0a10', (s - 1) / .18); ctx.fillStyle = base; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // 거품
    for (let i = 0; i < 16; i++) { const a = (time * (.6 + s) + i * .37) % 1, bx = cx + Math.cos(i * 2.4) * R * .75 * ((i % 5) / 5 + .1), by = cy + Math.sin(i * 1.9) * R * .75 * ((i % 4) / 4 + .1); ctx.strokeStyle = `rgba(255,220,230,${(1 - a) * .6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 4 + a * (6 + s * 6), 0, TAU); ctx.stroke(); }
    // 윤기: 점점 커지는 하이라이트(알맞은 때 반짝)
    const gloss = clamp((s - .3) / .6, 0, 1); ctx.strokeStyle = `rgba(255,255,255,${.5 * gloss})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R * .72, Math.PI * 1.05, Math.PI * (1.05 + .5 * gloss)); ctx.stroke(); ctx.lineCap = 'butt';
    if (s >= .86 && s <= 1.02 && !step.done) { ctx.fillStyle = '#fff6b8'; for (let i = 0; i < 6; i++) { const a = time * 2 + i * 1.05, r = R * (.35 + .3 * ((i * 7) % 5) / 5); const x = cx + Math.cos(a * 1.3) * r, y = cy + Math.sin(a * 1.7) * r * .8, k = (Math.sin(time * 9 + i * 2) + 1) / 2; ctx.globalAlpha = .4 + .6 * k; ctx.save(); ctx.translate(x, y); ctx.rotate(.78); ctx.fillRect(-1.5, -9 * k, 3, 18 * k); ctx.fillRect(-9 * k, -1.5, 18 * k, 3); ctx.restore(); } ctx.globalAlpha = 1; }
    ctx.fillStyle = '#e9e2c6'; ctx.font = '600 13px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s < .6 ? '아직 묽다…' : s < .86 ? '윤기가 돌기 시작한다' : s <= 1.02 ? '반짝반짝 — 지금!' : '눌어붙는다!', cx, cy - R - 26);
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!cooking || playEl.hidden) return;
    ctx.save(); if (S.shake > 0) ctx.translate((Math.random() - .5) * S.shake, (Math.random() - .5) * S.shake);
    const step = cooking.steps[Math.min(cooking.idx, cooking.steps.length - 1)];
    if (step.id === 'heat') drawHeat(step); else if (step.id === 'drop') drawDrop(step);
    else if (step.id === 'stir') drawStirPot(step, cooking.recipe.id === 'dew-berry-jam' ? '#b2406f' : '#c58b4a');
    else if (step.id === 'finish') drawFinish(step);
    for (const p of S.particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.a ?? 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    ctx.restore();
  }
  function frame(now) { raf = requestAnimationFrame(frame); if (destroyed) return; const dt = clamp((now - last) / 1000, 0, .05); last = now; if (!paused) update(dt); draw(); }

  layout(); renderSelect(); last = performance.now(); raf = requestAnimationFrame(frame);
  const game = {
    tutorial:{ title:'요리', pages:[
      { title:'재료를 고르고 시작', demo:'<div class="demo-fs"><span>생선 1</span><span>허브 1</span><span>→ 요리 시작</span></div>', text:'만들 수 있는 요리만 시작할 수 있습니다. <b>재료는 시작하는 순간 소비</b>됩니다. 재료는 <b>속삭임 숲(채집)</b>과 <b>호수·해안(낚시)</b>에서 구하세요.' },
      { title:'요리마다 다른 손놀림', demo:'<div class="demo-fs"><span>구이: 불 조절 + 뒤집기</span><span>수프: 재료 넣기 + 박자 젓기</span><span>잼: 박자 젓기 + 내리기</span></div>', text:'요리마다 <b>1~2가지 동작</b>만 합니다. 동작 전에 설명이 나오고, <b>준비됐어요</b>를 눌러야 시작됩니다.' },
      { title:'조작', demo:'<div class="demo-fs"><span>스페이스 / 탭 = 동작</span><span>↑↓ = 불 세기</span></div>', text:'동작 버튼(스페이스·엔터·화면 탭)으로 타이밍을 맞추고, 구이에서는 <b>↑↓ 또는 오른쪽 손잡이 드래그</b>로 불을 조절합니다. 결과에 따라 <b>실패작 / 일반 / 잘 만든 / 훌륭한</b> 요리가 됩니다.' },
    ] },
    busy: () => !!cooking && ['intro', 'play', 'between'].includes(cooking.phase),
    leaveWarning: () => '재료는 이미 소비되었습니다. 지금 나가면 요리를 망쳐 \'검게 탄 덩어리\' 하나만 남습니다.',
    pause: () => { paused = true; }, resume: () => { paused = false; }, layerClosed: () => { paused = false; },
    abort: () => { if (cooking && cooking.phase !== 'done') { progress.add('dish:burnt', 1); cooking.phase = 'done'; } },
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); },
    debug: () => ({ mode:stage.dataset.mode, step:cooking?.steps?.[cooking.idx]?.id, phase:cooking?.phase }),
    _S: S, _begin: begin, get _cooking() { return cooking; },
  };
  return game;
}
