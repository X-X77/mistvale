// 엑스의 비밀 선물 화면 두 가지.
//   openXEvent  : 누적 5,000코인에 처음 닿았을 때 한 번만 열리는 작은 이벤트 창(상자를 열고 엑스가 놀립니다)
//   openReward  : 선물을 산 뒤 코드와 복사 버튼을 보여 주는 보상 화면(소지품·상점에서 언제든 다시 열 수 있음)
// 코드는 구매한 뒤에만 이 화면에 그려집니다. 이 사이트는 케이브덕과 연동되지 않고, 코드가 쓰였는지 확인하지도 않습니다.
import { iconImg, uiIcon } from './art.js?v=mg4';
import { GIFT, GIFT_NOTE, giftCode } from './shop-data.js?v=mg4';

const CHEST = { id:'ui-chest', kind:'ui', icon:'chest', color:'#b8844c' }, CHEST_OPEN = { id:'ui-chest-open', kind:'ui', icon:'chestOpen', color:'#b8844c' };
export const GIFT_ICON = { id:'ui-gift', kind:'ui', icon:'gift', color:'#c96ab0' };
const X_SRC = './assets/ver-illustration.webp';
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

const X_LINES = [
  '……어라? 벌써 이렇게 모았어? 생각보다 제법인데, 농장주님? 흥, 특별히 이 몸이 준비한 걸 보여주지.',
  '비밀 선물이 열렸어. 클로버 잡화점 한구석에 올려놨으니까, 코인이 충분하면 가져가든가. ……칭찬 아니거든?',
];

function shell(parent, label, extraClass = '') {
  const root = document.createElement('div');
  root.className = 'gx-root ' + extraClass; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', label);
  parent.append(root); return root;
}
function sparkles(host, reduced, count = 9) {
  if (reduced || !host) return;
  const url = uiIcon('spark', '#fff3a8');
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i'); s.className = 'gx-spark'; s.style.backgroundImage = `url(${url})`;
    const a = (i / count) * Math.PI * 2 + Math.random() * .5, r = 36 + Math.random() * 34;
    s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r - 10 + 'px'); s.style.animationDelay = i * 40 + 'ms';
    host.append(s); setTimeout(() => s.remove(), 1000 + i * 40);
  }
}
function trapKeys(root, close) {
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
    if (event.key === 'Tab') {
      const items = [...root.querySelectorAll('button:not([hidden])')]; if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);   // 상점의 Esc 처리보다 먼저 받아서, Esc 가 상점까지 닫지 않게 합니다
  return () => document.removeEventListener('keydown', onKey, true);
}

/* ---------------- 엑스 이벤트 ---------------- */
export function openXEvent({ parent = document.body, sfx, reduced = false, onDone } = {}) {
  const root = shell(parent, '엑스의 비밀 선물 이벤트', 'gx-event');
  root.innerHTML = `<div class="gx-card px" data-step="0">
    <div class="gx-stage" aria-hidden="true"><span class="gx-glow"></span><img class="gx-x" src="${X_SRC}" alt="" draggable="false"><span class="gx-chest">${iconImg(CHEST, 96)}</span><span class="gx-fx"></span></div>
    <p class="gx-prompt">어디선가 작은 상자가 달그락거려요…</p>
    <div class="gx-say px" hidden><b>엑스</b><p></p></div>
    <div class="gx-actions"><button type="button" class="px-btn gx-next">상자 열기</button></div></div>`;
  const $ = sel => root.querySelector(sel), card = $('.gx-card'), say = $('.gx-say'), sayText = say.querySelector('p'), next = $('.gx-next'), prompt = $('.gx-prompt');
  let step = 0, typing = 0, closed = false, typedAll = true;
  const finishTyping = () => { clearInterval(typing); sayText.textContent = X_LINES[Math.max(0, step - 1)] || ''; typedAll = true; };
  function typeLine(text) {
    clearInterval(typing); sayText.textContent = ''; typedAll = false;
    if (reduced) { sayText.textContent = text; typedAll = true; return; }
    let i = 0; typing = setInterval(() => { sayText.textContent = text.slice(0, ++i); if (i % 3 === 0) sfx?.play('ui'); if (i >= text.length) { clearInterval(typing); typedAll = true; } }, 28);
  }
  function advance() {
    if (closed) return;
    if (step === 0) {            // 상자를 연다
      step = 1; card.dataset.step = '1'; prompt.hidden = true; say.hidden = false;
      $('.gx-chest').innerHTML = iconImg(CHEST_OPEN, 96); sfx?.play('level'); sparkles($('.gx-fx'), reduced, 12);
      typeLine(X_LINES[0]); next.textContent = '다음'; return;
    }
    if (!typedAll) return finishTyping();
    if (step < X_LINES.length) { step++; typeLine(X_LINES[step - 1]); if (step === X_LINES.length) next.textContent = '상점에서 보기'; return; }
    close();
  }
  function close() {
    if (closed) return; closed = true; clearInterval(typing); off(); root.classList.add('is-leaving');
    setTimeout(() => { root.remove(); onDone?.(); }, reduced ? 0 : 220);
  }
  const off = trapKeys(root, close);
  next.addEventListener('click', advance);
  if (!reduced) card.classList.add('is-in');
  next.focus({ preventScroll:true });
  return { root, close, advance, debug:() => ({ step, closed, typedAll }) };
}

