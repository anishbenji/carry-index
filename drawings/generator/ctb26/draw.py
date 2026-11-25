"""
Photo-traced technical drawings of the Evergoods CTB26 ULTRA.
Every view is authored in its source photo's 1536x1536 pixel space:
 - body silhouettes come straight from the photo masks (thin protrusions removed),
 - panel lines / zips / pockets / hardware are hand-traced from the gridded photos.
The front view uses the mirrored back-photo silhouette (same outline seen from the other side)
with features positioned from the three-quarter photo.
"""
import sys, math, re, numpy as np, cv2
sys.path.insert(0, '..')
from bagdraw import offset, resample, bez, chaikin

# ----- styles (1536 px space) -----
CSS = """
.o{fill:#fff;stroke:#111;stroke-width:8;stroke-linejoin:round;stroke-linecap:round}
.l{fill:none;stroke:#111;stroke-width:4.6;stroke-linejoin:round;stroke-linecap:round}
.lf{fill:#fff;stroke:#111;stroke-width:4.6;stroke-linejoin:round;stroke-linecap:round}
.t{fill:none;stroke:#111;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
.s{fill:none;stroke:#111;stroke-width:2.6;stroke-dasharray:11 8;stroke-linecap:round}
.z{fill:none;stroke:#111;stroke-width:2.6;stroke-linecap:round}
.h{fill:#fff;stroke:#111;stroke-width:4;stroke-linejoin:round}
.hf{fill:#111;stroke:none}
"""

# ----- tiny SVG path parser -> point list -----
def path_pts(d, n=18):
    toks = re.findall(r'[MLCQZ]|-?\d+\.?\d*', d)
    pts, i, cur, cmd = [], 0, None, None
    def num():
        nonlocal i; v = float(toks[i]); i += 1; return v
    while i < len(toks):
        t = toks[i]
        if t in 'MLCQZ': cmd = t; i += 1
        if cmd == 'M': cur = (num(), num()); pts.append(cur); cmd = 'L'
        elif cmd == 'L': cur = (num(), num()); pts.append(cur)
        elif cmd == 'C':
            p1 = (num(), num()); p2 = (num(), num()); p3 = (num(), num())
            pts += bez(cur, p1, p2, p3, n)[1:]; cur = p3
        elif cmd == 'Q':
            p1 = (num(), num()); p2 = (num(), num())
            c1 = (cur[0]+2/3*(p1[0]-cur[0]), cur[1]+2/3*(p1[1]-cur[1])); c2 = (p2[0]+2/3*(p1[0]-p2[0]), p2[1]+2/3*(p1[1]-p2[1]))
            pts += bez(cur, c1, c2, p2, n)[1:]; cur = p2
        elif cmd == 'Z': pts.append(pts[0]); cmd = None
    return pts

