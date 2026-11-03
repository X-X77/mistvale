import glob,os,sys,numpy as np
from PIL import Image
from rembg import new_session, remove
S=new_session('isnet-anime')
for f in sorted(glob.glob('/home/claude/x-x77/mistvale/assets/characters/chibi-originals/*.png')):
    n=os.path.basename(f)[:-7]
    im=Image.open(f).convert('RGB')
    m=remove(im,session=S,only_mask=True,post_process_mask=False)
    m.save(f'/home/claude/work/raw/{n}.mask.png'); print(n,flush=True)