/* ---------------- 보상 화면 (코드 + 복사) ---------------- */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok;
    } catch { return false; }
  }
}
/** 선물을 산 상태에서만 코드를 그립니다. reveal 이면 상자가 열리는 연출부터 보여 줍니다. */
export function openReward({ progress, parent = document.body, sfx, reduced = false, reveal = false, onClose } = {}) {
  if (!progress?.state.gift.bought) return null;   // 구매 전에는 코드 문자열을 화면에 올리지 않습니다
  const root = shell(parent, GIFT.name + ' 보상', 'gx-reward');
  root.innerHTML = `<div class="gx-card px is-in">
    <div class="gx-stage small" aria-hidden="true"><span class="gx-glow"></span><span class="gx-chest">${iconImg(reveal ? CHEST : CHEST_OPEN, 80)}</span><span class="gx-fx"></span></div>
    <h2>${esc(GIFT.name)}</h2><p class="gx-sub">특별 시작 코드</p>
    <div class="gx-codebox"><code class="gx-code" tabindex="0" aria-label="특별 시작 코드">${esc(giftCode())}</code><button type="button" class="px-btn gx-copy">복사</button></div>
    <p class="gx-copy-msg" role="status" aria-live="polite"></p>
    <p class="gx-effect">${esc(GIFT.effect)}</p>
    <p class="gx-note">${esc(GIFT_NOTE)}</p>
    <p class="gx-xline"><b>엑스</b> 흥, 잃어버렸으면 또 와서 봐. 한 번 산 건 다시 안 사도 되니까.</p>
    <div class="gx-actions"><button type="button" class="px-btn alt gx-close">닫기</button></div></div>`;
  const $ = sel => root.querySelector(sel), msg = $('.gx-copy-msg'), code = $('.gx-code'), copyBtn = $('.gx-copy');
  let closed = false;
  if (reveal) { code.classList.add('sealed'); setTimeout(() => { if (closed) return; $('.gx-chest').innerHTML = iconImg(CHEST_OPEN, 80); sfx?.play('level'); sparkles($('.gx-fx'), reduced, 12); code.classList.remove('sealed'); }, reduced ? 0 : 520); }
  async function copy() {
    const ok = await copyText(giftCode()); sfx?.play(ok ? 'coin' : 'deny');
    msg.textContent = ok ? '복사했어요! 케이브덕에서 붙여넣어 쓰세요.' : '복사하지 못했어요. 코드를 길게 눌러 직접 복사해 주세요.';
    copyBtn.textContent = ok ? '복사됨' : '복사'; if (!ok) { const range = document.createRange(); range.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); }
    setTimeout(() => { if (!closed) copyBtn.textContent = '복사'; }, 1600);
  }
  function close() { if (closed) return; closed = true; off(); root.classList.add('is-leaving'); setTimeout(() => { root.remove(); onClose?.(); }, reduced ? 0 : 200); }
  const off = trapKeys(root, close);
  copyBtn.addEventListener('click', copy); $('.gx-close').addEventListener('click', close);
  copyBtn.focus({ preventScroll:true });
  return { root, close, debug:() => ({ closed }) };
}
