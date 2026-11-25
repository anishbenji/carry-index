# pair each sheet quadrant with a photo: python3 pair.py sheet.png out.jpg TL.jpg TR.jpg BL.jpg BR.jpg
import sys
from PIL import Image
sh=Image.open(sys.argv[1]).convert('RGB'); W,H=sh.size
q=[(0,0,W//2,H//2),(W//2,0,W,H//2),(0,H//2,W//2,H),(W//2,H//2,W,H)]
T=560; c=Image.new('RGB',(4*T,2*T),'white')
for k,(box,ph) in enumerate(zip(q,sys.argv[3:7])):
    a=sh.crop(box); a.thumbnail((T,T)); p=Image.open(ph).convert('RGB'); p.thumbnail((T,T))
    x=(k%2)*2*T; y=(k//2)*T; c.paste(a,(x,y)); c.paste(p,(x+T,y))
c.save(sys.argv[2],quality=88)
