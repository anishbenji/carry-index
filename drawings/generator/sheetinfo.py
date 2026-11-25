import sys
from PIL import Image; import numpy as np
a=np.array(Image.open(sys.argv[1]).convert('L')); H,W=a.shape; ink=a<165
print('size',W,H,'bg pct',np.percentile(a,[1,5,50]))
def runs(x,minl=20):
    r=[];s=x[0];p=x[0]
    for v in x[1:]:
        if v!=p+1: r.append((s,p)); s=v
        p=v
    r.append((s,p)); return [q for q in r if q[1]-q[0]>minl]
cols=np.where(ink.sum(0)==0)[0]; rows=np.where(ink.sum(1)==0)[0]
cr=[q for q in runs(cols) if 0<q[0] and q[1]<W-1]; rr=[q for q in runs(rows) if 0<q[0] and q[1]<H-1]
print('inner empty cols',cr); print('inner empty rows',rr)
mx=(cr[0][0]+cr[0][1])//2 if cr else W//2; my=(rr[0][0]+rr[0][1])//2 if rr else H//2
print('mid',mx,my)
for name,(x0,x1,y0,y1) in {'TL':(0,mx,0,my),'TR':(mx,W,0,my),'BL':(0,mx,my,H),'BR':(mx,W,my,H)}.items():
    s=ink[y0:y1,x0:x1]; ys=np.where(s.any(1))[0]; xs=np.where(s.any(0))[0]
    print(name,'x',x0+xs[0],x0+xs[-1],'y',y0+ys[0],y0+ys[-1],'h',ys[-1]-ys[0])
print('BR corner min',a[int(H*.85):,int(W*.85):].min())
