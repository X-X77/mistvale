import { villageMap } from './map-data.js';
import { places } from './place-data.js';
import { npcs, npcsAt } from './npc-data.js';
import { readSave } from '../storage.js';

const $ = id => document.getElementById(id);
const app = $('world'), dialog = $('npc-dialog');
const preferences = readSave(), motion = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => preferences.reducedMotion || motion.matches;
let current = 'map', generation = 0, typingTimer = 0;
let featuredNpc = null;
let activeNpc = null, lineIndex = 0, typing = false, fullText = '', returnTarget = null;
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
  $('featured-npc').hidden = !here.length;
  if (here.length) featureNpc(here[0]);
  layer.dataset.count = String(Math.min(here.length, 6)); layer.style.setProperty('--n', String(Math.max(here.length, 1)));
  if (!here.length) {
    const empty = document.createElement('p'); empty.className = 'mv-empty-note';
    empty.textContent = Object.keys(npcs).length ? '지금은 이곳에서 만날 수 있는 인물이 없습니다.' : '인물 정보를 불러오지 못했습니다. 잠시 후 다시 방문해 주세요.';
    layer.append(empty); return;
  }
  for (const npc of here) {
    const button = document.createElement('button'); button.className = 'mv-npc-card'; button.dataset.npc = npc.id;
    if (npc.kind === 'nonhuman') button.classList.add('mv-nonhuman');
    button.setAttribute('aria-label', npc.name + '(' + npc.role + ')에게 말 걸기' + (npc.illustration.ready ? '' : ', 원화 준비 중'));
    const art = document.createElement('span'); art.className = 'mv-card-art';
    if (npc.illustration.ready) {
      const image = document.createElement('img'); image.alt = ''; image.draggable = false; image.decoding = 'async';
      image.style.objectPosition = npc.layout.cardPosition || 'center top';
      image.onerror = () => { image.remove(); art.classList.add('mv-card-empty'); art.append(emptyArt()); };
      image.src = npc.illustration.src; art.append(image);
    } else { art.classList.add('mv-card-empty'); art.append(emptyArt()); }
    const name = document.createElement('span'); name.className = 'mv-card-name';
    const strong = document.createElement('strong'); strong.textContent = npc.name;
    const small = document.createElement('small'); small.textContent = npc.role;
    name.append(strong, small);
    button.append(art, name);
    button.addEventListener('click', () => { featureNpc(npc); openDialogue(npc, button); });
    button.setAttribute('aria-pressed', String(npc.id === featuredNpc?.id));
    layer.append(button);
  }
}
// Presentation only: use the same original artwork and existing dialogue handler.
function featureNpc(npc) {
  featuredNpc = npc;
  const button = $('featured-npc'), image = $('featured-art');
  button.setAttribute('aria-label', npc.name + ' · 이야기 나누기');
  $('featured-name').textContent = npc.name; $('featured-role').textContent = npc.role;
  image.alt = npc.illustration.alt;
  if (npc.illustration.ready) loadImage(image, npc.illustration.src, $('featured-fallback'));
  else { image.hidden = true; image.removeAttribute('src'); $('featured-fallback').hidden = false; }
  for (const item of $('npc-layer').querySelectorAll('[data-npc]')) item.setAttribute('aria-pressed', String(item.dataset.npc === npc.id));
}
$('featured-npc').addEventListener('click', () => { if (featuredNpc) openDialogue(featuredNpc, $('featured-npc')); });
function emptyArt() {
  const box = document.createElement('span'); box.className = 'mv-card-wait'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<i>?</i><em>원화 준비 중</em>'; return box;
}
function render(value) {
  current = value;
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
  if (dialog.open) { returnTarget = null; dialog.close(); clearTyping(); }
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
  const portrait = $('npc-portrait'), art = activeNpc.illustration;
  if (portrait.dataset.src !== art.src) {
    portrait.dataset.src = art.src;
    if (art.ready) loadImage(portrait, art.src, $('portrait-fallback'));
    else { portrait.hidden = true; portrait.removeAttribute('src'); $('portrait-fallback').hidden = false; }
  }
  portrait.alt = art.alt;
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
  $('npc-portrait').dataset.src = '__reset__'; $('place-view').classList.add('mv-talking');
  dialog.showModal(); showLine(); $('dialog-next').focus({preventScroll:true});
}
function nextLine() {
  if (!dialog.open || !activeNpc) return;
  if (typing) return finishLine();
  if (++lineIndex >= activeNpc.dialogue.length) { dialog.close(); return; }
  showLine();
}
dialog.addEventListener('close', () => { clearTyping(); typing = false; activeNpc = null; $('place-view').classList.remove('mv-talking'); returnTarget?.focus({preventScroll:true}); });
$('dialog-close').addEventListener('click', () => dialog.close());
$('dialog-next').addEventListener('click', nextLine);
$('npc-text-next').addEventListener('click', nextLine);
$('world-map-back').addEventListener('click', () => navigate('map'));
window.addEventListener('hashchange', () => navigate(routeValue(), {fromHistory:true}));
window.addEventListener('pageshow', event => { if (event.persisted) navigate(routeValue(), {fromHistory:true, immediate:true}); });
window.addEventListener('pagehide', () => { ++generation; clearTyping(); });
motion.addEventListener('change', () => { document.documentElement.classList.toggle('mv-reduced-motion', reduced()); if (typing && reduced()) finishLine(); });
document.documentElement.classList.toggle('mv-reduced-motion', reduced());
mountMap(); const initial = routeValue(); setHash(initial, true); render(initial);
