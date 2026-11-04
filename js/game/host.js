// 미니게임 공통 껍데기: 전체 화면 오버레이, 튜토리얼, 결과 카드, 소지품 패널, 전환.
import { describeItem, TIERS } from './items.js?v=mg4';
import { GROUPS, groupOf, isProtected } from './goods.js?v=mg4';
import { SHOPS, GIFT } from './shop-data.js?v=mg4';
import { sellPrice } from './shop-engine.js?v=mg4';
import { GIFT_ICON } from './gift-ui.js?v=mg4';
import { effectText } from './shop-ui.js?v=mg4';
import { levelOf } from './progress.js?v=mg4';
import { iconImg, uiIcon } from './art.js?v=mg4';

/* 소지품 아이콘: 픽셀 그림(art.js) */
export function itemIcon(info, size = 28) { return iconImg(info, size); }
const el = (tag, cls, html) => { const node = document.createElement(tag); if (cls) node.className = cls; if (html !== undefined) node.innerHTML = html; return node; };
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const TUTORIAL_KEY = 'mistvale.minigameTutorial.v1';
const seenTutorial = id => { try { return (JSON.parse(localStorage.getItem(TUTORIAL_KEY)) || {})[id] === true; } catch { return false; } };
const markTutorial = id => { try { const v = JSON.parse(localStorage.getItem(TUTORIAL_KEY)) || {}; v[id] = true; localStorage.setItem(TUTORIAL_KEY, JSON.stringify(v)); } catch { /* 저장 불가: 매번 보입니다 */ } };

