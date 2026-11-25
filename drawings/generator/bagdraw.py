"""
Technical line-drawing generator for backpacks.
Bag is modelled in cm in a right-handed frame:
  x: 0..W  left->right (as seen from the FRONT of the bag)
  y: 0..H  top->bottom
  z: 0..D  front->back
Every feature is a 3-D polyline; each view is a projection + painter's-order hidden-line
handling (body silhouette is filled white over the straps that sit behind it).
"""
import math, numpy as np

S = 10.0  # px per cm

# ---------- helpers ----------
def arc(cx, cy, r, a0, a1, n=12):
    return [(cx + r*math.cos(math.radians(a)), cy + r*math.sin(math.radians(a)))
            for a in np.linspace(a0, a1, n)]

def rrect(x0, y0, x1, y1, rtl, rtr, rbr, rbl, n=10):
    """2-D rounded rectangle polyline (closed), corner radii per corner."""
    p = []
    p += arc(x0+rtl, y0+rtl, rtl, 180, 270, n)
    p += arc(x1-rtr, y0+rtr, rtr, 270, 360, n)
    p += arc(x1-rbr, y1-rbr, rbr, 0, 90, n)
    p += arc(x0+rbl, y1-rbl, rbl, 90, 180, n)
    p.append(p[0])
    return p

def bez(p0, p1, p2, p3, n=24):
    out = []
    for t in np.linspace(0, 1, n):
        u = 1-t
        out.append(tuple(u*u*u*np.array(p0) + 3*u*u*t*np.array(p1) + 3*u*t*t*np.array(p2) + t*t*t*np.array(p3)))
    return out

def hull(points):
    pts = sorted(set((round(x, 3), round(y, 3)) for x, y in points))
    if len(pts) < 3: return pts
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

def chaikin(pts, k=2, closed=True):
    for _ in range(k):
        out = []
        n = len(pts)
        rng = range(n) if closed else range(n-1)
        for i in rng:
            a, b = pts[i], pts[(i+1) % n]
            out.append((0.75*a[0]+0.25*b[0], 0.75*a[1]+0.25*b[1]))
            out.append((0.25*a[0]+0.75*b[0], 0.25*a[1]+0.75*b[1]))
        if not closed: out = [pts[0]] + out + [pts[-1]]
        pts = out
    return pts

# ---------- projections (3-D cm -> 2-D px, before view offset) ----------
class Proj:
    def __init__(self, fn, name): self.fn, self.name = fn, name
    def __call__(self, p):
        x, y = self.fn(*p); return (x*S, y*S)

P_FRONT = Proj(lambda x, y, z: (x, y), 'front')
P_BACK  = Proj(lambda x, y, z: (-x, y), 'back')            # mirrored
P_LEFT  = Proj(lambda x, y, z: (-z, y), 'side')             # bag's left side, front of bag on the right
_ax, _ay = math.radians(12), math.radians(36)
_sx, _sz = 0.95, 0.72
P_ISO   = Proj(lambda x, y, z: (_sx*x*math.cos(_ax) - _sz*z*math.cos(_ay),
                                y - _sx*x*math.sin(_ax) - _sz*z*math.sin(_ay)), 'iso')

# ---------- svg primitives ----------
class Sheet:
    def __init__(self):
        self.parts = []
        self.dx = self.dy = 0
    def off(self, dx, dy): self.dx, self.dy = dx, dy
    def _d(self, pts2, closed=False):
        d = 'M' + ' L'.join(f'{x+self.dx:.1f},{y+self.dy:.1f}' for x, y in pts2)
        return d + (' Z' if closed else '')
    def path(self, pts2, cls, closed=False, extra=''):
        self.parts.append(f'<path class="{cls}" d="{self._d(pts2, closed)}"{extra}/>')
    def circle(self, p, r, cls):
        self.parts.append(f'<circle class="{cls}" cx="{p[0]+self.dx:.1f}" cy="{p[1]+self.dy:.1f}" r="{r:.1f}"/>')
    def text(self, p, s, cls='lbl'):
        self.parts.append(f'<text class="{cls}" x="{p[0]+self.dx:.1f}" y="{p[1]+self.dy:.1f}">{s}</text>')