class SVG:
    def __init__(self): self.parts = []; self.tf = lambda p: p
    def d(self, pts, closed=False):
        return 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in map(self.tf, pts)) + (' Z' if closed else '')
    def path(self, pts, cls, closed=False):
        self.parts.append(f'<path class="{cls}" d="{self.d(pts, closed)}"/>')
        if cls == 'o':   # body silhouette: everything drawn after it is clipped to it
            self.parts.append(f'<clipPath id="body"><path d="{self.d(pts, True)}"/></clipPath><g clip-path="url(#body)">')
            self.body_open = True
    def P(self, dstr, cls, closed=False): self.path(path_pts(dstr), cls, closed)
    def stitch(self, pts, off, cls='s', trim=2):
        o = offset(pts, off); self.path(o[trim:len(o)-trim] if trim else o, cls)
    def zip(self, pts, w=17, tooth=11):
        pts = resample(pts, 6)
        a = offset(pts, w/2); b = offset(pts, -w/2)
        self.path(a, 'z'); self.path(b, 'z')
        for i, p in enumerate(resample(pts, tooth)):
            k = min(range(len(pts)), key=lambda t: (pts[t][0]-p[0])**2+(pts[t][1]-p[1])**2)
            a0 = pts[max(k-1, 0)]; b0 = pts[min(k+1, len(pts)-1)]
            tx, ty = b0[0]-a0[0], b0[1]-a0[1]; L = math.hypot(tx, ty) or 1
            nx, ny = -ty/L, tx/L; s = w/2-3
            sg = 1 if i % 2 else -1
            self.path([p, (p[0]+nx*s*sg, p[1]+ny*s*sg)], 'z')
    def slider(self, p, ang, size=1.0):
        a = math.radians(ang); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
        w, l = 11*size, 20*size
        body = [(p[0]+nx*w, p[1]+ny*w), (p[0]+nx*w+dx*l, p[1]+ny*w+dy*l), (p[0]-nx*w+dx*l, p[1]-ny*w+dy*l), (p[0]-nx*w, p[1]-ny*w)]
        self.path(body, 'h', closed=True)
    def cord(self, d, tip=True):
        """Webbing / cord zip pull: a narrow band along path d with a rounded tip."""
        pts = resample(path_pts(d), 5)
        band = offset(pts, 5) + offset(pts, -5)[::-1]
        self.path(band, 'lf', closed=True)
        if tip:
            e = pts[-1]; f = pts[-4]
            tx, ty = e[0]-f[0], e[1]-f[1]; L = math.hypot(tx, ty) or 1; tx, ty = tx/L, ty/L
            self.path([(e[0]-tx*22, e[1]-ty*22), (e[0]-tx*4, e[1]-ty*4)], 'l')
    def rect(self, x0, y0, x1, y1, cls='h'):
        self.path([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], cls, closed=True)
    def clip_begin(self, pts, cid):
        self.parts.append(f'<clipPath id="{cid}"><path d="{self.d(pts, True)}"/></clipPath><g clip-path="url(#{cid})">')
    def clip_end(self): self.parts.append('</g>')

def contour(name, mirror=False):
    c = np.load(f'{name}_clean.npy').astype(float).tolist()
    if mirror: c = [(1540 - x, y) for x, y in c]
    return chaikin([tuple(p) for p in c], 2)

# ======================================================================
def view_iso(s):
    # strap peeking at the bottom-left (behind the body)
    s.path([(322, 1130), (368, 1136), (362, 1268), (318, 1258)], 'lf', closed=True)
    # laptop-zip pulls hanging off the back-top corner (behind the body edge)
    s.cord('M 352,252 C 330,300 262,360 236,412')
    s.cord('M 356,258 C 340,320 318,362 300,400')
    s.cord('M 1150,1300 C 1200,1315 1260,1335 1292,1352')
    s.cord('M 1145,1310 C 1180,1345 1215,1385 1250,1400')
    # body
    s.path(contour('iso'), 'o', closed=True)
    # top-back rim and top face crease
    s.P('M 342,262 C 420,190 560,142 720,136 C 830,133 905,150 955,178', 'l')
    # main panel-load zip (bottom-left corner, up the left edge, across the top rim, down to the right edge)
    zp = path_pts('M 650,1398 C 612,1250 590,1000 578,800 C 568,600 552,430 552,335 C 552,268 592,216 662,206 L 1085,186 C 1145,184 1195,208 1228,252')
    s.zip(zp)
    s.stitch(zp, -24, 't', 0)     # front panel piping, just inside the zip
    s.stitch(zp, -36, 's', 6)
    # front pocket: zip along its top, seam down its left side
    pz = path_pts('M 738,371 C 850,352 1000,335 1192,318')
    s.zip(pz, 15, 10)
    s.slider((770, 366), 190, 0.9); s.slider((800, 361), 190, 0.9)
    s.cord('M 786,378 C 806,430 816,500 808,562')
    s.cord('M 812,372 C 812,410 800,440 790,472')
    ps = path_pts('M 806,388 C 832,600 834,900 816,1160 C 809,1250 800,1330 796,1388')
    s.path(ps, 'l'); s.stitch(ps, 14, 's', 4)
    # side face: back-panel edge, laptop zip, small webbing tab, stretch bottle pocket
    s.P('M 400,236 C 412,500 410,700 404,840', 't')
    lz = path_pts('M 360,248 C 374,360 380,480 382,600'); s.zip(lz, 14, 10)
    s.slider((352, 246), 84, 0.9)
    s.rect(408, 320, 438, 336)
    pk = path_pts('M 338,860 C 400,850 480,838 560,828'); s.path(pk, 'l'); s.stitch(pk, 16, 's', 3)
    for x0, y0 in ((380, 880), (440, 870), (500, 858)):
        s.P(f'M {x0},{y0} C {x0+8},{y0+150} {x0-6},{y0+300} {x0+4},{y0+430}', 's')
    # velcro patch, bottom-right webbing loops
    rs = path_pts('M 1196,332 C 1206,600 1208,900 1196,1150 C 1192,1220 1188,1260 1184,1290'); s.path(rs, 'l'); s.stitch(rs, -12, 's', 4)
    s.P('M 1046,1140 L 1130,1148 L 1122,1252 L 1038,1244 Z', 'lf', closed=True)
    s.P('M 1058,1154 L 1118,1160 L 1112,1240 L 1052,1234 Z', 's', closed=True)

