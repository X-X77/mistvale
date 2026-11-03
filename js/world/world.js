import { villageMap } from './map-data.js';
import { places } from './place-data.js';
import { npcs, npcsAt } from './npc-data.js?v=visual-novel-20261103';
import { hasMet, completeFirstMeeting } from './encounter-session.js';
import { readSave } from '../storage.js';
import { chibiResidents } from './chibi-data.js';

const $ = id => document.getElementById(id);
const app = $('world'), dialog = $('npc-dialog');
const preferences = readSave(), motion = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => preferences.reducedMotion || motion.matches;
let current = 'map', generation = 0, typingTimer = 0;
let featuredNpc = null;
let activeNpc = null, lineIndex = 0, typing = false, fullText = '', returnTarget = null;
let closeTimer = 0, closing = false;
const bounded = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

function loadImage(image, source, fallback) {
  image.hidden = false; if (fallback) fallback.hidden = true;
  image.onload = () => { image.hidden = false; if (fallback) fallback.hidden = true; };
  image.onerror = () => { image.hidden = true; if (fallback) fallback.hidden = false; };
  image.src = source;
}
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
  const groups = { building: $('place-list-town'), route: $('place-list-outside') };
  for (const location of villageMap.locations) {
    const place = places[location.placeId]; if (!place) continue;
    const kind = location.kind === 'route' ? 'route' : 'building';
    const button = document.createElement('button');
    button.className = 'mv-map-marker' + (kind === 'route' ? ' mv-route' : '');
    button.style.left = bounded(location.x, 3, 97, 50) + '%';
    button.style.top = bounded(location.y, 8, 96, 50) + '%';
    button.setAttribute('aria-label', place.name + (kind === 'route' ? ' 길로 들어가기' : ' 들어가기'));
    button.title = place.name; button.dataset.place = place.id;
    const pin = document.createElement('span'); pin.className = 'mv-marker-pin'; pin.textContent = location.glyph || '♧'; pin.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.className = 'mv-marker-name'; label.textContent = place.name;
    button.append(pin, label); button.addEventListener('click', () => navigate(place.id));
    $('map-markers').append(button);
    const card = document.createElement('button'); card.className = 'mv-place-card'; card.dataset.place = place.id;
    const title = document.createElement('strong'); title.textContent = place.name;
    const who = npcsAt(place.id).map(npc => npc.name).join(' · ');
    const info = document.createElement('span'); info.textContent = who ? '만날 수 있는 인물 · ' + who : place.purpose;
    const arrow = document.createElement('b'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    card.append(title, info, arrow); card.addEventListener('click', () => navigate(place.id));
    groups[kind].append(card);
  }
  $('place-group-town').hidden = !groups.building.children.length;
  $('place-group-outside').hidden = !groups.route.children.length;
}
// ---- NPC 표시 (모든 NPC 공통) -------------------------------------------------
// 장소 화면: 큰 원화와 하단 인물 선택 버튼이 같은 원화·대화 데이터를 사용합니다.
// 원화 또는 선택 버튼을 누르면 기존 대화창을 엽니다. 미등록 원화는 대체 안내로 표시합니다.
function mountNpcs(place) {
  const layer = $('npc-layer'); layer.replaceChildren();
  const here = npcsAt(place.id);
  $('featured-npc').hidden = true;
  $('place-view').dataset.residents = String(here.length);
  layer.setAttribute('aria-label', place.name + '의 주민');
  for (const npc of here) {
    const config = npc.chibi;
    const button = document.createElement('button');
    button.className = 'mv-chibi'; button.dataset.npc = npc.id;
    button.dataset.background = config?.background || 'original-preserved';
    button.setAttribute('aria-label', npc.name + ' · ' + npc.role + ' · 이야기 나누기');
    button.title = [npc.name, npc.spot, npc.appears].filter(Boolean).join(' · ');
    for (const [key, value] of Object.entries({x:config?.x ?? 65, ground:config?.ground ?? 78, h:config?.height ?? 28, mx:config?.mobileX ?? 60, mg:config?.mobileGround ?? 65, mh:config?.mobileHeight ?? 24, r:config?.ratio ?? 0.7, foot:config?.foot ?? 3, sw:config?.shadow ?? 56})) button.style.setProperty('--' + key, value);
    const image = document.createElement('img');
    image.alt = ''; image.draggable = false; image.decoding = 'async';
    image.src = config?.src || npc.illustration.src;
    const name = document.createElement('span'); name.className = 'mv-chibi-name'; name.textContent = npc.name;
    image.addEventListener('error', () => { image.hidden = true; button.classList.add('mv-chibi-missing'); });
    button.append(image, name);
    button.addEventListener('click', () => openDialogue(npc, button));
    layer.append(button);
  }
}
function render(value) {
  current = value; app.dataset.mode = 'explore';
  app.dataset.place = value === 'map' ? '' : value;
  if (value !== 'map') window.scrollTo({top:0, behavior:'instant'});
  app.dataset.view = value === 'map' ? 'map' : 'place';
  $('map-view').hidden = value !== 'map';
  $('place-view').hidden = value === 'map';
  $('world-map-back').hidden = value === 'map';
  if (value === 'map') {
    setStatus('미스트베일 마을 지도');
    $('map-markers').querySelector('button')?.focus({preventScroll:true});
  } else {
    const place = places[value];
    $('place-title').textContent = place.name;
    $('place-category').textContent = place.category;
    $('place-hours').hidden = !place.hours;
    $('place-hours').textContent = place.hours ? '영업시간 ' + place.hours : '';
    $('place-purpose').textContent = place.purpose;
    $('place-description').textContent = place.description;
    const stage = $('place-stage');
    stage.style.setProperty('--mood-a', place.mood?.a || '#344b3e'); stage.style.setProperty('--mood-b', place.mood?.b || '#304739'); stage.style.setProperty('--mood-glow', place.mood?.glow || '#ffffff');
    stage.dataset.place = place.id; stage.classList.toggle('mv-no-art', !place.background);
    $('place-art').alt = place.alt;
    if (place.background) loadImage($('place-art'), place.background, $('place-fallback'));
    else { $('place-art').hidden = true; $('place-art').removeAttribute('src'); $('place-fallback').hidden = true; }
    $('scene-note').textContent = '';
    mountNpcs(place); setStatus(place.name + '. 인물을 선택하면 대화가 열립니다.');
    $('place-title').focus({preventScroll:true});
  }
}
async function navigate(value, { fromHistory = false, immediate = false } = {}) {
  const target = places[value] ? value : 'map', ticket = ++generation;
  if (dialog.open) { returnTarget = null; closeDialogue(true); }
  app.inert = false; app.classList.add('mv-changing'); app.setAttribute('aria-busy', 'true');
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
  const portrait = $('npc-portrait'), art = activeNpc.portrait || {};
  const key = activeNpc.id + ':' + (art.src || 'missing');
  if (portrait.dataset.src !== key) {
    portrait.dataset.src = key;
    const fallback = $('portrait-fallback');
    portrait.hidden = true; fallback.hidden = false;
    const sources = [...new Set([art.src, art.fallback].filter(Boolean))];
    let attempt = 0;
    const next = () => {
      if (portrait.dataset.src !== key) return;
      if (attempt >= sources.length) { portrait.hidden = true; portrait.removeAttribute('src'); fallback.hidden = false; return; }
      portrait.src = sources[attempt++];
    };
    portrait.onload = () => { if (portrait.dataset.src === key) { portrait.hidden = false; fallback.hidden = true; } };
    portrait.onerror = next;
    portrait.alt = art.alt || activeNpc.name + ' 대화 원화';
    next();
  }
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
  if (dialog.open || closing || !npc.dialogue?.length) return;
  const firstMeeting = !hasMet(npc.id) && Boolean(npc.firstMeeting?.length);
  const lines = firstMeeting ? npc.firstMeeting : (npc.repeatDialogue?.length ? npc.repeatDialogue : npc.dialogue);
  activeNpc = { ...npc, dialogue: lines, firstMeeting };
  lineIndex = 0; returnTarget = source;
  dialog.dataset.place = current; app.dataset.mode = 'dialogue';
  $('npc-name').textContent = npc.name; $('npc-note').textContent = npc.note;
  $('npc-portrait').dataset.src = '__reset__'; $('place-view').classList.add('mv-talking');
  source?.classList.add('is-speaking'); dialog.showModal(); showLine(); $('dialog-next').focus({preventScroll:true});
}
function nextLine() {
  if (!dialog.open || !activeNpc || closing) return;
  if (typing) return finishLine();
  if (++lineIndex >= activeNpc.dialogue.length) {
    if (activeNpc.firstMeeting) completeFirstMeeting(activeNpc.id);
    closeDialogue(); return;
  }
  showLine();
}
function closeDialogue(immediate = false) {
  clearTyping();
  if (!dialog.open) return;
  if (immediate || reduced()) { clearTimeout(closeTimer); dialog.close(); return; }
  if (closing) return;
  closing = true; dialog.setAttribute('data-closing', '');
  closeTimer = setTimeout(() => { if (dialog.open) dialog.close(); }, 180);
}
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialogue(); });
dialog.addEventListener('close', () => {
  clearTimeout(closeTimer); closeTimer = 0; closing = false; dialog.removeAttribute('data-closing');
  clearTyping(); typing = false; activeNpc = null; app.dataset.mode = 'explore';
  $('place-view').classList.remove('mv-talking');
  returnTarget?.classList.remove('is-speaking'); returnTarget?.focus({preventScroll:true});
});
$('dialog-close').addEventListener('click', () => closeDialogue());
$('dialog-next').addEventListener('click', nextLine);
$('npc-text-next').addEventListener('click', nextLine);
$('world-map-back').addEventListener('click', () => navigate('map'));
window.addEventListener('hashchange', () => navigate(routeValue(), {fromHistory:true}));
window.addEventListener('pageshow', event => { if (event.persisted) navigate(routeValue(), {fromHistory:true, immediate:true}); });
window.addEventListener('pagehide', () => { ++generation; clearTyping(); closeDialogue(true); });
motion.addEventListener('change', () => { document.documentElement.classList.toggle('mv-reduced-motion', reduced()); if (typing && reduced()) finishLine(); });
document.documentElement.classList.toggle('mv-reduced-motion', reduced());
mountMap(); const initial = routeValue(); setHash(initial, true); render(initial);
