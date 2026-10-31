import { loadingLines, narrative, results, assets } from './data.js';
import { readSave, writeSave } from './storage.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const game = $('game'), settings = $('settings'), sound = new Sound();
const preferences = readSave(), systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let scene = 'title', controller = new AbortController(), line = 0, typeTimer = 0, fullText = '', typing = false;
const reduced = () => preferences.reducedMotion || systemMotion.matches;
function persist() { $('storage-notice').hidden = writeSave(preferences); }
function focus(element) { if (!settings.open) element?.focus({ preventScroll: true }); }
function updateSettings() {
  game.classList.toggle('reduced-motion', reduced());
  $('sound').checked = preferences.sound; $('motion').checked = preferences.reducedMotion;
  $('speed').value = preferences.speed;
  $('motion-note').textContent = systemMotion.matches ? '기기의 동작 줄이기 설정이 적용 중입니다.' : '빛과 움직임을 차분하게 표시합니다.';
  sound.setEnabled(preferences.sound);
}
systemMotion.addEventListener('change', updateSettings);
function setScene(next) {
  controller.abort(); controller = new AbortController(); clearInterval(typeTimer); typing = false;
  scene = next; game.dataset.scene = next;
  game.classList.remove('anomaly', 'blooming', 'revealing');
  for (const id of ['title', 'loading', 'story', 'notification', 'result']) $(id).hidden = id !== next;
  $('skip').hidden = !['loading', 'transition'].includes(next);
  $('continue').disabled = !preferences.completed;
  $('save-status').textContent = preferences.completed ? '낯선 아침에서 계속' : '저장 기록 없음';
}
function routeHash(hash, replace = false) {
  if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
}
function wait(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve(false);
    const cancel = () => { clearTimeout(timer); resolve(false); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(true); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
function title(fromHistory = false) {
  setScene('title'); if (!fromHistory) routeHash('#title'); focus($('new-game'));
}
async function launch() {
  if (scene !== 'title') return;
  sound.play(); setScene('loading'); routeHash('#opening');
  const signal = controller.signal;
  $('logs').replaceChildren(); $('progress').value = 0; $('percent').textContent = '0%';
  $('connection').textContent = ''; $('load-label').textContent = 'PREPARING YOUR WORLD';
  focus($('skip'));
  const values = [8, 23, 40, 58, 73, 86, 94, 99];
  for (let i = 0; i < loadingLines.length; i++) {
    if (!(await wait(reduced() ? 180 : (i > 4 ? 850 : 570), signal))) return;
    const entry = document.createElement('p'); entry.textContent = loadingLines[i];
    if (i >= 5) entry.className = 'strange';
    $('logs').append(entry); $('progress').value = values[i]; $('percent').textContent = values[i] + '%';
    game.classList.toggle('anomaly', i >= 5);
  }
  $('load-label').textContent = 'AWAITING SYNCHRONIZATION';
  if (!(await wait(reduced() ? 450 : 1500, signal))) return;
  $('connection').textContent = 'CONNECTION ESTABLISHED\nEntering MISTVALE...';
  $('progress').value = 100; $('percent').textContent = '100%';
  if (!(await wait(reduced() ? 300 : 950, signal))) return;
  transition();
}
async function transition() {
  setScene('transition'); $('loading').hidden = false;
  const signal = controller.signal;
  game.classList.add('blooming'); focus($('skip'));
  if (!(await wait(reduced() ? 350 : 3600, signal))) return;
  awaken(false, true);
}
async function awaken(fromHistory = false, reveal = false) {
  setScene('story'); if (!fromHistory) routeHash('#awakening', true);
  line = 0; $('ver-wrap').hidden = true; $('dialogue').hidden = reveal;
  if (reveal) {
    game.classList.add('revealing'); const signal = controller.signal;
    if (!(await wait(reduced() ? 150 : 1700, signal))) return;
    game.classList.remove('revealing');
  }
  $('dialogue').hidden = false; showLine(); focus($('dialogue'));
}
function finishText() {
  clearInterval(typeTimer); typing = false; $('dialogue-text').textContent = fullText;
  $('dialogue').classList.remove('typing');
}
function showLine() {
  clearInterval(typeTimer);
  const item = narrative[line]; fullText = item.text;
  $('speaker').textContent = item.speaker;
  $('ver-wrap').hidden = item.speaker !== '베르';
  $('accessible-dialogue').textContent = `${item.speaker}: ${item.text}`;
  $('line-counter').textContent = `${String(line + 1).padStart(2, '0')} / ${String(narrative.length).padStart(2, '0')}`;
  const delay = { slow: 65, normal: 35, fast: 16, instant: 0 }[preferences.speed];
  if (!delay || reduced()) return finishText();
  let position = 0; typing = true; $('dialogue-text').textContent = ''; $('dialogue').classList.add('typing');
  typeTimer = setInterval(() => {
    position++; $('dialogue-text').textContent = fullText.slice(0, position);
    if (position >= fullText.length) finishText();
  }, delay);
}
function advance() {
  if (scene !== 'story' || settings.open || $('dialogue').hidden) return;
  if (typing) return finishText();
  sound.play();
  if (++line < narrative.length) showLine(); else notify();
}
function notify(fromHistory = false) {
  setScene('notification'); preferences.completed = true; persist();
  if (!fromHistory) routeHash('#choices', true);
  focus(document.querySelector('[data-choice]')); sound.play('arrival');
}
function result(kind, fromHistory = false) {
  if (!results[kind]) return notify();
  setScene('result'); const data = results[kind];
  $('result-label').textContent = data.label; $('result-heading').textContent = data.heading;
  $('result-description').textContent = data.text; $('result-note').textContent = data.note;
  $('result-ver').hidden = kind !== 'logout'; $('result').classList.toggle('error-result', kind === 'logout');
  if (!fromHistory) routeHash('#' + kind); focus($('result-heading')); sound.play();
}
function restoreRoute() {
  const route = location.hash.slice(1);
  if (route === 'awakening') awaken(true);
  else if (route === 'choices' && preferences.completed) notify(true);
  else if (results[route] && preferences.completed) result(route, true);
  else { title(true); routeHash('#title', true); }
}
function openSettings() { if (!settings.open) settings.showModal(); }
$('new-game').addEventListener('click', launch);
$('continue').addEventListener('click', () => { if (preferences.completed) { sound.play(); awaken(); } });
$('skip').addEventListener('click', () => { if (['loading', 'transition'].includes(scene)) awaken(); });
$('dialogue').addEventListener('click', advance);
$('back-choices').addEventListener('click', () => notify());
document.querySelectorAll('[data-title]').forEach(button => button.addEventListener('click', () => title()));
document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => { if (scene === 'notification') result(button.dataset.choice); }));
[$('settings-open'), $('title-settings')].forEach(button => button.addEventListener('click', openSettings));
$('sound').addEventListener('change', e => { preferences.sound = e.target.checked; updateSettings(); persist(); sound.play(); });
$('motion').addEventListener('change', e => { preferences.reducedMotion = e.target.checked; updateSettings(); persist(); if (typing && reduced()) finishText(); });
$('speed').addEventListener('change', e => { preferences.speed = e.target.value; persist(); if (scene === 'story') finishText(); });
window.addEventListener('hashchange', restoreRoute);
window.addEventListener('keydown', e => {
  if (e.repeat || settings.open) return;
  if ((e.key === 'Enter' || e.key === ' ') && scene === 'story' && !['BUTTON', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); advance(); }
});
for (const [name, url] of Object.entries(assets)) {
  const img = new Image(); img.src = url;
  img.onerror = () => {
    game.classList.add('missing-' + name);
    if (name === 'ver') { $('ver').hidden = true; $('ver-fallback').hidden = false; }
  };
}
document.querySelectorAll('#result-ver img').forEach(img => img.addEventListener('error', () => { img.hidden = true; }));
updateSettings(); restoreRoute();
