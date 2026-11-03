const ROOT = './assets/loading/';
const PATHS = {
  farm: ROOT+'farm-scene.webp', valley:ROOT+'valley-scene.webp',
  idle:ROOT+'farmer-idle.webp', seed:ROOT+'farmer-seed.webp', water:ROOT+'farmer-water.webp',
  sprout:ROOT+'sprout.webp', petal:ROOT+'petal.webp',
  ver:ROOT+'ver-run.webp', seedBag:ROOT+'seed-bag.webp'
};
const smooth = t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function cover(ctx,im,w,h,scale=1){
  const srcRatio=im.width/im.height, dstRatio=w/h;
  let sx=0,sy=0,sw=im.width,sh=im.height;
  if(srcRatio>dstRatio){sw=sh*dstRatio;sx=(im.width-sw)*.5;}
  else{sh=sw/dstRatio;sy=(im.height-sh)*.5;}
  const ex=(w-w*scale)/2,ey=(h-h*scale)/2;
  ctx.drawImage(im,sx,sy,sw,sh,ex,ey,w*scale,h*scale);
}
function drawItem(ctx,image,x,y,height,alpha=1,flip=false){
  if(!image?.complete||!image.naturalWidth||alpha<=0)return;
  const ww=height*image.naturalWidth/image.naturalHeight;
  ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,alpha));
  if(flip){ctx.translate(x,0);ctx.scale(-1,1);ctx.drawImage(image,-ww/2,y-height,ww,height);}
  else ctx.drawImage(image,x-ww/2,y-height,ww,height);
  ctx.restore();
}
function loadArt(){
 const imgs={};
 for(const [key,url]of Object.entries(PATHS)){
  const img=new Image();img.decoding='async';img.src=url;imgs[key]=img;
 }
 return imgs;
}
function drawSoftShadow(ctx,x,y,rx,ry,opacity=.22){
 ctx.save();ctx.fillStyle=`rgba(9,25,19,${opacity})`;
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
// 농사 동작 효과는 스프라이트 안의 '손 끝'과 '물뿌리개 주둥이' 위치에서 시작해 캐릭터가 바라보는 방향(화면 왼쪽)의 밭으로 떨어진다.
// 좌표는 스프라이트 이미지 비율(0~1)로 적어 두었으므로 그림 크기가 바뀌어도 맞는다.
const ACTION_TIP={seed:{x:.405,y:.635},water:{x:.035,y:.535}};
// 효과가 닿는 밭 자리(캐릭터 발 기준 x 오프셋, y 오프셋). y 가 클수록 화면 앞쪽이라 조금 더 크게 그린다.
const PLANT_SPOTS=[{x:-96,y:-22},{x:-66,y:-12},{x:-38,y:-3}];
function sceneFarm(ctx,imgs,t,reduce,w,h){
 const background=imgs.farm?.naturalWidth?imgs.farm:null;
 if(background)cover(ctx,background,w,h,reduce?1:1.018);
 else{ctx.fillStyle='#244338';ctx.fillRect(0,0,w,h);}
 // The ground plane follows the garden beds in the creator's background.
 const baseY=370, playerX=540;
 // Begin working on the very first frame; cycle through planting and watering briskly.
 // Reduced motion shortens the cycle so seed -> water -> rest still visibly progresses in a short load.
 const cycle=reduce?1500:4800;
 const phase=reduce?(t%cycle)*(4800/cycle):t%4800;
 let state=phase<2100?'seed':phase<4200?'water':'idle';
 const image=imgs[state];
 const bounce=reduce?0:Math.sin(t/155)*3.5;
 const playerHeight=163;
 // 손/주둥이 위치(캔버스 좌표)
 const tipOf=kind=>{
  const im=imgs[kind];if(!im?.naturalWidth)return null;
  const ww=playerHeight*im.naturalWidth/im.naturalHeight, tip=ACTION_TIP[kind];
  return {x:playerX-ww/2+tip.x*ww, y:baseY+bounce-playerHeight+tip.y*playerHeight};
 };
 // 씨앗 주머니는 심는 자리의 반대편(오른쪽 뒤)에 둔다.
 if(imgs.seedBag?.naturalWidth)drawItem(ctx,imgs.seedBag,playerX+88,baseY+2,42,.84);
 // 심은 자리: 씨앗이 떨어진 곳 -> 물이 스며든 흔적 -> 새싹
 const seeded=smooth((phase-250)/900);               // 씨앗 단계에서 흙 위 씨앗 자국이 생김
 const wet=smooth((phase-2300)/700)*(1-smooth((phase-4500)/300));
 PLANT_SPOTS.forEach((spot,n)=>{
  const x=playerX+spot.x, y=baseY+spot.y;
  const grow=smooth((phase-3500-n*110)/720);
  if(seeded>.01&&grow<.4){
   ctx.fillStyle=`rgba(236,200,120,${.9*seeded*(1-grow*2)})`;
   ctx.fillRect(Math.round(x-5),Math.round(y-1),3,3);ctx.fillRect(Math.round(x+1),Math.round(y),3,3);ctx.fillRect(Math.round(x-1),Math.round(y+2),3,3);
  }
  if(wet>.01){ctx.save();ctx.fillStyle=`rgba(32,24,18,${.34*wet})`;ctx.beginPath();ctx.ellipse(x,y+1,22,6,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(grow>.005){const k=.25+grow*.36;drawSoftShadow(ctx,x,y,13*k+4,3.5,.2*grow);ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.translate(-x,-y);drawItem(ctx,imgs.sprout,x,y+3,64,Math.min(1,grow*1.3));ctx.restore();}
 });
 drawSoftShadow(ctx,playerX,baseY+2,43,10,.34);
 drawItem(ctx,image,playerX,baseY+bounce,playerHeight,1);
 // 효과는 손/주둥이에서 출발해 중력으로 휘어 떨어지며 밭 자리에 닿는다.
 const spray=(kind,count,period,local,paint)=>{
  const tip=tipOf(kind);if(!tip)return;
  for(let k=0;k<count;k++){
   const u=((local+k*(period/count))%period)/period, spot=PLANT_SPOTS[k%PLANT_SPOTS.length];
   const lx=playerX+spot.x+((k*7)%11-5), ly=baseY+spot.y+((k*5)%5-2);
   // 수평은 등속, 수직은 가속(포물선)
   paint(tip.x+(lx-tip.x)*u, tip.y+(ly-tip.y)*u*u, u, k);
  }
 };
 if(!reduce&&state==='seed'){
  ctx.fillStyle='#e8c675';
  spray('seed',9,1050,phase,(x,y)=>ctx.fillRect(Math.round(x),Math.round(y),3,3));
 }
 if(!reduce&&state==='water'){
  const local=phase-2100;
  ctx.fillStyle='#cdeee8';
  // 물줄기는 주둥이에서 곧게 이어지도록 촘촘한 점선으로 그린다.
  spray('water',16,720,local,(x,y,u)=>ctx.fillRect(Math.round(x),Math.round(y),2,u>.6?4:3));
 }
// Sparse drifting petal motifs on top of the scenery, without large UI clutter.
 if(imgs.petal?.naturalWidth&&!reduce){
  for(let i=0;i<5;i++){
   const seed=i*1237+487;
   const p=((t+seed)%(9800+i*280))/(9800+i*280);
   const x=100+i*171+p*80;
   const y=70+(i%3)*53+p*165;
   drawItem(ctx,imgs.petal,x,y,9+i%2*3,.48*(Math.sin(p*Math.PI)**2));
  }
 }
}
function sceneVer(ctx,imgs,t,reduce,w,h){
 if(imgs.valley?.naturalWidth)cover(ctx,imgs.valley,w,h,reduce?1:1.01);
 else{ctx.fillStyle='#294c42';ctx.fillRect(0,0,w,h);}
 const bounce=reduce?0:Math.abs(Math.sin(t/195))*10;
 const x=430+(reduce?0:Math.sin(t/2200)*14),y=375-bounce;
 drawSoftShadow(ctx,x,386,54,10,.35);
 drawItem(ctx,imgs.ver,x,y,136);
 if(!reduce){ctx.fillStyle='rgba(228,210,170,.7)';for(let n=0;n<4;n++){
  const f=((t+n*210)%880)/880;
  ctx.fillRect(x-55-f*30,382-(n%2)*7,Math.max(1,4-f*3),3);
 }}
}

function syncVerOnProgressBar(){
  const mascot=document.getElementById('loading-ver');
  const progress=document.getElementById('progress');
  if(!mascot||!progress)return;
  const percent=Math.max(0,Math.min(100,Number(progress.value)||0));
  // CSS clamps the mascot inside the rail, including small mobile widths.
  mascot.style.left=`clamp(27px, ${percent}%, calc(100% - 27px))`;
}

export function createPixelLoader(canvas,{mode='farm',reduced=()=>false,sprite=null}={}){
 const ctx=canvas?.getContext('2d');
 if(!ctx)return {start(){},stop(){}};
 // Wide virtual scene: keeps placements consistent across viewports.
 const width=960,height=540;canvas.width=width;canvas.height=height;
 // Render pixel art on a limited logical grid and scale back with nearest-neighbor.
 const lowRes=typeof document!=='undefined'&&document.createElement?document.createElement('canvas'):null;
 if(lowRes){lowRes.width=480;lowRes.height=270;}
 const lowCtx=lowRes?.getContext('2d')||null;
 const art=loadArt();
 // Allow replacing with a uniform horizontal sprite atlas later.
 let sheet=null;
 if(sprite?.src){const img=new Image();img.onload=()=>sheet=img;img.src=sprite.src;}
 let running=false,frameId=0,origin=0;
 function paint(stamp){
  if(!running)return;
  // Reduced-motion keeps the farming actions progressing; only decorative bouncing/particles are removed.
  const t=stamp-origin;
  ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
  if(mode==='ver')sceneVer(ctx,art,t,reduced(),width,height);
  else sceneFarm(ctx,art,t,reduced(),width,height);
  // Darken only the lower edge so the logo remains readable above the art.
  const dusk=ctx.createLinearGradient(0,335,0,height);
  dusk.addColorStop(0,'rgba(9,26,20,0)');
  dusk.addColorStop(.62,'rgba(9,26,20,.34)');
  dusk.addColorStop(1,'rgba(5,22,18,.83)');
  ctx.fillStyle=dusk;ctx.fillRect(0,315,width,225);
  if(sheet&&sprite){
   const n=reduced()?0:Math.floor(t/(sprite.frameMs||160))%(sprite.frames||1);
   ctx.drawImage(sheet,n*sprite.width,0,sprite.width,sprite.height,360,225,190,190);
  }
  if(lowCtx){
    lowCtx.clearRect(0,0,lowRes.width,lowRes.height);
    lowCtx.imageSmoothingEnabled=false;
    lowCtx.drawImage(canvas,0,0,lowRes.width,lowRes.height);
    ctx.clearRect(0,0,width,height);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(lowRes,0,0,width,height);
  }
  if(mode==='farm')syncVerOnProgressBar();
  frameId=requestAnimationFrame(paint);
 }
 return {
  start(){if(running)return;running=true;origin=performance.now();frameId=requestAnimationFrame(paint);},
  stop(){running=false;cancelAnimationFrame(frameId);}
 };
}
export function prepareImages(urls,{signal,onProgress=()=>{},timeout=8000}={}){
 let completed=0;
 return Promise.all(urls.map(url=>new Promise(resolve=>{
  const image=new Image();let settled=false;
  const done=ok=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=image.onerror=null;if(!signal?.aborted)onProgress(++completed/urls.length);resolve({url,ok});};
  const abort=()=>done(false);
  const timer=setTimeout(()=>done(false),timeout);
  if(signal?.aborted)return done(false);
  signal?.addEventListener('abort',abort,{once:true});
  image.onload=async()=>{try{await image.decode();}catch{}done(true);};
  image.onerror=()=>done(false);image.src=url;
 })));
}
export function createTravelLoader(host,options={}){
 const panel=document.createElement('section');panel.className='travel-loader';panel.hidden=true;panel.setAttribute('role','status');panel.setAttribute('aria-label','이동 중');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
 const title=document.createElement('p');title.textContent='이동 중...';
 const subtitle=document.createElement('small');subtitle.textContent='베르가 길을 안내하는 중.';
 panel.append(canvas,title,subtitle);host.append(panel);
 const animation=createPixelLoader(canvas,{...options,mode:'ver'});
 return {show(){panel.hidden=false;animation.start();},hide(){panel.hidden=true;animation.stop();},destroy(){animation.stop();panel.remove();}};
}
