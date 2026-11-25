"""CT21 Lite side view (Gemini side-only v7): remove the stray cord (3-line sleeve + end cap) at the top back,
then redraw the two edges the cord overlapped: the shoulder strap's outer edge and the top of the back panel's padded edge.
Strap edge centreline points measured in the original where the cord doesn't touch it; a parametric
spline through them is stroked at 9.5 px (4x supersampled, round caps) and darkened in."""
import sys, numpy as np, cv2
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('L')).astype(np.float32)
H, W = im.shape
poly = [(690,335),(730,317),(760,287),(790,257),(808,243),(819,247),(819,300),(800,307),(790,307),(760,333),
        (745,349),(730,363),(712,381),(705,394),(700,401),(695,404),(680,422),(665,420),(648,395),(645,375),(660,355)]
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
im[np.asarray(m) > 0] = 255
pts = np.array([(684.5,460),(691,440),(699,420),(745,359),(760,351),(775,347.5),(782,346)], float)
d = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]; t = np.linspace(0, d[-1], 400)
# smooth curve: cubic polynomial fit in x(t), y(t)
px = np.polyval(np.polyfit(d, pts[:,0], 3), t); py = np.polyval(np.polyfit(d, pts[:,1], 3), t)
S = 4; big = Image.new('L', (W*S, H*S), 0); dr = ImageDraw.Draw(big)
def stroke_curve(px, py, wpx):
    xy = [(x*S, y*S) for x, y in zip(px, py)]; w = int(wpx*S)
    dr.line(xy, fill=255, width=w, joint='curve')
    for x, y in (xy[0], xy[-1]): dr.ellipse((x-w/2, y-w/2, x+w/2, y+w/2), fill=255)
stroke_curve(px, py, 9.5)
# back panel padded edge: measured (789.5,340)..(800,304) below the cord, then up into the corner of the back line
q = np.array([(789.5,346),(789.5,340),(791.5,328),(795,316),(800,304),(806,292),(813,281),(819,271),(823,263)], float)
dq = np.r_[0, np.cumsum(np.hypot(*np.diff(q, axis=0).T))]; tq = np.linspace(0, dq[-1], 300)
stroke_curve(np.polyval(np.polyfit(dq, q[:,0], 3), tq), np.polyval(np.polyfit(dq, q[:,1], 3), tq), 9.0)
stroke = np.asarray(big.resize((W, H), Image.BILINEAR)).astype(np.float32)
res = np.minimum(im, 255 - stroke)
res[243:257, 812:822] = 255          # cord end left over at the corner
# drop specks (<40 px) left at the erase border
zone = (slice(225, 412), slice(640, 760))   # left of the back-panel mesh
dk = (res[zone] < 128).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(dk, connectivity=8)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 40:
        sub = res[zone]; sub[lab == i] = 255
Image.fromarray(res.astype(np.uint8)).save(out)
print('fit max dev px', float(np.max([np.min(np.hypot(px-x, py-y)) for x, y in pts])))
