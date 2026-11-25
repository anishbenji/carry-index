"""Bitmap line art -> SVG. Threshold the ink, trace outer+inner contours (holes preserved via
even-odd fill), smooth, simplify, and emit one path per connected ink region."""
import cv2, numpy as np, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
drop_frame = '--no-frame' in sys.argv
no_wm = '--no-wm' in sys.argv           # sheet has no generator watermark: keep ink in the bottom-right box
MIN_AREA = next((int(a[11:]) for a in sys.argv if a.startswith('--min-area=')), 60)   # 2x-pixel area below which a component is treated as a speck
im = Image.open(src).convert('RGBA')
bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
g = np.array(Image.alpha_composite(bg, im).convert('L'))
H, W = g.shape
# upscale 2x before thresholding so the traced curves are smoother than the pixel grid
g2 = cv2.resize(g, (W*2, H*2), interpolation=cv2.INTER_CUBIC)
THRESH = next((int(a[9:]) for a in sys.argv if a.startswith('--thresh=')), 150)
ink = (g2 < THRESH).astype(np.uint8) * 255
if '--dilate' in sys.argv:
    # thin (1 px) stitch dashes trace as zero-area hairlines: grow the ink 1 px at 2x so every line keeps a body.
    # this also offsets the half-pixel that contour tracing (through pixel centres) trims from every edge.
    ink = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3)))
if drop_frame:
    # remove the rounded rectangle border around the sheet: it's the largest component touching the margins
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
    for i in range(1, n):
        x, y, w, h = stats[i, :4]
        if w > 0.9*W*2 and h > 0.9*H*2: ink[lab == i] = 0
# drop the image generator's sparkle watermark and any stray specks: small components outside the four bag regions
n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
for i in range(1, n):
    x, y, w, h, a = stats[i]
    cx, cy = (x + w/2) / 2, (y + h/2) / 2      # back to source-pixel space
    if a < MIN_AREA: ink[lab == i] = 0
    if not no_wm and cx > 0.82*W and 0.78*H < cy < 0.9*H: ink[lab == i] = 0
# optional exclusion boxes (original-pixel coords) e.g. --drop=1630,1630,1740,1750 removes a watermark
for a in sys.argv:
    if a.startswith('--drop='):
        x0, y0, x1, y1 = [int(v)*2 for v in a[7:].split(',')]
        n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
        for i in range(1, n):
            x, y, w, h = stats[i, :4]
            if x >= x0 and y >= y0 and x+w <= x1 and y+h <= y1: ink[lab == i] = 0
# optional repairs: --bridge=x0,y0,x1,y1,w redraws a line segment the source lost (e.g. under a watermark glow)
for a in sys.argv:
    if a.startswith('--bridge='):
        x0, y0, x1, y1, wd = [float(v) for v in a[9:].split(',')]
        cv2.line(ink, (int(x0*2), int(y0*2)), (int(x1*2), int(y1*2)), 255, int(wd*2), cv2.LINE_AA)
        ink = (ink > 127).astype(np.uint8)*255
cnts, hier = cv2.findContours(ink, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
paths = []
def smooth(c):
    c = c.reshape(-1, 2).astype(float)
    if len(c) < 8: return c
    k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
    x = np.convolve(np.r_[c[-2:, 0], c[:, 0], c[:2, 0]], k, 'valid'); y = np.convolve(np.r_[c[-2:, 1], c[:, 1], c[:2, 1]], k, 'valid')
    return np.stack([x, y], 1)
for i, c in enumerate(cnts):
    if cv2.contourArea(c) < 3: continue
    pts = smooth(c)
    pts = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), 0.9, True).reshape(-1, 2) / 2.0
    if len(pts) < 3: continue
    paths.append('M' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">\n<path fill="#111" fill-rule="evenodd" d="{" ".join(paths)}"/>\n</svg>'
open(dst, 'w').write(svg)
print(len(paths), 'contours,', len(svg)//1024, 'KB')
