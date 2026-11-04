import { villageMap } from './map-data.js';
import { places } from './place-data.js';
import { npcs, npcsAt } from './npc-data.js?v=cutout-d';
import { hasMet, completeFirstMeeting } from './encounter-session.js';
import { readSave } from '../storage.js';
import { chibiResidents } from './chibi-data.js?v=cutout-d';
import { startMinigame, progress, shopSfx } from '../game/launcher.js?v=mg4';
import { shopByPlace, shopByNpc } from '../game/shop-data.js?v=mg4';
import { uiIcon } from '../game/art.js?v=mg4';
import { renderPack } from '../game/host.js?v=mg4';
import { GATHER_SPOTS, INGREDIENTS, ACTIVITIES, FISHING_SPOTS } from '../game/items.js?v=mg4';

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
/* 화면이 가려져 있는 동안 다음 장면의 그림을 미리 받아 둡니다(받기 전에 장면이 먼저 나타나 배경이 튀어나오는 것 방지). */
function preloadImages(urls, timeout = 1800) {
  const jobs = [...new Set(urls.filter(Boolean))].map(url => new Promise(resolve => {
    const image = new Image();
    image.onload = () => { (image.decode ? image.decode() : Promise.resolve()).then(resolve, resolve); };
    image.onerror = () => resolve();
    image.src = url;
  }));
  return Promise.race([Promise.all(jobs), new Promise(resolve => setTimeout(resolve, timeout))]);
}
function assetsFor(target) {
  if (target === 'map') return [villageMap.background];
  const place = places[target];
  return [place.background, ...npcsAt(place.id).map(npc => npc.chibi?.src || npc.illustration?.src)];
}
function clearTyping() { clearInterval(typingTimer); typingTimer = 0; }
function setStatus(message) { $('world-status').textContent = message; }
function routeValue() { const value = location.hash.slice(1); return places[value] ? value : 'map'; }
function setHash(value, replace = false) {
  if (location.hash !== '#' + value) history[replace ? 'replaceState' : 'pushState'](null, '', '#' + value);
}
/* 지도: 작은 마커 + 눌러지는 영역(호버 때 은은하게 빛남) + 이름표. 오른쪽 '여행 수첩'의 항목과 서로 연결됩니다.
   마우스: 올리면 강조, 누르면 입장. 터치(호버 없음): 한 번 누르면 선택·이름표, 같은 곳을 다시 누르면 입장. */
