# xform.py sheet.svg mx,my QUAD src_top,src_bot dst_top,dst_bot  — scale one quadrant so its bag body spans dst (x scaled about its centre)
import re,sys
f,mid,quad,src,dst=sys.argv[1:6]
mx,my=map(float,mid.split(',')); st,sb=map(float,src.split(',')); dt,db=map(float,dst.split(','))
k=(db-dt)/(sb-st)
svg=open(f).read(); d=re.search(r'd="([^"]+)"',svg).group(1); subs=re.findall(r'M[^M]+',d)
P=lambda s:[(float(a),float(b)) for a,b in re.findall(r'(-?\d+\.?\d*),(-?\d+\.?\d*)',s)]
def inq(p):
    cx=sum(x for x,_ in p)/len(p); cy=sum(y for _,y in p)/len(p)
    return quad==('T' if cy<my else 'B')+('L' if cx<mx else 'R')
sel=[P(s) for s in subs if inq(P(s))]
x0=min(x for p in sel for x,_ in p); x1=max(x for p in sel for x,_ in p); cx=(x0+x1)/2
out=[]
for s in subs:
    p=P(s)
    if inq(p): p=[(cx+(x-cx)*k, dt+(y-st)*k) for x,y in p]
    out.append('M'+' '.join(f'{x:.1f},{y:.1f}' for x,y in p)+'Z')
open(f,'w').write(svg.replace(d,' '.join(out))); print(quad,'scaled',round(k,4),len(sel),'subpaths')
