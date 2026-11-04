// 상점 화면(클로버 잡화점 하나): 사기/팔기 탭, 한 개 팔기·전부 팔기, 작은 구매 연출, 엑스의 비밀 선물.
// 사고파는 규칙·가격은 모두 shop-engine.js / shop-data.js 가 정하고, 이 파일은 보여 주고 누르게만 합니다.
import { describeItem, RECIPES, TIERS } from './items.js?v=mg4';
import { groupOf, GROUPS, isProtected } from './goods.js?v=mg4';
import { MAX_QTY, MAX_STACK, GIFT, GIFT_NOTE, buyPrice } from './shop-data.js?v=mg4';
import { buy, sell, sellAll, buyGift, quoteBuy, quoteSell, quoteGift, giftStatus, stockFor, sellables } from './shop-engine.js?v=mg4';
import { iconImg, uiIcon } from './art.js?v=mg4';
import { openXEvent, openReward, GIFT_ICON } from './gift-ui.js?v=mg4';

const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const fmt = n => Number(n).toLocaleString('ko-KR');
const REASON_LINE = { coins:'poor', lack:'lack', full:'full', owned:'owned', unknown:'nobuy', nobuy:'nobuy', cap:'full' };
const REASON_TEXT = {
  coins:'코인이 모자라요', full:'가방이 가득 차요 (한 물건 99개까지)', owned:'이미 가지고 있어요', lack:'가진 수량이 모자라요',
  nobuy:'이 가게에서는 사지 않아요', cap:'코인이 너무 많아져요', qty:'수량을 확인해 주세요', locked:'아직 열리지 않았어요',
};
const GIFT_INFO = { ...GIFT_ICON, name:GIFT.name, desc:'상점 구석에 누가 몰래 올려놓은 작은 상자예요. 리본에 삐뚤빼뚤한 글씨로 "엑스"라고 적혀 있어요.' };

/** 물건이 미니게임에서 하는 일(상세에 한 줄로) */
export function effectText(info) {
  const e = info.effect, parts = [];
  if (e?.mineSwings) parts.push(`채광: 곡괭이질 +${e.mineSwings}번`);
  if (e?.biteWindow) parts.push(`낚시: 챔질 시간 +${Math.round((e.biteWindow - 1) * 100)}%`);
  if (e?.waitMul) parts.push(`낚시: 입질 대기 −${Math.round((1 - e.waitMul) * 100)}% (던질 때 1개 사용)`);
  if (e?.rareMul) parts.push(`낚시: 희귀·특수 확률 ×${e.rareMul} (던질 때 1개 사용)`);
  if (info.kind === 'ingredient') {
    const used = Object.values(RECIPES).filter(recipe => recipe.need?.[info.id]).map(recipe => recipe.name);
    if (used.length) parts.push('요리: ' + used.join(' · '));
  }
  return parts;
}

