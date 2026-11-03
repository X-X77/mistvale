import sys,os,glob,time,numpy as np,cv2
from PIL import Image
from pymatting import estimate_alpha_cf, estimate_foreground_ml
ORIG='/home/claude/x-x77/mistvale/assets/characters/chibi-originals/'
IDS={'네리':'neri','네피아':'nepia','노아':'noah','레피온':'lepion','로웬':'rowen','루시엘':'luciel','릴리안':'lillian','마리엘':'mariel','모렐':'morel','미엘':'miel','비앙카':'bianca','사르칸':'sarkan','세레피나':'serepina','세이라':'seira','아델라':'adela','아라크네':'arachne','에델린':'edelin','에드윈':'edwin','이사벨':'isabel','카일런':'kylen','코델리아':'cordelia','테오':'theo','페릭스':'felix'}
NARROW={'neri','luciel','miel','sarkan'}   # 배경이 흰색이 아닌 그림: 바깥 확장 폭을 줄여 배경을 줍지 않음
def run(kr):
    id=IDS[kr]; t0=time.time()
    img=np.array(Image.open(ORIG+kr+'_치비.png').convert('RGB')).astype(np.float64)/255
    m=np.array(Image.open(f'raw/{kr}.mask.png').convert('L')).astype(np.float64)/255
    k=lambda n:cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(n,n))
    fg=cv2.erode((m>0.9).astype(np.uint8),k(7))>0
    out=7 if id in NARROW else 17
    reach=cv2.dilate((m>0.08).astype(np.uint8),k(out))>0
    tri=np.full(m.shape,0.5); tri[~reach]=0; tri[fg]=1
    a=estimate_alpha_cf(img,tri,laplacian_kwargs={'epsilon':1e-6},cg_kwargs={'maxiter':800})
    a=np.clip(a,0,1)
    # 확실한 배경 밖은 0, 확실한 전경은 1 로 고정
    a[~reach]=0; a[fg]=1
    f=estimate_foreground_ml(img,a)
    rgba=np.dstack([np.clip(f,0,1),a]); rgba=(rgba*255+.5).astype(np.uint8)
    Image.fromarray(rgba,'RGBA').save(f'matted/{id}.png')
    print(id,round(time.time()-t0,1),flush=True)
if __name__=='__main__':
    os.makedirs('matted',exist_ok=True)
    names=sys.argv[1:] or list(IDS)
    for n in names: run(n)
