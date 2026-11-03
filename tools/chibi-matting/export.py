import numpy as np,glob,os,json,cv2
from PIL import Image
OUT='/home/claude/x-x77/mistvale/assets/characters/chibis-matted/'
os.makedirs(OUT,exist_ok=True)
meta={}
for f in sorted(glob.glob('matted2/*.png')):
    id=os.path.basename(f)[:-4]
    a=np.array(Image.open(f)).astype(np.float64)
    al=a[:,:,3]/255; H,W=al.shape
    cut=[]
    F=64
    for side,line in (('L',al[:,0]),('R',al[:,-1]),('T',al[0,:]),('B',al[-1,:])):
        if (line>.16).sum()>30: cut.append(side)
    ramp=np.clip(np.arange(F)/F,0,1)**1.6
    for s in cut:
        if s=='L': al[:,:F]*=ramp[None,:]
        if s=='R': al[:,-F:]*=ramp[::-1][None,:]
        if s=='T': al[:F,:]*=ramp[:,None]
        if s=='B': al[-F:,:]*=ramp[::-1][:,None]
    if len(cut)>=2 and ('T' in cut or 'B' in cut) and ('L' in cut or 'R' in cut):
        R=0.30*min(W,H); yy,xx=np.mgrid[0:H,0:W].astype(np.float64)
        # 둥근 사각형 안쪽 거리(음수=안쪽) : 잘린 모서리만 둥글게 감쇠
        qx=np.abs(xx-W/2)-(W/2-R); qy=np.abs(yy-H/2)-(H/2-R)
        d=np.hypot(np.maximum(qx,0),np.maximum(qy,0))-R
        env=np.clip(1-(d+40)/48,0,1)
        env=np.where((qx>0)&(qy>0),env,1.0)
        # 잘리지 않은 변 쪽 모서리는 건드리지 않는다
        keep=np.ones_like(env)
        al=al*(env**1.2 if True else keep)
    a[:,:,3]=al*255
    ys,xs=np.where(al>.04); pad=6
    y0,y1,x0,x1=max(ys.min()-pad,0),min(ys.max()+pad+1,H),max(xs.min()-pad,0),min(xs.max()+pad+1,W)
    c=Image.fromarray((a[y0:y1,x0:x1]+.5).astype(np.uint8),'RGBA')
    sc=900/c.height; c=c.resize((round(c.width*sc),900),Image.LANCZOS)
    c.save(OUT+id+'.webp',quality=92,method=6,exact=True)
    meta[id]={'file':id+'.webp','width':c.width,'height':c.height,'sourceCutSides':cut}
    print(id,c.size,cut,os.path.getsize(OUT+id+'.webp')//1024,'KB')
json.dump(meta,open(OUT+'matte-report.json','w'),ensure_ascii=False,indent=1)