# ======================================================================
def side_split():
    """Split the side-photo mask into body and strap along the back-panel line."""
    m = cv2.imread('side_mask.png', 0)
    line = [(606, 120), (566, 260), (556, 520), (558, 820), (560, 1120), (576, 1350), (606, 1440)]
    ys = np.arange(1536); xs = np.interp(ys, [p[1] for p in line], [p[0] for p in line])
    X = np.arange(1536)[None, :]
    body = m.copy(); body[X < xs[:, None]] = 0
    strap = m.copy(); strap[X >= xs[:, None]] = 0
    out = {}
    for nm, mm, k in (('body', body, 25), ('strap', strap, 45)):
        mm = cv2.morphologyEx(mm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        cnts, _ = cv2.findContours(mm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(cnts, key=cv2.contourArea)
        out[nm] = chaikin([tuple(map(float, p)) for p in cv2.approxPolyDP(c, 1.5, True).reshape(-1, 2)], 2)
    return out

def view_side(s):
    # lower webbing + ladder lock (behind), then the padded strap, then the body over both
    s.path(offset(path_pts('M 335,1252 C 420,1290 520,1360 596,1396'), 6) + offset(path_pts('M 335,1252 C 420,1290 520,1360 596,1396'), -6)[::-1], 'lf', closed=True)
    strap = path_pts('M 470,150 C 400,230 320,380 300,560 C 286,720 288,900 296,1060 C 300,1150 304,1210 312,1244 L 366,1232 C 360,1120 362,980 372,840 C 384,660 420,520 470,430 C 520,340 570,300 610,290 Z')
    s.path(strap, 'lf', closed=True)
    s.stitch(strap[1:110], 12, 's', 0)
    s.P('M 436,292 C 460,330 520,352 596,344', 'l')
    s.rect(455, 1300, 515, 1345)
    s.cord('M 1128,306 C 1150,400 1160,520 1148,620'); s.cord('M 1132,300 C 1146,360 1150,420 1140,480')
    s.path(contour('side'), 'o', closed=True)
    # back-panel foam edge
    s.P('M 590,250 C 578,520 578,900 592,1300', 's')
    # laptop zip with its two parked pulls
    lz = path_pts('M 616,232 C 636,400 641,620 633,852'); s.zip(lz, 15, 10)
    s.slider((612, 236), 86); s.slider((652, 262), 86)
    s.cord('M 606,256 C 600,320 592,370 596,426'); s.cord('M 654,282 C 656,340 652,380 650,428')
    s.rect(700, 314, 762, 334)
    # main panel-load zip up the front edge and over the top; piping just in front of it
    mz = path_pts('M 1003,1404 C 990,1250 975,1050 965,850 C 955,600 940,350 905,180 C 860,152 770,138 690,138')
    s.zip(mz)
    s.stitch(mz, 24, 't', 0)
    # stretch bottle pocket
    pk = path_pts('M 640,856 C 720,836 830,800 948,790'); s.path(pk, 'l'); s.stitch(pk, 16, 's', 3)
    s.P('M 628,862 C 622,1050 614,1250 612,1398', 't')
    for x0, y0 in ((700, 890), (790, 870), (880, 850)):
        s.P(f'M {x0},{y0} C {x0+10},{y0+180} {x0-8},{y0+330} {x0+6},{y0+480}', 's')

# ======================================================================
def view_back(s):
    """Traced from the 3000-px studio back photo; strap edges from a brightness segmentation of the
    photo (x' = 0.506x + 31, y' = 0.506y + 3 into the 1536 frame; centre x = 770)."""
    body = contour('back')
    M = lambda d: re.sub(r'(-?\d+\.?\d*),(-?\d+\.?\d*)', lambda m: f'{1540-float(m.group(1)):.0f},{m.group(2)}', d)
    # behind the body: dangling webbing tails, laptop-zip pull
    for d in ('M 540,1222 C 480,1236 420,1250 388,1272', M('M 540,1222 C 480,1236 420,1250 388,1272')):
        s.cord(d)
    s.cord('M 1152,238 C 1200,300 1240,370 1236,432')
    s.path(body, 'o', closed=True)
    # base panel and side-gusset seams
    s.P('M 396,1262 C 600,1256 900,1256 1140,1262', 'l')
    s.P('M 422,300 C 406,600 402,900 410,1260', 't'); s.P(M('M 422,300 C 406,600 402,900 410,1260'), 't')
    # quilted padded panel (channels run bottom-left to top-right)
    panel = path_pts('M 490,292 L 1050,292 C 1066,292 1074,300 1074,316 L 1074,1236 C 1074,1250 1066,1256 1050,1256 L 490,1256 C 474,1256 466,1250 466,1236 L 466,316 C 466,300 474,292 490,292 Z')
    s.path(panel, 't', closed=True)
    s.clip_begin(panel, 'bq')
    for k in range(-2, 9):
        y0 = 300 + k*150
        s.path([(456, y0), (1084, y0 - 628*0.84)], 's')
    s.clip_end()
    # harness: crown / yoke across the top, padded bridge between the strap roots
    crown = 'M 345,307 C 385,296 425,284 461,276'
    s.P(crown, 'l'); s.P(M(crown), 'l')
    bridge = path_pts('M 623,256 C 660,250 880,250 917,256 C 924,268 924,282 917,292 L 623,292 C 616,282 616,268 623,256 Z')
    s.path(bridge, 'lf', closed=True); s.stitch(bridge[:-1], 9, 's', 3)
    # shoulder straps: nearly vertical pads that narrow and drift inward toward the base;
    # the top section is one piece with the crown, with an angled seam where the sewn pad begins
    L = ('M 461,276 C 470,300 476,320 476,332 L 476,433 C 478,470 481,510 481,534 C 483,570 484,610 486,636 '
         'C 492,660 502,672 502,686 C 510,704 514,722 517,737 C 522,754 527,772 532,787 C 542,822 552,862 557,889 '
         'C 560,922 561,958 562,990 C 564,1024 565,1058 565,1091 C 564,1110 563,1130 562,1147 L 664,1147 '
         'C 663,1130 660,1110 658,1091 C 656,1058 654,1024 653,990 C 653,958 653,922 653,889 '
         'C 655,872 657,855 658,838 C 662,822 666,805 669,787 C 673,770 677,752 679,737 C 674,700 669,668 664,636 '
         'C 662,618 660,600 658,585 C 651,560 644,535 638,509 C 634,484 630,458 628,433 L 628,332 C 626,310 624,290 623,271 '
         'C 570,270 515,272 461,276 Z')
    for d in (L, M(L)):
        pts = path_pts(d); s.path(pts, 'lf', closed=True)
        s.stitch(pts[3:200], 11, 's', 0)
    seam = 'M 486,626 C 540,614 600,600 658,590'
    s.P(seam, 'l'); s.P(M(seam), 'l')
    # webbing rails (daisy chain) on the strap pads
    for x in (613, 902):
        s.rect(x, 742, x+25, 1066, 'lf')
        for y in range(772, 1066, 46): s.path([(x, y), (x+25, y)], 't')
    # sternum strap: female buckle off the left rail, male half, webbing to the slider on the right rail
    s.P('M 638,890 L 739,890 L 739,946 L 638,946 Z', 'h', closed=True)
    s.P('M 739,896 C 780,896 820,904 820,918 C 820,932 780,940 739,940', 'h')
    s.rect(652, 902, 674, 934, 'h')
    s.path(offset([(820, 918), (902, 918)], 9) + offset([(820, 918), (902, 918)], -9)[::-1], 'lf', closed=True)
    s.rect(884, 892, 924, 944); s.path([(896, 892), (896, 944)], 't'); s.path([(912, 892), (912, 944)], 't')
    # lower webbing from the pad end down to the base corner, ladder lock on it
    for d in ('M 600,1147 C 560,1200 510,1260 476,1319', M('M 600,1147 C 560,1200 510,1260 476,1319')):
        pts = path_pts(d); s.path(offset(pts, 10) + offset(pts, -10)[::-1], 'lf', closed=True)
    s.rect(527, 1200, 585, 1242); s.rect(955, 1200, 1013, 1242)
    # bottle-pocket top edges
    s.P('M 344,838 C 370,818 400,814 424,828', 'l'); s.P(M('M 344,838 C 370,818 400,814 424,828'), 'l')

# ======================================================================
def view_front(s):
    """Mirrored back silhouette; features mapped from the on-body straight front photo
    (x_f = 390 + (x-1000)*0.855, y_f = 240 + (y-860)*0.855 from the 3000-px frame)."""
    body = contour('back', mirror=True)
    # laptop pulls peeking past the left (bag's left) edge
    s.cord('M 388,238 C 340,300 300,370 304,432'); s.cord('M 384,246 C 356,300 330,350 334,400')
    s.cord('M 1090,1300 C 1140,1330 1190,1360 1218,1384'); s.cord('M 1082,1318 C 1112,1360 1150,1408 1176,1444')
    s.path(body, 'o', closed=True)
    # side-pocket top edges
    s.P('M 1196,838 C 1170,818 1140,814 1116,828', 'l'); s.P('M 344,838 C 370,818 400,814 424,828', 'l')
    # grab handle lying over the crown
    hd = path_pts('M 528,246 C 534,196 560,186 600,186 L 950,186 C 990,186 1016,196 1022,246')
    s.path(hd, 'l'); s.path(offset(hd, -20)[3:-3], 'l'); s.path(offset(hd, -10)[4:-4], 's')
    # main panel-load zip runs around the very edge of the front panel (top edge and down both sides)
    zp = path_pts('M 416,1384 C 408,1100 406,700 412,400 C 414,300 470,250 560,246 L 990,246 C 1080,248 1128,300 1130,400 C 1134,700 1132,1100 1124,1384')
    s.zip(zp); s.stitch(zp, -22, 't', 0)
    # front dump pocket: full-width panel with a seam each side, zip along its top, pulls parked at the left
    pz = path_pts('M 510,428 L 1100,428'); s.zip(pz, 15, 10)
    s.slider((518, 428), 0, 0.9); s.slider((548, 428), 0, 0.9)
    s.cord('M 528,440 C 540,500 546,560 534,620'); s.cord('M 556,440 C 566,470 562,520 552,560')
    for d in ('M 544,445 C 548,750 550,1050 546,1343', 'M 1057,445 C 1061,750 1062,1050 1058,1343'):
        pts = path_pts(d); s.path(pts, 'l'); s.stitch(pts, -12 if d.startswith('M 544') else 12, 's', 0)
    # velcro patch (square), corner loops
    s.rect(903, 1189, 988, 1274, 'lf'); s.rect(915, 1201, 976, 1262, 's')

VIEWS = {'front': view_front, 'iso': view_iso, 'side': view_side, 'back': view_back}

def render(name, overlay=None, out=None):
    s = SVG(); VIEWS[name](s)
    if getattr(s, 'body_open', False): s.parts.append('</g>')
    body = '\n'.join(s.parts)
    extra = '.o,.lf,.h{fill:none}' if overlay else ''
    img = f'<image href="{overlay}" width="1536" height="1536" opacity="0.45"/>' if overlay else ''
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1536 1536" width="1536" height="1536"><style>{CSS}{extra}</style><rect width="100%" height="100%" fill="#fff"/>{img}<g opacity="{0.85 if overlay else 1}">{body}</g></svg>'
    open(out or f'{name}.svg', 'w').write(svg)

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'final'
    photos = {'iso': 'iso.png', 'side': 'side.jpg', 'back': 'back.jpg', 'front': None}
    for v in VIEWS:
        if mode == 'overlay' and photos[v]:
            render(v, photos[v], f'ov_{v}.svg')
        else:
            render(v, None, f'{v}.svg')
