from PIL import ImageOps
import json, os
from PIL import Image, ImageDraw, ImageFont
S='/tmp/claude-0/-home-claude/eb5e9b6f-4a73-5f32-9dbc-232f86059244/scratchpad'
R='/mnt/user-data/uploads/Downloads/the-carry-index/drawings/raw source images'
VB={
 'tp4':  {'front':[238,126,641,902],'side':[1212,1056,671,906],'back':[234,1057,652,899],'iso':[1160,154,691,884]},
 'cpp2': {'front':[312,178,590,861],'side':[1238,1083,624,856],'back':[258,1080,695,860],'iso':[1134,154,716,898]},
 'ct15l':{'front':[290,132,630,900],'side':[1223,1061,653,903],'back':[296,1074,615,916],'iso':[1161,154,690,884]},
 'ct21l':{'front':[276,164,632,866],'side':[1247,1082,615,862],'back':[267,1088,635,908],'iso':[1160,154,690,884]},
 'ct21p':{'front':[286,150,616,880],'side':[1254,1082,608,850],'back':[267,1080,639,899],'iso':[1160,154,690,884]},
 'slite':{'front':[287,180,641,850],'side':[1239,1081,727,924],'back':[248,1080,700,904],'iso':[1160,154,690,884]},
}
PH={
 'cpp2':{'front':f'{R}/cpp2/cpp2-2-front.jpg','iso':f'{R}/cpp2/cpp2-1-34hero.jpg','back':f'{R}/cpp2/cpp2-4-back.jpg','side':f'{R}/cpp2/cpp2-3-sideright.jpg'},
 'tp4':{'front':f'{R}/tp4/tp4-2-front.jpg','iso':f'{R}/tp4/tp4-1-34hero.jpg','back':f'{R}/tp4/tp4-4-back.jpg','side':f'{R}/tp4/tp4-3-sideright.jpg'},
 'ct15l':{'front':f'{R}/ct15l/ct15l-1-CT15_Lite_Ultra200X_-_Black_1.jpg','iso':f'{R}/ct15l/ct15l-2-CT15_Lite_Ultra200X_-_Black_2.jpg','back':f'{R}/ct15l/ct15l-4-CT15_Lite_Ultra200X_-_Black_4.jpg','side':f'{R}/ct15l/ct15l-3-CT15_Lite_Ultra200X_-_Black_3.jpg'},
 'ct21l':{'front':f'{R}/ct21l/ct21l-1-CT21LiteUltra400XBlack_1.jpg','iso':f'{R}/ct21l/ct21l-2-CT21LiteUltra400XBlack_2.jpg','back':f'{R}/ct21l/ct21l-4-CT21LiteUltra400XBlack_4.jpg','side':f'{R}/ct21l/ct21l-3-CT21LiteUltra400XBlack_3.jpg'},
 'ct21p':{'front':f'{R}/ct21p/ct21p-1-CT21PlusUltra400XBlack_1.jpg','iso':f'{R}/ct21p/ct21p-2-CT21PlusUltra400XBlack_2.jpg','back':f'{R}/ct21p/ct21p-5-CT21PlusUltra400XBlack_5.jpg','side':f'{R}/ct21p/ct21p-3-CT21PlusUltra400XBlack_3.jpg'},
 'slite':{'front':f'{S}/ks/slite-ks-06.png','iso':f'{S}/ks/slite-ks-21.png','back':f'{S}/slite/slite-ph-harness-system-studio.jpg','side':f'{S}/slite/slite-nn-IMG_0779.jpg'},
}
# known issues: (bag, view, n, box in sheet px or None)
ISS={
 'cpp2':[('side',1,(1430,1100,1535,1215)),('front',1,(435,180,770,278)),('iso',1,(1262,182,1578,402)),('back',1,(478,1088,722,1178)),('back',2,(420,1250,800,1900))],
 'tp4':[('front',1,(400,138,722,232)),('iso',1,(1288,168,1642,382)),('iso',2,(1500,650,1702,978)),('iso',3,(1196,470,1272,665)),('iso',3,(1600,560,1712,662))],
 'ct15l':[('iso',1,(1272,325,1390,512)),('side',2,(1432,1088,1540,1205)),('side',3,(1310,1128,1665,1232)),('iso',3,(1188,192,1692,332)),('iso',5,(1546,728,1594,864))],
 'ct21l':[('side',1,(1432,1100,1520,1230))],
 'ct21p':[('side',1,(1447,1100,1540,1220)),('back',2,(400,1240,770,1900))],
 'slite':[('side',1,(1432,1100,1540,1230)),('front',2,(530,280,680,420)),('iso',3,(1192,372,1252,422))],
}
H=560
try: F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',26)
except: F=ImageFont.load_default()
for id in VB:
    im=Image.open(f'{S}/out-{id}/native.png').convert('RGBA'); sheet=Image.new('RGB',im.size,'white'); sheet.paste(im,mask=im.split()[3])
    for v in ['front','side','back','iso']:
        x,y,w,h=VB[id][v]; c=sheet.crop((x,y,x+w,y+h)); k=H/h; c=c.resize((round(w*k),H))
        fl=(v=='side' and id in ('ct15l','ct21l','ct21p'))
        if fl: c=ImageOps.mirror(c)
        d=ImageDraw.Draw(c)
        for (vv,n,b) in ISS[id]:
            if vv!=v: continue
            bx=[(b[0]-x)*k,(b[1]-y)*k,(b[2]-x)*k,(b[3]-y)*k]
            if fl: bx=[c.width-bx[2],bx[1],c.width-bx[0],bx[3]]
            d.rounded_rectangle(bx,radius=10,outline=(214,40,40),width=5)
            cx,cy=bx[2]+4,bx[1]-4; r=19
            if cx+r*2>c.width: cx=bx[0]-r*2-4
            cy=max(cy, r)
            d.ellipse([cx,cy-r,cx+2*r,cy+r],fill=(214,40,40)); d.text((cx+r,cy),str(n),fill='white',font=F,anchor='mm')
        c.save(f'{S}/review/img/{id}-{v}-sketch.png')
        p=Image.open(PH[id][v]).convert('RGB'); p.thumbnail((900,H)); 
        if p.height<H: p=p.resize((round(p.width*H/p.height),H))
        p.save(f'{S}/review/img/{id}-{v}-photo.jpg',quality=84)
print('done', len(os.listdir(f'{S}/review/img')))
