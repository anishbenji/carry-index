"""Replace the side quadrant (bottom-right) of a four-view sheet with a separately generated side view.
usage: put_side.py sheet.png side.png out.png midx,midy side_top,side_bottom target_bottom target_height front_x
The side image's body (side_top..side_bottom rows) is scaled to target_height and placed with its body bottom on
target_bottom (the back view's body bottom) and its right-most ink at front_x (the old side view's front edge); 'L<x>' aligns the left-most ink instead (front on the left)."""
import sys, numpy as np
from PIL import Image
sheet, side, out, mid, body, tb, th, fx = sys.argv[1:9]
mx, my = map(int, mid.split(',')); st, sb = map(int, body.split(',')); tb, th = int(tb), int(th)
left = fx.startswith('L'); fx = int(fx.lstrip('L'))
S = Image.open(sheet).convert('L'); D = Image.open(side).convert('L')
s = th / (sb - st)
D2 = D.resize((round(D.width * s), round(D.height * s)), Image.LANCZOS)
a = np.asarray(D2) < 200; ys, xs = np.where(a)
oy = round(tb - sb * s); ox = fx - (xs.min() if left else xs.max())
A = np.asarray(S).copy(); A[my:, mx:] = 255
canvas = np.full_like(A, 255)
d2 = np.asarray(D2)
y0, x0 = max(oy, 0), max(ox, 0)
sy, sx = y0 - oy, x0 - ox
h = min(canvas.shape[0] - y0, d2.shape[0] - sy); w = min(canvas.shape[1] - x0, d2.shape[1] - sx)
canvas[y0:y0+h, x0:x0+w] = d2[sy:sy+h, sx:sx+w]
canvas[:my, :] = 255; canvas[:, :mx] = 255
A = np.minimum(A, canvas)
Image.fromarray(A).save(out)
ink = np.where(np.asarray(Image.fromarray(A))[my:, mx:] < 128)
print('scale', round(s, 4), 'side ink x', ink[1].min()+mx, ink[1].max()+mx, 'y', ink[0].min()+my, ink[0].max()+my)
