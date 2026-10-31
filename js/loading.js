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
function sceneFarm(ctx,imgs,t,reduce,w,h){
 const background=imgs.farm?.naturalWidth?imgs.farm:null;
 if(background)cover(ctx,background,w,h,reduce?1:1.018);
 else{ctx.fillStyle='#244338';ctx.fillRect(0,0,w,h);}
 // The ground plane follows the garden beds in the creator's background.
 const baseY=370, playerX=540;
 const phase=t%7800;
 let state=phase<1750?'idle':phase<4050?'seed':phase<6300?'water':'idle';
 const image=imgs[state];
 const bounce=reduce?0:Math.sin(t/380)*1.3;
 const playerHeight=163;
 if(imgs.seedBag?.naturalWidth)drawItem(ctx,imgs.seedBag,440,baseY+2,42,.84);
 // A few seedlings appear only after the planting and watering segments.
 for(let n=0;n<3;n++){
  let x=615+n*42, y=371+n*2;
  const grow=reduce?1:smooth((phase-5900-n*130)/1000);
  if(grow>.005){drawSoftShadow(ctx,x,y,14,4,.20*grow);ctx.save();ctx.translate(x,y);ctx.scale(.25+grow*.36,.25+grow*.36);ctx.translate(-x,-y);drawItem(ctx,imgs.sprout,x,y+3,64,Math.min(1,grow*1.3));ctx.restore();}
 }
 drawSoftShadow(ctx,playerX,baseY+2,43,10,.34);
 drawItem(ctx,image,playerX,baseY+bounce,playerHeight,1);
 // Additional tiny pixelated seeds / droplets fill in missing motion frames.
 if(!reduce && state==='seed'){
  ctx.fillStyle='#e4bd70';
  const local=phase-1750;
  for(let k=0;k<9;k++){
   let u=((local+k*220)%1120)/1120;
   let x=557+u*64+(k%3)*5,y=299+u*u*63+(k%2)*4;
   ctx.fillRect(Math.round(x),Math.round(y),3,3);
  }
 }
 if(!reduce && state==='water'){
  ctx.fillStyle='#c2e8e0';
  const local=phase-4050;
  for(let k=0;k<11;k++){
   let u=((local+k*130)%880)/880;
   let x=570+u*60+(k%3)*3,y=296+u*u*70;
   ctx.fillRect(Math.round(x),Math.round(y),2,5);
  }
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
 const art=loadArt();
 // Allow replacing with a uniform horizontal sprite atlas later.
 let sheet=null;
 if(sprite?.src){const img=new Image();img.onload=()=>sheet=img;img.src=sprite.src;}
 let running=false,frameId=0,origin=0;
 function paint(stamp){
  if(!running)return;
  const t=reduced()?6900:stamp-origin;
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
