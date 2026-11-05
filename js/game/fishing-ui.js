// 낚시 화면(픽셀 캔버스): 위에서 내려다본 물가. 찌·물보라·줄의 휘어짐·낚싯대의 휘어짐·물고기의 몸짓으로 상태를 보여 줍니다.
// 규칙(장력·체력·저항 패턴)은 fishing-engine.js 가 그대로 담당하고, 이 파일은 입력과 그림만 맡습니다.
import { scenePainter } from './scene-art.js';
import { FISH, FISHING_SPOTS, TIERS, GRADES, TRAITS, josa } from './items.js?v=mine1';
import { equipmentBonus, baitEffect, BAIT_IDS, GOODS } from './goods.js?v=mine1';
import { BiteSession, Fight, TUNING, rollSize } from './fishing-engine.js?v=mine1';
import { createRng } from './rng.js?v=mine1';
import { Pix, pixelSurface, blit, text, clamp, lerp, mix, light, dark, INK, hash } from './pixel.js?v=mine1';
import { fishSprite, uiIcon, iconImg } from './art.js?v=mine1';
import { describeItem } from './items.js?v=mine1';

const TAU = Math.PI * 2;

export function createFishing({ host, placeId, progress, sfx, reduced }) {
  const paintScene = scenePainter('pond', .08);
  const spot = FISHING_SPOTS[placeId], pool = spot.fish.map(id => FISH[id]);
  const rng = createRng();
  const stage = host.stage; stage.classList.add('fs-stage');
  const zoneChip = (cls, id, label) => `<div class="fs-zone ${cls}">${iconImg({ id, kind:'fish', color:FISH[id].color }, 24)}<span>${label}</span></div>`;
  stage.innerHTML = `<canvas class="fs-canvas" aria-label="낚시터 화면"></canvas>
    <div class="fs-zones" aria-hidden="true">${zoneChip('z1', pool[0].id, '얕은 곳 · 쉬움~보통')}${zoneChip('z2', pool[2].id, '중간 · 어려움')}${zoneChip('z3', pool[3].id, '깊은 곳 · 최고 난도')}</div>
    <div class="fs-gauge pxt" aria-hidden="true">줄 장력</div>
    <div class="fs-grade px" aria-hidden="true" hidden></div>
    <div class="fs-call" aria-hidden="true"></div>
    <div class="fs-hint" aria-hidden="true"></div>
    <div class="fs-controls" hidden><button type="button" class="fs-btn side fs-left" aria-label="왼쪽으로 기울이기"><img class="pxi" src="${uiIcon('left')}" alt=""></button><button type="button" class="fs-btn fs-reel" aria-label="감기 (누르고 있는 동안)">감기<small>꾹 누르기</small></button><button type="button" class="fs-btn side fs-right" aria-label="오른쪽으로 기울이기"><img class="pxi" src="${uiIcon('right')}" alt=""></button></div>`;
  // 미끼 고르기: 던지기 전에만 보입니다. 던질 때마다 고른 미끼를 1개 씁니다. (키보드: 1 = 미끼 없음, 2·3 = 미끼)
  stage.insertAdjacentHTML('beforeend', '<div class="fs-bait" role="group" aria-label="미끼 고르기"></div>');
  const baitEl = stage.querySelector('.fs-bait'); let baitId = null;
  function renderBait() {
    if (baitId && progress.count(baitId) < 1) baitId = null;
    const chips = [{ id:null, label:'없음', key:'1' }, ...BAIT_IDS.map((id, i) => ({ id, label:GOODS[id].short || GOODS[id].name, key:String(i + 2), n:progress.count(id) }))];
    baitEl.innerHTML = chips.map(chip => `<button type="button" tabindex="-1" class="fs-baitbtn${chip.id === baitId ? ' on' : ''}${chip.id && !chip.n ? ' empty' : ''}" data-bait="${chip.id || ''}" aria-pressed="${chip.id === baitId}" ${chip.id && !chip.n ? 'aria-disabled="true"' : ''} title="${chip.id ? GOODS[chip.id].desc : '미끼 없이 던집니다'}">${chip.id ? iconImg(describeItem(chip.id), 24) : ''}<span>${chip.label}</span>${chip.id ? `<b>×${chip.n}</b>` : ''}${coarse ? '' : `<kbd>${chip.key}</kbd>`}</button>`).join('');
  }
  function pickBait(id) {
    if (S.phase !== 'aim') return;
    if (id && progress.count(id) < 1) { sfx.play('deny'); setHint('그 미끼가 없어요. 클로버 잡화점에서 살 수 있어요.', 2400); return; }
    baitId = id; sfx.play('ui'); renderBait();
    setHint(id ? GOODS[id].desc : '미끼 없이 던져요', 2600);
  }
  baitEl.addEventListener('pointerdown', event => event.preventDefault());   // 눌러도 초점이 옮겨 가지 않게(Space 로 던질 때 버튼이 눌리지 않도록)
  baitEl.addEventListener('click', event => { const button = event.target.closest('.fs-baitbtn'); if (button) pickBait(button.dataset.bait || null); });
  const canvas = stage.querySelector('canvas'), surf = pixelSurface(canvas, stage, { maxH:220 }), g = surf.g;
  const gradeEl = stage.querySelector('.fs-grade'), callEl = stage.querySelector('.fs-call'), hintEl = stage.querySelector('.fs-hint'), controls = stage.querySelector('.fs-controls'), gaugeEl = stage.querySelector('.fs-gauge');
  const zoneEls = [...stage.querySelectorAll('.fs-zone')];
  const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
  controls.hidden = !coarse;

  let W = 0, H = 0, PX = 3, raf = 0, last = 0, time = 0, paused = false, destroyed = false, bg = null;
  const S = { phase:'aim', bite:null, fight:null, fish:null, floatX:0, floatY:0, castT:0, from:null, shake:0, flash:0, reeling:false, lean:0,
    keys:{ reel:false, left:false, right:false }, ptr:{ down:false, id:null, x0:0 }, btn:{ reel:false, left:false, right:false },
    particles:[], rings:[], fishPos:{ x:0, y:0, vx:0, vy:0 }, floatDip:0, dipV:0, call:'', callTone:'', callT:0, lastTick:0, lastWarn:-9, maxT:0, dangerSeen:false,
    shadows:[], biter:null, mouse:{ x:0, y:0, in:false }, ended:false, endT:0, endInfo:null, pxPerM:30, hookedAt:0, reelAcc:0, dashShown:'' , jumpT:0, catchFrom:null, splash:0 };

  const bottomPad = () => (coarse ? 112 : 0);
  const shoreY = () => H - bottomPad() - Math.max(54, H * .1);
  const waterTop = () => 12;
  const halfW = () => Math.min(W * .38, 340);
  const depthToY = d => shoreY() - 54 - d * (shoreY() - waterTop() - 120);
  const yToDepth = y => clamp((shoreY() - 54 - y) / (shoreY() - waterTop() - 120), 0, 1);
  const dial = () => ({ x:W - 26 * PX, y:shoreY() - 22 * PX });
  function layout() {
    surf.layout(); W = surf.W; H = surf.H; PX = surf.PX; bg = buildBg(); placeZones();
  }
  function placeZones() {
    const left = Math.max(10, W / 2 - halfW() * .8 - 4);
    [.16, .5, .84].forEach((d, i) => { zoneEls[i].style.top = Math.round(depthToY(d) - 15) + 'px'; zoneEls[i].style.left = Math.round(left) + 'px'; });
    const d = dial(); gaugeEl.style.left = Math.round(d.x) + 'px'; gaugeEl.style.top = Math.round(d.y + 18 * PX) + 'px';
  }

  /* ---------- 상태 전환 ---------- */
  function setCall(text, tone = '', hold = 1.2) { if (text) hintEl.classList.remove('on'); S.call = text; S.callTone = tone; S.callT = hold; callEl.textContent = text; callEl.dataset.tone = tone; callEl.classList.toggle('on', !!text); }
  let hintTimer = 0;
  function setHint(text, ttl = 0) { hintEl.textContent = text; hintEl.classList.toggle('on', !!text); clearTimeout(hintTimer); if (text && ttl) hintTimer = setTimeout(() => hintEl.classList.remove('on'), ttl); }
  function burst(x, y, n, color = '#e8f6ff', speed = 120) { if (reduced) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = rng.range(0, TAU), v = rng.range(.3, 1) * speed; S.particles.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - speed * .3, life:rng.range(.4, .8), max:.8, size:rng.range(1.5, 3.2), color }); } }
  function ring(x, y, color = '#ffffff', max = 46, dur = .9) { S.rings.push({ x, y, t:0, dur, max, color }); }
  function shake(amount) { if (!reduced) S.shake = Math.max(S.shake, amount); }
  function buzz(ms) { try { navigator.vibrate?.(ms); } catch { /* 지원 안 함 */ } }

  /* ---------- 물속 그림자: 던지기 전에 물고기가 헤엄치는 모습이 어렴풋이 보입니다 ----------
     그림자가 큰(=덩치 큰) 곳 가까이에 던지면 바로 그 물고기가 다가옵니다. 아무것도 없는 곳에 던지면 깊이에 따라 무엇이 올지 정해져요. */
  const silCache = {};
  function silhouette(fish) {
    const key = fish.id; if (silCache[key]) return silCache[key];
    const spr = fishSprite(fish.id, 0, fish.color), out = new Pix(spr.cv.width, spr.cv.height); out.g.drawImage(spr.cv, 0, 0);
    out.g.globalCompositeOperation = 'source-atop'; out.g.fillStyle = '#04141e'; out.g.fillRect(0, 0, out.cv.width, out.cv.height);
    out.len = spr.len; out.headX = spr.headX; return (silCache[key] = out);
  }
  // 구역(깊이)별로 어떤 그림자가 많이 보이는지: 얕을수록 작고 쉬운 물고기, 깊을수록 크고 어려운 물고기
  const SHADOW_BANDS = [[.1, [.7, .3, 0, 0]], [.26, [.4, .6, 0, 0]], [.42, [.1, .5, .4, 0]], [.58, [0, .2, .8, 0]], [.76, [0, 0, .65, .35]], [.92, [0, 0, .25, .75]]];
  function spawnShadows() {
    S.shadows = SHADOW_BANDS.map(([d0, w]) => { const d = clamp(d0 + rng.range(-.04, .04), 0, 1), y = depthToY(d), x = W / 2 + rng.range(-.7, .7) * halfW();
      let roll = rng(), idx = 0; for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll <= 0) { idx = i; break; } idx = i; }
      return { fish:pool[idx], x, y, hx:x, hy:y, ang:rng() < .5 ? 0 : Math.PI, ph:rng.range(0, 6.28), spd:rng.range(9, 16) }; });
  }
  function updateShadows(dt) {
    for (const sh of S.shadows) {
      sh.ang += Math.sin(time * .6 + sh.ph) * dt * 1.4; const sp = sh.spd * (sh.alert > 0 ? 3 : 1); sh.alert = Math.max(0, (sh.alert || 0) - dt);
      sh.x += Math.cos(sh.ang) * sp * dt; sh.y += Math.sin(sh.ang) * sp * dt * .45;
      const dx = sh.hx - sh.x, dy = sh.hy - sh.y; if (Math.hypot(dx, dy) > 46) sh.ang = Math.atan2(dy, dx) + Math.sin(sh.ph) * .4;
    }
  }
  function drawShadowFish(fish, x, y, heading, alpha) {
    const spr = silhouette(fish), swim = Math.sin(time * 3 + x * .05) * .08; blit(g, spr, R(x), R(y), { rot:heading + swim, alpha });
    if (fish.grade === 4 && !reduced && Math.sin(time * 3 + x) > .5) { g.save(); g.globalAlpha = .6; surf.pix.px(R(x) + 2, R(y) - 2, '#fff3a8'); g.restore(); }
  }
  function drawShadows() { for (const sh of S.shadows) drawShadowFish(sh.fish, sh.x, sh.y, Math.cos(sh.ang) >= 0 ? sh.ang : sh.ang, .3); }
  /* 입질을 기다리는 동안 이 물고기가 찌 쪽으로 다가와 기웃거리다 물어요 */
  function updateBiter(dt) {
    const b = S.biter; if (!b) return; const bite = S.bite, u = bite ? clamp(bite.t / bite.biteAt, 0, 1) : 1, e = u * u * (3 - 2 * u);
    const lunge = clamp(1 - (bite.t - bite.lastNibble) / .4, 0, 1), a = time * 1.5, near = (1 - e) * 26 + 9;
    const tx = S.floatX + Math.cos(a) * near, ty = S.floatY + Math.sin(a) * near * .55;
    const px0 = lerp(b.x0, tx, e), py0 = lerp(b.y0, ty, e);
    const nx = lerp(px0, S.floatX, lunge * .85 + (S.phase === 'bite' ? .9 : 0)), ny = lerp(py0, S.floatY + 3, lunge * .85 + (S.phase === 'bite' ? .9 : 0));
    b.heading = Math.atan2(S.floatY - ny, S.floatX - nx) + (S.phase === 'bite' ? Math.sin(time * 40) * .5 : 0); b.x = nx; b.y = ny;
  }
  function toAim() {
    S.phase = 'aim'; S.bite = null; S.fight = null; S.fish = null; S.biter = null; gradeEl.hidden = true; spawnShadows(); S.ended = false; S.reeling = false; S.dashShown = '';
    sfx.stopHum(); setCall(''); renderBait(); setHint(coarse ? '물 위를 눌러 던져요. 큰 그림자 가까이 던지면 그 물고기가 와요' : '큰 그림자 가까이에 던지면 그 물고기가 와요 (Space: 아무 데나)');
    stage.dataset.phase = 'aim';
  }
  function cast(x, y) {
    const minY = waterTop() + 40, maxY = shoreY() - 70;
    const ty = clamp(y, minY, maxY), tx = clamp(x, W / 2 - halfW() * .78, W / 2 + halfW() * .78);
    S.floatX = tx; S.floatY = ty; S.from = { x:W / 2, y:shoreY() - 36 }; S.castT = 0; S.phase = 'cast'; stage.dataset.phase = 'cast';
    // 고른 미끼는 던지는 순간 1개 씁니다(다른 탭에서 이미 써서 없다면 미끼 없이 던집니다).
    let used = null; if (baitId && progress.remove({ [baitId]:1 })) used = baitId; else baitId = null;
    let forced = null, near = null, best = 70; for (const sh of S.shadows) { const d = Math.hypot(sh.x - tx, sh.y - ty); if (d < best) { best = d; near = sh; } }
    if (near) { forced = near.fish; S.shadows = S.shadows.filter(sh => sh !== near); }
    S.bite = new BiteSession(pool, yToDepth(ty), rng, equipmentBonus(progress.state.items).biteWindow, used ? baitEffect(used) : {}, forced); S.fish = S.bite.fish;
    S.biter = { fish:S.fish, x0:near ? near.x : tx + (rng() < .5 ? -1 : 1) * rng.range(110, 170), y0:near ? near.y : ty + rng.range(-24, 24), x:0, y:0, heading:0 }; S.biter.x = S.biter.x0; S.biter.y = S.biter.y0; S.usedBait = used; setHint(''); sfx.play('cast');
    if (used) { const name = describeItem(used).name; host.say(`${name}${josa(name, '을/를')} 달아 던졌습니다.`); }; renderBait();
  }
  function afterCast() {
    S.phase = 'wait'; stage.dataset.phase = 'wait'; ring(S.floatX, S.floatY, '#ffffff', 40, 1.1); sfx.play('plop');
    setHint('찌를 지켜봐요. 까딱이는 건 가짜 입질!'); host.say('낚싯줄을 던졌습니다. 입질을 기다리는 중.');
  }
  function onHookPress() {
    if (S.phase === 'wait' || S.phase === 'bite') {
      const r = S.bite.hook();
      if (r === 'hooked') startFight();
      else if (r === 'early') endBite('early');
    }
  }
  function showGrade(fish) {
    const grade = GRADES[fish.grade] || GRADES[1], trait = TRAITS[fish.trait];
    gradeEl.innerHTML = `<b>${fish.name}</b><span class="g${fish.grade}">${grade.stars} ${grade.label}</span>${trait ? `<em>${trait.label}</em>` : ''}`; gradeEl.hidden = false;
  }
  function startFight() {
    S.phase = 'fight'; stage.dataset.phase = 'fight'; S.biter = null; S.fight = new Fight(S.fish, rng); showGrade(S.fish); S.hookedAt = time; S.maxT = 0; S.dangerSeen = false; S.reelAcc = 0;
    const startDist = S.fight.dist, dy = shoreY() - 30 - S.floatY; S.pxPerM = Math.max(14, dy / startDist);
    S.fishPos = { x:S.floatX, y:S.floatY, vx:0, vy:0 };
    // 좌우 위치는 던진 위치에서 시작
    S.fight.x = clamp((S.floatX - W / 2) / halfW(), -.6, .6);
    sfx.play('hook'); shake(7); buzz(40); burst(S.floatX, S.floatY, 18, '#ffffff', 160); ring(S.floatX, S.floatY, '#ffe9a8', 60, .6);
    setHint(coarse ? '‘감기’를 꾹 눌러 끌어와요. 물보라가 보이면 손을 떼요!' : '꾹 눌러(마우스·Space) 끌어와요. 물보라가 보이면 놓아요!', 6000); host.say('걸렸습니다! 힘겨루기 시작.');
  }
  function endBite(kind) {
    S.biter = null; S.phase = 'ending'; stage.dataset.phase = 'ending'; sfx.stopHum(); setHint('');
    const fish = S.fish;
    if (kind === 'early') { sfx.play('early'); ring(S.floatX, S.floatY, '#ff9d7a', 50, .7); setCall('너무 일찍!', 'bad', 1.6); S.endInfo = { result:'early' }; }
    else { sfx.play('lose'); setCall('놓쳤다…', 'bad', 1.6); S.endInfo = { result:'missed' }; }
    S.endT = 0; S.ended = true; S.fishName = fish.name;
  }
  function finishFight() {
    const f = S.fight; S.phase = 'ending'; stage.dataset.phase = 'ending'; sfx.stopHum(); setHint('');
    S.endInfo = { result:f.over, reason:f.reason }; S.endT = 0; S.ended = true;
    if (f.over === 'caught') { sfx.play('catch'); setTimeout(() => sfx.play('win'), 380); S.jumpT = 0; S.catchFrom = [Math.round(S.fishPos.x / PX), Math.round(S.fishPos.y / PX)]; burst(S.fishPos.x, S.fishPos.y, 30, '#ffffff', 220); setCall('낚았다!', 'win', 2); buzz(60); }
    else { sfx.play(f.over === 'snap' ? 'snap' : 'lose'); shake(f.over === 'snap' ? 14 : 5); buzz(f.over === 'snap' ? 120 : 40);
      setCall(f.over === 'snap' ? '줄이 끊어졌다!' : f.over === 'loose' ? '바늘이 빠졌다!' : '도망쳤다!', 'bad', 2); }
  }
  function showOutcome() {
    const info = S.endInfo, fish = S.fish, again = { label:'다시 던지기', primary:true, run:() => { toAim(); } }, leave = { label:'돌아가기', run:() => host.close() };
    S.ended = false;
    if (info.result === 'caught') {
      const size = rollSize(fish, rng), rec = progress.recordCatch(fish.id, size); progress.add(fish.id, 1);
      const xp = progress.addXp('fishing', fish.xp), lvl = xp.leveled ? `낚시 Lv.${xp.after.level} 달성!` : '';
      if (xp.leveled) sfx.play('level');
      host.showResult({ tone:'win', title:'낚았다!', message:`${GRADES[fish.grade].stars} ${GRADES[fish.grade].label} · ${size}cm${rec.first ? ' · 처음 낚았어요!' : rec.best === size && progress.state.caught[fish.id].count > 1 ? ' · 최대 기록!' : ''}`,
        rewards:[{ item:fish.id, n:1, note:fish.desc }], xp:`낚시 경험치 +${fish.xp}`, level:lvl, actions:[again, leave] });
    } else {
      const reasons = { early:['너무 일찍!', '가짜 입질에 속았어요. 찌가 푹 잠기고 물보라가 일 때까지 기다려요.'],
        missed:['입질을 놓쳤어요', '진짜 입질이 왔을 때 제때 누르지 못했어요. 찌가 푹 잠기면 바로 눌러요.'],
        snap:['줄이 끊어졌어요', info.reason], loose:['바늘이 빠졌어요', info.reason], escaped:['도망쳤어요', info.reason] };
      let [title, why] = reasons[info.result] || ['실패', ''];
      if (['snap', 'loose', 'escaped'].includes(info.result) && TRAITS[fish.trait]) why += ` (${fish.name}: ${TRAITS[fish.trait].label} — ${TRAITS[fish.trait].text})`;
      progress.addXp('fishing', 2);
      host.showResult({ tone:'lose', title, message:info.result === 'early' || info.result === 'missed' ? '물고기가 달아났어요.' : `${fish.name}${josa(fish.name, '은/는')} 놓쳤어요.`, detail:why, xp:'낚시 경험치 +2 (도전 보상)', actions:[again, leave] });
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
    if (down && !event.repeat && S.phase === 'aim' && /^[1-3]$/.test(event.key)) { const choice = ['', ...BAIT_IDS][Number(event.key) - 1]; pickBait(Number(event.key) === 1 ? null : choice); event.preventDefault(); return; }
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
    updateShadows(dt); if (S.biter && (S.phase === 'cast' || S.phase === 'wait' || S.phase === 'bite')) updateBiter(dt);

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
        if (ev === 'phase:telegraph') { const dir = f.dashDir; setCall(f.zig ? '◀▶ 지그재그! 놓아요' : dir < 0 ? '◀ 물보라! 놓아요' : '물보라! 놓아요 ▶', 'alert', f.teleLen + .6); sfx.play('warn'); ring(S.fishPos.x, S.fishPos.y, '#fff1a8', 54, f.teleLen + .3); buzz(25); S.dashShown = 'tele'; }
        if (ev === 'phase:dash') { burst(S.fishPos.x, S.fishPos.y, 12, '#ffffff', 190); sfx.play('splash'); shake(4); setCall('', '', .01); callEl.classList.remove('on'); }
        if (ev === 'turn') { burst(S.fishPos.x, S.fishPos.y, 16, '#ffffff', 210); ring(S.fishPos.x, S.fishPos.y, '#ffffff', 62, .5); sfx.play('splash'); shake(5); setCall(f.dashDir < 0 ? '◀ 방향 전환!' : '방향 전환! ▶', 'danger', .7); }
        if (ev === 'phase:rest') { if (!f.tired) setCall('힘을 아끼는 중 — 지금 감아요', 'info', 1.1); }
        if (ev === 'phase:tired') { setCall('지쳤다! 쭉 감아요', 'good', 1.8); sfx.play('good'); }
        if (ev === 'phase:swim' && f.stamina > .5 && S.dashShown === 'tired') { setCall('힘을 되찾았다!', 'alert', 1.2); }
      }
      if (f.phase === 'tired') S.dashShown = 'tired';
      if (f.tension > f.k.dangerT - .05 && time - S.lastWarn > .55) { S.lastWarn = time; sfx.play('warn'); buzz(15); if (f.phase !== 'telegraph') setCall('장력 위험! 놓아요', 'danger', .5); }
      if (Math.abs(f.x) > TUNING.hazardAt && time - S.lastWarn > .8) { S.lastWarn = time; setCall(f.x < 0 ? '◀ 갈대에 쓸려요! 반대로' : '갈대에 쓸려요! 반대로 ▶', 'danger', .8); }
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

  /* ---------- 그리기 (모든 좌표는 '한 칸(PX)' 단위로 환산해서 찍습니다) ---------- */
  const R = x => Math.round(x / PX);
  const BAYER = [[.125, .625], [.875, .375]];
  const reedBase = (frame) => { // 부들(갈대): 줄기 + 갈색 이삭
    const key = 'reed' + frame; if (reedBase[key]) return reedBase[key];
    const p = new Pix(9, 20), lean = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    for (let y = 0; y < 18; y++) { const x = 4 + Math.round(lean * (1 - y / 18) * 2); p.px(x, 19 - y, y % 5 === 4 ? '#6faa5e' : '#4a8a4c'); if (y > 3 && y < 9) p.px(x + (y & 1 ? 1 : -1), 19 - y, '#6faa5e'); }
    const hx = 4 + lean * 2; p.rect(hx - 1, 1, 2, 6, '#8a5a32'); p.px(hx - 1, 1, '#c28a52'); p.px(hx - 1, 2, '#c28a52'); p.px(hx, 0, '#6a4527'); p.line(hx + 1, 7, hx + 3, 11, '#4a8a4c'); p.line(hx - 2, 9, hx - 4, 12, '#4a8a4c');
    p.outline(INK); reedBase[key] = p; return p;
  };
  const padSprite = (() => { const p = new Pix(11, 8); p.ellipse(5, 4, 4.5, 3, '#5aa05a'); p.px(9, 4, '#25607a'); p.px(10, 4, '#25607a'); p.px(9, 3, '#25607a'); p.px(3, 3, '#8fd07a'); p.px(4, 3, '#8fd07a'); p.px(5, 2, '#8fd07a'); p.outline('#1a4a3a'); return p; })();
  const stoneSprite = (n) => { const p = new Pix(11 + n, 8 + (n >> 1)); p.ellipse(6 + n / 2, 4 + n / 4, 4.5 + n / 2, 3 + n / 4, '#6f7f7a'); p.ellipse(5 + n / 2, 3 + n / 4, 3 + n / 2, 2, '#98a8a2'); p.px(4 + n / 2, 2 + n / 4, '#d6e2dc'); p.outline(INK); return p; };
  const bucket = (() => { const p = new Pix(11, 12); p.poly([[2, 4], [9, 4], [8, 10], [3, 10]], '#98a8a2'); p.rect(2, 4, 7, 1, '#d6e2dc'); p.rect(3, 6, 5, 1, '#7c8a90'); p.line(2, 4, 3, 1, '#7c8a90'); p.line(8, 1, 9, 4, '#7c8a90'); p.line(3, 1, 8, 1, '#7c8a90'); p.outline(INK); return p; })();
  const starSprite = (big, color) => { const k = (big ? 7 : 5), p = new Pix(k, k), c = (k - 1) / 2; p.rect(c, 0, 1, k, color); p.rect(0, c, k, 1, color); p.px(c, c, '#ffffff'); return p; };
  const bangSprite = (() => { const p = new Pix(7, 12); p.ellipse(3, 4, 3, 4, '#ffe27a'); p.rect(2, 2, 3, 4, '#ffe27a'); p.rect(3, 2, 1, 3, INK); p.px(3, 6, INK); p.px(3, 8, '#ffe27a'); p.px(3, 9, INK); p.line(2, 8, 3, 10, '#ffe27a'); p.outline(INK); return p; })();

  function buildBg() {
    const vw = surf.vw, vh = surf.vh, sy = R(shoreY()), p = new Pix(vw, vh), w = spot.water, cx = R(W / 2), hz = R(halfW() * TUNING.hazardAt);
    const pal = [mix(w.deep, '#071a26', .3), w.deep, mix(w.deep, w.mid, .5), w.mid, mix(w.mid, w.shallow, .5), w.shallow, light(w.shallow, .14)];
    const bank = pal.map(c => mix(c, '#14382c', .6)), nb = pal.length;
    for (let y = 0; y < sy; y++) {
      const t = clamp(y / sy, 0, .999) * (nb - 1), i = Math.floor(t), f = t - i, gd = clamp((f - .3) / .4, 0, 1);
      for (let x = 0; x < vw; x++) {
        const k = clamp((Math.abs(x - cx) - hz) / 7, 0, 1), useBank = k > BAYER[y & 1][x & 1] * 1;
        const row = useBank ? bank : pal; p.px(x, y, gd > BAYER[y & 1][x & 1] ? row[i + 1] : row[i]);
      }
    }
    // 연잎·돌: 위험 구역(갈대밭) 바깥쪽 장식
    for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1, x = cx + side * (hz + 8 + hash(i * 7) * Math.max(10, vw / 2 - hz - 14)), y = 8 + hash(i * 13 + 5) * (sy - 24); if (i % 3 === 0) blit(p.g, stoneSprite(i % 3), x, y); else if (i % 3 === 1 && i % 4) blit(p.g, padSprite, x, y); }
    for (let i = 0; i < 5; i++) blit(p.g, padSprite, cx - hz + 6 + hash(i * 31) * hz * 2 - 4, 10 + hash(i * 17 + 2) * (sy * .55), { flip:i & 1 === 1 });
    // 물가(모래·거품)와 부두
    p.rect(0, sy, vw, vh - sy, '#6b5a3a'); p.rect(0, sy + 3, vw, vh - sy, '#5c4d32');
    for (let x = 0; x < vw; x++) { const yy = sy + Math.round(Math.sin(x * .45) * 1); p.px(x, yy - 1, '#dff2f0'); p.px(x, yy, '#a9ccc8'); p.px(x, yy + 1, '#8f7a4c'); }
    for (let i = 0; i < 40; i++) { const x = hash(i * 3) * vw, y = sy + 4 + hash(i * 9) * (vh - sy - 4); p.px(x, y, i % 3 ? '#8a7648' : '#4a3d28'); if (i % 7 === 0) p.px(x + 1, y, '#a89460'); }
    for (let i = 0; i < 9; i++) { const x = hash(i * 21 + 4) * vw; if (Math.abs(x - cx) < 18) continue; const y = sy + 5 + hash(i * 5) * 6; p.line(x, y, x - 1, y - 3, '#3f7a4e'); p.line(x, y, x + 1, y - 4, '#5f9a52'); p.line(x, y, x + 2, y - 2, '#3f7a4e'); }
    const dx0 = cx - 15; p.rect(dx0, sy - 3, 30, vh - sy + 3, '#a77746');
    for (let y = sy - 3, row = 0; y < vh; y += 4, row++) { p.rect(dx0, y, 30, 1, '#6a4527'); p.rect(dx0 + 1, y + 1, 28, 1, row & 1 ? '#c08a52' : '#b8834a'); p.px(dx0 + 3 + (row & 1) * 18, y + 2, '#5a3a1c'); p.px(dx0 + 26 - (row & 1) * 18, y + 2, '#5a3a1c'); }
    p.rect(dx0, sy - 3, 1, vh, INK); p.rect(dx0 + 29, sy - 3, 1, vh, INK); p.rect(dx0, sy - 4, 30, 1, INK);
    for (const x of [dx0 - 1, dx0 + 28]) { p.rect(x, sy - 6, 3, 8, '#4a2f17'); p.rect(x, sy - 6, 3, 1, '#8a5a32'); p.rect(x - 1, sy - 6, 1, 8, INK); p.rect(x + 3, sy - 6, 1, 8, INK); }
    blit(p.g, bucket, dx0 + 36, sy + 8);
    return p;
  }

  function sampleCurve(x0, y0, cx_, cy_, x1, y1, n) { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; pts.push([a * x0 + b * cx_ + c * x1, a * y0 + b * cy_ + c * y1]); } return pts; }
  function polyline(pts, color, thick = 1) { const p = surf.pix; for (let i = 0; i < pts.length - 1; i++) { p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color); if (thick > 1) p.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], color); } }

  function rodTip() {
    const f = S.fight, sy = shoreY(), cx = W / 2;
    const bend = f ? f.tension : 0, lean = (S.lean || 0) * 26;
    const bx = cx, by = sy + 18, tx = cx + lean + (f ? clamp(f.x, -1, 1) * 22 : 0) * .6, ty = sy - 116 + bend * 14;
    return { bx, by, tx, ty, bend };
  }
  function lineColor(T) { return T < .6 ? '#f7f3e6' : T < .82 ? '#ffd778' : T < .92 ? '#ff9d4a' : '#ff4a3c'; }
  function drawRod() {
    const r = rodTip(), p = surf.pix, B = [R(r.bx), R(r.by)], T = [R(r.tx), R(r.ty)];
    const wob = S.reeling && r.bend > .75 && !reduced ? Math.round(Math.sin(time * 70)) : 0;
    const side = Math.sign((S.fight?.x || 0) + (S.lean || 0) * .6) || 1, ctl = [(B[0] + T[0]) / 2 - r.bend * 5 * side * -1 * .6, (B[1] + T[1]) / 2 + r.bend * 3];
    const pts = sampleCurve(B[0], B[1], ctl[0], ctl[1], T[0] + wob, T[1], 22);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) polyline(pts.map(([x, y]) => [x + ox, y + oy]), INK, 2);
    polyline(pts, '#8a5a32', 2); polyline(pts.slice(7).map(([x, y]) => [x, y]), '#d19a60', 1); polyline(pts.slice(0, 7), '#5a3a1c', 2);
    for (const i of [6, 12, 17]) p.rect(pts[i][0], pts[i][1], 2, 1, '#f0d890');
    p.disc(pts[pts.length - 1][0], pts[pts.length - 1][1], 1, '#f0d890'); // 낚싯대 끝 고리
    for (const i of [1, 3, 5]) p.rect(pts[i][0] - 1, pts[i][1], 3, 1, '#bc8555');
    // 릴
    const rx = B[0] - 4, ry = B[1] - 5; p.disc(rx, ry, 4, INK); p.disc(rx, ry, 3, '#c5d0d2'); p.disc(rx, ry, 1, '#7c8e92');
    const k = S.reeling ? Math.floor(time * 20) % 4 : 0, hx = [[0, -3], [3, 0], [0, 3], [-3, 0]][k]; p.px(rx + hx[0], ry + hx[1], INK); p.px(rx + hx[0] * .7, ry + hx[1] * .7, '#ffe27a');
    return { ...r, vx:T[0] + wob, vy:T[1] };
  }
  function drawLine(r, ex, ey, T, slack = 0) { // ex,ey: 화면 좌표(CSS px)
    const p = surf.pix, tx = r.vx, ty = r.vy, X = R(ex), Y = R(ey), mx = (tx + X) / 2, my = (ty + Y) / 2;
    const sag = (1 - clamp(T * 1.6, 0, 1)) * (13 + slack * 10) * (X > tx ? 1 : -1) + (S.fight ? 0 : 2), vib = Math.max(0, T - .55) * 2 * Math.sin(time * 60) * (reduced ? 0 : 1);
    const pts = sampleCurve(tx, ty, mx + sag + vib, my + (T < .3 ? 4 : 0), X, Y, Math.max(8, Math.round(Math.hypot(X - tx, Y - ty) / 2)));
    if (T > .86) polyline(pts.map(([x, y]) => [x - 1, y]), '#ff3b2a55'.slice(0, 7), 1);
    polyline(pts, lineColor(T), T > .88 ? 2 : 1);
    return pts;
  }
  function drawFloat(x, y, bite, submerge = 0) {
    const X = R(x), Y = R(y + clamp(S.floatDip, -4, 26) * 0 + Math.sin(time * 2.2) * 1.2) + Math.round(clamp(S.floatDip, -4, 40) / PX) + (bite ? 3 : 0) + submerge;
    const p = surf.pix; g.save(); g.beginPath(); g.rect(0, 0, surf.vw, Y + 3); g.clip();
    p.ellipse(X, Y + 3, 4, 1.5, '#0a2a3a'); // 물속 그림자
    p.rect(X, Y - 8, 1, 3, INK); p.px(X, Y - 9, '#ffe27a'); // 안테나
    p.ellipse(X, Y - 2, 3, 4, INK); p.ellipse(X, Y - 2, 2, 3, '#f7f3e6'); p.rect(X - 2, Y - 5, 5, 2, '#e0503c'); p.px(X - 1, Y - 5, '#ff9d8a'); p.rect(X - 2, Y - 3, 5, 1, INK);
    g.restore();
  }
  function drawFish(x, y, heading, fish, bendIdx, alpha = 1, scale = 1) {
    const spr = fishSprite(fish.id, bendIdx, fish.color); blit(g, spr, R(x), R(y), { rot:heading, alpha, scale });
    return spr;
  }
  const mouthOf = (x, y, heading, spr) => { const d = (spr.headX - spr.w / 2) * 1; return [x + Math.cos(heading) * d * PX, y + Math.sin(heading) * d * PX]; };

  function drawWater() {
    paintScene(g, bg.cv, R(shoreY())); const p = surf.pix, vw = surf.vw, sy = R(shoreY());
    // 물결 무늬와 반짝임
    for (let i = 0; i < 46; i++) { const sp = 2 + hash(i * 3) * 4, x = ((hash(i * 11) * (vw + 30) + time * sp * (i & 1 ? 1 : -1)) % (vw + 30) + (vw + 30)) % (vw + 30) - 15, y = 4 + hash(i * 5 + 1) * (sy - 10), w = 3 + Math.floor(hash(i * 7) * 5); p.g.globalAlpha = i % 3 ? .2 : .28; p.rect(x, y, w, 1, i % 3 ? '#e9fbff' : '#06202e'); }
    p.g.globalAlpha = 1;
    for (let i = 0; i < 14; i++) { const a = (Math.sin(time * 1.6 + i * 2.3) + 1) / 2; if (a < .7) continue; const x = hash(i * 17) * vw, y = 4 + hash(i * 23 + 3) * (sy - 12); p.px(x, y, '#ffffff'); p.px(x - 1, y, '#ffffff88'); p.px(x + 1, y, '#ffffff88'); p.px(x, y - 1, '#ffffff88'); p.px(x, y + 1, '#ffffff88'); }
    drawShadows();
    // 갈대밭(위험 구역): 물고기가 그쪽으로 몰리면 노란 표시와 함께 거세게 흔들립니다
    const cx = W / 2, hz = halfW() * TUNING.hazardAt;
    for (const side of [-1, 1]) {
      const hot = S.fight && Math.abs(S.fight.x) > TUNING.hazardAt && Math.sign(S.fight.x) === side, ex = R(cx + side * hz), edge = hot ? (Math.floor(time * 12) & 1 ? '#fff3a8' : '#ffb13c') : '#cfe9a8';
      p.g.globalAlpha = hot ? 1 : .4; for (let y = 4; y < sy - 2; y += 4) p.rect(ex, y, 1, hot ? 3 : 2, edge); p.g.globalAlpha = 1;
      for (let i = 0; i < 20; i++) {
        const x = cx / PX + side * (hz / PX + 5 + hash(i * 7 + (side > 0 ? 91 : 0)) * Math.max(8, vw / 2 - hz / PX - 9)), y = 12 + hash(i * 13 + (side > 0 ? 37 : 0)) * (sy - 14), ph = Math.sin(time * (hot ? 11 : 1.5) + i * 1.9);
        blit(g, reedBase(ph > .35 ? 1 : ph < -.35 ? 2 : 0), x, y - 10);
      }
    }
  }
  function drawDialPx() {
    const f = S.fight, K = f ? f.k : TUNING, d = dial(), cx = R(d.x), cy = R(d.y), rr = 15, p = surf.pix, T = f ? f.tension : 0;
    const hotLevel = f ? clamp(f.strain / K.snapStrain, 0, 1) : 0;
    p.disc(cx, cy, rr + 3, INK); p.disc(cx, cy, rr + 2, hotLevel > .05 && (Math.floor(time * 14) & 1) ? '#8a2a20' : '#c9a24a'); p.disc(cx, cy, rr + 1, INK); p.disc(cx, cy, rr, '#142a21');
    const a0 = Math.PI * .78, a1 = Math.PI * 2.22, N = 22, zones = [[0, K.sweetLow, '#5b8aa6'], [K.sweetLow, K.sweetHigh, '#6fb36a'], [K.sweetHigh, K.dangerT, '#e0a53c'], [K.dangerT, 1.02, '#e0503c']];
    for (let i = 0; i < N; i++) { const t = i / (N - 1), a = lerp(a0, a1, t), z = zones.find(zz => t >= zz[0] && t < zz[1]) || zones[3], on = t <= T + .001; p.g.globalAlpha = on ? 1 : .42; const x = cx + Math.cos(a) * (rr - 4), y = cy + Math.sin(a) * (rr - 4); p.rect(x - 1, y - 1, 2, 2, z[2]); }
    p.g.globalAlpha = 1;
    const jit = f && T > .85 && !reduced ? Math.sin(time * 70) * .03 : 0, ang = lerp(a0, a1, clamp(T + jit, 0, 1));
    p.line(cx, cy, cx + Math.cos(ang) * (rr - 6), cy + Math.sin(ang) * (rr - 6), '#fff5d6'); p.disc(cx, cy, 2, '#fff5d6'); p.px(cx, cy, INK);
    if (T > K.dangerT - .05 && !reduced && (Math.floor(time * 10) & 1)) text(g, '!', cx, cy + 3, '#ff8a72', INK);
  }

  function drawFightScene(r) {
    const f = S.fight, fp = S.fishPos, T = f.tension, p = surf.pix, fish = S.fish;
    const toRod = Math.atan2(r.ty - fp.y, r.tx - fp.x);
    let heading = toRod + Math.sin(time * 1.3) * .3;
    if (f.phase === 'dash') heading = toRod - f.dashDir * .95 + Math.sin(time * 30) * .08; else if (f.phase === 'telegraph') heading = toRod - f.dashDir * .5 + Math.sin(time * 40) * .06; else if (f.phase === 'tired') heading = toRod + .15; else if (f.phase === 'rest') heading = toRod + Math.sin(time * .8) * .1;
    const act = f.phase === 'dash' ? 26 : f.phase === 'telegraph' ? 18 : f.phase === 'tired' ? 3 : f.phase === 'rest' ? 4 : 10, bend = Math.sin(time * act);
    const bendIdx = bend > .45 ? 1 : bend < -.45 ? -1 : 0, alpha = f.phase === 'tired' ? .75 : 1;
    const spr = fishSprite(fish.id, bendIdx, fish.color), mouth = mouthOf(fp.x, fp.y, heading, spr);
    drawLine(r, mouth[0], mouth[1], T, f.loose / f.k.looseLimit);
    const X = R(fp.x), Y = R(fp.y);
    // 돌진 신호: 물보라 링과 방향 화살표, 머리 위 느낌표
    if (f.phase === 'telegraph') {
      const k = f.tele; for (let i = 0; i < 3; i++) { const t = (k * 2 + i / 3) % 1; p.g.globalAlpha = (1 - t) * .9; p.ring(X, Y, 5 + t * 15, 3 + t * 9, '#fff1a8'); } p.g.globalAlpha = 1;
      for (const dx of f.zig ? [-1, 1] : [f.dashDir]) for (let i = 0; i < 3; i++) { const ox = X + dx * (14 + i * 6 + Math.floor(k * 4)); p.g.globalAlpha = .45 + .2 * i; for (let j = 0; j < 4; j++) p.rect(ox - dx * j, Y - 3 + j, 1, 7 - j * 2, f.zig ? '#ffb86a' : '#fff1a8'); } p.g.globalAlpha = 1;
      blit(g, bangSprite, X, Y - R(fish.tier === 'special' ? 20 * PX : 14 * PX) - Math.abs(Math.sin(time * 14)) * 2);
    }
    if (f.phase === 'dash') { for (let i = 0; i < 5; i++) { const t = (time * 3 + i * .2) % 1; p.g.globalAlpha = (1 - t) * .8; p.rect(X - f.dashDir * (6 + t * 24), Y + (i - 2) * 3, 4 + t * 4, 1, '#ffffff'); } p.g.globalAlpha = 1; }
    blit(g, spr, X, Y, { rot:heading, alpha });
    if (fish.tier === 'special' && !reduced) { const k = (Math.sin(time * 4) + 1) / 2; if (k > .6) blit(g, starSprite(false, '#fff3a8'), X + Math.cos(time * 3) * 13, Y + Math.sin(time * 2.2) * 9); }
    text(g, `${Math.max(0, f.dist).toFixed(1)}m`, X, Y + 11 + Math.round(spr.len / 3), '#eaf6ff', INK);
    if (f.phase === 'tired') for (let i = 0; i < 3; i++) { const t = ((time * .9 + i / 3) % 1); p.px(X + 9 + i * 3, Y - 10 - t * 8, '#bfe8ff'); p.px(X + 9 + i * 3, Y - 9 - t * 8, '#7ec0e8'); }
    if (T > f.k.dangerT - .02 && !reduced && (Math.floor(time * 12) & 1)) { const col = '#e0503c'; p.g.globalAlpha = .75; p.rect(0, 0, surf.vw, 2, col); p.rect(0, surf.vh - 2, surf.vw, 2, col); p.rect(0, 0, 2, surf.vh, col); p.rect(surf.vw - 2, 0, 2, surf.vh, col); p.g.globalAlpha = 1; }
  }
  function draw() {
    const p = surf.pix; g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, surf.vw, surf.vh);
    if (S.shake > 0 && !reduced) canvas.style.transform = `translate(${Math.round((Math.random() - .5) * S.shake / PX) * PX}px,${Math.round((Math.random() - .5) * S.shake / PX) * PX}px)`; else if (canvas.style.transform) canvas.style.transform = '';
    drawWater();
    if (S.phase === 'aim') { // 던질 수 있는 구역 안내선과 조준
      const sy = shoreY(), top = waterTop(); p.g.globalAlpha = .5;
      for (const d of [.33, .66]) { const y = R(depthToY(d)); for (let x = R(W / 2 - halfW() * .8); x < R(W / 2 + halfW() * .8); x += 5) p.rect(x, y, 3, 1, '#e9fbff'); } p.g.globalAlpha = 1;
      if (S.mouse.in && !coarse) { const my = R(clamp(S.mouse.y, top + 40, sy - 70)), mx = R(clamp(S.mouse.x, W / 2 - halfW() * .78, W / 2 + halfW() * .78)), pulse = 5 + Math.round(Math.sin(time * 5) * 1); p.ring(mx, my, pulse, pulse * .6, '#fff4c8'); p.px(mx, my, '#fff4c8'); for (const [ox, oy] of [[0, -pulse - 2], [0, pulse], [-pulse - 2, 0], [pulse, 0]]) p.rect(mx + ox, my + oy * .6, 1, 1, '#fff4c8'); }
    }
    for (const rg of S.rings) { const k = rg.t / rg.dur; p.g.globalAlpha = (1 - k) * .9; p.ring(R(rg.x), R(rg.y), rg.max / PX * k, rg.max / PX * k * .55, rg.color); } p.g.globalAlpha = 1;
    const r = drawRod();
    if (S.phase === 'cast') {
      const k = clamp(S.castT / .55, 0, 1), e = 1 - Math.pow(1 - k, 2), x = lerp(r.tx, S.floatX, e), y = lerp(r.ty, S.floatY, e) - Math.sin(k * Math.PI) * 90;
      if (S.biter) drawShadowFish(S.biter.fish, S.biter.x, S.biter.y, S.biter.heading || 0, .4);
      drawLine(r, x, y, .3); p.disc(R(x), R(y), 2, INK); p.disc(R(x), R(y), 1, '#f7f3e6');
    } else if (S.phase === 'wait' || S.phase === 'bite') {
      if (S.biter) drawShadowFish(S.biter.fish, S.biter.x, S.biter.y, S.biter.heading, S.phase === 'bite' ? .62 : .48);
      if (S.phase === 'bite') { const k = (Math.floor(time * 10) & 1); p.ring(R(S.floatX), R(S.floatY), 8 + k, 5 + k, '#ffe08a'); blit(g, bangSprite, R(S.floatX), R(S.floatY) - 17 - Math.abs(Math.sin(time * 16)) * 2); }
      drawLine(r, S.floatX, S.floatY, .12 + (S.phase === 'bite' ? .3 : 0)); drawFloat(S.floatX, S.floatY, S.phase === 'bite');
    } else if (S.phase === 'fight') drawFightScene(r);
    else if (S.phase === 'ending') {
      const info = S.endInfo, fish = S.fish, fp = S.fishPos;
      if (info.result === 'caught') {
        const k = clamp(S.endT / 1.1, 0, 1), cxv = R(W / 2) + 9, land = [cxv, R(shoreY()) + 9], from = S.catchFrom || [R(fp.x), R(fp.y)];
        if (k < 1) { const e = 1 - Math.pow(1 - k, 2), x = lerp(from[0], land[0], e), y = lerp(from[1], land[1], e) - Math.sin(k * Math.PI) * 26, spr = fishSprite(fish.id, Math.floor(time * 18) % 2 ? 1 : -1, fish.color); drawLine(r, x * PX, y * PX, .6); blit(g, spr, x, y, { rot:k * TAU * 1.5 - Math.PI / 2 }); }
        else { const hop = Math.abs(Math.sin(S.endT * 9)) * Math.max(0, 1 - (S.endT - 1.1) * 1.2) * 4, spr = fishSprite(fish.id, Math.floor(time * 14) % 2 ? 1 : -1, fish.color); p.ellipse(land[0], land[1] + 4, spr.len / 3, 1.5, '#00000044'); blit(g, spr, land[0], land[1] - hop, { rot:Math.sin(S.endT * 22) * .12 }); }
        const stars = Math.min(6, Math.floor(S.endT * 9)); for (let i = 0; i < stars; i++) { const a = i / 6 * TAU + S.endT * 1.5, rad = 10 + (S.endT * 30) % 18; if (S.endT < 1.4) blit(g, starSprite(i % 2 === 0, i % 3 ? '#fff3a8' : '#ffffff'), land[0] + Math.cos(a) * rad, land[1] - 6 + Math.sin(a) * rad * .8); }
      } else if (info.result === 'snap') { // 줄이 끊어져 낚싯대 끝에서 흩날림
        const pts = sampleCurve(r.vx, r.vy, r.vx + 4, r.vy + 8, r.vx + 7 + S.endT * 6, r.vy + 16 + S.endT * 8, 8); polyline(pts, '#ff4a3c', 1);
        if (S.endT < .9) { const spr = fishSprite(fish.id, Math.floor(time * 20) % 2 ? 1 : -1, fish.color); blit(g, spr, R(fp.x), R(fp.y) - S.endT * 70 / PX, { rot:-Math.PI / 2 + Math.sin(S.endT * 20) * .4, alpha:1 - S.endT }); }
      } else if (info.result === 'early' || info.result === 'missed') {
        const spr = fishSprite(fish.id, Math.floor(time * 16) % 2 ? 1 : -1, fish.color); blit(g, spr, R(S.floatX) + Math.sin(S.endT * 5) * 3, R(S.floatY) - S.endT * 30 / PX, { rot:-Math.PI / 2, alpha:clamp(1 - S.endT * .8, 0, 1) });
        drawFloat(S.floatX, S.floatY, false); if (info.result === 'early') p.line(r.vx, r.vy, R(S.floatX), R(S.floatY) - 12, '#f7f3e6'); else drawLine(r, S.floatX, S.floatY, .1);
      } else { // 바늘이 빠지거나 도망침: 낚싯대 끝에서 줄이 힘없이 늘어짐
        const pts = sampleCurve(r.vx, r.vy, r.vx + 2, r.vy + 10, r.vx + 3, r.vy + 22 + Math.sin(S.endT * 6) * 2, 8); polyline(pts, '#f7f3e6', 1);
        if (S.endT < 1.1) { const spr = fishSprite(fish.id, Math.floor(time * 20) % 2 ? 1 : -1, fish.color); blit(g, spr, R(fp.x), R(fp.y) - S.endT * 60 / PX, { rot:-Math.PI / 2, alpha:clamp(1 - S.endT * .9, 0, 1) }); }
      }
    }
    for (const q of S.particles) { p.g.globalAlpha = clamp(q.life / q.max, 0, 1); p.rect(q.x / PX, q.y / PX, Math.max(1, Math.round(q.size / PX / 1.4)), Math.max(1, Math.round(q.size / PX / 1.4)), q.color); } p.g.globalAlpha = 1;
    if (S.phase === 'fight') drawDialPx();
    if (S.flash > 0) { p.g.globalAlpha = S.flash; p.rect(0, 0, surf.vw, surf.vh, '#ffffff'); p.g.globalAlpha = 1; }
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

  const chip = (t, cls = '') => `<span class="demo-chip ${cls}">${t}</span>`, key = t => `<span class="demo-key">${t}</span>`;
  const game = {
    tutorial:{ title:'낚시', pages:[
      { title:'물속 그림자 보고 던지기', demo:chip('작은 그림자 · 쉬움') + chip('큰 그림자 · 어려움', 'warn') + chip('멀리 = 최고 난도', 'bad'), text:'물속에 <b>물고기 그림자</b>가 헤엄쳐요. 그림자 가까이에 던지면 그 물고기가 와요. 크고 먼 곳일수록 귀하지만 훨씬 어려워요(★ 1~4).' },
      { title:'입질과 챔질', demo:chip('까딱… 가짜', 'bad') + chip('푹! 진짜', 'ok') + key('Space'), text:'찌가 <b>푹 잠기고 물보라</b>가 일 때 눌러요. 일찍 누르면 도망쳐요.' },
      { title:'당기기와 놓기', demo:key('꾹') + chip('감기 · 장력↑') + key('뗌') + chip('풀기 · 장력↓'), text:'누르는 동안 감겨요. 장력 바늘이 <b>빨간 구역</b>에 오래 있으면 줄이 끊어지고, 너무 오래 풀어 두면 바늘이 빠져요.' },
      { title:'물보라 = 돌진 신호', demo:chip('! 물보라', 'warn') + chip('돌진 → 놓기', 'bad') + chip('끝나면 다시 감기', 'ok'), text:'물고기가 <b>!</b> 표시와 물보라를 보이면 곧 돌진해요. 손을 떼고, 지쳐서 힘이 빠질 때 쭉 감아 올려요. <b>◀▶ 표시</b>는 돌진 도중 방향을 바꾸는 지그재그예요.' },
      { title:'좌우 방향 잡기', demo:key('←') + key('→') + key('A') + key('D') + chip('끌기'), text:'물고기가 <b>갈대밭</b>으로 쏠리면 줄이 쓸려요. 반대 방향으로 기울여 가운데로 돌려요.' },
    ] },
    busy: () => S.phase === 'fight' || S.phase === 'bite',
    leaveWarning: () => '힘겨루기 중이에요. 지금 나가면 물고기를 놓쳐요.',
    pause: () => { paused = true; sfx.stopHum(); }, resume: () => { paused = false; }, layerClosed: () => { paused = false; },
    abort: () => { sfx.stopHum(); },
    destroy: () => { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); sfx.stopHum(); },
    debug: () => ({ phase:S.phase, fish:S.fish?.id, tension:S.fight?.tension, dist:S.fight?.dist, fightPhase:S.fight?.phase, x:S.fight?.x }),
    _S: S, _cast: cast, _toAim: toAim,
  };
  return game;
}
