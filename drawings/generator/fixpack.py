import json, os, shutil
from PIL import Image, ImageDraw, ImageFont, ImageOps
S='/tmp/claude-0/-home-claude/eb5e9b6f-4a73-5f32-9dbc-232f86059244/scratchpad'
U='/mnt/user-data/uploads/Downloads/the-carry-index/drawings/'
R=U+'raw source images/'
G=U+'gemini-inputs/'
OUT=S+'/fix'
exec(open(S+'/review_build.py').read().split('H=560')[0])   # VB, PH, ISS
FB=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',30)
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',24)
def white(p):
    im=Image.open(p)
    if im.mode in('RGBA','LA','P'):
        im=im.convert('RGBA'); bg=Image.new('RGBA',im.size,'white'); bg.alpha_composite(im); im=bg
    return im.convert('RGB')
def sheet6(id):
    im=white(f'{S}/out-{id}/native.png')
    if id in ('ct15l','ct21l','ct21p'):
        x,y,w,h=VB[id]['side']; c=im.crop((x,y,x+w,y+h)); im.paste(ImageOps.mirror(c),(x,y))
    return im
def sheet4(id):
    v={k:white(U+f'{id}/sketch/{id}-sketch-{k}.png') for k in ['front','iso','back','side']}
    H=900; v={k:i.resize((round(i.width*H/i.height),H)) for k,i in v.items()}
    W=max(v['front'].width,v['back'].width)+max(v['iso'].width,v['side'].width)+120
    o=Image.new('RGB',(W,2*H+120),'white')
    c1=max(v['front'].width,v['back'].width)+60
    o.paste(v['front'],(30,30)); o.paste(v['iso'],(c1+30,30)); o.paste(v['back'],(30,H+90)); o.paste(v['side'],(c1+30,H+90))
    return o
def wrap(t,n=95):
    import textwrap; return textwrap.wrap(t,n)
def pxwrap(t,font,W):
    out=[];cur=''
    for w in t.split():
        c=(cur+' '+w).strip()
        if font.getlength(c)<=W: cur=c
        else: out.append(cur); cur=w
    if cur: out.append(cur)
    return out
def closeups(rows,title):
    # rows: list of (label, [images])
    H=520; blocks=[]
    for lab,ims in rows:
        ims=[i.resize((round(i.width*H/i.height),H)) for i in ims]
        BW=max(1400,sum(i.width+20 for i in ims)+20)
        lines=pxwrap(lab,FB,BW-40)
        top=20+38*len(lines)
        b=Image.new('RGB',(BW,top+H+30),'white'); d=ImageDraw.Draw(b)
        for k,l in enumerate(lines): d.text((20,12+38*k),l,fill=(200,30,30),font=FB)
        x=20
        for i in ims: b.paste(i,(x,top)); x+=i.width+20
        d.rectangle([0,0,b.width-1,b.height-1],outline=(180,180,180),width=2)
        blocks.append(b)
    W=max(b.width for b in blocks); tl=pxwrap(title,FB,W-40); th=30+38*len(tl)
    o=Image.new('RGB',(W,th+sum(b.height+16 for b in blocks)),'white')
    for k,l in enumerate(tl): ImageDraw.Draw(o).text((20,14+38*k),l,fill='black',font=FB)
    y=th
    for b in blocks: o.paste(b,(0,y)); y+=b.height+16
    return o
def save(id,files,prompt):
    d=f'{OUT}/fix-{id}'; shutil.rmtree(d,ignore_errors=True); os.makedirs(d)
    names=[]
    for n,(name,obj) in enumerate(files):
        fn=f'{d}/{n:02d}-{name}'
        if isinstance(obj,Image.Image):
            fn+='.png'; im=obj
            if max(im.size)>2600: im=im.copy(); im.thumbnail((2600,2600))
            im.save(fn)
        else:
            ext=os.path.splitext(obj)[1]; fn+=ext; shutil.copy(obj,fn)
        names.append(os.path.basename(fn))
    lst='\n'.join(f'- Image {i+1}: {n}' for i,n in enumerate(names))
    open(f'{d}/PROMPT.txt','w').write(prompt.strip()+'\n')
    open(f'{d}/README.txt','w').write(f'Drag images 1-{len(names)} into a NEW Gemini chat, in this order, then paste PROMPT.txt.\n\n{lst}\n')
    assert len(names)<=10, (id,len(names))
    print(id,len(names),names)