CSS = """
.o{fill:#fff;stroke:#111;stroke-width:3.2;stroke-linejoin:round;stroke-linecap:round}
.of{fill:#fff;stroke:none}
.l{fill:none;stroke:#111;stroke-width:1.9;stroke-linejoin:round;stroke-linecap:round}
.lf{fill:#fff;stroke:#111;stroke-width:1.9;stroke-linejoin:round;stroke-linecap:round}
.t{fill:none;stroke:#111;stroke-width:1.2;stroke-linejoin:round;stroke-linecap:round}
.s{fill:none;stroke:#111;stroke-width:1.1;stroke-dasharray:4 3.2;stroke-linecap:round}
.z{fill:none;stroke:#111;stroke-width:1.1;stroke-linecap:round}
.h{fill:#fff;stroke:#111;stroke-width:1.6;stroke-linejoin:round}
.hd{fill:#111;stroke:none}
.lbl{font:600 15px/1 Archivo,Inter,Helvetica,Arial,sans-serif;fill:#111;letter-spacing:.14em;text-transform:uppercase}
"""

# ---------- 2-D ops in projected space ----------
def offset(pts2, d):
    """Offset an open polyline by d px along its left-hand normal."""
    out = []
    n = len(pts2)
    for i in range(n):
        a = pts2[max(i-1, 0)]; b = pts2[min(i+1, n-1)]
        tx, ty = b[0]-a[0], b[1]-a[1]; L = math.hypot(tx, ty) or 1
        out.append((pts2[i][0] - ty/L*d, pts2[i][1] + tx/L*d))
    return out

def resample(pts2, step):
    out = [pts2[0]]; acc = 0
    for i in range(1, len(pts2)):
        a, b = pts2[i-1], pts2[i]; seg = math.hypot(b[0]-a[0], b[1]-a[1])
        while acc + seg >= step:
            t = (step-acc)/seg; a = (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
            out.append(a); seg = math.hypot(b[0]-a[0], b[1]-a[1]); acc = 0
        acc += seg
    return out

def draw_zip(sh, pts2, w=5.5, tooth=3.6):
    """Coil zip: two tape lines with a chain of teeth between."""
    a = offset(pts2, w/2); b = offset(pts2, -w/2)
    sh.path(a, 'z'); sh.path(b, 'z')
    for i, p in enumerate(resample(pts2, tooth)):
        # alternate short ticks either side of the centre line
        j = i % 2
        q = offset([pts2[0], p, pts2[-1]], (w/2-1.2)*(1 if j else -1))[1] if False else None
        # simpler: perpendicular tick through centre
        k = min(range(len(pts2)), key=lambda t: (pts2[t][0]-p[0])**2+(pts2[t][1]-p[1])**2)
        a0 = pts2[max(k-1, 0)]; b0 = pts2[min(k+1, len(pts2)-1)]
        tx, ty = b0[0]-a0[0], b0[1]-a0[1]; L = math.hypot(tx, ty) or 1
        nx, ny = -ty/L, tx/L
        s = (w/2-1.0)
        if j: sh.path([(p[0], p[1]), (p[0]+nx*s, p[1]+ny*s)], 'z')
        else: sh.path([(p[0], p[1]), (p[0]-nx*s, p[1]-ny*s)], 'z')

def draw_pull(sh, p2, ang_deg=90, length=22):
    """Slider + cord pull hanging from point p2 in direction ang (deg, 0 = +x, 90 = down)."""
    a = math.radians(ang_deg); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
    x, y = p2
    # slider body
    body = [(x+nx*3.2, y+ny*3.2), (x+nx*3.2+dx*7, y+ny*3.2+dy*7), (x-nx*3.2+dx*7, y-ny*3.2+dy*7), (x-nx*3.2, y-ny*3.2)]
    sh.path(body, 'h', closed=True)
    # cord loop
    tip = (x+dx*(7+length), y+dy*(7+length))
    loop = bez((x+nx*1.6+dx*7, y+ny*1.6+dy*7), (x+nx*5+dx*(7+length*0.7), y+ny*5+dy*(7+length*0.7)),
               (x-nx*5+dx*(7+length*0.7), y-ny*5+dy*(7+length*0.7)), (x-nx*1.6+dx*7, y-ny*1.6+dy*7), 16)
    sh.path(loop, 'l', closed=True)
    # knot
    sh.path([(x+nx*2.2+dx*(7+length*0.72), y+ny*2.2+dy*(7+length*0.72)), (x-nx*2.2+dx*(7+length*0.72), y-ny*2.2+dy*(7+length*0.72))], 'l')
