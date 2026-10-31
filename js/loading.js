// Code-drawn placeholder sprites. Supply a horizontal sprite sheet to replace them.
// No player identity is implied by the anonymous farming symbol.
export function createPixelLoader(canvas, { mode = 'farm', reduced = () => false, sprite = null } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { start() {}, stop() {} };
  canvas.width = 160; canvas.height = 86;
  ctx.imageSmoothingEnabled = false;
  let frame = 0, running = false, start = 0, sheet = null;
  if (sprite?.src) {
    const image = new Image();
    image.onload = () => { sheet = image; };
    image.src = sprite.src;
  }
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function drawFarm(t) {
    // Floating little garden island, tilled rows, grass and tiny spring flowers.
    rect(18,64,124,4,'#273b32'); rect(23,61,114,4,'#718455');
    rect(34,65,92,5,'#5d4b35'); rect(40,70,80,3,'#394238');
    rect(69,54,53,9,'#8a6747');
    for (let x=72;x<120;x+=12) {rect(x,56,7,2,'#b28b58');rect(x,60,7,2,'#5d4735');}
    rect(24,57,2,5,'#8ea866'); rect(28,59,2,3,'#8ea866');
    rect(130,55,2,7,'#81985c');rect(127,54,3,2,'#e3ce92');
    const phase = t % 6400;
    const walk = phase < 1300;
    const x = walk ? 24 + Math.floor(phase / 1300 * 31) : 55;
    const bob = walk ? Math.floor(phase/160)%2 : (phase>2400&&phase<4200 ? Math.floor(phase/350)%2 : 0);
    const y = 31 + bob;
    // Hat, tiny shadowed face, neutral overalls and boots. No facial/body traits.
    rect(x+4,y-3,10,5,'#d6be7c');rect(x,y+2,19,3,'#e9d49b');
    rect(x+5,y+5,9,6,'#aa9670');rect(x+12,y+6,2,2,'#36453b');
    rect(x+3,y+11,12,10,'#a8b493');rect(x+6,y+12,7,10,'#526c60');
    rect(x+4,y+21,4,6,'#344e46');rect(x+10,y+21,4,6,'#344e46');
    const step = walk ? (Math.floor(phase/160)%2)*2 : 0;
    rect(x+2,y+26-step,6,3,'#d1b481');rect(x+10,y+26+step,6,3,'#d1b481');
    if (phase>=1300&&phase<2500) {
      rect(x+15,y+12,6,3,'#c0ad82');
      for(let n=0;n<3;n++){const f=((phase-1300+n*210)%700)/700;rect(x+22+f*20,y+13+f*11,2,2,'#e4c785');}
    } else if (phase>=2500&&phase<4300) {
      rect(x+15,y+13,9,7,'#8db3ac');rect(x+23,y+14,5,3,'#a8c5b1');
      rect(x+17,y+10,5,2,'#a8c5b1');
      for(let n=0;n<5;n++){const f=((phase+n*110)%600)/600;rect(x+28+f*11+n%2,y+16+f*15,1,3,'#b6dcce');}
    } else rect(x+15,y+12,3,8,'#c0ad82');
    if (phase>=4200) {
      const height = Math.min(9,Math.floor((phase-4200)/110));
      for(let x=78;x<120;x+=15){rect(x,56-height,2,height,'#8faa69');if(height>4){rect(x-4,56-height,4,3,'#b6cc82');rect(x+2,53-height,4,3,'#a2bd70');}}
    }
    if (phase>5500) {ctx.fillStyle='rgba(25,43,38,'+Math.max(0,(phase-5800)/600)+')';ctx.fillRect(0,0,160,86);}
  }
  function drawVer(t) {
    const bounce = reduced() ? 0 : Math.sin(t/160)*2, y=42+bounce;
    rect(24,66,112,1,'#7f8662');
    rect(64,y,25,18,'#292c33');rect(59,y+5,35,11,'#34353c');
    rect(65,y-5,4,7,'#cc9b9d');rect(83,y-5,4,7,'#cc9b9d');
    rect(53,y+5,8,5,'#554652');rect(91,y+5,8,5,'#554652');
    rect(68,y+5,4,2,'#e1ce8c');rect(81,y+5,4,2,'#e1ce8c');
    rect(74,y+11,6,1,'#c4aba4');
    const stride = reduced()?0:Math.floor(t/160)%2*4;
    rect(66,y+18,6+stride,3,'#292c33');rect(81,y+18,10-stride,3,'#292c33');
    for(let n=0;n<3;n++){const f=((t+n*230)%900)/900;ctx.globalAlpha=1-f;rect(54-f*24,63-n%2*2,3,2,'#bba577');}ctx.globalAlpha=1;
  }
  function paint(time) {
    if (!running) return;
    const t = reduced() ? (mode === 'farm' ? 4900 : 0) : time-start;
    ctx.clearRect(0,0,160,86);
    if (sheet && sprite) {
      const index=reduced()?0:Math.floor(t/(sprite.frameMs||160))%sprite.frames;
      ctx.drawImage(sheet,index*sprite.width,0,sprite.width,sprite.height,0,0,160,86);
    } else if (mode === 'ver') drawVer(t); else drawFarm(t);
    frame=requestAnimationFrame(paint);
  }
  return {
    start() { if(running)return;running=true;start=performance.now();frame=requestAnimationFrame(paint); },
    stop() {running=false;cancelAnimationFrame(frame);}
  };
}
export function prepareImages(urls, { signal, onProgress = () => {}, timeout = 8000 } = {}) {
  let completed=0;
  return Promise.all(urls.map(url => new Promise(resolve => {
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
// Reusable transition component, deliberately NOT inserted into the opening.
// const loader = createTravelLoader(host, { reduced, sprite: optionalSheet });
// loader.show(); await prepareNextScene(); loader.hide(); // destroy() on unmount
export function createTravelLoader(host, options = {}) {
  const panel=document.createElement('section');panel.className='travel-loader';panel.hidden=true;
  panel.setAttribute('role','status');panel.setAttribute('aria-label','이동 중');
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
  const title=document.createElement('p');title.textContent='이동 중...';
  const subtitle=document.createElement('small');subtitle.textContent='베르가 길을 안내하는 중.';
  panel.append(canvas,title,subtitle);host.append(panel);
  const animation=createPixelLoader(canvas,{...options,mode:'ver'});
  return {show(){panel.hidden=false;animation.start();},hide(){panel.hidden=true;animation.stop();},destroy(){animation.stop();panel.remove();}};
}
