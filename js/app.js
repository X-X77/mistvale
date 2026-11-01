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
  updateMusicButton();updateSettings();
}
const preferences=readSave(), systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
if(!preferences.bgm)music.setEnabled(false);
let scene='store',controller=new AbortController(),line=0,typeTimer=0,autoTimer=0;
let fullText='',typing=false,auto=true,choosing=false;
const reduced=()=>preferences.reducedMotion||systemMotion.matches;
const farmLoader=createPixelLoader($('farm-animation'),{reduced});
/* The marketed game's title art is downsampled into a genuine low-res canvas.
   Reality scenes continue to use the original high-resolution bedroom artwork. */
const titleCanvas=$('title-pixel-art');
if(titleCanvas){
  const art=new Image();art.src='./assets/title.jpg';
  art.addEventListener('load',()=>{
    const ctx=titleCanvas.getContext('2d');
    if(!ctx)return;
    ctx.imageSmoothingEnabled=true;
    const w=titleCanvas.width,h=titleCanvas.height;
    const scale=Math.max(w/art.naturalWidth,h/art.naturalHeight);
    const sw=w/scale,sh=h/scale;
    ctx.drawImage(art,(art.naturalWidth-sw)/2,(art.naturalHeight-sh)/2,sw,sh,0,0,w,h);
  });
}

