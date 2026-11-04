// 상점 화면: 가게마다 분위기가 다른 픽셀 상점(사기/팔기 탭, 분류, 수량, NPC 반응, 반짝임·동전 연출).
// 사고파는 규칙·가격은 모두 shop-engine.js / shop-data.js 가 정하고, 이 파일은 보여 주고 누르게만 합니다.
import { describeItem, TIERS } from './items.js?v=sh1';
import { GROUPS, groupOf, isProtected } from './goods.js?v=sh1';
import { MAX_QTY, MAX_STACK, buyPrice } from './shop-data.js?v=sh1';
import { buy, sell, quoteBuy, quoteSell, stockFor, sellables, isOpen, hoursText, currentMinutes, clockText } from './shop-engine.js?v=sh1';
import { iconImg, uiIcon } from './art.js?v=sh1';

const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const fmt = n => Number(n).toLocaleString('ko-KR');
const GROUP_LABEL = Object.fromEntries(GROUPS.map(group => [group.id, group.label]));
const REASON_LINE = { gold:'poor', lack:'lack', full:'full', owned:'owned', better:'owned', need:'need', closed:'closed', nobuy:'nobuy', unknown:'nobuy' };
const REASON_TEXT = {
  gold:'소지금이 모자라요', need:'필요한 재료가 모자라요', full:'가방이 가득 차요 (한 물건 99개까지)', owned:'이미 가지고 있어요', better:'더 좋은 장비를 갖고 있어요',
  closed:'지금은 영업 시간이 아니에요', lack:'가진 수량이 모자라요', nobuy:'이 가게에서는 사지 않아요', goldcap:'소지금이 너무 많아져요', qty:'수량을 확인해 주세요',
};

