"""Replace one quadrant of a sheet with the same quadrant from another sheet (e.g. Gemini's edit of it).
usage: take_quadrant.py base.png donor.png out.png midx,midy TL|TR|BL|BR"""
import sys, numpy as np
from PIL import Image
base, donor, out, mid, q = sys.argv[1:6]; mx, my = map(int, mid.split(','))
def L(p):
    im = Image.open(p).convert('RGBA'); bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3]); return np.asarray(bg.convert('L')).copy()
a = L(base); b = L(donor)
if b.shape != a.shape: b = np.asarray(Image.fromarray(b).resize((a.shape[1], a.shape[0]), Image.LANCZOS))
ys = slice(0, my) if q[0] == 'T' else slice(my, None); xs = slice(0, mx) if q[1] == 'L' else slice(mx, None)
a[ys, xs] = b[ys, xs]
Image.fromarray(a).save(out); print('ok', q)