const touchLike = matchMedia('(hover: none)');
const markers = new Map(), cards = new Map();
let selectedPlace = '', lastVisited = '';
function setHighlight(id, on) {
  markers.get(id)?.classList.toggle('is-hover', on);
  cards.get(id)?.classList.toggle('is-hover', on);
  $('map-stage').classList.toggle('has-focus', Boolean(document.querySelector('#map-stage .is-hover, #map-stage .is-selected')));
}
function setSelected(id) {
  if (selectedPlace === id) return;
  markers.get(selectedPlace)?.classList.remove('is-selected'); cards.get(selectedPlace)?.classList.remove('is-selected');
  selectedPlace = id;
  markers.get(id)?.classList.add('is-selected'); cards.get(id)?.classList.add('is-selected');
  $('map-stage').classList.toggle('has-focus', Boolean(id) || Boolean(document.querySelector('#map-stage .is-hover')));
}
function activatePlace(id, fromMap) {
  // 터치에서는 지도 위 첫 탭이 '선택'입니다. 같은 곳을 한 번 더 누르면 들어갑니다.
  if (fromMap && touchLike.matches && selectedPlace !== id) {
    setSelected(id); cards.get(id)?.scrollIntoView({block:'nearest', behavior: reduced() ? 'auto' : 'smooth'});
    setStatus(places[id].name + ' 선택됨. 한 번 더 누르면 들어갑니다.'); return;
  }
  setSelected(id); lastVisited = id; navigate(id);
}
function mountMap() {
  $('map-subtitle').textContent = villageMap.subtitle;
  loadImage($('map-art'), villageMap.background, $('map-fallback'));
  $('map-art').alt = villageMap.alt;
  const groups = { building: $('place-list-town'), route: $('place-list-outside') };
  const counts = { building: 0, route: 0 };
  $('map-hint').querySelector('span').textContent = touchLike.matches
    ? '좌우로 밀어 둘러보고, 장소를 눌러 확인한 뒤 다시 누르면 들어갑니다.' : '지도 위 장소에 마우스를 올리거나 눌러 보세요.';
  for (const location of villageMap.locations) {
    const place = places[location.placeId]; if (!place) continue;
    const kind = location.kind === 'route' ? 'route' : 'building';
    const cx = bounded(location.hx ?? location.x, 3, 97, 50), cy = bounded(location.hy ?? location.y, 5, 95, 50);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mv-map-marker' + (kind === 'route' ? ' mv-route' : '');
    button.style.setProperty('--x', cx + '%'); button.style.setProperty('--y', cy + '%'); button.style.setProperty('--r', String(location.r ?? 7));
    button.dataset.tag = cy < 22 ? 'below' : 'above';
    button.dataset.edge = cx < 14 ? 'left' : cx > 86 ? 'right' : 'center';
    button.setAttribute('aria-label', place.name + (kind === 'route' ? ' 길로 들어가기' : ' 들어가기'));
    button.dataset.place = place.id;
    const hot = document.createElement('span'); hot.className = 'mv-hot'; hot.setAttribute('aria-hidden', 'true');
    const pin = document.createElement('span'); pin.className = 'mv-marker-pin'; pin.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.className = 'mv-marker-name'; label.setAttribute('aria-hidden', 'true');
    const labelName = document.createElement('strong'); labelName.textContent = place.name;
    const labelHint = document.createElement('small'); labelHint.textContent = kind === 'route' ? '길 입구' : '마을 시설';
    label.append(labelName, labelHint);
    button.append(hot, pin, label);
    button.addEventListener('click', () => activatePlace(place.id, true));
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setHighlight(place.id, true); });
    button.addEventListener('pointerleave', () => setHighlight(place.id, false));
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) setHighlight(place.id, true); }); button.addEventListener('blur', () => setHighlight(place.id, false));
    $('map-markers').append(button); markers.set(place.id, button);
    const card = document.createElement('button'); card.type = 'button'; card.className = 'mv-place-card' + (kind === 'route' ? ' mv-route' : ''); card.dataset.place = place.id;
    const mark = document.createElement('i'); mark.className = 'mv-card-mark'; mark.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong'); title.textContent = place.name;
    const who = npcsAt(place.id).map(npc => npc.name).join(' · ');
    const info = document.createElement('span'); info.textContent = who ? who : place.purpose;
    const arrow = document.createElement('b'); arrow.textContent = '›'; arrow.setAttribute('aria-hidden', 'true');
    card.append(mark, title, info, arrow);
    card.addEventListener('click', () => activatePlace(place.id, false));
    card.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setHighlight(place.id, true); });
    card.addEventListener('pointerleave', () => setHighlight(place.id, false));
    card.addEventListener('focus', () => { if (card.matches(':focus-visible')) setHighlight(place.id, true); }); card.addEventListener('blur', () => setHighlight(place.id, false));
    groups[kind].append(card); cards.set(place.id, card); counts[kind]++;
  }
  $('place-group-town').hidden = !groups.building.children.length;
  $('place-group-outside').hidden = !groups.route.children.length;
  $('town-count').textContent = counts.building; $('outside-count').textContent = counts.route;
  $('map-view').dataset.count = String(counts.building + counts.route);
  const body = $('place-list'), toggle = $('journal-toggle');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? '접기' : '펼치기';
    $('map-journal').classList.toggle('is-collapsed', !open);
  });
  // 지도 바깥(빈 곳)을 누르면 선택이 풀립니다.
  // 좁은 화면에서는 지도가 가로로 넓어져 밀어서 볼 수 있습니다. 처음엔 마을 한가운데에 맞춥니다.
  const centerMap = () => { const stage = $('map-stage'); if (stage.scrollWidth > stage.clientWidth + 4) stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) * 0.55; };
  $('map-art').addEventListener('load', centerMap); addEventListener('resize', () => { if (!$('map-view').hidden && $('map-stage').scrollLeft === 0) centerMap(); });
  $('map-stage').addEventListener('click', event => { if (!event.target.closest('.mv-map-marker')) setSelected(''); });
}