export function openShop({ shop, npc, place, progress, sfx, reduced = false, parent = document.body, onClose, clock = currentMinutes }) {
  const L = shop.lines, listeners = [];
  const pick = key => { const lines = L[key] || []; return lines[Math.floor(Math.random() * lines.length)] || ''; };
  const S = { tab:'buy', group:'all', sel:{ buy:null, sell:null }, qty:1, busy:false, closing:false, shownGold:progress.state.gold, confirm:null, destroyed:false };
  const root = document.createElement('div');
  root.className = 'sh-root'; root.dataset.shop = shop.theme; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', shop.name);
  const chibi = npc?.chibi?.src || npc?.illustration?.src || '';
  root.innerHTML = `
    <div class="sh-bg" ${place?.background ? `style="--sh-art:url('${place.background}')"` : ''}></div><div class="sh-deco" aria-hidden="true"><span class="sh-awning"></span><span class="sh-motes">${'<i></i>'.repeat(9)}</span></div>
    <div class="sh-frame">
      <header class="sh-top">
        <div class="sh-sign px"><strong>${esc(shop.name)}</strong><small>${esc(shop.tagline)}</small></div>
        <div class="sh-status"><span class="sh-open" data-open=""></span><small class="sh-hours"></small></div>
        <div class="sh-gold px" aria-live="polite"><img class="pxi" src="${uiIcon('coin')}" width="26" height="26" alt=""><span class="sh-gold-n">0</span><em>G</em></div>
        <button type="button" class="px-ico sh-close" aria-label="상점 나가기" title="나가기 (Esc)"><img class="pxi" src="${uiIcon('close')}" alt="" width="26" height="26"></button>
      </header>
      <div class="sh-main">
        <aside class="sh-npc">
          <div class="sh-npc-stage">${chibi ? `<img class="sh-chibi" src="${esc(chibi)}" alt="" draggable="false">` : ''}<span class="sh-shadow"></span></div>
          <div class="sh-bubble px" role="status" aria-live="polite"><b>${esc(npc?.name || '')}</b><p></p></div>
        </aside>
        <section class="sh-board px">
          <div class="sh-tabs" role="tablist"><button type="button" role="tab" class="sh-tab" data-tab="buy">사기</button><button type="button" role="tab" class="sh-tab" data-tab="sell">팔기</button><div class="sh-chips" role="group" aria-label="분류"></div></div>
          <div class="sh-body"><ul class="sh-list" role="listbox" aria-label="물건 목록"></ul>
            <div class="sh-detail"></div></div>
        </section>
      </div>
    </div>
    <div class="sh-fx" aria-hidden="true"></div>`;
  parent.append(root);
  const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
  const bubbleEl = $('.sh-bubble p'), npcEl = $('.sh-npc'), goldEl = $('.sh-gold-n'), goldBox = $('.sh-gold');

  /* ---------- 말풍선·반응 ---------- */
  function say(text, react = true) {
    bubbleEl.textContent = text; const bubble = $('.sh-bubble');
    bubble.classList.remove('pop'); void bubble.offsetWidth; if (!reduced) bubble.classList.add('pop');
    if (react && !reduced) { npcEl.classList.remove('react'); void npcEl.offsetWidth; npcEl.classList.add('react'); }
  }
  const status = () => { const open = isOpen(shop, clock()); return { open, now:clockText(clock()) }; };
  function paintStatus() {
    const { open, now } = status(), badge = $('.sh-open');
    badge.textContent = open ? '영업 중' : '준비 중'; badge.dataset.open = open ? '1' : '0';
    $('.sh-hours').textContent = '영업시간 ' + hoursText(shop) + ' · 지금 ' + now;
    root.classList.toggle('is-closed', !open);
  }

  /* ---------- 소지금(부드럽게 바뀌는 숫자) ---------- */
  let goldRaf = 0;
  function setGold(target, instant = false) {
    cancelAnimationFrame(goldRaf); const from = S.shownGold;
    if (instant || reduced || from === target) { S.shownGold = target; goldEl.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 520;
    const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); S.shownGold = Math.round(from + (target - from) * e); goldEl.textContent = fmt(S.shownGold); if (k < 1 && !S.destroyed) goldRaf = requestAnimationFrame(tick); else { S.shownGold = target; goldEl.textContent = fmt(target); } };
    goldRaf = requestAnimationFrame(tick);
  }

  /* ---------- 목록 ---------- */
  function rowsNow() {
    const items = progress.state.items;
    if (S.tab === 'buy') return stockFor(shop).map(entry => ({ id:entry.id, info:entry.info, price:entry.price, owned:items[entry.id] || 0, entry }));
    const order = id => GROUPS.findIndex(group => group.id === groupOf(describeItem(id).kind));
    return sellables(shop, items).map(row => ({ id:row.id, info:row.info, price:row.price, owned:row.n })).sort((a, b) => order(a.id) - order(b.id) || a.info.name.localeCompare(b.info.name, 'ko'));
  }
  const visible = rows => S.group === 'all' ? rows : rows.filter(row => groupOf(row.info.kind) === S.group);
  function ensureSelection(rows) {
    const list = visible(rows);
    if (!list.some(row => row.id === S.sel[S.tab])) { S.sel[S.tab] = list[0]?.id || null; S.qty = 1; }
  }
  function renderChips(rows) {
    const present = GROUPS.filter(group => rows.some(row => groupOf(row.info.kind) === group.id));
    const chips = $('.sh-chips');
    if (present.length < 2) { chips.hidden = true; chips.replaceChildren(); S.group = 'all'; return; }
    if (S.group !== 'all' && !present.some(group => group.id === S.group)) S.group = 'all';
    chips.hidden = false;
    chips.innerHTML = [{ id:'all', label:'전체' }, ...present].map(group => `<button type="button" class="sh-chip${S.group === group.id ? ' on' : ''}" data-group="${group.id}" aria-pressed="${S.group === group.id}">${group.label}</button>`).join('');
  }
  function renderList() {
    const rows = rowsNow(); renderChips(rows); ensureSelection(rows);
    const list = visible(rows), ul = $('.sh-list'); const keepScroll = ul.scrollTop;
    const hadRowFocus = Boolean(document.activeElement?.closest?.('.sh-row'));
    ul.innerHTML = list.length ? list.map(row => {
      const info = row.info, tier = info.tier && TIERS[info.tier] && S.tab === 'sell' ? `<em class="tier-${info.tier}">${TIERS[info.tier]}</em>` : '';
      const tags = S.tab === 'buy' ? [row.entry.need ? '<em class="sh-tag up">강화</em>' : '', info.season ? `<em class="sh-tag">${info.season}</em>` : '', info.unique && row.owned ? '<em class="sh-tag own">보유 중</em>' : ''].join('') : '';
      const q = S.tab === 'buy' ? quoteBuy(progress.state, shop, row.id, 1) : null, dim = q && !q.ok && ['gold', 'need', 'owned', 'better', 'full'].includes(q.reason);
      return `<li role="option" tabindex="${row.id === S.sel[S.tab] ? 0 : -1}" class="sh-row${row.id === S.sel[S.tab] ? ' sel' : ''}${dim ? ' dim' : ''}" data-id="${esc(row.id)}" aria-selected="${row.id === S.sel[S.tab]}">
        <span class="sh-ico">${iconImg(info, 32)}</span><span class="sh-name"><b>${esc(info.name)}</b>${tier}${tags}</span>
        <span class="sh-own" title="가진 수량">${S.tab === 'buy' ? (row.owned && !info.unique ? '보유 ×' + row.owned : '') : '×' + row.owned}</span>
        <span class="sh-price"><img class="pxi" src="${uiIcon('coin')}" width="16" height="16" alt="">${fmt(row.price)}<small>G</small></span></li>`;
    }).join('') : `<li class="sh-empty">${S.tab === 'sell' ? '이 가게에서 사 줄 물건이 없어요.<small>다른 가게는 사 주는 물건이 다를 수 있어요.</small>' : '준비된 물건이 없어요.'}</li>`;
    ul.scrollTop = keepScroll;
    if (hadRowFocus) ul.querySelector('.sh-row.sel')?.focus({ preventScroll:true });
    $$('.sh-tab').forEach(tab => { const on = tab.dataset.tab === S.tab; tab.classList.toggle('on', on); tab.setAttribute('aria-selected', String(on)); });
    renderDetail();
  }

  /* ---------- 상세·수량 ---------- */
  function maxQty() {
    const id = S.sel[S.tab]; if (!id) return 0;
    if (S.tab === 'sell') return Math.min(progress.count(id), 9999);
    const info = describeItem(id), price = buyPrice(id), entry = shop.stock.find(row => row.id === id);
    if (info.unique) return 1;
    let cap = Math.min(MAX_QTY, MAX_STACK - progress.count(id), Math.floor(progress.state.gold / price));
    if (entry?.need) for (const [item, n] of Object.entries(entry.need)) cap = Math.min(cap, Math.floor(progress.count(item) / n));
    return Math.max(0, cap);
  }
  function renderDetail() {
    const box = $('.sh-detail'), id = S.sel[S.tab];
    const prev = document.activeElement, keep = prev && box.contains(prev) ? ['sh-act', 'sh-plus', 'sh-minus', 'sh-max'].find(name => prev.classList.contains(name)) : null;
    if (!id) { box.innerHTML = `<p class="sh-hint">${S.tab === 'sell' ? '팔 물건이 없어요. 낚시·채집·채광·요리를 하고 다시 와 보세요.' : '물건을 골라 보세요.'}</p>`; return; }
    const info = describeItem(id), max = maxQty(), buying = S.tab === 'buy';
    S.qty = Math.max(1, Math.min(S.qty, Math.max(1, buying ? Math.min(MAX_QTY, MAX_STACK) : max)));
    if (max >= 1) S.qty = Math.min(S.qty, max);
    const entry = buying ? shop.stock.find(row => row.id === id) : null, unit = buying ? buyPrice(id) : rowsNow().find(row => row.id === id)?.price || 0;
    const quote = buying ? quoteBuy(progress.state, shop, id, S.qty, clock()) : quoteSell(progress.state, shop, id, S.qty, clock());
    const owned = progress.count(id), total = unit * S.qty;
    const need = entry?.need ? `<ul class="sh-need">${Object.entries(entry.need).map(([item, n]) => { const have = progress.count(item), ok = have >= n; return `<li class="${ok ? 'ok' : 'no'}"><span class="sh-ico s">${iconImg(describeItem(item), 24)}</span>${esc(describeItem(item).name)}<b>${have}/${n}</b></li>`; }).join('')}</ul><p class="sh-note">재료는 강화할 때 사라지고, 이전 장비는 새 장비로 바뀌어요.</p>` : '';
    const effect = info.effect ? `<p class="sh-effect">${info.effect.mineSwings ? `곡괭이질 +${info.effect.mineSwings}번` : ''}${info.effect.biteWindow ? `챔질 시간 +${Math.round((info.effect.biteWindow - 1) * 100)}%` : ''}</p>` : '';
    const soon = info.soon ? `<p class="sh-soon">※ ${esc(info.soon)}</p>` : '';
    const protectedNote = !buying ? '' : (isProtected(info) ? '<p class="sh-note">고유 장비라서 되팔 수 없어요.</p>' : '');
    const stepper = info.unique && buying ? '' : `<div class="sh-qty" role="group" aria-label="수량"><button type="button" class="px-ico sh-minus" aria-label="하나 줄이기"><img class="pxi" src="${uiIcon('minus')}" alt="" width="26" height="26"></button><output class="sh-qty-n" aria-live="polite">${S.qty}</output><button type="button" class="px-ico sh-plus" aria-label="하나 늘이기"><img class="pxi" src="${uiIcon('plus')}" alt="" width="26" height="26"></button><button type="button" class="px-btn alt sh-max">${buying ? '최대' : '전부'}</button></div>`;
    const ok = quote.ok, reasonText = !ok ? (REASON_TEXT[quote.reason] || '') : '';
    const confirming = S.confirm === id + ':' + S.qty;
    const label = buying ? (info.unique && quote.reason === 'owned' ? '보유 중' : (entry?.need ? '강화하기' : '사기')) : (confirming ? '한 번 더 누르면 팔아요' : '팔기');
    box.innerHTML = `<div class="sh-sel"><span class="sh-pedestal"><span class="sh-big">${iconImg(info, 64)}</span></span>
      <div class="sh-info"><h3>${esc(info.name)}${info.tier && TIERS[info.tier] ? `<em class="tier-${info.tier}">${TIERS[info.tier]}</em>` : ''}</h3><small>${esc(GROUP_LABEL[groupOf(info.kind)] || '')}${info.season ? ' · ' + info.season + ' 씨앗' : ''} · <span class="sh-own-n">가진 수량 ×${owned}</span></small></div></div>
      <p class="sh-desc">${esc(info.desc || '')}</p>${effect}${need}${soon}${protectedNote}
      <div class="sh-deal">${stepper}
        <div class="sh-sum"><span>${buying ? '개당' : '개당 매입가'} <b>${fmt(unit)}G</b></span><strong class="${ok ? '' : 'bad'}"><img class="pxi" src="${uiIcon('coin')}" width="20" height="20" alt="">${buying ? '−' : '+'}${fmt(total)}<small>G</small></strong></div>
        <button type="button" class="px-btn sh-act${ok ? '' : ' is-dim'}${confirming ? ' confirm' : ''}" data-act="${S.tab}" ${ok ? '' : 'aria-disabled="true"'}>${label}</button>
        <p class="sh-why" role="status">${esc(reasonText)}</p></div>`;
    if (keep) box.querySelector('.' + keep)?.focus({ preventScroll:true });
    const bigIcon = box.querySelector('.sh-big');
    if (S.wiggleId === id && !reduced) { bigIcon.classList.add('wig'); } S.wiggleId = null;
  }

  /* ---------- 연출 ---------- */
  const fx = $('.sh-fx');
  const center = el => { const r = el.getBoundingClientRect(), f = root.getBoundingClientRect(); return { x:r.left - f.left + r.width / 2, y:r.top - f.top + r.height / 2 }; };
  function sparkle(el, count = 7) {
    if (reduced || !el) return; const c = center(el), url = uiIcon('spark', '#fff3a8');
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i'); s.className = 'sh-spark'; s.style.backgroundImage = `url(${url})`;
      const a = (i / count) * Math.PI * 2 + Math.random() * .6, r = 30 + Math.random() * 26;
      s.style.left = c.x + 'px'; s.style.top = c.y + 'px'; s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r - 8 + 'px'); s.style.animationDelay = i * 35 + 'ms';
      fx.append(s); setTimeout(() => s.remove(), 900 + i * 35);
    }
  }
  function coins(fromEl, toEl, count, toward = true) {
    if (reduced || !fromEl || !toEl) return; const a = center(fromEl), b = center(toEl), url = uiIcon('coin');
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('img'); coin.className = 'sh-coin pxi'; coin.src = url; coin.width = 26; coin.height = 26; coin.alt = '';
      const [from, to] = toward ? [a, b] : [b, a]; coin.style.left = from.x - 13 + 'px'; coin.style.top = from.y - 13 + 'px'; fx.append(coin);
      const mid = { x:(from.x + to.x) / 2 + (Math.random() - .5) * 60, y:Math.min(from.y, to.y) - 30 - Math.random() * 30 };
      const anim = coin.animate([{ transform:'translate(0,0) scale(.6)', opacity:0 }, { transform:`translate(${mid.x - from.x}px,${mid.y - from.y}px) scale(1)`, opacity:1, offset:.4 }, { transform:`translate(${to.x - from.x}px,${to.y - from.y}px) scale(.7)`, opacity:.9 }], { duration:620 + i * 30, delay:i * 70, easing:'ease-in-out', fill:'both' });
      anim.onfinish = () => { coin.remove(); if (toward) { goldBox.classList.remove('bump'); void goldBox.offsetWidth; goldBox.classList.add('bump'); } };
    }
  }
  function floatText(text, el, tone) {
    if (!el) return; const c = center(el), f = document.createElement('b'); f.className = 'sh-float ' + tone; f.textContent = text; f.style.left = c.x + 'px'; f.style.top = c.y + 'px'; fx.append(f); setTimeout(() => f.remove(), 1100);
  }
  const popEl = (el) => { if (!el || reduced) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };

  /* ---------- 행동 ---------- */
  function act() {
    if (S.busy || S.closing) return;
    const id = S.sel[S.tab]; if (!id) return;
    paintStatus();
    const buying = S.tab === 'buy', info = describeItem(id);
    const quote = buying ? quoteBuy(progress.state, shop, id, S.qty, clock()) : quoteSell(progress.state, shop, id, S.qty, clock());
    if (!quote.ok) { sfx?.play('deny'); say(pick(REASON_LINE[quote.reason] || 'nobuy')); renderDetail(); const why = $('.sh-why'); if (why && !reduced) { why.classList.remove('shake'); void why.offsetWidth; why.classList.add('shake'); } return; }
    // 비싼 물건·희귀한 물건을 팔 때는 한 번 더 눌러야 팝니다(실수 방지)
    if (!buying && (quote.total >= 150 || ['rare', 'special'].includes(info.tier)) && S.confirm !== id + ':' + S.qty) {
      S.confirm = id + ':' + S.qty; renderDetail(); clearTimeout(S.confirmTimer); S.confirmTimer = setTimeout(() => { S.confirm = null; if (!S.destroyed) renderDetail(); }, 3200); sfx?.play('ui'); return;
    }
    S.busy = true; S.confirm = null; clearTimeout(S.confirmTimer);
    const result = buying ? buy(progress, shop, id, S.qty, clock()) : sell(progress, shop, id, S.qty, clock());
    if (!result.ok) { S.busy = false; sfx?.play('deny'); say(pick(REASON_LINE[result.reason] || 'nobuy')); renderAll(); return; }
    const bigIcon = $('.sh-big'), actBtn = $('.sh-act');
    if (buying) {
      sfx?.play('buy'); sparkle(bigIcon, info.unique ? 12 : 7); floatText('−' + fmt(result.total) + 'G', goldBox, 'out');
      say(pick('buy'));
    } else {
      sfx?.play('coin'); coins(bigIcon || actBtn, goldBox, Math.min(8, 2 + Math.ceil(result.qty / 2))); floatText('+' + fmt(result.total) + 'G', goldBox, 'in');
      say(result.total >= 200 ? pick('sellBig') : result.rare ? (L.rare ? pick('rare') : pick('sell')) : pick('sell'));
    }
    setGold(progress.state.gold);
    S.qty = 1; S.wiggleId = id; renderAll();
    popEl($('.sh-own-n')); popEl($('.sh-row.sel .sh-own'));
    setTimeout(() => { S.busy = false; }, reduced ? 0 : 260);
  }
  function renderAll() { paintStatus(); renderList(); }
  function select(id) { if (S.sel[S.tab] === id) return; S.sel[S.tab] = id; S.qty = 1; S.confirm = null; S.wiggleId = id; sfx?.play('ui'); renderList(); const row = $(`.sh-row[data-id="${CSS.escape(id)}"]`); row?.focus({ preventScroll:true }); row?.scrollIntoView({ block:'nearest' }); }
  function setTab(tab) {
    if (S.tab === tab) return; S.tab = tab; S.group = 'all'; S.qty = 1; S.confirm = null; sfx?.play('ui'); renderList();
    if (tab === 'sell' && !rowsNow().length) say(pick('empty'), false);
    else if (tab === 'sell') say(pick('greet'), false);
  }
  function on(target, type, handler, options) { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); }

  on(root, 'click', event => {
    const row = event.target.closest('.sh-row'); if (row) return select(row.dataset.id);
    const tab = event.target.closest('.sh-tab'); if (tab) return setTab(tab.dataset.tab);
    const chip = event.target.closest('.sh-chip'); if (chip) { S.group = chip.dataset.group; S.confirm = null; sfx?.play('ui'); return renderList(); }
    if (event.target.closest('.sh-plus')) { const max = maxQty(); if (S.qty < Math.max(1, S.tab === 'buy' ? Math.min(max || 1, MAX_QTY) : max)) S.qty++; S.confirm = null; sfx?.play('ui'); return renderDetail(); }
    if (event.target.closest('.sh-minus')) { S.qty = Math.max(1, S.qty - 1); S.confirm = null; sfx?.play('ui'); return renderDetail(); }
    if (event.target.closest('.sh-max')) { S.qty = Math.max(1, maxQty()); S.confirm = null; sfx?.play('ui'); return renderDetail(); }
    if (event.target.closest('.sh-act')) return act();
    if (event.target.closest('.sh-close')) return close();
  });
  on(root, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.target.closest('.sh-list') && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault(); const list = visible(rowsNow()), i = list.findIndex(row => row.id === S.sel[S.tab]), next = list[Math.max(0, Math.min(list.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1)))]; if (next) select(next.id);
    }
    if (event.key === 'Tab') {   // 상점 안에서만 초점이 돌게
      const focusable = $$('button:not([hidden]), [tabindex="0"]').filter(el => el.offsetParent !== null); if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  on(document, 'keydown', event => { if (event.key === 'Escape' && !S.closing && !S.destroyed) { event.preventDefault(); close(); } });   // 초점이 어디 있든 Esc 로 나가기
  const clockTimer = setInterval(() => { if (!S.destroyed) { const was = root.classList.contains('is-closed'); paintStatus(); if (was !== root.classList.contains('is-closed')) renderDetail(); } }, 15000);
  const unsubscribe = progress.subscribe(() => { if (!S.busy && !S.destroyed && S.shownGold !== progress.state.gold) setGold(progress.state.gold, true); });

  function close() {
    if (S.closing) return; S.closing = true; clearInterval(clockTimer); unsubscribe();
    say(pick('bye'));
    const done = () => { S.destroyed = true; cancelAnimationFrame(goldRaf); listeners.forEach(off => off()); root.remove(); onClose?.(); };
    if (reduced) done(); else { root.classList.add('is-leaving'); setTimeout(done, 380); }
  }

  /* ---------- 시작 ---------- */
  paintStatus(); goldEl.textContent = fmt(S.shownGold); renderList();
  const { open } = status();
  say(open ? pick('greet') : pick('closed'), false);
  if (!reduced) root.classList.add('is-entering'); setTimeout(() => root.classList.remove('is-entering'), 600);
  $('.sh-close').focus({ preventScroll:true });
  return { root, close, destroy:() => { if (!S.destroyed) { S.closing = true; clearInterval(clockTimer); unsubscribe(); S.destroyed = true; listeners.forEach(off => off()); root.remove(); } },
    debug:() => ({ tab:S.tab, sel:S.sel[S.tab], qty:S.qty, shownGold:S.shownGold, open:isOpen(shop, clock()), group:S.group, busy:S.busy, closing:S.closing }) };
}