export class MinigameHost {
  constructor({ parent, progress, sfx, reduced, onClose }) {
    Object.assign(this, { parent, progress, sfx, reduced, onClose }); this.cleanup = []; this.closed = false;
  }
  open({ id, title, subtitle }) {
    this.id = id;
    this.root = el('div', 'mg-root'); this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true'); this.root.setAttribute('aria-label', title); this.root.dataset.game = id;
    const btn = (cls, icon, label) => `<button type="button" class="px-ico ${cls}" aria-label="${label}" title="${label}"><img class="pxi" src="${uiIcon(icon)}" alt="" width="26" height="26"></button>`;
    this.root.innerHTML = `<div class="mg-stage"></div>
      <div class="mg-hud"><div class="mg-plaque px"><div><strong>${esc(title)}</strong><small>${esc(subtitle || '')}</small></div><span class="mg-skill" aria-live="polite"></span></div>
        <div class="mg-tools">${btn('mg-sfx', 'sound', '효과음 켜기/끄기')}${btn('mg-help', 'help', '조작법')}${btn('mg-close', 'close', '그만두기')}</div></div>
      <div class="mg-layer" hidden></div><div class="mg-sr" role="status" aria-live="polite"></div>`;
    this.stage = this.root.querySelector('.mg-stage'); this.layer = this.root.querySelector('.mg-layer'); this.live = this.root.querySelector('.mg-sr');
    this.sfxBtn = this.root.querySelector('.mg-sfx'); this.skillEl = this.root.querySelector('.mg-skill');
    this.#syncSfx();
    this.sfxBtn.addEventListener('click', () => { this.sfx.setEnabled(!this.sfx.enabled); this.#syncSfx(); if (this.sfx.enabled) this.sfx.play('ui'); try { localStorage.setItem('mistvale.mgSound', this.sfx.enabled ? '1' : '0'); } catch { /* 저장 불가 */ } });
    this.root.querySelector('.mg-close').addEventListener('click', () => this.requestClose());
    this.root.querySelector('.mg-help').addEventListener('click', () => this.showTutorial(true));
    this.parent.append(this.root);
    this.keyHandler = event => { if (event.key === 'Escape') { event.preventDefault(); if (!this.layer.hidden && this.layer.dataset.kind === 'tutorial') this.hideLayer(); else this.requestClose(); } };
    document.addEventListener('keydown', this.keyHandler);
    this.refreshSkill();
    return this;
  }
  #syncSfx() { this.sfxBtn.querySelector('img').src = uiIcon(this.sfx.enabled ? 'sound' : 'mute'); this.sfxBtn.setAttribute('aria-pressed', String(this.sfx.enabled)); this.sfxBtn.title = this.sfx.enabled ? '효과음 끄기' : '효과음 켜기'; }
  refreshSkill() {
    const skill = { fishing:'fishing', cooking:'cooking', mining:'mining', gathering:'gathering' }[this.id]; const level = levelOf(this.progress.state.skills[skill] || 0);
    const names = { fishing:'낚시', cooking:'요리', mining:'채광', gathering:'채집' };
    this.skillEl.textContent = `Lv.${level.level}`; this.skillEl.title = `${names[skill]} 숙련도`;
  }
  say(message) { this.live.textContent = message; }
  setGame(game) { this.game = game; }
  requestClose() { if (this.closed) return; if (this.game?.busy?.()) { this.confirmClose(); return; } this.close(); }
  confirmClose() {
    this.showLayer('confirm', `<div class="mg-card mg-small px"><h2>그만둘까요?</h2><p class="mg-body">${esc(this.game.leaveWarning?.() || '진행 중인 일이 있습니다. 지금 나가면 이번 시도는 실패로 끝납니다.')}</p><div class="mg-actions"><button class="px-btn" data-a="stay">계속하기</button><button class="px-btn alt" data-a="leave">그만두기</button></div></div>`);
    this.layer.querySelector('[data-a=stay]').addEventListener('click', () => { this.hideLayer(); this.game.resume?.(); }, { once:true });
    this.layer.querySelector('[data-a=leave]').addEventListener('click', () => { this.game.abort?.(); this.close(); }, { once:true });
    this.game.pause?.(); this.layer.querySelector('[data-a=stay]').focus();
  }
  showLayer(kind, html) { this.layer.dataset.kind = kind; this.layer.innerHTML = html; this.layer.hidden = false; this.root.classList.add('has-layer'); return this.layer; }
  hideLayer() { this.layer.hidden = true; this.layer.innerHTML = ''; this.root.classList.remove('has-layer'); this.game?.layerClosed?.(); }
  /* 튜토리얼: 처음 한 번 자동으로, 이후엔 '조작법' 버튼으로 */
  showTutorial(force = false, onDone) {
    const info = this.game?.tutorial; if (!info) { onDone?.(); return; }
    if (!force && seenTutorial(this.id)) { onDone?.(); return; }
    const pages = info.pages; let index = 0;
    const draw = () => {
      const page = pages[index], last = index === pages.length - 1;
      this.showLayer('tutorial', `<div class="mg-card mg-tutorial px"><p class="mg-kicker">${esc(info.title)} 배우기</p><h2>${esc(page.title)}</h2><div class="mg-demo">${page.demo || ''}</div><p class="mg-body">${page.text}</p>
        <div class="mg-dots">${pages.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>
        <div class="mg-actions">${index ? '<button class="px-btn alt" data-a="prev">이전</button>' : '<span></span>'}<button class="px-btn" data-a="next">${last ? (force ? '닫기' : '시작!') : '다음'}</button></div></div>`);
      this.layer.querySelector('[data-a=next]').addEventListener('click', () => { this.sfx.play('ui'); if (last) { markTutorial(this.id); this.hideLayer(); onDone?.(); } else { index++; draw(); } });
      this.layer.querySelector('[data-a=prev]')?.addEventListener('click', () => { index--; draw(); });
      this.layer.querySelector('[data-a=next]').focus();
    };
    this.game.pause?.(); draw();
  }
  /* 결과 카드. rewards: [{item(id), n}] consumed: [{item,n}] */
  showResult({ tone, title, message, detail, rewards = [], consumed = [], xp, level, actions }) {
    let order = 0;
    const slot = (entry, sign) => { const info = describeItem(entry.item); return `<li class="mg-slot ${sign === '+' ? 'gain' : 'cost'}" style="--i:${order++}" title="${esc(entry.note || info.desc || '')}"><span class="box">${iconImg(info, 56)}<span class="qty">${sign}${entry.n}</span></span><b>${esc(info.name)}</b>${info.tier && TIERS[info.tier] ? `<em class="tier-${info.tier}">${TIERS[info.tier]}</em>` : ''}</li>`; };
    const rows = [...rewards.map(r => slot(r, '+')), ...consumed.map(r => slot(r, '−'))].join('');
    this.showLayer('result', `<div class="mg-card mg-result tone-${tone} px"><h2 class="mg-ribbon">${esc(title)}</h2>${message ? `<p class="mg-sub">${esc(message)}</p>` : ''}
      ${rows ? `<ul class="mg-loot">${rows}</ul>` : ''}${!rewards.length && !consumed.length ? '<p class="mg-none">얻은 것도, 소비한 것도 없어요.</p>' : ''}
      ${detail ? `<p class="mg-why">${esc(detail)}</p>` : ''}${xp ? `<p class="mg-xp">${esc(xp)}</p>` : ''}${level ? `<p class="mg-level">${esc(level)}</p>` : ''}
      <div class="mg-actions">${actions.map((a, i) => `<button class="px-btn ${a.primary ? '' : 'alt'}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`);
    this.layer.querySelectorAll('[data-i]').forEach(button => button.addEventListener('click', () => { this.sfx.play('ui'); const action = actions[Number(button.dataset.i)]; this.hideLayer(); action.run?.(); }));
    (this.layer.querySelector('.px-btn:not(.alt)') || this.layer.querySelector('button'))?.focus();
    this.refreshSkill(); this.say(title + '. ' + (message || ''));
  }
  close() {
    if (this.closed) return; this.closed = true;
    document.removeEventListener('keydown', this.keyHandler);
    this.game?.destroy?.(); this.sfx.stopHum();
    this.root.remove(); this.onClose?.();
  }
}

/* ---------- 소지품 패널 (월드 화면 공용) ---------- */
// 간결한 목록: 분류별(물고기·광석·재료·요리·미끼·장비)로 이름과 수량만 보여 주고, 물건을 누르면 설명과 팔 값이 나옵니다.
function packDetail(id, n) {
  const info = describeItem(id), price = sellPrice(SHOPS.clover, id), shop = SHOPS.clover.name;
  const where = isProtected(info) ? '<p class="pack-lock">고유 장비라서 되팔 수 없어요.</p>'
    : price ? `<p class="pack-where"><span>${esc(shop)}에서 개당 <em>${price.toLocaleString('ko-KR')}코인</em></span></p>` : '';
  const eff = effectText(info).map(line => `<p class="pack-eff">${esc(line)}</p>`).join('');
  return `<div class="pack-detail"><span class="mg-ico">${itemIcon(info, 30)}</span><div><h4>${esc(info.name)}<em class="pack-n">×${n}</em></h4><p>${esc(info.desc || '')}</p>${eff}${where}</div></div>`;
}
export function renderPack(progress, selectedId = '') {
  const state = progress.state, byGroup = {};
  for (const [id, n] of Object.entries(state.items)) { const info = describeItem(id); (byGroup[groupOf(info.kind)] ||= []).push({ info, n, id }); }
  const skillNames = { fishing:'낚시', gathering:'채집', cooking:'요리', mining:'채광' };
  const skills = Object.keys(skillNames).map(key => { const lv = levelOf(state.skills[key]); return `<li><b>${skillNames[key]}</b><span>Lv.${lv.level}</span><small>${lv.max ? 'MAX' : lv.xp + ' / ' + lv.next + ' XP'}</small></li>`; }).join('');
  let html = `<div class="pack-gold"><span>코인</span><b>${state.coins.toLocaleString('ko-KR')} 코인</b></div><p class="pack-note pack-own">이 사이트의 미니게임용 코인이에요. 케이브덕 본편의 소지금(G)과는 별개예요.</p><ul class="pack-skills">${skills}</ul>`;
  const selected = selectedId && state.items[selectedId] > 0 ? selectedId : '';
  html += selected ? packDetail(selected, state.items[selected]) : '<p class="pack-tip">물건을 누르면 설명과 팔 값이 나와요.</p>';
  let any = false;
  for (const group of GROUPS) {
    const list = byGroup[group.id]; if (!list?.length) continue; any = true;
    html += `<h3>${group.label}<small>${list.length}종</small></h3><ul class="pack-list">` + list.sort((a, b) => a.info.name.localeCompare(b.info.name, 'ko')).map(({ info, n, id }) => `<li class="${id === selected ? 'sel' : ''}" data-pack-item="${esc(id)}" role="button" tabindex="0" aria-pressed="${id === selected}" title="${esc(info.desc || '')}"><span class="mg-ico">${itemIcon(info, 30)}</span><span><b>${esc(info.name)}</b>${info.tier && TIERS[info.tier] ? `<em class="tier-${info.tier}">${TIERS[info.tier]}</em>` : isProtected(info) ? '<em class="tier-special">고유</em>' : ''}</span><strong>×${n}</strong></li>`).join('') + '</ul>';
  }
  if (!any) html += '<p class="pack-empty">아직 소지품이 없습니다. 은빛 호수나 푸른물결 해안에서 낚시를, 속삭임 숲에서 채집을, 습한 동굴에서 채광을 해 보세요. 얻은 물건은 클로버 잡화점에서 팔 수 있어요.</p>';
  if (state.gift.bought) html += `<h3>받은 선물</h3><ul class="pack-list"><li class="pack-gift"><span class="mg-ico">${itemIcon({ ...GIFT_ICON }, 30)}</span><span><b>${esc(GIFT.name)}</b><em class="tier-special">코드</em></span><button type="button" class="px-btn" data-open-reward>코드 보기</button></li></ul>`;
  const caught = Object.keys(state.caught).length;
  if (caught) html += `<p class="pack-note">낚시 도감 ${caught}종 기록됨</p>`;
  if (!progress.persistent) html += '<p class="pack-warn">이 브라우저는 저장을 막고 있어, 페이지를 닫으면 소지품이 사라집니다.</p>';
  html += '<p class="pack-note">저장은 이 브라우저 안에서만 이뤄져요. 다른 브라우저나 기기와는 이어지지 않아요.</p>';
  return html;
}