function persist(){ $('storage-notice').hidden=writeSave(preferences); }
function focus(element){if(!settings.open)element?.focus({preventScroll:true});}
function updateSettings(){
  game.classList.toggle('reduced-motion',reduced());
  $('sound').checked=preferences.sound;$('motion').checked=preferences.reducedMotion;$('speed').value=preferences.speed;
  $('bgm').checked=music.enabled;
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
  for(const id of ['store','title','loading','story','notification','result'])$(id).hidden=id!==next;
  $('skip').hidden=!['loading','transition'].includes(next);
  $('continue').disabled=true;
  $('save-status').textContent='저장 데이터 없음';
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
function store(fromHistory=false){
  setScene('store');if(!fromHistory)routeHash('#store');
  window.scrollTo({top:0,behavior:'instant'});focus($('store-play'));
}
function title(fromHistory=false){
  setScene('title');if(!fromHistory)routeHash('#title');
  window.scrollTo({top:0,behavior:'instant'});focus($('new-game'));
}
async function launch(){
  if(scene!=='title')return;
  sound.play();setScene('loading');routeHash('#opening');
  const signal=controller.signal,start=performance.now(),minimum=reduced()?1600:6500;
  let ready=0;
  $('progress').value=0;$('connection').textContent='';$('loading-caption').textContent='새로운 농장을 불러오는 중...';
  farmLoader.start();focus($('skip'));
  const preparation=prepareImages(Object.values(assets),{signal,onProgress:value=>{ready=value;}});
  while(!signal.aborted&&performance.now()-start<14000&&(performance.now()-start<minimum||ready<1)){
    if(!(await wait(80,signal)))return;
    const elapsed=Math.min(1,(performance.now()-start)/minimum);
    $('progress').value=Math.min(96,Math.round((elapsed*.65+ready*.35)*96));
  }
  if(signal.aborted)return;
  await Promise.race([preparation,wait(1200,signal)]);if(signal.aborted)return;
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
  if(!(await wait(reduced()?300:2200,signal)))return;
  awaken(false,true);
}
async function awaken(fromHistory=false,reveal=false){
  setScene('story');if(!fromHistory)routeHash('#awakening',true);
  line=0;$('ver-wrap').hidden=true;$('dialogue-shell').hidden=reveal;
  if(reveal){
    game.classList.add('revealing');const signal=controller.signal;
    if(!(await wait(reduced()?150:2000,signal)))return;
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
  setScene('notification');
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
  if(route==='store')store(true);
  else if(route==='title')title(true);
  else if(route==='awakening')awaken(true);
  else if(route==='choices')notify(true);
  else if(results[route])result(route,true);
  else{store(true);routeHash('#store',true);}
}
function openSettings(){if(!settings.open){cancelAuto();updateSettings();settings.showModal();}}
systemMotion.addEventListener('change',()=>{updateSettings();if(typing&&reduced())finishText();});
settings.addEventListener('close',scheduleAuto);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAuto();else scheduleAuto();});
$('store-play').addEventListener('click',()=>{sound.play();title();});
const slides=[
 {src:'./assets/loading/farm-scene.webp',name:'오래된 농장',detail:'풀숲에 잠긴 작은 농장. 여기서부터 모든 것이 시작됩니다.',alt:'작은 농장 도트 게임 화면'},
 {src:'./assets/screenshots/gallery-02.webp',fallback:'./assets/loading/farm-scene.webp',name:'오래된 농가',detail:'안개 낀 계곡 너머 작은 마을을 바라보는 농가.',alt:'계곡과 농가의 전경'},
 {src:'./assets/screenshots/gallery-03.webp',fallback:'./assets/loading/farm-scene.webp',name:'봄의 밭',detail:'새싹과 꽃이 피어나는 봄날의 농장.',alt:'꽃밭과 밭이 펼쳐진 농장 풍경'},
 {src:'./assets/screenshots/gallery-04.webp',fallback:'./assets/loading/valley-scene.webp',name:'마을 거리',detail:'시장과 상점이 모인 미스트베일의 거리.',alt:'따뜻한 햇살 아래의 상점 거리'},
 {src:'./assets/screenshots/gallery-05.webp',fallback:'./assets/loading/valley-scene.webp',name:'달빛 숲',detail:'밤에만 드러나는 숲의 고요한 길.',alt:'달빛이 비치는 어두운 숲'},
 {src:'./assets/screenshots/gallery-06.webp',fallback:'./assets/loading/valley-scene.webp',name:'호수의 밤',detail:'보름달이 잔잔한 수면 위로 떠오르는 시간.',alt:'밤하늘과 호수 위의 달빛'}
];
const previewImage=$('xx-main-image');
previewImage.addEventListener('error',()=>{
 const current=slides[slideIndex];
 if(current.fallback && previewImage.getAttribute('src')!==current.fallback) previewImage.src=current.fallback;
});
document.querySelectorAll('[data-xx-slide]').forEach(button=>{
 const img=button.querySelector('img');
 img?.addEventListener('error',()=>{
  const candidate=slides[Number(button.dataset.xxSlide)];
  if(candidate?.fallback && img.getAttribute('src')!==candidate.fallback)img.src=candidate.fallback;
 });
});
let slideIndex=0;
function showSlide(next){
 slideIndex=(next+slides.length)%slides.length;
 const slide=slides[slideIndex];
 $('xx-main-image').src=slide.src;$('xx-main-image').alt=slide.alt;
 $('xx-slide-name').textContent=String(slideIndex+1).padStart(2,'0')+'  '+slide.name;
 $('xx-slide-detail').textContent=slide.detail;
 document.querySelectorAll('[data-xx-slide]').forEach(button=>{
  const selected=Number(button.dataset.xxSlide)===slideIndex;
  button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
 });
}
$('xx-prev').addEventListener('click',()=>showSlide(slideIndex-1));
$('xx-next').addEventListener('click',()=>showSlide(slideIndex+1));
document.querySelectorAll('[data-xx-slide]').forEach(button=>button.addEventListener('click',()=>showSlide(Number(button.dataset.xxSlide))));
const reviews=[
 ['추천',42.6,'새벽의감자','농사만 하려고 켰는데 어느새 마을 사람들 일상까지 신경 쓰고 있네요. 하루가 너무 짧아요.'],
 ['추천',18.2,'호숫가산책','낮 분위기가 좋아요. 호수에서 낚시하다 보면 시간 가는 줄 모르겠어요.'],
 ['추천',63.1,'양치기아님','베르라는 안내 캐릭터, 친절한 줄 알았는데 제 실수만 기다리는 것 같음. 그래도 귀여워요.'],
 ['추천',12.4,'고구마좋아','심은 작물이 자라는 걸 구경하는 맛이 있어요. 작은 농장을 꾸미는 재미가 큽니다.'],
 ['비추천',6.3,'아침잠많음','하루가 너무 짧아서 하고 싶은 걸 다 못하겠어요.'],
 ['추천',89.4,'흐린계곡','낚시하고 요리하고 주민들한테 선물 주는 재미로 계속 켜게 됩니다.'],
 ['추천',27.1,'풀씨앗','농장 경영이 생각보다 쉽지만은 않네요. 천천히 해보려구요.'],
 ['추천',54.8,'달빛우물','잔잔한 배경음이 좋아서 계속 돌아다니게 돼요.'],
 ['비추천',9.7,'바쁜농부','해야 할 일이 너무 많아서 힐링하려다 더 바빠졌어요.'],
 ['추천',37.3,'숲의손님','숲에 숨겨진 오솔길 찾는 재미가 있네요.'],
 ['추천',71.2,'마을우체부','주민들이 각자 살아가는 느낌이라 마음에 들어요.'],
 ['비추천',4.5,'초보농장주','초반에 돈이 잘 안 모여서 조금 답답합니다.'],
 ['추천',45.9,'푸른모자','비 오는 날 농장 풍경이 특히 예쁘더라고요.'],
 ['추천',21.6,'주점단골','금요일 저녁에 주점 가보세요. 분위기가 달라요.'],
 ['비추천',7.8,'낚시초보','원하는 물고기를 잡는 게 꽤 어려워요.'],
 ['비추천',11.3,'늦은봄','지도에 없는 길이 많아 처음에는 헤맸어요.']
];
let reviewPage=0;const reviewSize=3;
function renderReviews(){
 const totalPages=Math.ceil(reviews.length/reviewSize);
 const items=reviews.slice(reviewPage*reviewSize,(reviewPage+1)*reviewSize);
 $('xx-review-list').replaceChildren(...items.map(([vote,hours,user,body])=>{
  const article=document.createElement('article');article.className='xx-review-card';
  const v=document.createElement('strong');v.className='xx-review-vote'+(vote==='비추천'?' negative':'');v.textContent=vote==='추천'?'✓ 추천':'− 비추천';
  const h=document.createElement('span');h.className='xx-review-hours';h.textContent='플레이 시간 '+hours+'시간';
  const p=document.createElement('p');p.textContent=body;
  const footer=document.createElement('footer');footer.textContent=user+' · 사용자 평가';
  article.append(v,h,p,footer);return article;
 }));
 $('xx-review-page-label').textContent='전체 '+reviews.length+'개 중 '+(reviewPage*reviewSize+1)+'–'+Math.min((reviewPage+1)*reviewSize,reviews.length)+' 표시';
 $('xx-review-prev').disabled=reviewPage===0;
 $('xx-review-next').disabled=reviewPage===totalPages-1;
}
$('xx-review-prev').addEventListener('click',()=>{reviewPage=Math.max(0,reviewPage-1);renderReviews();});
$('xx-review-next').addEventListener('click',()=>{reviewPage=Math.min(Math.ceil(reviews.length/reviewSize)-1,reviewPage+1);renderReviews();});
renderReviews();
$('new-game').addEventListener('click',()=>{music.activate();launch();});
$('music-toggle').addEventListener('click',toggleMusic);

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
[$('settings-open'),$('title-settings'),$('store-settings')].forEach(button=>button.addEventListener('click',openSettings));
$('bgm').addEventListener('change',event=>{music.setEnabled(event.target.checked);if(event.target.checked)music.activate();preferences.bgm=music.enabled;persist();updateSettings();});
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
