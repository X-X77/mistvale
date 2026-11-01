import { villageMap } from './map-data.js';
import { places } from './place-data.js';
import { npcs } from './npc-data.js';
import { readSave } from '../storage.js';

const $ = id => document.getElementById(id);
const app = $('world'), dialog = $('npc-dialog');
const preferences = readSave(), motion = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => preferences.reducedMotion || motion.matches;
let current = 'map', generation = 0, idleTimers = [], typingTimer = 0;
let activeNpc = null, lineIndex = 0, typing = false, fullText = '', returnTarget = null;
const missingImages = new Set();
const bounded = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

function loadImage(image, source, fallback) {
  image.hidden = false; if (fallback) fallback.hidden = true;
  image.onload = () => { image.hidden = false; if (fallback) fallback.hidden = true; };
  image.onerror = () => { missingImages.add(source); image.hidden = true; if (fallback) fallback.hidden = false; };
  image.src = source;
}
function stopIdle() { idleTimers.forEach(clearInterval); idleTimers = []; }
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
function mountNpcs(place) {
  stopIdle(); $('npc-layer').replaceChildren();
  for (const position of place.npcs) {
    const npc = npcs[position.npcId]; if (!npc) continue;
    const button = document.createElement('button'); button.className = 'mv-npc';
    button.style.left = bounded(position.x, 5, 95, 50) + '%';
    button.style.top = bounded(position.y, 10, 90, 60) + '%';
    button.style.setProperty('--npc-width', bounded(position.width, 3, 18, 6) + '%');
    button.setAttribute('aria-label', npc.name + '에게 말 걸기');
    const image = document.createElement('img'); image.alt = npc.small.alt;
    const fallback = document.createElement('span'); fallback.className = 'mv-npc-fallback'; fallback.textContent = '?'; fallback.hidden = true;
    const bubble = document.createElement('span'); bubble.className = 'mv-npc-bubble'; bubble.textContent = '대화'; bubble.setAttribute('aria-hidden', 'true');
    button.append(image, fallback, bubble);
    button.addEventListener('click', () => openDialogue(npc, button));
    $('npc-layer').append(button);
    const frames = (Array.isArray(npc.small.frames) && npc.small.frames.length >= 2 ? npc.small.frames.slice(0,4) : [npc.small.image]).filter(Boolean);
    const source = frames[0] || npc.small.image;
    loadImage(image, source, fallback);
    if (frames.length >= 2 && !reduced()) {
      let frame = 0;
      idleTimers.push(setInterval(() => {
        if (document.hidden || dialog.open) return;
        const valid = frames.filter(src => !missingImages.has(src));
        if (!valid.length) { image.hidden = true; fallback.hidden = false; return; }
        loadImage(image, valid[++frame % valid.length], fallback);
      }, bounded(npc.small.frameMs, 200, 2000, 650)));
    }
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
}
function showLine() {
  clearTyping();
  const line = activeNpc.dialogue[lineIndex];
  fullText = line.text;
  $('npc-accessible-text').textContent = activeNpc.name + ': ' + fullText;
  const image = activeNpc.portrait.expressions?.[line.expression] || activeNpc.portrait.default;
  loadImage($('npc-portrait'), image, $('portrait-fallback'));
  $('npc-portrait').alt = activeNpc.portrait.alt;
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
  dialog.dataset.portraitMode = npc.portrait.mode;
  $('portrait-label').textContent = npc.portrait.mode === 'original' ? '일러스트 초상' : '도트 초상';
  dialog.showModal(); showLine(); $('dialog-next').focus({preventScroll:true});
}
function nextLine() {
  if (!dialog.open || !activeNpc) return;
  if (typing) return finishLine();
  if (++lineIndex >= activeNpc.dialogue.length) { dialog.close(); return; }
  showLine();
}
dialog.addEventListener('close', () => { clearTyping(); typing = false; activeNpc = null; returnTarget?.focus({preventScroll:true}); });
$('dialog-close').addEventListener('click', () => dialog.close());
$('dialog-next').addEventListener('click', nextLine);
$('npc-text-next').addEventListener('click', nextLine);
$('world-map-back').addEventListener('click', () => navigate('map'));
window.addEventListener('hashchange', () => navigate(routeValue(), {fromHistory:true}));
window.addEventListener('pageshow', event => { if (event.persisted) navigate(routeValue(), {fromHistory:true, immediate:true}); });
window.addEventListener('pagehide', () => { ++generation; stopIdle(); clearTyping(); });
motion.addEventListener('change', () => { document.documentElement.classList.toggle('mv-reduced-motion', reduced()); if (current !== 'map') mountNpcs(places[current]); if (typing && reduced()) finishLine(); });
document.documentElement.classList.toggle('mv-reduced-motion', reduced());
mountMap(); const initial = routeValue(); setHash(initial, true); render(initial);
