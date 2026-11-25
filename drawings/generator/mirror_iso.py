"""Mirror the three-quarter (top-right) quadrant of a four-view sheet in place, about the centre of its ink.
usage: mirror_iso.py sheet.png out.png midx,midy"""
import sys, numpy as np
from PIL import Image, ImageOps
src, out, mid = sys.argv[1:4]; mx, my = map(int, mid.split(','))
im = Image.open(src).convert('RGBA'); bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3]); im = bg.convert('L')
a = np.asarray(im).copy(); q = a[:my, mx:]
ys, xs = np.where(q < 200); x0, x1 = xs.min(), xs.max()
box = q[:, x0:x1+1][:, ::-1].copy()
q[:, :] = 255; q[:, x0:x1+1] = box
a[:my, mx:] = q
Image.fromarray(a).save(out); print('mirrored x', x0+mx, x1+mx)
