#!/bin/bash
# runbag.sh id src.png mid layout "erase boxes" ["QUAD src_top,src_bot dst_top,dst_bot"]
set -e
id=$1; src=$2; mid=$3; layout=$4; boxes=$5; xf=$6
S=/tmp/claude-0/-home-claude/eb5e9b6f-4a73-5f32-9dbc-232f86059244/scratchpad; G=$S/wlh30/gen; O=$S/out-$id; mkdir -p $O; cd $O
python3 - "$src" "$boxes" <<'PY'
import sys
from PIL import Image, ImageDraw
im=Image.open(sys.argv[1]).convert('RGB'); d=ImageDraw.Draw(im)
for b in filter(None, sys.argv[2].split(';')):
    x0,y0,x1,y1=map(int,b.split(',')); d.rectangle([x0,y0,x1,y1],fill='white')
im.save('clean.png')
PY
python3 $G/vectorize.py clean.png $id-sketch.svg --no-wm --min-area=16 --thresh=165 --dilate
[ -n "$xf" ] && python3 $S/xform.py $id-sketch.svg $mid $xf
python3 $G/split.py $id-sketch.svg $id-sketch --mid=$mid --layout=$layout
export NODE_PATH=$(npm root -g); cp $G/render_png.js .
node render_png.js $id-sketch.svg native.png 2048 >/dev/null
for v in front side back iso; do node render_png.js $id-sketch-$v.svg $id-sketch-$v.png 1400 >/dev/null; done
node render_png.js $id-sketch.svg $id-sketch.png 2400 >/dev/null
python3 - <<'PY'
from PIL import Image; import numpy as np
src=np.array(Image.open('clean.png').convert('L'))<165
r=np.array(Image.open('native.png').convert('RGBA'))[:,:,3]>100
print('missing',int((src&~r).sum()),'of',int(src.sum()))
o=np.full(src.shape+(3,),255,np.uint8); o[r]=(150,150,150); o[src&~r]=(255,0,0)
Image.fromarray(o).resize((1024,1024)).save('overlay.png')
im=Image.open([f for f in __import__('glob').glob('*-sketch.png')][0]); bg=Image.new('RGB',im.size,'white'); bg.paste(im,mask=im.split()[3]); bg.resize((1100,1100)).save('preview.png')
PY
for v in front side back iso; do echo "$v $(grep -o 'viewBox="[^"]*"' $id-sketch-$v.svg)"; done
