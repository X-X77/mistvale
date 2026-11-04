// 낚시 화면(캔버스): 위에서 내려다본 물가. 물고기의 그림자·물보라·줄의 휘어짐·찌의 움직임으로 상태를 보여 줍니다.
import { FISH, FISHING_SPOTS, TIERS, josa } from './items.js';
import { BiteSession, Fight, TUNING, rollSize } from './fishing-engine.js';
import { createRng } from './rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

export function createFishing({ host, placeId, progress, sfx, reduced }) {
  const spot = FISHING_SPOTS[placeId], pool = spot.fish.map(id => FISH[id]);
  const rng = createRng();
  const stage = host.stage; stage.classList.add('fs-stage');
  stage.innerHTML = `<canvas class="fs-canvas" aria-label="낚시터 화면"></canvas>
    <div class="fs-call" aria-hidden="true"></div>
    <div class="fs-hint" aria-hidden="true"></div>
    <div class="fs-controls" hidden><button type="button" class="fs-btn fs-left" aria-label="왼쪽으로 기울이기">◀</button><button type="button" class="fs-btn fs-reel" aria-label="감기 (누르고 있는 동안)">감기<small>누르고 있기</small></button><button type="button" class="fs-btn fs-right" aria-label="오른쪽으로 기울이기">▶</button></div>`;
  const canvas = stage.querySelector('canvas'), ctx = canvas.getContext('2d');
  const callEl = stage.querySelector('.fs-call'), hintEl = stage.querySelector('.fs-hint'), controls = stage.querySelector('.fs-controls');
  const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
  controls.hidden = !coarse;

  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, time = 0, paused = false, destroyed = false;
  const S = { phase:'aim', bite:null, fight:null, fish:null, floatX:0, floatY:0, castT:0, from:null, shake:0, flash:0, reeling:false, lean:0,
    keys:{ reel:false, left:false, right:false }, ptr:{ down:false, id:null, x0:0 }, btn:{ reel:false, left:false, right:false },
    particles:[], rings:[], fishPos:{ x:0, y:0, vx:0, vy:0 }, floatDip:0, dipV:0, call:'', callTone:'', callT:0, lastTick:0, lastWarn:-9, maxT:0, dangerSeen:false,
    mouse:{ x:0, y:0, in:false }, ended:false, endT:0, endInfo:null, pxPerM:30, hookedAt:0, reelAcc:0, dashShown:'' , jumpT:0 };

  function layout() {
    const r = stage.getBoundingClientRect(); W = Math.max(300, r.width); H = Math.max(300, r.height); dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  const bottomPad = () => (coarse ? 112 : 0);
  const shoreY = () => H - bottomPad() - Math.max(54, H * .1);
  const waterTop = () => 12;
  const halfW = () => Math.min(W * .38, 340);
  const depthToY = d => shoreY() - 54 - d * (shoreY() - waterTop() - 120);
  const yToDepth = y => clamp((shoreY() - 54 - y) / (shoreY() - waterTop() - 120), 0, 1);

  /* ---------- 상태 전환 ---------- */
  function setCall(text, tone = '', hold = 1.2) { S.call = text; S.callTone = tone; S.callT = hold; callEl.textContent = text; callEl.dataset.tone = tone; callEl.classList.toggle('on', !!text); }
  let hintTimer = 0;
  function setHint(text, ttl = 0) { hintEl.textContent = text; hintEl.classList.toggle('on', !!text); clearTimeout(hintTimer); if (text && ttl) hintTimer = setTimeout(() => hintEl.classList.remove('on'), ttl); }
  function burst(x, y, n, color = '#e8f6ff', speed = 120) { if (reduced) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = rng.range(0, TAU), v = rng.range(.3, 1) * speed; S.particles.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - speed * .3, life:rng.range(.4, .8), max:.8, size:rng.range(1.5, 3.2), color }); } }
  function ring(x, y, color = '#ffffff', max = 46, dur = .9) { S.rings.push({ x, y, t:0, dur, max, color }); }
  function shake(amount) { if (!reduced) S.shake = Math.max(S.shake, amount); }
  function buzz(ms) { try { navigator.vibrate?.(ms); } catch { /* 지원 안 함 */ } }

  function toAim() {
    S.phase = 'aim'; S.bite = null; S.fight = null; S.fish = null; S.ended = false; S.reeling = false; S.dashShown = '';
    sfx.stopHum(); setCall(''); setHint(coarse ? '물 위를 눌러 낚싯줄을 던지세요. 멀리 던질수록 희귀한 물고기가 걸립니다.' : '물 위를 눌러 낚싯줄을 던지세요. 멀리 던질수록 희귀한 물고기가 걸립니다.');
    stage.dataset.phase = 'aim';
  }
  function cast(x, y) {
    const minY = waterTop() + 40, maxY = shoreY() - 70;
    const ty = clamp(y, minY, maxY), tx = clamp(x, W / 2 - halfW() * .78, W / 2 + halfW() * .78);
    S.floatX = tx; S.floatY = ty; S.from = { x:W / 2, y:shoreY() - 36 }; S.castT = 0; S.phase = 'cast'; stage.dataset.phase = 'cast';
    S.bite = new BiteSession(pool, yToDepth(ty), rng); S.fish = S.bite.fish; setHint(''); sfx.play('cast');
  }
  function afterCast() {
    S.phase = 'wait'; stage.dataset.phase = 'wait'; ring(S.floatX, S.floatY, '#ffffff', 40, 1.1); sfx.play('splash');
    setHint('찌를 지켜보세요. 살짝 까딱이는 건 탐색 중인 가짜 입질입니다.'); host.say('낚싯줄을 던졌습니다. 입질을 기다리는 중.');
  }
  function onHookPress() {
    if (S.phase === 'wait' || S.phase === 'bite') {
      const r = S.bite.hook();
      if (r === 'hooked') startFight();
      else if (r === 'early') endBite('early');
    }
  }
  function startFight() {
    S.phase = 'fight'; stage.dataset.phase = 'fight'; S.fight = new Fight(S.fish, rng); S.hookedAt = time; S.maxT = 0; S.dangerSeen = false; S.reelAcc = 0;
    const startDist = S.fight.dist, dy = shoreY() - 30 - S.floatY; S.pxPerM = Math.max(14, dy / startDist);
    S.fishPos = { x:S.floatX, y:S.floatY, vx:0, vy:0 };
    // 좌우 위치는 던진 위치에서 시작
    S.fight.x = clamp((S.floatX - W / 2) / halfW(), -.6, .6);
    sfx.play('hook'); shake(7); buzz(40); burst(S.floatX, S.floatY, 18, '#ffffff', 160); ring(S.floatX, S.floatY, '#ffe9a8', 60, .6);
    setHint(coarse ? '“감기”를 꾹 누르면 끌어옵니다. 물보라가 보이면 손을 떼세요.' : '마우스(또는 스페이스)를 꾹 누르면 끌어옵니다. 물보라가 보이면 놓으세요.', 6000); host.say('걸렸습니다! 힘겨루기 시작.');
  }
  function endBite(kind) {
    S.phase = 'ending'; stage.dataset.phase = 'ending'; sfx.stopHum(); setHint('');
    const fish = S.fish;
    if (kind === 'early') { sfx.play('early'); ring(S.floatX, S.floatY, '#ff9d7a', 50, .7); setCall('너무 일찍!', 'bad', 1.6); S.endInfo = { result:'early' }; }
    else { sfx.play('lose'); setCall('놓쳤다…', 'bad', 1.6); S.endInfo = { result:'missed' }; }
    S.endT = 0; S.ended = true; S.fishName = fish.name;
  }
  function finishFight() {
    const f = S.fight; S.phase = 'ending'; stage.dataset.phase = 'ending'; sfx.stopHum(); setHint('');
    S.endInfo = { result:f.over, reason:f.reason }; S.endT = 0; S.ended = true;
    if (f.over === 'caught') { sfx.play('win'); S.jumpT = 0; burst(S.fishPos.x, S.fishPos.y, 30, '#ffffff', 220); setCall('낚았다!', 'win', 2); buzz(60); }
    else { sfx.play(f.over === 'snap' ? 'snap' : 'lose'); shake(f.over === 'snap' ? 14 : 5); buzz(f.over === 'snap' ? 120 : 40);
      setCall(f.over === 'snap' ? '줄이 끊어졌다!' : f.over === 'loose' ? '바늘이 빠졌다!' : '도망쳤다!', 'bad', 2); }
  }
  function showOutcome() {
    const info = S.endInfo, fish = S.fish, again = { label:'한 번 더 던지기', primary:true, run:() => { toAim(); } }, leave = { label:'낚시터 떠나기', run:() => host.close() };
    S.ended = false;
    if (info.result === 'caught') {
      const size = rollSize(fish, rng), rec = progress.recordCatch(fish.id, size); progress.add(fish.id, 1);
      const xp = progress.addXp('fishing', fish.xp), lvl = xp.leveled ? `낚시 Lv.${xp.after.level} 달성!` : '';
      if (xp.leveled) sfx.play('level');
      host.showResult({ tone:'win', title:`${fish.name}${josa(fish.name, '을/를')} 낚았습니다`, message:`${size}cm · ${TIERS[fish.tier]} 물고기${rec.first ? ' · 처음 낚은 물고기입니다!' : rec.best === size && progress.state.caught[fish.id].count > 1 ? ' · 최대 기록!' : ''}`,
        rewards:[{ item:fish.id, n:1, note:fish.desc }], xp:`낚시 경험치 +${fish.xp}`, level:lvl, actions:[again, leave] });
    } else {
      const reasons = { early:['너무 일찍 당겼습니다', '가짜 입질에 속아 챔질했습니다. 찌가 완전히 잠기고 물보라가 일 때까지 기다리세요.'],
        missed:['입질을 놓쳤습니다', '진짜 입질이 왔을 때 제한 시간 안에 챔질하지 못했습니다. 찌가 푹 잠기면 바로 누르세요.'],
        snap:['줄이 끊어졌습니다', info.reason], loose:['물고기를 놓쳤습니다', info.reason], escaped:['물고기가 도망쳤습니다', info.reason] };
      const [title, why] = reasons[info.result] || ['실패', ''];
      const xp = progress.addXp('fishing', 2);
      host.showResult({ tone:'lose', title, message:info.result === 'early' || info.result === 'missed' ? '물고기가 달아났습니다.' : `${fish.name}${josa(fish.name, '은/는')} 놓쳤습니다.`, detail:why, xp:'낚시 경험치 +2 (도전 보상)', actions:[again, leave] });
    }
  }

  /* ---------- 입력 ---------- */
  const rect = () => canvas.getBoundingClientRect();
  function onPointerDown(event) {
    if (paused || host.closed || !host.layer.hidden) return;
    const r = rect(), x = event.clientX - r.left, y = event.clientY - r.top;
    if (S.phase === 'aim') { if (y < shoreY() - 40) { event.preventDefault(); cast(x, y); } return; }
    if (S.phase === 'wait' || S.phase === 'bite') { event.preventDefault(); onHookPress(); return; }
    if (S.phase === 'fight') { event.preventDefault(); S.ptr = { down:true, id:event.pointerId, x0:x }; try { canvas.setPointerCapture(event.pointerId); } catch {} }
  }
  function onPointerMove(event) {
    const r = rect(), x = event.clientX - r.left, y = event.clientY - r.top; S.mouse = { x, y, in:true };
    if (S.ptr.down && event.pointerId === S.ptr.id) S.ptr.lean = clamp((x - S.ptr.x0) / 70, -1, 1);
  }
  function onPointerUp(event) { if (event.pointerId === S.ptr.id) { S.ptr = { down:false, id:null, x0:0, lean:0 }; } }
  const keyMap = { ' ':'reel', Spacebar:'reel', Enter:'reel', ArrowDown:'reel', s:'reel', S:'reel', ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right' };
  function onKey(event, down) {
    if (paused || host.closed || !host.layer.hidden) return;
    const k = keyMap[event.key]; if (!k) return;
    if (event.target?.closest?.('button') && (event.key === ' ' || event.key === 'Enter')) { if (!event.target.classList.contains('fs-reel')) return; }
    event.preventDefault();
    if (down && !event.repeat && k === 'reel') {
      if (S.phase === 'aim') { cast(W / 2 + (rng() - .5) * 60, lerp(waterTop() + 80, shoreY() - 90, .35)); return; }
      if (S.phase === 'wait' || S.phase === 'bite') { onHookPress(); return; }
    }
    S.keys[k] = down;
  }
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', () => { S.mouse.in = false; });
  canvas.style.touchAction = 'none';
  for (const [cls, key] of [['fs-reel', 'reel'], ['fs-left', 'left'], ['fs-right', 'right']]) {
    const b = controls.querySelector('.' + cls);
    const down = e => { e.preventDefault(); e.stopPropagation(); if (paused || !host.layer.hidden) return; if (key === 'reel' && (S.phase === 'wait' || S.phase === 'bite')) { onHookPress(); return; } if (key === 'reel' && S.phase === 'aim') { cast(W / 2, lerp(waterTop() + 80, shoreY() - 90, .35)); return; } S.btn[key] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} };
    const up = e => { S.btn[key] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  window.addEventListener('blur', () => { S.keys = { reel:false, left:false, right:false }; S.btn = { reel:false, left:false, right:false }; S.ptr = { down:false, id:null, x0:0, lean:0 }; });

  /* ---------- 갱신 ---------- */
  function update(dt) {
    time += dt;
    S.shake = Math.max(0, S.shake - dt * 22); S.flash = Math.max(0, S.flash - dt * 3);
    if (S.callT > 0 && S.phase !== 'ending') { S.callT -= dt; if (S.callT <= 0) { callEl.classList.remove('on'); S.call = ''; } }
    for (const p of S.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }
    S.particles = S.particles.filter(p => p.life > 0);
    for (const r of S.rings) r.t += dt; S.rings = S.rings.filter(r => r.t < r.dur);
    // 찌 출렁임(스프링)
    S.dipV += (-S.floatDip * 60 - S.dipV * 7) * dt; S.floatDip += S.dipV * dt;

    if (S.phase === 'cast') {
      S.castT += dt; if (S.castT >= .55) afterCast();
    } else if (S.phase === 'wait' || S.phase === 'bite') {
      for (const ev of S.bite.step(dt)) {
        if (ev === 'nibble') { S.dipV += 70; ring(S.floatX, S.floatY, '#d6f0ff', 22, .6); sfx.play('nibble'); }
        else if (ev === 'bite') { S.phase = 'bite'; stage.dataset.phase = 'bite'; S.dipV += 340; shake(5); burst(S.floatX, S.floatY, 14, '#ffffff', 150); ring(S.floatX, S.floatY, '#ffe08a', 56, .8); sfx.play('bite'); buzz(60); setCall('입질! 지금!', 'alert', S.bite.window + .1); setHint(''); }
        else if (ev === 'missed') { endBite('missed'); }
      }
    } else if (S.phase === 'fight') {
      const f = S.fight;
      const lean = clamp((S.keys.left ? -1 : 0) + (S.keys.right ? 1 : 0) + (S.btn.left ? -1 : 0) + (S.btn.right ? 1 : 0) + (S.ptr.down ? (S.ptr.lean || 0) : 0), -1, 1);
      S.reeling = S.keys.reel || S.btn.reel || S.ptr.down; S.lean = lerp(S.lean, lean, 1 - Math.exp(-dt * 14));
      const before = f.dist;
      f.step(dt, { reel:S.reeling, lean:lean });
      S.maxT = Math.max(S.maxT, f.tension);
      for (const ev of f.events) {
        if (ev === 'phase:telegraph') { const dir = f.dashDir; setCall(dir < 0 ? '◀ 물보라! 놓으세요' : '물보라! 놓으세요 ▶', 'alert', f.teleLen + .6); sfx.play('warn'); ring(S.fishPos.x, S.fishPos.y, '#fff1a8', 54, f.teleLen + .3); buzz(25); S.dashShown = 'tele'; }
        if (ev === 'phase:dash') { burst(S.fishPos.x, S.fishPos.y, 12, '#ffffff', 190); sfx.play('splash'); shake(4); setCall('', '', .01); callEl.classList.remove('on'); }
        if (ev === 'phase:rest') { if (!f.tired) setCall('힘을 아낀다 — 지금 감자', 'info', 1.1); }
        if (ev === 'phase:tired') { setCall('지쳤다! 쭉 감자', 'good', 1.8); sfx.play('good'); }
        if (ev === 'phase:swim' && f.stamina > .5 && S.dashShown === 'tired') { setCall('힘을 되찾았다!', 'alert', 1.2); }
      }
      if (f.phase === 'tired') S.dashShown = 'tired';
      if (f.tension > TUNING.dangerT - .05 && time - S.lastWarn > .55) { S.lastWarn = time; sfx.play('warn'); buzz(15); if (f.phase !== 'telegraph') setCall('장력 위험! 놓아요', 'danger', .5); }
      if (Math.abs(f.x) > TUNING.hazardAt && time - S.lastWarn > .8) { S.lastWarn = time; setCall(f.x < 0 ? '◀ 갈대에 쓸린다! 반대로' : '갈대에 쓸린다! 반대로 ▶', 'danger', .8); }
      // 감는 소리
      if (S.reeling) { S.reelAcc += Math.max(0, before - f.dist); if (S.reelAcc > .09) { S.reelAcc = 0; sfx.play('tick', clamp(f.tension, 0, 1)); } }
      sfx.humTo(f.tension);
      // 물고기 화면 좌표
      const tx = W / 2 + f.x * halfW(), ty = clamp(shoreY() - 30 - f.dist * S.pxPerM, waterTop() + 14, shoreY() - 46);
      const fp = S.fishPos; const nvx = (tx - fp.x) / Math.max(dt, .001), nvy = (ty - fp.y) / Math.max(dt, .001);
      fp.vx = lerp(fp.vx, nvx, .2); fp.vy = lerp(fp.vy, nvy, .2); fp.x = lerp(fp.x, tx, 1 - Math.exp(-dt * 12)); fp.y = lerp(fp.y, ty, 1 - Math.exp(-dt * 12));
      if (f.phase === 'dash' && Math.random() < dt * 14) burst(fp.x, fp.y, 1, '#ffffff', 90);
      if (f.over) finishFight();
    } else if (S.phase === 'ending') {
      S.endT += dt;
      if (S.endInfo.result === 'caught') {
        S.jumpT += dt; const fp = S.fishPos; fp.x = lerp(fp.x, W / 2, .08); fp.y = lerp(fp.y, shoreY() - 70, .08);
      }
      if (S.endT > (S.endInfo.result === 'caught' ? 1.5 : 1.3) && S.ended) showOutcome();
    }
  }

  /* ---------- 그리기 ---------- */
  function drawWater() {
    const w = spot.water, top = waterTop(), sy = shoreY();
    const g = ctx.createLinearGradient(0, top, 0, sy); g.addColorStop(0, w.deep); g.addColorStop(.55, w.mid); g.addColorStop(1, w.shallow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 일렁이는 물결선
    ctx.lineWidth = 1.4; ctx.globalAlpha = .13;
    for (let i = 0; i < 26; i++) {
      const y = lerp(top + 20, sy - 10, i / 26), amp = 2 + 3 * (i / 26), ph = time * (.5 + (i % 5) * .1) + i * 1.7;
      ctx.beginPath(); ctx.strokeStyle = i % 3 ? '#e9fbff' : '#04202e';
      for (let x = 0; x <= W; x += 18) { const yy = y + Math.sin(x * .02 + ph) * amp; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 빛 반짝임
    ctx.fillStyle = '#ffffff'; for (let i = 0; i < 28; i++) { const x = (i * 193 + Math.sin(time * .3 + i) * 20) % W, y = top + ((i * 71) % (sy - top - 40)) + 10, a = (Math.sin(time * 1.4 + i * 2.2) + 1) / 2; ctx.globalAlpha = .05 + .14 * a; ctx.fillRect(x, y, 3, 2); }
    ctx.globalAlpha = 1;
    // 위험 구역(갈대·바위)
    const cx = W / 2, hz = halfW() * TUNING.hazardAt;
    for (const side of [-1, 1]) {
      const edge = cx + side * hz, outer = side < 0 ? 0 : W;
      const hot = S.fight && Math.abs(S.fight.x) > TUNING.hazardAt && Math.sign(S.fight.x) === side;
      const gg = ctx.createLinearGradient(edge, 0, outer, 0); gg.addColorStop(0, 'rgba(26,56,34,0)'); gg.addColorStop(.35, hot ? 'rgba(120,96,30,.6)' : 'rgba(22,52,32,.72)'); gg.addColorStop(1, 'rgba(14,34,24,.92)');
      ctx.fillStyle = gg; ctx.fillRect(Math.min(edge, outer), top, Math.abs(outer - edge), sy - top);
      ctx.strokeStyle = hot ? '#e8c35c' : '#5d8b4d'; ctx.lineWidth = 2;
      const count = Math.floor(Math.abs(outer - edge) / 9);
      for (let i = 0; i < count; i++) {
        const x = edge + side * (10 + i * 9 + (i * 37 % 7)), baseY = top + ((i * 131) % (sy - top)) + 20, hh = 26 + (i * 53 % 30);
        const sway = Math.sin(time * (hot ? 9 : 1.4) + i) * (hot ? 5 : 3);
        ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x + sway, baseY - hh * .6, x + sway * 1.6, baseY - hh); ctx.stroke();
      }
      // 바위
      ctx.fillStyle = '#34423a'; for (let i = 0; i < 5; i++) { const x = edge + side * (40 + i * 52 + (i * 13 % 9)), y = top + 60 + ((i * 197) % (sy - top - 140)); ctx.beginPath(); ctx.ellipse(x, y, 16 + (i % 3) * 5, 10 + (i % 2) * 4, 0, 0, TAU); ctx.fill(); }
    }
  }
  function drawShore() {
    const sy = shoreY(), cx = W / 2;
    const g = ctx.createLinearGradient(0, sy - 6, 0, H); g.addColorStop(0, '#6a5a3c'); g.addColorStop(.18, '#4c4630'); g.addColorStop(1, '#283426');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, sy + 10);
    for (let x = 0; x <= W; x += 24) ctx.lineTo(x, sy + Math.sin(x * .03) * 5); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 부두 판자
    ctx.fillStyle = '#7a5c36'; ctx.fillRect(cx - 54, sy - 4, 108, H - sy + 4); ctx.strokeStyle = '#3d2a17'; ctx.lineWidth = 2;
    for (let y = sy; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(cx - 54, y); ctx.lineTo(cx + 54, y); ctx.stroke(); }
    ctx.strokeRect(cx - 54, sy - 4, 108, H - sy + 4);
  }
  function rodTip() {
    const f = S.fight, sy = shoreY(), cx = W / 2;
    const bend = f ? f.tension : 0, lean = (S.lean || 0) * 26;
    // 낚싯대: 손잡이 → 끝(장력이 클수록 휘어짐)
    const bx = cx, by = sy + 18, tx = cx + lean + (f ? clamp(f.x, -1, 1) * 22 : 0) * .6, ty = sy - 70 + bend * 10;
    return { bx, by, tx, ty, bend };
  }
  function drawRod() {
    const r = rodTip(), ctl = { x:(r.bx + r.tx) / 2 + (S.fight ? (r.tx - r.bx) * 0 : 0) - r.bend * 18 * Math.sign(S.fight?.x || 1) * .4, y:(r.by + r.ty) / 2 - r.bend * 6 };
    ctx.lineCap = 'round'; ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(r.bx, r.by); ctx.quadraticCurveTo(ctl.x, ctl.y, r.tx, r.ty); ctx.stroke();
    ctx.strokeStyle = '#a77746'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(r.bx, r.by); ctx.quadraticCurveTo(ctl.x, ctl.y, r.tx, r.ty); ctx.stroke();
    ctx.strokeStyle = '#e6b77a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(r.bx, r.by); ctx.quadraticCurveTo(ctl.x, ctl.y, r.tx, r.ty); ctx.stroke();
    // 릴
    ctx.fillStyle = '#c9c4a8'; ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.bx, r.by - 12, 10, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#6b6650'; ctx.lineWidth = 2; ctx.beginPath(); const rot = S.reeling ? time * 18 : 0; ctx.moveTo(r.bx, r.by - 12); ctx.lineTo(r.bx + Math.cos(rot) * 8, r.by - 12 + Math.sin(rot) * 8); ctx.stroke();
    ctx.lineCap = 'butt'; return r;
  }
  function lineColor(T) { return T < .6 ? '#f3efe0' : T < .82 ? '#ffd778' : T < .92 ? '#ff9d4a' : '#ff4a3c'; }
  function drawLine(r, ex, ey, T, slack = 0) {
    const mx = (r.tx + ex) / 2, my = (r.ty + ey) / 2;
    const sag = (1 - clamp(T * 1.6, 0, 1)) * (40 + slack * 30) * (ex > r.tx ? 1 : -1) + (S.fight ? 0 : 6);
    const vib = Math.max(0, T - .55) * 6 * Math.sin(time * 60);
    ctx.strokeStyle = lineColor(T); ctx.lineWidth = T > .88 ? 2.6 : 1.8; ctx.globalAlpha = .95;
    if (T > .88 && !reduced) { ctx.shadowColor = '#ff3b2a'; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.moveTo(r.tx, r.ty); ctx.quadraticCurveTo(mx + sag + vib, my + (T < .3 ? 12 : 0), ex, ey); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  function drawFloat(x, y, bite) {
    const dip = clamp(S.floatDip, -4, 26), bob = Math.sin(time * 2.2) * 1.2;
    ctx.save(); ctx.translate(x, y + bob + dip);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 9, 4, 0, 0, TAU); ctx.fill();
    const sink = bite ? 10 : 0;
    ctx.fillStyle = '#f7f3e6'; ctx.beginPath(); ctx.arc(0, sink, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e0483a'; ctx.beginPath(); ctx.arc(0, sink - 3, 6, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#16251f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, sink, 6, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function drawFishShape(x, y, ang, len, color, wag, alpha, tier) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
    const w = len * .34, tail = Math.sin(wag) * len * .16;
    ctx.fillStyle = 'rgba(5,16,24,.55)'; // 그림자
    ctx.beginPath(); ctx.moveTo(len * .5, 0); ctx.bezierCurveTo(len * .3, -w, -len * .2, -w * .9, -len * .38, tail * .6);
    ctx.lineTo(-len * .6, tail + w * .75); ctx.lineTo(-len * .55, tail - w * .75); ctx.lineTo(-len * .38, tail * .6);
    ctx.bezierCurveTo(-len * .2, w * .9, len * .3, w, len * .5, 0); ctx.fill();
    ctx.fillStyle = color; ctx.globalAlpha = alpha * .62; ctx.beginPath(); ctx.ellipse(len * .05, 0, len * .36, w * .6, 0, 0, TAU); ctx.fill();
    // 지느러미
    ctx.globalAlpha = alpha * .8; ctx.fillStyle = 'rgba(5,16,24,.6)';
    ctx.beginPath(); ctx.moveTo(len * .08, -w * .8); ctx.lineTo(-len * .1, -w * 1.5 - Math.sin(wag * .7) * 3); ctx.lineTo(-len * .18, -w * .7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(len * .08, w * .8); ctx.lineTo(-len * .1, w * 1.5 + Math.sin(wag * .7) * 3); ctx.lineTo(-len * .18, w * .7); ctx.fill();
    if (tier === 'special') { ctx.strokeStyle = '#fff3b0'; ctx.globalAlpha = alpha * (.45 + .25 * Math.sin(time * 4)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(len * .02, 0, len * .5, w * 1.1, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function drawDial() {
    const f = S.fight; const r = W < 640 ? 46 : 60, cx = W - r - 22, cy = shoreY() - r - 6;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(12,28,24,.78)'; ctx.strokeStyle = '#d8c58a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, TAU); ctx.fill(); ctx.stroke();
    const a0 = Math.PI * .78, a1 = Math.PI * 2.22, at = t => lerp(a0, a1, t);
    const zones = [[0, TUNING.sweetLow, '#5b8aa6'], [TUNING.sweetLow, TUNING.sweetHigh, '#6fb36a'], [TUNING.sweetHigh, TUNING.dangerT, '#e0a53c'], [TUNING.dangerT, 1.02, '#d9402f']];
    ctx.lineWidth = 8; for (const [s, e, c] of zones) { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, r - 8, at(s), at(Math.min(e, 1))); ctx.stroke(); }
    const T = f ? f.tension : 0, jit = f && T > .85 && !reduced ? Math.sin(time * 70) * .015 : 0, ang = at(clamp(T + jit, 0, 1));
    ctx.strokeStyle = '#fff5d6'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * (r - 14), Math.sin(ang) * (r - 14)); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#fff5d6'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9d2b0'; ctx.font = '600 11px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('줄 장력', 0, r * .55);
    if (f && f.strain > .02) { ctx.fillStyle = '#ff6a52'; ctx.fillRect(-r * .5, r * .66, r * clamp(f.strain / TUNING.snapStrain, 0, 1), 4); }
    ctx.restore();
  }
  function drawFight(r) {
    const f = S.fight, fp = S.fishPos, T = f.tension;
    // 줄과 물고기
    drawLine(r, fp.x, fp.y, T, f.loose / TUNING.looseLimit);
    const speed = Math.hypot(fp.vx, fp.vy), baseAng = Math.atan2(-(fp.vy || -1), fp.vx || 0);
    let ang = f.phase === 'dash' ? Math.atan2(-.55, f.dashDir * 1) : (-Math.PI / 2 + Math.sin(time * 1.3) * .4 + (f.phase === 'telegraph' ? f.dashDir * .5 : 0));
    const len = ({ common:46, rare:62, special:80 })[S.fish.tier] * (W < 640 ? .8 : 1);
    const act = f.phase === 'dash' ? 26 : f.phase === 'telegraph' ? 18 : f.phase === 'tired' ? 3 : f.phase === 'rest' ? 4 : 10;
    const alpha = f.phase === 'tired' ? .7 : .95;
    // 신호: 물보라 링 + 방향 물결
    if (f.phase === 'telegraph') {
      const k = f.tele; ctx.strokeStyle = '#fff1a8'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { const t = (k * 2 + i / 3) % 1; ctx.globalAlpha = (1 - t) * .8; ctx.beginPath(); ctx.arc(fp.x, fp.y, 14 + t * 46, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = .9; ctx.fillStyle = '#fff1a8'; const dx = f.dashDir; for (let i = 0; i < 3; i++) { const ox = dx * (30 + i * 16 + k * 14); ctx.beginPath(); ctx.moveTo(fp.x + ox, fp.y - 10); ctx.lineTo(fp.x + ox + dx * 12, fp.y); ctx.lineTo(fp.x + ox, fp.y + 10); ctx.closePath(); ctx.globalAlpha = .35 + .2 * i; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (f.phase === 'dash') { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const t = ((time * 3 + i * .25) % 1); ctx.globalAlpha = (1 - t) * .6; ctx.beginPath(); ctx.moveTo(fp.x - f.dashDir * (10 + t * 60), fp.y + (i - 1.5) * 6); ctx.lineTo(fp.x - f.dashDir * (30 + t * 90), fp.y + (i - 1.5) * 9); ctx.stroke(); } ctx.globalAlpha = 1; }
    drawFishShape(fp.x, fp.y, ang, len, S.fish.color, time * act, alpha, S.fish.tier);
    // 남은 거리 라벨
    ctx.font = '600 12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#eaf6ff'; ctx.strokeStyle = 'rgba(8,24,32,.85)'; ctx.lineWidth = 3;
    const label = `${Math.max(0, f.dist).toFixed(1)}m`; ctx.strokeText(label, fp.x, fp.y + len * .62 + 6); ctx.fillText(label, fp.x, fp.y + len * .62 + 6);
    if (f.phase === 'tired') { ctx.fillStyle = '#bfe8ff'; ctx.font = '12px sans-serif'; for (let i = 0; i < 3; i++) ctx.fillText('·', fp.x + 14 + i * 8, fp.y - 18 - ((time * 20 + i * 8) % 14)); }
    // 끊어질 듯한 줄 경고 플래시
    if (T > TUNING.dangerT - .02 && !reduced) { ctx.fillStyle = `rgba(255,60,40,${.08 + .07 * Math.sin(time * 40)})`; ctx.fillRect(0, 0, W, H); }
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - .5) * S.shake, (Math.random() - .5) * S.shake);
    drawWater();
    // 조준 구역 안내
    if (S.phase === 'aim') {
      const sy = shoreY(), top = waterTop(); ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(235,250,255,.28)'; ctx.lineWidth = 1.5;
      for (const d of [.33, .66]) { const y = depthToY(d); ctx.beginPath(); ctx.moveTo(W / 2 - halfW() * .8, y); ctx.lineTo(W / 2 + halfW() * .8, y); ctx.stroke(); }
      ctx.setLineDash([]); ctx.fillStyle = 'rgba(235,250,255,.5)'; ctx.font = '600 11px "Noto Sans KR", sans-serif'; ctx.textAlign = 'left';
      const lx = W / 2 - halfW() * .8 + 4; ctx.fillText('가까운 물가 · 일반', lx, depthToY(.16) + 4); ctx.fillText('중간 · 일반~희귀', lx, depthToY(.5) + 4); ctx.fillText('깊은 곳 · 희귀·특수', lx, depthToY(.84) + 4);
      if (S.mouse.in && !coarse) { const my = clamp(S.mouse.y, top + 40, sy - 70), mx = clamp(S.mouse.x, W / 2 - halfW() * .78, W / 2 + halfW() * .78); ctx.strokeStyle = '#fff4c8'; ctx.lineWidth = 2; const pulse = 12 + Math.sin(time * 5) * 2; ctx.beginPath(); ctx.arc(mx, my, pulse, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(mx, my, 3, 0, TAU); ctx.stroke(); }
    }
    for (const rg of S.rings) { const k = rg.t / rg.dur; ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = rg.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(rg.x, rg.y, rg.max * k, rg.max * k * .6, 0, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
    const r = drawRod();
    if (S.phase === 'cast') {
      const k = clamp(S.castT / .55, 0, 1), e = 1 - Math.pow(1 - k, 2); const x = lerp(r.tx, S.floatX, e), y = lerp(r.ty, S.floatY, e) - Math.sin(k * Math.PI) * 90;
      drawLine(r, x, y, .3); ctx.fillStyle = '#f7f3e6'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
    } else if (S.phase === 'wait' || S.phase === 'bite') {
      if (S.phase === 'bite') { ctx.fillStyle = 'rgba(255,230,140,.12)'; ctx.beginPath(); ctx.arc(S.floatX, S.floatY, 40 + Math.sin(time * 18) * 4, 0, TAU); ctx.fill(); }
      drawLine(r, S.floatX, S.floatY, .12 + (S.phase === 'bite' ? .3 : 0)); drawFloat(S.floatX, S.floatY, S.phase === 'bite');
    } else if (S.phase === 'fight') drawFight(r);
    else if (S.phase === 'ending') {
      if (S.endInfo.result === 'caught') {
        const k = clamp(S.endT / 1.4, 0, 1), fp = S.fishPos, len = ({ common:46, rare:62, special:80 })[S.fish.tier] * (1 + k * .5), jump = Math.sin(k * Math.PI) * 60;
        drawLine(r, fp.x, fp.y - jump, .6); drawFishShape(fp.x, fp.y - jump, -Math.PI / 2 + Math.sin(time * 30) * .3, len, S.fish.color, time * 30, 1, S.fish.tier);
      } else if (S.endInfo.result === 'snap') { drawLine(r, r.tx + 6, r.ty + 30, .2); }
      else if (S.endInfo.result === 'early' || S.endInfo.result === 'missed') { drawFloat(S.floatX, S.floatY, false); }
    }
    for (const p of S.particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1;
    drawShore(); drawRod();
    ctx.restore();
    if (S.phase === 'fight') drawDial();
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${S.flash})`; ctx.fillRect(0, 0, W, H); }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (destroyed) return;
    const dt = clamp((now - last) / 1000, 0, .05); last = now;
    if (!paused) update(dt);
    draw();
  }
  const ro = new ResizeObserver(() => layout()); ro.observe(stage);
  layout(); toAim(); last = performance.now(); raf = requestAnimationFrame(frame);

  const game = {
    tutorial:{ title:'낚시', pages:[
      { title:'낚싯줄 던지기', demo:'<div class="demo-fs demo-aim"><i></i><i></i><i></i><span>◎</span></div>', text:'물 위를 눌러(탭) 던집니다. <b>가까운 곳</b>은 일반 물고기, <b>깊은 곳</b>일수록 희귀·특수 물고기가 걸리지만 훨씬 힘이 셉니다.' },
      { title:'입질과 챔질', demo:'<div class="demo-fs demo-bite"><b>찌</b><em>까딱…</em><em class="big">푹!</em></div>', text:'찌가 <b>살짝 까딱이면 가짜 입질</b>입니다 — 기다리세요. 찌가 <b>푹 잠기고 물보라</b>가 일면 진짜 입질입니다. 제한 시간 안에 누르면(클릭·탭·스페이스) 챔질합니다. 일찍 누르면 달아납니다.' },
      { title:'당기기와 놓기', demo:'<div class="demo-fs demo-fight"><span class="a">꾹 누름 = 감기 (장력↑)</span><span class="b">놓음 = 풀기 (장력↓, 물고기가 멀어짐)</span></div>', text:'<b>꾹 누르는 동안 감깁니다.</b> 감을수록 줄 장력(우측 게이지)이 오르고, 위험선(붉은 구간)을 오래 넘으면 줄이 끊어집니다. 너무 오래 놓아 두면 바늘이 빠집니다.' },
      { title:'물보라 = 돌진 신호', demo:'<div class="demo-fs demo-tele"><span>◎ 물보라!</span><span>→ 돌진! 놓기</span><span>→ 다시 감기</span></div>', text:'물고기는 돌진하기 <b>직전에 물보라와 화살표</b>를 보입니다. 그때 손을 떼서 장력을 낮추고, 돌진이 끝나면 다시 감으세요. 힘을 아끼는 때와 <b>지쳤을 때</b>는 쭉 감아 올릴 기회입니다.' },
      { title:'좌우 방향 잡기', demo:'<div class="demo-fs demo-lean"><span>◀ A / ← </span><b>물고기</b><span> D / → ▶</span></div>', text:'물고기가 좌우 <b>갈대·바위 쪽</b>으로 몰리면 줄이 쓸려 장력이 오릅니다. 좌우 방향키(A/D), 화면 ◀▶ 버튼, 또는 누른 채 좌우로 끌어서 중앙으로 되돌리세요.' },
    ] },
    busy: () => S.phase === 'fight' || S.phase === 'bite',
    leaveWarning: () => '힘겨루기 중입니다. 지금 나가면 물고기를 놓칩니다.',
    pause: () => { paused = true; sfx.stopHum(); }, resume: () => { paused = false; }, layerClosed: () => { paused = false; },
    abort: () => { sfx.stopHum(); },
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); sfx.stopHum(); },
    debug: () => ({ phase:S.phase, fish:S.fish?.id, tension:S.fight?.tension, dist:S.fight?.dist, fightPhase:S.fight?.phase, x:S.fight?.x }),
    _S: S, _cast: cast, _toAim: toAim,
  };
  return game;
}