export function openShop({ shop, npc, place, progress, sfx, reduced = false, parent = document.body, onClose }) {
  const L = shop.lines, listeners = [];
  const pick = key => { const lines = L[key] || []; return lines[Math.floor(Math.random() * lines.length)] || ''; };
  const S = { tab:'buy', sel:{ buy:null, sell:null }, qty:1, busy:false, closing:false, shownCoins:progress.state.coins, confirm:null, destroyed:false, overlay:0 };
  const root = document.createElement('div');
  root.className = 'sh-root'; root.dataset.shop = 'clover'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', shop.name);
  const chibi = npc?.chibi?.src || npc?.illustration?.src || '';
  root.innerHTML = `
    <div class="sh-bg" ${place?.background ? `style="--sh-art:url('${place.background}')"` : ''}></div><div class="sh-deco" aria-hidden="true"><span class="sh-awning"></span><span class="sh-motes">${'<i></i>'.repeat(9)}</span></div>
    <div class="sh-frame">
      <header class="sh-top">
        <div class="sh-sign px"><strong>${esc(shop.name)}</strong><small>${esc(shop.tagline)}</small></div>
        <div class="sh-coins px" aria-live="polite" aria-label="보유 코인"><img class="pxi" src="${uiIcon('coin')}" width="26" height="26" alt=""><span class="sh-coins-n">0</span><em>코인</em></div>
        <button type="button" class="px-ico sh-close" aria-label="상점 나가기" title="나가기 (Esc)"><img class="pxi" src="${uiIcon('close')}" alt="" width="26" height="26"></button>
      </header>
      <div class="sh-main">
        <aside class="sh-npc">
          <div class="sh-npc-stage">${chibi ? `<img class="sh-chibi" src="${esc(chibi)}" alt="" draggable="false">` : ''}<span class="sh-shadow"></span></div>
          <div class="sh-bubble px" role="status" aria-live="polite"><b>${esc(npc?.name || '')}</b><p></p></div>
        </aside>
        <section class="sh-board px">
          <div class="sh-tabs" role="tablist"><button type="button" role="tab" class="sh-tab" data-tab="buy">사기</button><button type="button" role="tab" class="sh-tab" data-tab="sell">팔기</button></div>
          <div class="sh-body"><ul class="sh-list" role="listbox" aria-label="물건 목록"></ul>
            <div class="sh-detail"></div></div>
        </section>
      </div>
    </div>
    <div class="sh-fx" aria-hidden="true"></div>`;
  parent.append(root);
  const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
  const bubbleEl = $('.sh-bubble p'), npcEl = $('.sh-npc'), coinsEl = $('.sh-coins-n'), coinsBox = $('.sh-coins');

  /* ---------- 말풍선·반응 ---------- */
  function say(text, react = true) {
    bubbleEl.textContent = text; const bubble = $('.sh-bubble');
    bubble.classList.remove('pop'); void bubble.offsetWidth; if (!reduced) bubble.classList.add('pop');
    if (react && !reduced) { npcEl.classList.remove('react'); void npcEl.offsetWidth; npcEl.classList.add('react'); }
  }

  /* ---------- 코인(부드럽게 바뀌는 숫자) ---------- */
  let coinRaf = 0;
  function setCoins(target, instant = false) {
    cancelAnimationFrame(coinRaf); const from = S.shownCoins;
    if (instant || reduced || from === target) { S.shownCoins = target; coinsEl.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 520;
    const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); S.shownCoins = Math.round(from + (target - from) * e); coinsEl.textContent = fmt(S.shownCoins); if (k < 1 && !S.destroyed) coinRaf = requestAnimationFrame(tick); else { S.shownCoins = target; coinsEl.textContent = fmt(target); } };
    coinRaf = requestAnimationFrame(tick);
  }

  /* ---------- 목록 ---------- */
  function rowsNow() {
    const items = progress.state.items;
    if (S.tab === 'buy') {
      const rows = stockFor(shop).map(entry => ({ id:entry.id, info:entry.info, price:entry.price, owned:items[entry.id] || 0 }));
      if (giftStatus(progress.state) !== 'hidden') rows.unshift({ id:GIFT.id, info:GIFT_INFO, price:GIFT.cost, owned:progress.state.gift.bought ? 1 : 0, gift:true });
      return rows;
    }
    const order = id => GROUPS.findIndex(group => group.id === groupOf(describeItem(id).kind));
    return sellables(shop, items).map(row => ({ id:row.id, info:row.info, price:row.price, owned:row.n })).sort((a, b) => order(a.id) - order(b.id) || b.price - a.price);
  }
  function ensureSelection(rows) {
    if (!rows.some(row => row.id === S.sel[S.tab])) { S.sel[S.tab] = rows[0]?.id || null; S.qty = 1; }
  }
  function renderList() {
    const rows = rowsNow(); ensureSelection(rows);
    const ul = $('.sh-list'), keepScroll = ul.scrollTop, hadRowFocus = Boolean(document.activeElement?.closest?.('.sh-row'));
    ul.innerHTML = rows.length ? rows.map(row => {
      const info = row.info, sel = row.id === S.sel[S.tab];
      const tier = info.tier && TIERS[info.tier] && S.tab === 'sell' ? `<em class="tier-${info.tier}">${TIERS[info.tier]}</em>` : '';
      let tag = '', dim = false, own = S.tab === 'sell' ? '×' + row.owned : (row.owned && !info.unique ? '보유 ×' + row.owned : '');
      if (row.gift) { tag = `<em class="sh-tag gift">${progress.state.gift.bought ? '받음' : '비밀'}</em>`; own = ''; dim = !progress.state.gift.bought && !quoteGift(progress.state).ok; }
      else if (S.tab === 'buy') { if (info.unique && row.owned) tag = '<em class="sh-tag own">보유 중</em>'; const q = quoteBuy(progress.state, shop, row.id, 1); dim = !q.ok; }
      return `<li role="option" tabindex="${sel ? 0 : -1}" class="sh-row${sel ? ' sel' : ''}${dim ? ' dim' : ''}${row.gift ? ' gift' : ''}" data-id="${esc(row.id)}" aria-selected="${sel}">
        <span class="sh-ico">${iconImg(info, 32)}</span><span class="sh-name"><b>${esc(info.name)}</b>${tier}${tag}</span>
        <span class="sh-own" title="가진 수량">${own}</span>
        <span class="sh-price"><img class="pxi" src="${uiIcon('coin')}" width="16" height="16" alt="">${fmt(row.price)}</span></li>`;
    }).join('') : `<li class="sh-empty">${S.tab === 'sell' ? '사 드릴 물건이 없어요.<small>낚시·채광·요리로 얻은 물고기, 광석, 요리를 받아요.</small>' : '준비된 물건이 없어요.'}</li>`;
    ul.scrollTop = keepScroll;
    if (hadRowFocus) ul.querySelector('.sh-row.sel')?.focus({ preventScroll:true });
    $$('.sh-tab').forEach(tab => { const on = tab.dataset.tab === S.tab; tab.classList.toggle('on', on); tab.setAttribute('aria-selected', String(on)); });
    renderDetail();
  }

  /* ---------- 상세·수량 ---------- */
  function maxBuyQty(id) {
    const info = describeItem(id), price = buyPrice(id);
    if (info.unique) return 1;
    return Math.max(0, Math.min(MAX_QTY, MAX_STACK - progress.count(id), Math.floor(progress.state.coins / price)));
  }
  const detailFocusKeys = ['sh-act', 'sh-act-one', 'sh-act-all', 'sh-plus', 'sh-minus', 'sh-max'];
  function renderDetail() {
    const box = $('.sh-detail'), id = S.sel[S.tab];
    const prev = document.activeElement, keep = prev && box.contains(prev) ? detailFocusKeys.find(name => prev.classList.contains(name)) : null;
    if (!id) { box.innerHTML = `<p class="sh-hint">${S.tab === 'sell' ? '팔 물건이 없어요.<br>낚시·채광·요리를 하고 다시 와 보세요.' : '물건을 골라 보세요.'}</p>`; return; }
    if (id === GIFT.id) return renderGift(box, keep);
    const info = describeItem(id), buying = S.tab === 'buy', owned = progress.count(id);
    const effects = effectText(info).map(line => `<p class="sh-effect">${esc(line)}</p>`).join('');
    const head = `<div class="sh-sel"><span class="sh-pedestal"><span class="sh-big">${iconImg(info, 64)}</span></span>
      <div class="sh-info"><h3>${esc(info.name)}${info.tier && TIERS[info.tier] ? `<em class="tier-${info.tier}">${TIERS[info.tier]}</em>` : ''}</h3><small>가진 수량 <span class="sh-own-n">×${owned}</span></small></div></div>
      <p class="sh-desc">${esc(info.desc || '')}</p>${effects}${buying && isProtected(info) ? '<p class="sh-note">고유 장비라서 되팔 수 없어요.</p>' : ''}`;
    if (buying) {
      const max = maxBuyQty(id), unit = buyPrice(id);
      S.qty = Math.max(1, Math.min(S.qty, MAX_QTY)); if (max >= 1) S.qty = Math.min(S.qty, max);
      const quote = quoteBuy(progress.state, shop, id, S.qty), ok = quote.ok, total = unit * S.qty;
      const stepper = info.unique ? '' : `<div class="sh-qty" role="group" aria-label="수량"><button type="button" class="px-ico sh-minus" aria-label="하나 줄이기"><img class="pxi" src="${uiIcon('minus')}" alt="" width="26" height="26"></button><output class="sh-qty-n" aria-live="polite">${S.qty}</output><button type="button" class="px-ico sh-plus" aria-label="하나 늘리기"><img class="pxi" src="${uiIcon('plus')}" alt="" width="26" height="26"></button><button type="button" class="px-btn alt sh-max">최대</button></div>`;
      box.innerHTML = `${head}<div class="sh-deal">${stepper}
        <div class="sh-sum"><span>개당 <b>${fmt(unit)}</b></span><strong class="${ok ? '' : 'bad'}"><img class="pxi" src="${uiIcon('coin')}" width="20" height="20" alt="">−${fmt(total)}</strong></div>
        <button type="button" class="px-btn sh-act${ok ? '' : ' is-dim'}" ${ok ? '' : 'aria-disabled="true"'}>${info.unique && quote.reason === 'owned' ? '보유 중' : '사기'}</button>
        <p class="sh-why" role="status">${ok ? '' : esc(REASON_TEXT[quote.reason] || '')}</p></div>`;
    } else {
      const unit = sellables(shop, progress.state.items).find(row => row.id === id)?.price || 0, total = unit * owned;
      const confirmOne = S.confirm === id + ':1', confirmAll = S.confirm === id + ':all';
      box.innerHTML = `${head}<div class="sh-deal">
        <div class="sh-sum"><span>개당 <b>${fmt(unit)}</b></span><span class="sh-sum-all">전부 <b>${fmt(total)}</b></span></div>
        <div class="sh-sellbtns"><button type="button" class="px-btn sh-act sh-act-one${confirmOne ? ' confirm' : ''}" data-n="1">${confirmOne ? '한 번 더 눌러요' : `한 개 팔기 <small>+${fmt(unit)}</small>`}</button>
          ${owned > 1 ? `<button type="button" class="px-btn sh-act sh-act-all${confirmAll ? ' confirm' : ''}" data-n="all">${confirmAll ? '한 번 더 눌러요' : `전부 팔기 ×${owned} <small>+${fmt(total)}</small>`}</button>` : ''}</div>
        <p class="sh-why" role="status"></p></div>`;
    }
    if (keep) box.querySelector('.' + keep)?.focus({ preventScroll:true });
    if (S.wiggleId === id && !reduced) box.querySelector('.sh-big')?.classList.add('wig'); S.wiggleId = null;
  }
  function renderGift(box, keep) {
    const bought = progress.state.gift.bought, quote = quoteGift(progress.state), ok = bought || quote.ok;
    box.innerHTML = `<div class="sh-sel"><span class="sh-pedestal gift"><span class="sh-big">${iconImg(GIFT_INFO, 64)}</span></span>
      <div class="sh-info"><h3>${esc(GIFT.name)}<em class="sh-tag gift">${bought ? '받음' : '비밀'}</em></h3><small>엑스가 몰래 놓고 간 상자</small></div></div>
      <p class="sh-desc">${esc(GIFT_INFO.desc)}</p>
      <p class="sh-effect">${esc(GIFT.effect)} 특별 시작 코드</p>
      <p class="sh-sealed"><span>코드</span><b aria-label="아직 보이지 않는 코드">${bought ? '받았어요' : '????-?????'}</b></p>
      <p class="sh-note">${bought ? '코드는 보상 화면에서 언제든 다시 볼 수 있어요.' : esc(GIFT_NOTE)}</p>
      <div class="sh-deal"><div class="sh-sum"><span>${bought ? '이미 받은 선물' : '한 번만 살 수 있어요'}</span>${bought ? '' : `<strong class="${ok ? '' : 'bad'}"><img class="pxi" src="${uiIcon('coin')}" width="20" height="20" alt="">−${fmt(GIFT.cost)}</strong>`}</div>
        <button type="button" class="px-btn sh-act sh-act-gift${ok ? '' : ' is-dim'}" ${ok ? '' : 'aria-disabled="true"'}>${bought ? '코드 보기' : '선물 열기'}</button>
        <p class="sh-why" role="status">${ok ? '' : esc(REASON_TEXT[quote.reason] || '')}</p></div>`;
    if (keep) box.querySelector('.' + keep)?.focus({ preventScroll:true });
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
  function coinFly(fromEl, toEl, count) {
    if (reduced || !fromEl || !toEl) return; const a = center(fromEl), b = center(toEl), url = uiIcon('coin');
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('img'); coin.className = 'sh-coin pxi'; coin.src = url; coin.width = 26; coin.height = 26; coin.alt = '';
      coin.style.left = a.x - 13 + 'px'; coin.style.top = a.y - 13 + 'px'; fx.append(coin);
      const mid = { x:(a.x + b.x) / 2 + (Math.random() - .5) * 60, y:Math.min(a.y, b.y) - 30 - Math.random() * 30 };
      const anim = coin.animate([{ transform:'translate(0,0) scale(.6)', opacity:0 }, { transform:`translate(${mid.x - a.x}px,${mid.y - a.y}px) scale(1)`, opacity:1, offset:.4 }, { transform:`translate(${b.x - a.x}px,${b.y - a.y}px) scale(.7)`, opacity:.9 }], { duration:620 + i * 30, delay:i * 40, easing:'ease-in', fill:'both' });
      anim.onfinish = () => { coin.remove(); coinsBox.classList.remove('bump'); void coinsBox.offsetWidth; coinsBox.classList.add('bump'); };
    }
  }
  function floatText(text, el, tone) {
    if (!el) return; const c = center(el), f = document.createElement('b'); f.className = 'sh-float ' + tone; f.textContent = text; f.style.left = c.x + 'px'; f.style.top = c.y + 'px'; fx.append(f); setTimeout(() => f.remove(), 1100);
  }
  const popEl = el => { if (!el || reduced) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };

  /* ---------- 오버레이(엑스 이벤트·보상 화면) 동안은 상점을 잠급니다 ---------- */
  function lock() { S.overlay++; root.inert = true; }
  function unlock() { S.overlay = Math.max(0, S.overlay - 1); if (!S.overlay) { root.inert = false; } }
  function showReward(reveal) {
    lock(); openReward({ progress, parent:document.body, sfx, reduced, reveal, onClose:() => { unlock(); if (!S.destroyed) { renderAll(); $('.sh-row.sel')?.focus({ preventScroll:true }); } } });
  }
  function showXEvent() {
    if (S.overlay || !progress.claimGiftEvent()) return;          // 처음 부른 한 곳만 true → 이벤트는 정확히 한 번
    lock(); sfx?.play('bell');
    openXEvent({ parent:document.body, sfx, reduced, onDone:() => {
      unlock(); if (S.destroyed) return;
      S.tab = 'buy'; S.sel.buy = GIFT.id; S.qty = 1; S.wiggleId = GIFT.id; renderAll(); say(pick('gift')); $('.sh-row.sel')?.focus({ preventScroll:true });
    } });
  }

  /* ---------- 행동 ---------- */
  const needsConfirm = (info, total) => total >= 200 || ['rare', 'special'].includes(info.tier);
  function act(button) {
    if (S.busy || S.closing || S.overlay) return;
    const id = S.sel[S.tab]; if (!id) return;
    if (id === GIFT.id) return actGift();
    const buying = S.tab === 'buy', info = describeItem(id);
    const all = !buying && button?.dataset.n === 'all', qty = buying ? S.qty : all ? progress.count(id) : 1;
    const quote = buying ? quoteBuy(progress.state, shop, id, qty) : quoteSell(progress.state, shop, id, qty);
    if (!quote.ok) { fail(quote.reason); return; }
    // 비싼 물건·희귀한 물건을 팔 때는 한 번 더 눌러야 팝니다(실수 방지)
    const key = id + ':' + (all ? 'all' : qty);
    if (!buying && needsConfirm(info, quote.total) && S.confirm !== key) {
      S.confirm = id + ':' + (all ? 'all' : '1'); renderDetail(); clearTimeout(S.confirmTimer); S.confirmTimer = setTimeout(() => { S.confirm = null; if (!S.destroyed) renderDetail(); }, 3200); sfx?.play('ui'); return;
    }
    S.busy = true; S.confirm = null; clearTimeout(S.confirmTimer);
    const result = buying ? buy(progress, shop, id, qty) : all ? sellAll(progress, shop, id) : sell(progress, shop, id, qty);
    if (!result.ok) { S.busy = false; fail(result.reason); renderAll(); return; }
    const bigIcon = $('.sh-big'), actBtn = button || $('.sh-act');
    if (buying) { sfx?.play('buy'); sparkle(bigIcon, info.unique ? 12 : 7); floatText('−' + fmt(result.total), coinsBox, 'out'); say(pick('buy')); }
    else {
      sfx?.play('coin'); coinFly(bigIcon || actBtn, coinsBox, Math.min(8, 2 + Math.ceil(result.qty / 2))); floatText('+' + fmt(result.total), coinsBox, 'in');
      say(result.rare ? pick('rare') : result.total >= 200 ? pick('sellBig') : pick('sell'));
    }
    setCoins(progress.state.coins);
    S.qty = 1; S.wiggleId = id; renderAll();
    popEl($('.sh-own-n')); popEl($('.sh-row.sel .sh-own'));
    setTimeout(() => { S.busy = false; }, reduced ? 0 : 260);
    if (!buying && result.unlockedNow) setTimeout(showXEvent, reduced ? 0 : 900);   // 동전이 다 들어간 뒤에 엑스가 나타납니다
  }
  function actGift() {
    if (progress.state.gift.bought) { sfx?.play('ui'); return showReward(false); }
    const quote = quoteGift(progress.state); if (!quote.ok) { fail(quote.reason); return; }
    S.busy = true;
    const result = buyGift(progress);
    if (!result.ok) { S.busy = false; fail(result.reason); renderAll(); return; }
    sfx?.play('buy'); sparkle($('.sh-big'), 14); floatText('−' + fmt(result.total), coinsBox, 'out'); setCoins(progress.state.coins); renderAll();
    setTimeout(() => { S.busy = false; showReward(true); }, reduced ? 0 : 450);
  }
  function fail(reason) {
    sfx?.play('deny'); say(pick(REASON_LINE[reason] || 'nobuy')); renderDetail();
    const why = $('.sh-why'); if (why) { why.textContent = REASON_TEXT[reason] || ''; if (!reduced) { why.classList.remove('shake'); void why.offsetWidth; why.classList.add('shake'); } }
  }
  function renderAll() { renderList(); }
  function select(id) { if (S.sel[S.tab] === id) return; S.sel[S.tab] = id; S.qty = 1; S.confirm = null; S.wiggleId = id; sfx?.play('ui'); renderList(); const row = $(`.sh-row[data-id="${CSS.escape(id)}"]`); row?.focus({ preventScroll:true }); row?.scrollIntoView({ block:'nearest' }); }
  function setTab(tab) {
    if (S.tab === tab) return; S.tab = tab; S.qty = 1; S.confirm = null; sfx?.play('ui'); renderList();
    say(tab === 'sell' && !rowsNow().length ? pick('empty') : pick('greet'), false);
  }
  function on(target, type, handler, options) { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); }

  on(root, 'click', event => {
    const row = event.target.closest('.sh-row'); if (row) return select(row.dataset.id);
    const tab = event.target.closest('.sh-tab'); if (tab) return setTab(tab.dataset.tab);
    if (event.target.closest('.sh-plus')) { const max = maxBuyQty(S.sel.buy); if (S.qty < Math.max(1, max)) S.qty++; S.confirm = null; sfx?.play('ui'); return renderDetail(); }
    if (event.target.closest('.sh-minus')) { S.qty = Math.max(1, S.qty - 1); sfx?.play('ui'); return renderDetail(); }
    if (event.target.closest('.sh-max')) { S.qty = Math.max(1, maxBuyQty(S.sel.buy)); sfx?.play('ui'); return renderDetail(); }
    const actBtn = event.target.closest('.sh-act'); if (actBtn) return act(actBtn);
    if (event.target.closest('.sh-close')) return close();
  });
  on(root, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.target.closest('.sh-list') && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault(); const list = rowsNow(), i = list.findIndex(row => row.id === S.sel[S.tab]), next = list[Math.max(0, Math.min(list.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1)))]; if (next) select(next.id);
    }
    if (event.key === 'Tab') {   // 상점 안에서만 초점이 돌게
      const focusable = $$('button:not([hidden]), [tabindex="0"]').filter(el => el.offsetParent !== null); if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  on(document, 'keydown', event => { if (event.key === 'Escape' && !S.closing && !S.destroyed && !S.overlay && !document.querySelector('.gx-root')) { event.preventDefault(); close(); } });
  const unsubscribe = progress.subscribe(() => { if (!S.busy && !S.destroyed && S.shownCoins !== progress.state.coins) setCoins(progress.state.coins, true); });

  function close() {
    if (S.closing || S.overlay) return; S.closing = true; unsubscribe();
    say(pick('bye'));
    const done = () => { S.destroyed = true; cancelAnimationFrame(coinRaf); listeners.forEach(off => off()); root.remove(); onClose?.(); };
    if (reduced) done(); else { root.classList.add('is-leaving'); setTimeout(done, 380); }
  }

  /* ---------- 시작 ---------- */
  coinsEl.textContent = fmt(S.shownCoins); renderList();
  say(pick('greet'), false);
  if (!reduced) root.classList.add('is-entering'); setTimeout(() => root.classList.remove('is-entering'), 600);
  $('.sh-close').focus({ preventScroll:true });
  // 이미 5,000 코인을 넘었는데 이벤트를 아직 못 본 경우(예: 이벤트 직전에 창을 닫았을 때)에는 들어오자마자 보여 줍니다.
  if (progress.state.gift.unlocked && !progress.state.gift.seen) setTimeout(showXEvent, reduced ? 0 : 500);
  return { root, close, destroy:() => { if (!S.destroyed) { S.closing = true; unsubscribe(); S.destroyed = true; listeners.forEach(off => off()); root.remove(); } },
    debug:() => ({ tab:S.tab, sel:S.sel[S.tab], qty:S.qty, shownCoins:S.shownCoins, busy:S.busy, closing:S.closing, overlay:S.overlay }) };
}
