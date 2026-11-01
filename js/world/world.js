import { villageMap } from './map-data.js';
import { places } from './place-data.js';
import { npcs } from './npc-data.js';
import { readSave } from '../storage.js';

const $ = id => document.getElementById(id);
const app = $('world'), dialog = $('npc-dialog');
const preferences = readSave(), motion = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => preferences.reducedMotion || motion.matches;
let current = 'map', generation = 0, typingTimer = 0, npcEntries = [];
let activeNpc = null, lineIndex = 0, typing = false, fullText = '', returnTarget = null;
const bounded = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

function loadImage(image, source, fallback) {
  image.hidden = false; if (fallback) fallback.hidden = true;
  image.onload = () => { image.hidden = false; if (fallback) fallback.hidden = true; };
  image.onerror = () => { image.hidden = true; if (fallback) fallback.hidden = false; };
  image.src = source;
}
function stopIdle() { npcEntries = []; }
function clearTyping() { clearInterval(typingTimer); typingTimer = 0; }
function setStatus(message) { $('world-status').textContent = message; }
function routeValue() { const value = location.hash.slice(1); return places[value] ? value : 'map'; }
function setHash(value, replace = false) {
  if (location.hash !== '#' + value) history[replace ? 'replaceState' : 'pushState'](null, '', '#' + value);
}
function mountMap() {
  $('map-subtitle').textContent = villageMap.subtitle;
  loadImage($('map-art'), villageMap.background, $('map-fallback'));
  $('map-art').alt = villageMap.alt;
  for (const location of villageMap.locations) {
    const place = places[location.placeId]; if (!place) continue;
    const button = document.createElement('button');
    button.className = 'mv-map-marker';
    button.style.left = bounded(location.x, 5, 95, 50) + '%';
    button.style.top = bounded(location.y, 8, 92, 50) + '%';
    button.setAttribute('aria-label', place.name + ' 들어가기');
    button.title = place.name;
    const pin = document.createElement('span'); pin.className = 'mv-marker-pin'; pin.textContent = '♧'; pin.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.className = 'mv-marker-name'; label.textContent = place.name;
    button.append(pin, label); button.addEventListener('click', () => navigate(place.id));
    $('map-markers').append(button);
    const card = document.createElement('button'); card.className = 'mv-place-card';
    const title = document.createElement('strong'); title.textContent = place.name;
    const info = document.createElement('span'); info.textContent = (place.hours ? place.hours + ' · ' : '') + place.purpose;
    const arrow = document.createElement('b'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    card.append(title, info, arrow); card.addEventListener('click', () => navigate(place.id));
    $('place-list').append(card);
  }
}
// ---- NPC 표시 (모든 NPC 공통) -------------------------------------------------
// 정면 도트 한 장만 사용하고, 캐릭터 키는 장소 화면 높이에 대한 비율로 통일합니다.
// 도트가 흐려지지 않도록 화면의 실제 픽셀(DPR) 기준 정수 배율로 맞춥니다.
const SPRITE_HEIGHT_RATIO = 0.23;
const spriteMetrics = new Map();
const devicePixels = () => window.devicePixelRatio || 1;
function measureSprite(image) {
  const key = image.currentSrc || image.src;
  if (spriteMetrics.has(key)) return spriteMetrics.get(key);
  const w = image.naturalWidth, h = image.naturalHeight;
  let box = { left: Math.round(w * .25), right: Math.round(w * .75) - 1, top: Math.round(h * .1), bottom: Math.round(h * .95) };
  try {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, w, h).data;
    let left = w, right = -1, top = h, bottom = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 8) {
      if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; bottom = y;
    }
    if (right >= 0) box = { left, right, top, bottom };
  } catch { /* 이미지를 읽을 수 없으면 기본값 사용 */ }
  const metrics = { w, h, ...box };
  spriteMetrics.set(key, metrics);
  return metrics;
}
function placeNpc(entry) {
  const m = entry.metrics; if (!m) return;
  const layer = $('npc-layer'), ratio = devicePixels();
  const layerWidth = layer.clientWidth, layerHeight = layer.clientHeight; if (!layerWidth || !layerHeight) return;
  const contentHeight = m.bottom - m.top + 1, contentWidth = m.right - m.left + 1;
  const wanted = layerHeight * SPRITE_HEIGHT_RATIO * (entry.npc.layout.spriteScale || 1);
  const raw = wanted * ratio / contentHeight;          // 원본 1픽셀이 화면 몇 픽셀이 되는지
  const smooth = raw < .35;                             // 도트가 아닌 큰 이미지만 부드럽게
  const scale = raw >= .75 ? Math.max(1, Math.round(raw)) : raw >= .35 ? .5 : raw;
  const px = value => Math.round(value * ratio) / ratio;
  const css = n => n * scale / ratio;
  const footFraction = Number.isFinite(entry.npc.layout.spriteFootY) ? entry.npc.layout.spriteFootY : (m.bottom + 1) / m.h;
  const centerX = (m.left + m.right + 1) / 2;
  const imageWidth = css(m.w), imageHeight = css(m.h);
  const feetX = px(entry.position.x / 100 * layerWidth), feetY = px(entry.position.y / 100 * layerHeight);
  const originX = feetX - css(centerX), originY = feetY - imageHeight * footFraction;
  // 클릭 영역은 캐릭터 몸에 맞추되 손가락으로 누르기 쉽게 최소 44px을 보장합니다.
  const pad = 4, minSize = 44;
  let boxW = css(contentWidth) + pad * 2, boxH = css(contentHeight) + pad * 2;
  let boxX = originX + css(m.left) - pad, boxY = originY + css(m.top) - pad;
  if (boxW < minSize) { boxX -= (minSize - boxW) / 2; boxW = minSize; }
  if (boxH < minSize) { boxY -= (minSize - boxH) / 2; boxH = minSize; }
  Object.assign(entry.button.style, { left: px(boxX) + 'px', top: px(boxY) + 'px', width: px(boxW) + 'px', height: px(boxH) + 'px' });
  Object.assign(entry.image.style, { left: px(originX - boxX) + 'px', top: px(originY - boxY) + 'px', width: px(imageWidth) + 'px', height: px(imageHeight) + 'px', imageRendering: smooth ? 'auto' : 'pixelated' });
  // 그림자는 발끝 높이에 맞춰 캐릭터 몸 너비 기준으로 그립니다.
  const shadowWidth = css(contentWidth) * .95, shadowHeight = Math.max(5, shadowWidth * .2);
  Object.assign(entry.shadow.style, { left: px(originX - boxX + css(centerX) - shadowWidth / 2) + 'px', top: px(feetY - boxY - shadowHeight * .55) + 'px', width: px(shadowWidth) + 'px', height: px(shadowHeight) + 'px' });
  Object.assign(entry.bubble.style, { left: px(originX - boxX + css(centerX)) + 'px', top: px(originY - boxY + css(m.top) - 30) + 'px' });
}
function layoutNpcs() { npcEntries.forEach(placeNpc); }
function mountNpcs(place) {
  stopIdle(); $('npc-layer').replaceChildren();
  for (const position of place.npcs) {
    const npc = npcs[position.npcId]; if (!npc) continue;
    const button = document.createElement('button'); button.className = 'mv-npc';
    button.setAttribute('aria-label', npc.name + '에게 말 걸기');
    const shadow = document.createElement('span'); shadow.className = 'mv-npc-shadow'; shadow.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img'); image.alt = npc.sprite.alt; image.draggable = false;
    const fallback = document.createElement('span'); fallback.className = 'mv-npc-fallback'; fallback.textContent = '?'; fallback.hidden = true;
    const bubble = document.createElement('span'); bubble.className = 'mv-npc-bubble'; bubble.textContent = '대화'; bubble.setAttribute('aria-hidden', 'true');
    button.append(shadow, image, fallback, bubble);
    button.addEventListener('click', () => openDialogue(npc, button));
    $('npc-layer').append(button);
    const entry = { npc, position, button, image, shadow, bubble, metrics: null };
    npcEntries.push(entry);
    image.onload = () => { image.hidden = false; fallback.hidden = true; entry.metrics = measureSprite(image); button.classList.remove('mv-npc-broken'); placeNpc(entry); };
    image.onerror = () => {
      // 이미지가 없어도 자리 표시로 대화는 계속할 수 있게 합니다.
      image.hidden = true; shadow.hidden = true; fallback.hidden = false; button.classList.add('mv-npc-broken');
      const layer = $('npc-layer');
      Object.assign(button.style, { width: '64px', height: '64px', left: Math.round(position.x / 100 * layer.clientWidth - 32) + 'px', top: Math.round(position.y / 100 * layer.clientHeight - 64) + 'px' });
      Object.assign(bubble.style, { left: '32px', top: '-30px' });
    };
    image.src = npc.sprite.src;
  }
}
function render(value) {
  current = value;
  app.dataset.view = value === 'map' ? 'map' : 'place';
  $('map-view').hidden = value !== 'map';
  $('place-view').hidden = value === 'map';
  $('world-map-back').hidden = value === 'map';
  if (value === 'map') {
    stopIdle(); setStatus('미스트베일 마을 지도');
    $('map-markers').querySelector('button')?.focus({preventScroll:true});
  } else {
    const place = places[value];
    $('place-title').textContent = place.name;
    $('place-category').textContent = place.category;
    $('place-hours').hidden = !place.hours;
    $('place-hours').textContent = place.hours ? '영업시간 ' + place.hours : '';
    $('place-purpose').textContent = place.purpose;
    $('place-description').textContent = place.description;
    $('place-art').alt = place.alt;
    loadImage($('place-art'), place.background, $('place-fallback'));
    mountNpcs(place); setStatus(place.name + '. 인물을 선택하면 대화가 열립니다.');
    $('place-title').focus({preventScroll:true});
  }
}
async function navigate(value, { fromHistory = false, immediate = false } = {}) {
  const target = places[value] ? value : 'map', ticket = ++generation;
  if (dialog.open) { returnTarget = null; dialog.close(); clearTyping(); }
  stopIdle(); app.inert = false; app.classList.add('mv-changing'); app.setAttribute('aria-busy', 'true');
  app.inert = true;
  if (!immediate && !reduced()) await new Promise(resolve => setTimeout(resolve, 220));
  if (ticket !== generation) return;
  if (!fromHistory) setHash(target);
  app.inert = false; render(target);
  app.classList.remove('mv-changing'); app.removeAttribute('aria-busy');
}
function finishLine() {
  clearTyping(); typing = false; $('npc-text').textContent = fullText;
  $('dialog-next').textContent = lineIndex === activeNpc.dialogue.length - 1 ? '대화 마치기 ✓' : '다음 대사 ▸';
  liftStage();
}
function showLine() {
  clearTyping();
  const line = activeNpc.dialogue[lineIndex];
  fullText = line.text;
  $('npc-accessible-text').textContent = activeNpc.name + ': ' + fullText;
  const portrait = $('npc-portrait');
  if (portrait.dataset.src !== activeNpc.portrait.src) { portrait.dataset.src = activeNpc.portrait.src; loadImage(portrait, activeNpc.portrait.src, $('portrait-fallback')); }
  portrait.alt = activeNpc.portrait.alt;
  portrait.style.objectFit = activeNpc.layout.portraitFit || 'contain';
  portrait.style.objectPosition = activeNpc.layout.portraitPosition || 'center';
  const speed = { slow:65, normal:35, fast:16, instant:0 }[preferences.speed] ?? 35;
  if (!speed || reduced()) { finishLine(); return; }
  let count = 0; typing = true; $('npc-text').textContent = '';
  $('dialog-next').textContent = '즉시 표시 ▸';
  typingTimer = setInterval(() => {
    $('npc-text').textContent = fullText.slice(0, ++count);
    if (count >= fullText.length) finishLine();
  }, speed);
}
function openDialogue(npc, source) {
  if (dialog.open || !npc.dialogue?.length) return;
  activeNpc = npc; lineIndex = 0; returnTarget = source;
  $('npc-name').textContent = npc.name; $('npc-note').textContent = npc.note;
  $('npc-portrait').dataset.src = ''; $('place-view').classList.add('mv-talking');
  dialog.showModal(); showLine(); $('dialog-next').focus({preventScroll:true});
  requestAnimationFrame(liftStage);
}
// 대화창이 장소 화면의 캐릭터를 가리면, 캐릭터가 보일 만큼만 장면을 위로 올립니다.
function liftStage() {
  const view = $('place-view');
  if (!dialog.open || current === 'map' || !returnTarget?.isConnected) { view.style.translate = ''; return; }
  // 이미 올라간 만큼을 빼서 '원래 위치' 기준으로 계산합니다(호출이 반복돼도 값이 흔들리지 않게).
  const shift = parseFloat((getComputedStyle(view).translate || '').split(' ')[1]) || 0;
  const rect = returnTarget.getBoundingClientRect(); if (!rect.width) return;
  const sprite = { left: rect.left, right: rect.right, top: rect.top - shift, bottom: rect.bottom - shift };
  let need = 0;
  for (const element of [$('npc-portrait'), dialog.querySelector('.mv-dialog-box')]) {
    if (!element || element.hidden) continue;
    const box = element.getBoundingClientRect(); if (!box.width || !box.height) continue;
    if (sprite.right > box.left && sprite.left < box.right) need = Math.max(need, sprite.bottom + 16 - box.top);
  }
  need = Math.max(0, Math.min(need, sprite.top - 8));
  view.style.translate = need > 0 ? '0 ' + (-Math.round(need)) + 'px' : '';
}
function nextLine() {
  if (!dialog.open || !activeNpc) return;
  if (typing) return finishLine();
  if (++lineIndex >= activeNpc.dialogue.length) { dialog.close(); return; }
  showLine();
}
dialog.addEventListener('close', () => { clearTyping(); typing = false; activeNpc = null; $('place-view').style.translate = ''; $('place-view').classList.remove('mv-talking'); returnTarget?.focus({preventScroll:true}); });
$('npc-portrait').addEventListener('load', () => requestAnimationFrame(liftStage));
window.addEventListener('resize', () => { layoutNpcs(); liftStage(); });
new ResizeObserver(() => layoutNpcs()).observe($('npc-layer'));
$('dialog-close').addEventListener('click', () => dialog.close());
$('dialog-next').addEventListener('click', nextLine);
$('npc-text-next').addEventListener('click', nextLine);
$('world-map-back').addEventListener('click', () => navigate('map'));
window.addEventListener('hashchange', () => navigate(routeValue(), {fromHistory:true}));
window.addEventListener('pageshow', event => { if (event.persisted) navigate(routeValue(), {fromHistory:true, immediate:true}); });
window.addEventListener('pagehide', () => { ++generation; stopIdle(); clearTyping(); });
motion.addEventListener('change', () => { document.documentElement.classList.toggle('mv-reduced-motion', reduced()); if (typing && reduced()) finishLine(); });
document.documentElement.classList.toggle('mv-reduced-motion', reduced());
mountMap(); const initial = routeValue(); setHash(initial, true); render(initial);
