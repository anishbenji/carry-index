import numpy as np, json, re, glob
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize
H={'ctb26':48.2,'cpp2':46,'tp4':49,'cicada':45.7,'dfly':47,'ct15l':47.5,'ct21l':47.5,'ct15p':47.5,'ct21p':47.5,'edx':45,'slite':53,'wlh30':52}
S=3.3; P=30
res={}
for id in H:
    try: fr=open(f'v5test/drawings/{id}/sketch/{id}-sketch-front.svg').read()
    except FileNotFoundError: continue
    vbh=float(re.search(r'viewBox="([^"]+)"',fr).group(1).split()[3])
    k=H[id]*S/(vbh-2*P)   # svg units -> page px
    row={}
    for v in ['front','side']:
        a=np.array(Image.open(f'lw/{id}-sketch-{v}.png'))[...,3]>128
        dt=ndi.distance_transform_edt(a); sk=skeletonize(a)
        t=2*dt[sk]/2.0     # in svg units (render at 2 px/unit)
        t=t[t>0.5]
        # outline: thickness on the outer silhouette boundary
        fill=ndi.binary_fill_holes(a); edge=fill & ~ndi.binary_erosion(fill,iterations=3)
        ot=2*dt[sk & ndi.binary_dilation(edge,iterations=6)]/2.0
        row[v]=dict(detail_p50=round(float(np.percentile(t,50))*k,2),detail_p25=round(float(np.percentile(t,25))*k,2),outline_p50=round(float(np.median(ot))*k,2) if len(ot) else None,ink_frac=round(float(a.mean()),3))
    res[id]=dict(k=round(k,4),**row)
print(json.dumps(res,indent=0))
json.dump(res,open('lw/lw.json','w'),indent=1)
