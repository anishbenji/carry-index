from PIL import Image, ImageDraw, ImageOps
import numpy as np, sys
U='/mnt/user-data/uploads/Downloads/the-carry-index/drawings/'
R=U+'raw source images/'
def load(p):
    im=Image.open(p)
    if im.mode in('RGBA','LA','P'):
        im=im.convert('RGBA');bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);im=bg
    return im.convert('RGB')
def crop(im):
    g=np.array(im.convert('L'));bgv=np.median(np.concatenate([g[0],g[-1],g[:,0],g[:,-1]]))
    if bgv<60: return im
    ys,xs=np.where(g<bgv-25);return im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
H=420
def row(label,items):
    ims=[]
    for cap,p,flip in items:
        i=crop(load(p));i=ImageOps.mirror(i) if flip else i
        i=i.resize((int(i.width*H/i.height),H));c=Image.new('RGB',(i.width,H+22),'white');c.paste(i,(0,22));ImageDraw.Draw(c).text((2,4),cap,fill='red');ims.append(c)
    W=sum(i.width+16 for i in ims);r=Image.new('RGB',(W,H+40),'white');ImageDraw.Draw(r).text((2,0),label,fill='black');x=0
    for i in ims:r.paste(i,(x,16));x+=i.width+16
    return r
def sheet(rows,out):
    W=max(r.width for r in rows);o=Image.new('RGB',(W,sum(r.height for r in rows)),'white');y=0
    for r in rows:o.paste(r,(0,y));y+=r.height
    o.save(out)
