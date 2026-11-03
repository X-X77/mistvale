import numpy as np,cv2,glob,os
from PIL import Image
os.makedirs('matted2',exist_ok=True)
from matte import IDS
DARKBG={'neri','luciel'}
FLOOR2={'nepia':.86,'serepina':.9,'arachne':.93,'isabel':.93,'edelin':.93,'lillian':.93}
POCKET={'seira'}
FLOOR={'serepina':.86,'nepia':.84,'arachne':.88,'isabel':.9,'lillian':.9,'bianca':.9,'cordelia':.9,'felix':.93,'theo':.9,'edwin':.9,'kylen':.9,'adela':.9}
STRICT={'serepina','seira','nepia','arachne','lepion','cordelia','isabel'}
for f in sorted(glob.glob('matted/*.png')):
    id=os.path.basename(f)[:-4]
    a=np.array(Image.open(f)).astype(np.float64)/255
    kr=[k for k,v in IDS.items() if v==id][0]
    o=np.array(Image.open(f'src/{kr}_치비.png').convert('RGB')).astype(np.float64)/255
    # 원본 테두리 색을 배경색으로 보고, 가장자리와 이어진 배경 덩어리(머리카락 사이 빈틈 포함)를 찾는다
    border=np.concatenate([o[0],o[-1],o[:,0],o[:,-1]]); bgc=np.median(border,axis=0)
    near=(np.abs(o-bgc).max(axis=2)<(0.03 if id not in DARKBG else 0.0))
    nl,lab=cv2.connectedComponents(near.astype(np.uint8),connectivity=4)
    touch=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bgmask=np.isin(lab,list(touch))
    if id in POCKET:
        # 머리카락에 둘러싸여 가장자리와 이어지지 않은 큰 흰 빈틈도 배경으로 본다(순백·넓은 덩어리만)
        pure=(o.min(axis=2)>0.985)
        n2,lab2,st,_=cv2.connectedComponentsWithStats(pure.astype(np.uint8),connectivity=4)
        for k in range(1,n2):
            if st[k,cv2.CC_STAT_AREA]>700: bgmask|=(lab2==k)
    bgmask=cv2.dilate(bgmask.astype(np.uint8),np.ones((3,3),np.uint8))>0
    rgb,al=a[:,:,:3],a[:,:,3].copy()
    al[bgmask]=0
    core=cv2.erode((al>.97).astype(np.uint8),np.ones((9,9),np.uint8))>0   # 몸 안쪽
    dist=cv2.distanceTransform((~core).astype(np.uint8),cv2.DIST_L2,5)
    lum=rgb.min(axis=2)
    white=np.clip((lum-.80)/.15,0,1)                  # 0(색 있음) ~ 1(거의 흰색)
    far=np.clip((dist-3)/6,0,1)                       # 몸 안쪽에서 멀수록 1
    strength=.85 if id in STRICT else .6
    soft=al<.98
    new=al*(1-strength*white*far*soft)
    # 약한 연기 같은 잔여물(알파 <.12) 제거, 그리고 알파를 살짝 선명하게
    new=np.where(new<.10,0,new)
    new=np.clip((new-.04)/.92,0,1)
    if id in FLOOR:
        H=al.shape[0]; yy=np.arange(H)[:,None]/H
        haze=(lum>.86)&(yy>FLOOR[id])
        haze=cv2.dilate(haze.astype(np.uint8),np.ones((3,3),np.uint8))>0
        new=np.where(haze,new*0.0,new)
        new=cv2.GaussianBlur(new,(0,0),0.8)*(new>0)+new*(new<=0)
    # 가장자리 색 오염 제거: 반투명 픽셀의 색을 안쪽 몸 색으로 끌어당겨 흰 테두리를 없앤다
    cw=cv2.GaussianBlur(core.astype(np.float64),(0,0),9)+1e-6
    inner=np.dstack([cv2.GaussianBlur(rgb[:,:,c]*core,(0,0),9)/cw for c in range(3)])
    edge=np.clip(1-new,0,1)*np.clip((dist-0.5)/3,0,1)*(dist<26)
    pull=(0.55 if id in STRICT else 0.35)*white*edge
    rgb=rgb*(1-pull[:,:,None])+inner*pull[:,:,None]
    if id in FLOOR2:
        H=al.shape[0]; yy=np.arange(H)[:,None]/H
        sat=(rgb.max(axis=2)-rgb.min(axis=2))
        sh=(yy>FLOOR2[id])&(dist>5)&(lum>.55)&(sat<.30)
        sh=cv2.dilate(sh.astype(np.uint8),np.ones((3,3),np.uint8))>0
        new=np.where(sh,0,new)
    out=np.dstack([rgb,new]); out=(out*255+.5).astype(np.uint8)
    # 알파 0인 픽셀의 색은 가까운 색으로 확장(리사이즈 때 흰 테두리 방지)
    Image.fromarray(out,'RGBA').save(f'matted2/{id}.png')
