import { narrative, results, assets } from './data.js';
import { readSave, writeSave } from './storage.js';
import { Sound } from './audio.js';
import { Music } from './music.js';
import { createPixelLoader, prepareImages } from './loading.js';
import { readingTime } from './dialogue-timing.js';

const $ = id => document.getElementById(id);
const game=$('game'), settings=$('settings'), sound=new Sound();
const music=new Music({onChange:()=>updateMusicButton()});
function updateMusicButton(){
  const button=$('music-toggle');if(!button)return;
  const playing=music.isPlaying();
  button.textContent=playing?'♫ BGM 켜짐':'♫ BGM 시작';
  button.setAttribute('aria-pressed',String(playing));
  button.setAttribute('aria-label',playing?'배경음악 끄기':'배경음악 시작');
}
function toggleMusic(){
  if(music.isPlaying()){music.setEnabled(false);}else{music.setEnabled(true);music.activate();}
  updateMusicButton();
}
const preferences=readSave(), systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
let scene='title',controller=new AbortController(),line=0,typeTimer=0,autoTimer=0;
let fullText='',typing=false,auto=true,choosing=false;
const reduced=()=>preferences.reducedMotion||systemMotion.matches;
const farmLoader=createPixelLoader($('farm-animation'),{reduced});
function persist(){ $('storage-notice').hidden=writeSave(preferences); }
function focus(element){if(!settings.open)element?.focus({preventScroll:true});}
function updateSettings(){
  game.classList.toggle('reduced-motion',reduced());
  $('sound').checked=preferences.sound;$('motion').checked=preferences.reducedMotion;$('speed').value=preferences.speed;
  $('motion-note').textContent=systemMotion.matches?'기기의 동작 줄이기 설정이 적용 중입니다.':'빛과 움직임을 차분하게 표시합니다.';
  sound.setEnabled(preferences.sound);
}
function cancelAuto(){clearTimeout(autoTimer);autoTimer=0;}
function scheduleAuto(){
  cancelAuto();
  if(!auto||typing||scene!=='story'||settings.open||document.hidden||$('dialogue-shell').hidden)return;
  const expectedLine=line,signal=controller.signal;
  autoTimer=setTimeout(()=>{
    if(!signal.aborted&&line===expectedLine&&auto&&!settings.open&&!document.hidden)advance(false);
  },readingTime(fullText,narrative[line].speaker,preferences.speed));
}
function setScene(next){
  controller.abort();controller=new AbortController();clearInterval(typeTimer);cancelAuto();typing=false;choosing=false;
  farmLoader.stop();scene=next;game.dataset.scene=next;
  music.setScene(next,{delay: next==='story'?1250:0});
  game.classList.remove('anomaly','blooming','revealing');
  for(const id of ['title','loading','story','notification','result'])$(id).hidden=id!==next;
  $('skip').hidden=!['loading','transition'].includes(next);
  $('continue').disabled=!preferences.completed;
  $('save-status').textContent=preferences.completed?'낯선 아침에서 계속':'저장 기록 없음';
  document.querySelectorAll('[data-choice]').forEach(button=>{button.disabled=false;button.classList.remove('chosen');});
}
function routeHash(hash,replace=false){if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);}
function wait(ms,signal){
  return new Promise(resolve=>{
    if(signal.aborted)return resolve(false);
    const cancel=()=>{clearTimeout(timer);resolve(false);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve(true);},ms);
    signal.addEventListener('abort',cancel,{once:true});
  });
}
function title(fromHistory=false){setScene('title');if(!fromHistory)routeHash('#title');focus($('new-game'));}
async function launch(){
  if(scene!=='title')return;
  sound.play();setScene('loading');routeHash('#opening');
  const signal=controller.signal,start=performance.now(),minimum=reduced()?1600:6500;
  let ready=0;
  $('progress').value=0;$('connection').textContent='';$('loading-caption').textContent='새로운 농장을 불러오는 중...';
  farmLoader.start();focus($('skip'));
  const preparation=prepareImages(Object.values(assets),{signal,onProgress:value=>{ready=value;}});
  while(!signal.aborted&&(performance.now()-start<minimum||ready<1)){
    if(!(await wait(80,signal)))return;
    const elapsed=Math.min(1,(performance.now()-start)/minimum);
    $('progress').value=Math.min(96,Math.round((elapsed*.65+ready*.35)*96));
  }
  if(signal.aborted)return;
  await preparation;if(signal.aborted)return;
  $('progress').value=98;game.classList.add('anomaly');
  $('loading-caption').textContent='잠시만요. 무언가 달라지고 있습니다.';
  $('connection').textContent='PLAYER DATA — UNKNOWN';
  if(!(await wait(reduced()?650:1300,signal)))return;
  $('connection').textContent='CONNECTION ESTABLISHED';$('progress').value=100;
  if(!(await wait(reduced()?550:1000,signal)))return;
  transition();
}
async function transition(){
  setScene('transition');$('loading').hidden=false;
  const signal=controller.signal;game.classList.add('blooming');focus($('skip'));
  if(!(await wait(reduced()?350:3600,signal)))return;
  awaken(false,true);
}
async function awaken(fromHistory=false,reveal=false){
  setScene('story');if(!fromHistory)routeHash('#awakening',true);
  line=0;$('ver-wrap').hidden=true;$('dialogue-shell').hidden=reveal;
  if(reveal){
    game.classList.add('revealing');const signal=controller.signal;
    if(!(await wait(reduced()?150:1700,signal)))return;
    game.classList.remove('revealing');
  }
  $('dialogue-shell').hidden=false;showLine();focus($('dialogue'));
}
function finishText(){
  clearInterval(typeTimer);typing=false;$('dialogue-text').textContent=fullText;
  $('dialogue').classList.remove('typing');scheduleAuto();
}
function showLine(){
  clearInterval(typeTimer);cancelAuto();
  const item=narrative[line];fullText=item.text;
  $('speaker').textContent=item.speaker;$('ver-wrap').hidden=item.speaker!=='베르';
  $('accessible-dialogue').textContent=item.speaker+': '+item.text;
  const delay={slow:65,normal:35,fast:16,instant:0}[preferences.speed];
  if(!delay||reduced())return finishText();
  let position=0;typing=true;$('dialogue-text').textContent='';$('dialogue').classList.add('typing');
  typeTimer=setInterval(()=>{
    $('dialogue-text').textContent=fullText.slice(0,++position);
    if(position>=fullText.length)finishText();
  },delay);
}
function advance(manual=true){
  if(scene!=='story'||settings.open||$('dialogue-shell').hidden)return;
  cancelAuto();if(typing)return finishText();
  if(manual)sound.play();
  if(++line<narrative.length)showLine();else notify();
}
function notify(fromHistory=false){
  setScene('notification');preferences.completed=true;persist();
  if(!fromHistory)routeHash('#choices',true);
  focus(document.querySelector('[data-choice]'));if(!fromHistory)sound.play('arrival');
}
async function choose(button){
  if(scene!=='notification'||choosing)return;
  choosing=true;const signal=controller.signal;
  button.classList.add('chosen');sound.play();
  document.querySelectorAll('[data-choice]').forEach(item=>{item.disabled=true;});
  if(await wait(reduced()?0:230,signal))result(button.dataset.choice);
}
async function result(kind,fromHistory=false){
  if(!results[kind])return notify();
  setScene('result');const data=results[kind],signal=controller.signal;
  $('result-label').textContent=data.label;$('result-heading').textContent=data.heading;
  $('result-description').textContent=data.text;$('result-note').textContent=data.note;
  $('result-ver').hidden=true;$('result').classList.toggle('error-result',kind==='logout');
  if(!fromHistory)routeHash('#'+kind);focus($('result-heading'));
  if(kind==='logout'&&await wait(reduced()?0:700,signal))$('result-ver').hidden=false;
}
function restoreRoute(){
  const route=location.hash.slice(1);
  if(route==='awakening')awaken(true);
  else if(route==='choices'&&preferences.completed)notify(true);
  else if(results[route]&&preferences.completed)result(route,true);
  else{title(true);routeHash('#title',true);}
}
function openSettings(){if(!settings.open){cancelAuto();settings.showModal();}}
systemMotion.addEventListener('change',()=>{updateSettings();if(typing&&reduced())finishText();});
settings.addEventListener('close',scheduleAuto);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAuto();else scheduleAuto();});
$('new-game').addEventListener('click',()=>{music.activate();launch();});
$('music-toggle').addEventListener('click',toggleMusic);
$('continue').addEventListener('click',()=>{if(preferences.completed){music.activate();sound.play();awaken();}});
$('skip').addEventListener('click',()=>{if(['loading','transition'].includes(scene))awaken();});
$('dialogue').addEventListener('click',()=>advance());
$('auto-toggle').addEventListener('click',()=>{
  auto=!auto;$('auto-toggle').textContent=auto?'AUTO ON':'AUTO OFF';
  $('auto-toggle').setAttribute('aria-pressed',String(auto));scheduleAuto();
});
$('story-skip').addEventListener('click',()=>{if(scene==='story')notify();});
$('back-choices').addEventListener('click',()=>notify());
document.querySelectorAll('[data-title]').forEach(button=>button.addEventListener('click',()=>title()));
document.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>choose(button)));
$('choices').addEventListener('keydown',event=>{
  const buttons=[...document.querySelectorAll('[data-choice]')],index=buttons.indexOf(document.activeElement);
  if(index<0||choosing)return;
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowDown'?1:2))%3;
    focus(buttons[next]);
  }
});
[$('settings-open'),$('title-settings')].forEach(button=>button.addEventListener('click',openSettings));
$('sound').addEventListener('change',event=>{preferences.sound=event.target.checked;updateSettings();persist();sound.play();});
$('motion').addEventListener('change',event=>{preferences.reducedMotion=event.target.checked;updateSettings();persist();if(typing&&reduced())finishText();});
$('speed').addEventListener('change',event=>{preferences.speed=event.target.value;persist();if(scene==='story')finishText();});
window.addEventListener('hashchange',restoreRoute);
window.addEventListener('keydown',event=>{
  if(event.repeat||settings.open)return;
  if((event.key==='Enter'||event.key===' ')&&scene==='story'&&!['BUTTON','INPUT','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();advance();}
});
for(const [name,url]of Object.entries(assets)){
  const image=new Image();
  image.onerror=()=>{game.classList.add('missing-'+name);if(name==='ver'){$('ver').hidden=true;$('ver-fallback').hidden=false;}};
  image.src=url;
}
document.querySelectorAll('#result-ver img').forEach(image=>image.addEventListener('error',()=>{image.hidden=true;}));
updateSettings();restoreRoute();updateMusicButton();
