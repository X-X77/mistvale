import { atlas } from './map-data.js?v=atlas1';
import { places } from './place-data.js';
import { npcs, npcsAt } from './npc-data.js?v=cutout-d';
import { hasMet, completeFirstMeeting } from './encounter-session.js';
import { readSave } from '../storage.js';
import { chibiResidents } from './chibi-data.js?v=cutout-d';
import { startMinigame, progress, shopSfx } from '../game/launcher.js?v=mg-art1';
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
  if (target === 'map') return [atlas[page].art];
  const place = places[target];
  return [place.background, ...npcsAt(place.id).map(npc => npc.chibi?.src || npc.illustration?.src)];
}
function clearTyping() { clearInterval(typingTimer); typingTimer = 0; }
function setStatus(message) { $('world-status').textContent = message; }
function routeValue() { const value = location.hash.slice(1); return places[value] ? value : 'map'; }
function setHash(value, replace = false) {
  if (location.hash !== '#' + value) history[replace ? 'replaceState' : 'pushState'](null, '', '#' + value);
}
let page = 'town', selected = '';
const marks = new Map(), rows = new Map();
function describe(site) {
  const place = places[site.id];
  return { name:site.name || place.name,
    note:site.note || npcsAt(site.id).map(npc => npc.name).join(' · ') || place.purpose };
}
function selectSite(id) {
  const site = atlas[page].sites.find(item => item.id === id);
  selected = site?.id || '';
  for (const [key, marker] of marks) {
    const on = key === selected;
    marker.classList.toggle('is-selected', on);
    rows.get(key).classList.toggle('is-selected', on);
    rows.get(key).setAttribute('aria-pressed', String(on));
  }
  $('atlas-name').textContent = site ? describe(site).name : atlas[page].title;
  $('atlas-note').textContent = site ? describe(site).note + (site.note ? ' · 지도 명소' : '') : '건물이나 지형을 선택해 둘러보세요.';
  $('atlas-enter').hidden = !places[selected];
}
function showPage(key) {
  page = key;
  const sheet = atlas[key], town = key === 'town';
  $('map-subtitle').textContent = sheet.title;
  $('map-art').alt = sheet.alt;
  loadImage($('map-art'), sheet.art, $('map-fallback'));
  $('place-group-town').hidden = !town;
  $('place-group-outside').hidden = town;
  for (const tab of $('atlas-pages').children) tab.setAttribute('aria-pressed', String(tab.dataset.page === key));
  const list = $(town ? 'place-list-town' : 'place-list-outside');
  list.replaceChildren(); $('map-markers').replaceChildren(); marks.clear(); rows.clear();
  for (const site of sheet.sites) {
    const { name, note } = describe(site);
    const marker = document.createElement('button'), row = document.createElement('button');
    marker.type = row.type = 'button'; marker.dataset.place = row.dataset.place = site.id;
    marker.className = 'mv-map-marker'; row.className = 'mv-place-card';
    for (const k of ['x','y','w','h']) marker.style.setProperty('--' + k, site[k] + '%');
    marker.dataset.tag = site.y < 20 ? 'below' : 'above';
    marker.dataset.edge = site.x < 14 ? 'left' : site.x > 85 ? 'right' : 'center';
    marker.setAttribute('aria-label', name);
    marker.innerHTML = '<span class="mv-hot"></span><span class="mv-marker-pin"></span><span class="mv-marker-name"><strong></strong></span>';
    marker.querySelector('strong').textContent = name;
    row.innerHTML = '<i class="mv-card-mark"></i><strong></strong><span></span><b aria-hidden="true">›</b>';
    row.querySelector('strong').textContent = name; row.querySelector('span').textContent = note;
    const highlight = on => { marker.classList.toggle('is-hover', on); row.classList.toggle('is-hover', on); };
    for (const el of [marker,row]) {
      el.onpointerenter = e => { if (e.pointerType !== 'touch') highlight(true); };
      el.onpointerleave = () => highlight(false);
      el.onfocus = () => highlight(true); el.onblur = () => highlight(false);
    }
    marker.onclick = e => {
      const enter = places[site.id] && (selected === site.id || !matchMedia('(hover:none)').matches && e.detail > 0);
      selectSite(site.id);
      if (enter) navigate(site.id);
    };
    row.onclick = () => { if (selected === site.id && places[site.id]) navigate(site.id); else selectSite(site.id); };
    marks.set(site.id,marker); rows.set(site.id,row);
    $('map-markers').append(marker); list.append(row);
  }
  $(town ? 'town-count' : 'outside-count').textContent = sheet.sites.length;
  selectSite('');
}
function mountMap() {
  $('map-hint').querySelector('span').textContent = '수첩에서 위치를 찾고, 건물을 눌러 방문하세요.';
  for (const tab of $('atlas-pages').children) tab.onclick = () => showPage(tab.dataset.page);
  $('atlas-enter').onclick = () => { if (places[selected]) navigate(selected); };
  $('journal-toggle').onclick = () => {
    const open = $('map-journal').classList.toggle('is-collapsed') === false;
    $('journal-toggle').setAttribute('aria-expanded', String(open));
    $('journal-toggle').textContent = open ? '접기' : '펼치기';
  };
  showPage('town');
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
    if (selected) marks.get(selected)?.focus({preventScroll:true});
  } else {
    const place = places[value];
    const sheet = Object.keys(atlas).find(key => atlas[key].sites.some(site => site.id === value));
    if (sheet && sheet !== page) showPage(sheet);
    selectSite(value);
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