// ---- 활동(낚시·요리·채광·채집) : 장소 데이터의 activities 로 버튼이 만들어집니다 ----------------------------
const ACTIVITY_COPY = {
  fishing: place => ({ label:'낚시하기', hint:'장력과 물고기의 움직임을 읽는 힘겨루기', icon:'rod' }),
  cooking: () => ({ label:'요리하기', hint:'불 조절·타이밍·젓기로 직접 조리', icon:'pan' }),
  mining:  () => ({ label:'광맥 캐기', hint:'약점을 정확히 노려 내리치기', icon:'pick' }),
  gather:  () => ({ label:'채집하기', hint:'숲에서 단서를 찾아 재료를 직접 모으기', icon:'leaf' }),
};
function toast(message) { const node = $('mv-toast'); node.textContent = message; node.classList.add('on'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('on'), 2600); }
function refreshGold() { $('pack-gold').textContent = progress.state.coins.toLocaleString('ko-KR') + ' 코인'; }
function mountActivities(place) {
  const box = $('place-activities'); box.replaceChildren();
  const list = place.activities || [], shop = shopByPlace(place.id);
  box.hidden = !list.length && !shop; if (box.hidden) return;
  for (const kind of list) {
    const copy = ACTIVITY_COPY[kind]?.(place); if (!copy) continue;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'mv-activity mv-activity-' + kind; button.dataset.activity = kind;
    button.innerHTML = '<i aria-hidden="true"></i><span><strong></strong><small></small></span><b aria-hidden="true">▸</b>';
    button.querySelector('i').innerHTML = `<img class="pxi" src="${uiIcon(copy.icon)}" width="26" height="26" alt="">`; button.querySelector('strong').textContent = copy.label; button.querySelector('small').textContent = copy.hint;
    button.addEventListener('click', () => {
      startMinigame({ type:kind === 'gather' ? 'gathering' : kind, placeId:place.id, placeName:place.name, app, reduced:reduced(), onExit: () => { refreshGold(); button.focus({ preventScroll:true }); } });
    });
    box.append(button);
  }
  if (shop) mountShopButton(box, place, shop);
}
// 상점 이용 버튼: 처음 만나는 상점 주인이면 먼저 인사(기존 첫 만남 대화)부터, 이미 만났으면 바로 가게를 엽니다.
function mountShopButton(box, place, shop) {
  const npc = npcs[shop.npcId];
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'mv-activity mv-activity-shop'; button.dataset.activity = 'shop';
  button.innerHTML = `<i aria-hidden="true"><img class="pxi" src="${uiIcon('coin')}" width="26" height="26" alt=""></i><span><strong></strong><small></small></span><b aria-hidden="true">▸</b>`;
  button.querySelector('strong').textContent = '가게 이용하기';
  button.querySelector('small').textContent = '사기 · 팔기 · 미끼와 장비';
  button.addEventListener('click', () => {
    if (!npc) return;
    if (!hasMet(npc.id) && npc.firstMeeting?.length) openDialogue(npc, button); else openShopFor(npc, button);
  });
  box.append(button);
}
let shopRunning = false;
async function openShopFor(npc, source) {
  const shop = shopByNpc(npc?.id); if (!shop || shopRunning) return; shopRunning = true;
  app.inert = true; document.documentElement.classList.add('mg-open');
  try {
    const { openShop } = await import('../game/shop-ui.js?v=mg4');
    openShop({ shop, npc, place:places[shop.placeId], progress, sfx:shopSfx(), reduced:reduced(), onClose: () => {
      shopRunning = false; app.inert = false; document.documentElement.classList.remove('mg-open'); refreshGold();
      (source?.isConnected ? source : document.querySelector(`.mv-chibi[data-npc="${npc.id}"]`))?.focus({ preventScroll:true });
    } });
  } catch (error) { console.error(error); shopRunning = false; app.inert = false; document.documentElement.classList.remove('mg-open'); toast('상점을 열지 못했습니다. 잠시 뒤 다시 시도해 주세요.'); }
}
let packSelected = '';
const paintPack = () => { $('pack-body').innerHTML = renderPack(progress, packSelected); };
function openPack() { paintPack(); if (!$('pack-dialog').open) $('pack-dialog').showModal(); }
$('pack-body').addEventListener('click', async event => {
  if (event.target.closest('[data-open-reward]')) {   // 받은 선물의 코드 다시 보기
    const { openReward } = await import('../game/gift-ui.js?v=mg4'); const dialogEl = $('pack-dialog');
    openReward({ progress, parent:dialogEl, sfx:shopSfx(), reduced:reduced(), onClose:() => dialogEl.querySelector('[data-open-reward]')?.focus({ preventScroll:true }) }); return;
  }
  const item = event.target.closest('[data-pack-item]'); if (!item) return;
  packSelected = packSelected === item.dataset.packItem ? '' : item.dataset.packItem; paintPack();
  $('pack-body').querySelector(`[data-pack-item="${CSS.escape(packSelected)}"]`)?.focus({ preventScroll:true });
});
$('pack-open').addEventListener('click', openPack);
$('pack-body').addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-pack-item]')) { event.preventDefault(); event.target.click(); } });
$('pack-close').addEventListener('click', () => $('pack-dialog').close());
$('pack-dialog').addEventListener('click', event => { if (event.target === $('pack-dialog')) $('pack-dialog').close(); });
progress.subscribe(() => { refreshGold(); if ($('pack-dialog').open) paintPack(); });
window.addEventListener('storage', () => { progress.refresh(); refreshGold(); if ($('pack-dialog').open) paintPack(); });
refreshGold();
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
    button.dataset.background = config?.background || (config?.src ? 'transparent' : 'original-preserved');
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
    setSelected('');
    markers.get(lastVisited)?.focus({preventScroll:true});
  } else {
    const place = places[value];
    $('place-title').textContent = place.name;
    $('place-category').textContent = place.category;
    const shop = shopByPlace(place.id);
    $('place-hours').hidden = !place.hours || Boolean(shop);   // 상점은 항상 열려 있어서 영업시간을 따로 표시하지 않습니다
    $('place-hours').textContent = place.hours && !shop ? '영업시간 ' + place.hours : '';
    $('place-purpose').textContent = place.purpose;
    $('place-description').textContent = place.description;
    const stage = $('place-stage');
    stage.style.setProperty('--mood-a', place.mood?.a || '#344b3e'); stage.style.setProperty('--mood-b', place.mood?.b || '#304739'); stage.style.setProperty('--mood-glow', place.mood?.glow || '#ffffff');
    stage.dataset.place = place.id; stage.classList.toggle('mv-no-art', !place.background);
    $('place-art').alt = place.alt;
    if (place.background) loadImage($('place-art'), place.background, $('place-fallback'));
    else { $('place-art').hidden = true; $('place-art').removeAttribute('src'); $('place-fallback').hidden = true; }
    $('scene-note').textContent = '';
    mountActivities(place);
    mountNpcs(place); setStatus(place.name + '. 인물을 선택하면 대화가 열립니다.');
    $('place-title').focus({preventScroll:true});
  }
}
async function navigate(value, { fromHistory = false, immediate = false } = {}) {
  const target = places[value] ? value : 'map', ticket = ++generation;
  if (dialog.open) { returnTarget = null; closeDialogue(true); }
  app.inert = false; app.classList.add('mv-changing'); app.setAttribute('aria-busy', 'true');
  app.inert = true;
  if (!immediate && !reduced()) await new Promise(resolve => setTimeout(resolve, 260));
  await preloadImages(assetsFor(target));
  if (ticket !== generation) return;
  if (!fromHistory) setHash(target);
  app.inert = false; render(target);
  app.classList.remove('mv-changing'); app.removeAttribute('aria-busy');
}
function finishLine() {
  clearTyping(); typing = false; $('npc-text').textContent = fullText;
  const last = lineIndex === activeNpc.dialogue.length - 1;
  $('dialog-next').textContent = last ? '대화 마치기 ✓' : '다음 대사 ▸';
  // 마지막 대사에서 상점 주인이면 '상점 보기'가 나타납니다(기존 첫 만남 대화는 그대로 끝까지 봅니다).
  const shopBtn = $('dialog-shop'), shop = last ? shopByNpc(activeNpc.id) : null;
  shopBtn.hidden = !shop;
  if (shop) shopBtn.textContent = '상점 보기';
}
function showLine() {
  clearTyping(); $('dialog-shop').hidden = true;
  const line = activeNpc.dialogue[lineIndex];
  fullText = line.text;
  $('npc-accessible-text').textContent = activeNpc.name + ': ' + fullText;
  const portrait = $('npc-portrait'), art = activeNpc.portrait || {};
  const key = activeNpc.id + ':' + (art.src || 'missing');
  if (portrait.dataset.src !== key) {
    portrait.dataset.src = key;
    const fallback = $('portrait-fallback');
    portrait.hidden = true; fallback.hidden = true;
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
let opening = false;
async function openDialogue(npc, source) {
  if (dialog.open || closing || opening || !npc.dialogue?.length) return;
  opening = true;
  const firstMeeting = !hasMet(npc.id) && Boolean(npc.firstMeeting?.length);
  const lines = firstMeeting ? npc.firstMeeting : (npc.repeatDialogue?.length ? npc.repeatDialogue : npc.dialogue);
  const art = npc.portrait || {};
  // 인물 그림이 서서히 물러나는 동안 대화 원화를 미리 받아 두고, 준비된 뒤에 대화창을 엽니다.
  $('place-view').classList.add('mv-talking'); source?.classList.add('is-speaking');
  const ticket = generation;
  await Promise.all([preloadImages([art.src, art.fallback], 1200), reduced() ? null : new Promise(resolve => setTimeout(resolve, 200))]);
  opening = false;
  if (ticket !== generation || dialog.open) { $('place-view').classList.remove('mv-talking'); source?.classList.remove('is-speaking'); return; }
  activeNpc = { ...npc, dialogue: lines, firstMeeting };
  lineIndex = 0; returnTarget = source;
  dialog.dataset.place = current; app.dataset.mode = 'dialogue';
  $('npc-name').textContent = npc.name; $('npc-note').textContent = npc.note;
  $('npc-portrait').dataset.src = '__reset__';
  dialog.showModal(); showLine(); $('dialog-next').focus({preventScroll:true});
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
$('dialog-shop').addEventListener('click', () => {
  if (!dialog.open || !activeNpc || closing || typing) return;
  const npc = npcs[activeNpc.id], source = returnTarget;
  if (activeNpc.firstMeeting) completeFirstMeeting(activeNpc.id);
  dialog.addEventListener('close', () => openShopFor(npc, source), { once:true });   // 대화창이 완전히 닫힌 뒤 상점을 엽니다
  closeDialogue(true);
});
$('dialog-next').addEventListener('click', nextLine);
$('npc-text-next').addEventListener('click', nextLine);
$('world-map-back').addEventListener('click', () => navigate('map'));
window.addEventListener('hashchange', () => navigate(routeValue(), {fromHistory:true}));
window.addEventListener('pageshow', event => { if (event.persisted) navigate(routeValue(), {fromHistory:true, immediate:true}); });
window.addEventListener('pagehide', () => { ++generation; clearTyping(); closeDialogue(true); });
motion.addEventListener('change', () => { document.documentElement.classList.toggle('mv-reduced-motion', reduced()); if (typing && reduced()) finishLine(); });
document.documentElement.classList.toggle('mv-reduced-motion', reduced());
mountMap(); const initial = routeValue(); setHash(initial, true); render(initial);
