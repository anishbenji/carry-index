"""Evergoods CIVIC Travel Bag 26L - ULTRA : technical line drawing (front / side / back / 3-4)."""
import math, numpy as np, sys
from bagdraw import *

W, H, D = 29.2, 48.2, 20.3          # published dims, cm
RC = 4.2                            # plan-view corner radius (vertical edges)
RT, RB = 4.0, 2.2                   # top dome / bottom edge rounding
BOW = 1.3                           # forward bulge of the front face at mid height
TAPER = 0.9                         # per-side narrowing at the base (front view)

def zf(y):                          # z of the front face at height y (negative = forward)
    return -BOW*math.sin(math.pi*y/H)

def inset(y):
    if y < RT:   return RT - math.sqrt(max(RT*RT-(RT-y)**2, 0))
    if y > H-RB: return RB - math.sqrt(max(RB*RB-(RB-(H-y))**2, 0))
    return 0.0

def body_points():
    """Sample the body surface (rounded box, domed top, bowed front, tapered base)."""
    pts = []
    for y in sorted(set(list(np.linspace(0, H, 90)) + list(np.linspace(0, RT, 25)) + list(np.linspace(H-RB, H, 15)))):
        i = inset(y); tx = TAPER*(y/H)
        x0, x1 = i + tx, W - i - tx
        z0, z1 = zf(y) + i, D - i
        rc = max(RC - i, 0.2)
        rc = min(rc, (x1-x0)/2, (z1-z0)/2)
        for x, z in rrect(x0, z0, x1, z1, rc, rc, rc, rc, 7):
            pts.append((x, y, z))
    return pts

def silhouette(P):
    return chaikin(hull([P(p) for p in body_points()]), 2)

# ---------- point constructors on faces ----------
F = lambda x, y: (x, y, zf(y))                 # front face
Lf = lambda y, z: (0.0 + inset(y), y, z)       # left face
B = lambda x, y: (x, y, D)                     # back face
T = lambda x, z: (x, 0.0, z)                   # top face

# ---------- straps (3-D) ----------
def strap_edges(side):
    """side=-1 bag-left strap, +1 bag-right.  Returns (inner, outer) 3-D edge polylines."""
    cx = W/2
    def c(t_in, t_out):
        return lambda a, b, cc, d: bez(a, b, cc, d, 26)
    # centreline: leaves the yoke at the top-back, bows away from the back panel, comes back in at the pad end
    xs = lambda k: cx + side*k
    centre = bez((xs(5.0), 1.8, D-0.5), (xs(6.0), 12.0, D+9.5), (xs(11.5), 26.0, D+8.0), (xs(12.5), 37.0, D+1.5), 30)
    wid = 3.3
    inner, outer = [], []
    for i, (x, y, z) in enumerate(centre):
        # strap width vector: mostly in x, tilting to follow the curve
        inner.append((x - side*wid, y, z)); outer.append((x + side*wid, y, z))
    return inner, outer, centre

def webbing(side):
    cx = W/2; xs = lambda k: cx + side*k
    return [(xs(12.5), 37.0, D+1.5), (xs(13.4), 41.5, D+0.8), (xs(13.6), H-2.0, D-0.6)]

# ---------- drawing a view ----------
def draw_view(sh, P, view):
    px = lambda p: P(p)
    poly = lambda pts: [px(p) for p in pts]

    # ---- 1. things BEHIND the body ----
    if view in ('side', 'iso', 'front'):
        # shoulder straps (behind the body; whichever peeks past the silhouette shows)
        for side in (+1, -1) if view == 'side' else (-1, +1):
            inner, outer, centre = strap_edges(side)
            if view == 'side':
                c = poly(centre)
                band = offset(c, 9) + offset(c, -9)[::-1]
                sh.path(band, 'lf', closed=True)
                sh.path(offset(c, 4)[2:-2], 's')
            else:
                sh.path(poly(outer) + poly(inner)[::-1], 'lf', closed=True)
            wb = poly(webbing(side))
            sh.path(offset(wb, 3) + offset(wb, -3)[::-1], 'lf', closed=True)
            # ladder-lock
            sh.path(rrect(wb[1][0]-9, wb[1][1]-6, wb[1][0]+9, wb[1][1]+6, 2, 2, 2, 2, 3), 'h', closed=True)
    # side bottle-pocket bulge (front & back views)
    if view in ('front', 'back'):
        for side in (0, 1):
            xe = 0 if side == 0 else W
            sgn = -1 if side == 0 else 1
            b = bez((xe, 25.0, 0), (xe+sgn*1.3, 30, 0), (xe+sgn*1.2, 41, 0), (xe+sgn*0.4, H-2.3, 0), 18)
            pts = poly(b) + poly([(xe+sgn*0.4, H-2.3, 0), (xe - sgn*1.5, H-2.3, 0), (xe - sgn*1.5, 25, 0)])
            sh.path(pts, 'lf', closed=True)
    # top handle (a padded loop standing proud of the crown)
    zh = D*0.55; hx0, hx1 = W/2-6.0, W/2+6.0; hz0, hz1 = zh-1.2, zh+1.2
    outer = [T(hx0, hz0), (hx0, -2.6, hz0), (hx1, -2.6, hz0), T(hx1, hz0)]
    outer2 = [T(hx0, hz1), (hx0, -2.6, hz1), (hx1, -2.6, hz1), T(hx1, hz1)]
    if view in ('front', 'back', 'iso'):
        o = chaikin(poly(outer), 2, closed=False)
        sh.path(o, 'lf', closed=True)
        inner = [T(hx0+1.3, hz0), (hx0+1.3, -1.4, hz0), (hx1-1.3, -1.4, hz0), T(hx1-1.3, hz0)]
        sh.path(chaikin(poly(inner), 2, closed=False), 'l')
        sh.path(offset(chaikin(poly(outer), 2, closed=False), 3.5)[3:-3], 's')
    if view == 'side':
        o = poly([T(hx0, hz0-0.4), (hx0, -2.6, hz0-0.4), (hx0, -2.6, hz1+0.4), T(hx0, hz1+0.4)])
        sh.path(chaikin(o, 2, closed=False), 'lf', closed=True)

    # ---- 2. body ----
    sil = silhouette(P)
    sh.path(sil, 'o', closed=True)

    # ---- 3. surface detail ----
    if view in ('front', 'iso'):
        # front panel seam (the panel-load "tailgate") + its zip on three sides
        seam = [F(x, y) for x, y in rrect(1.6, 1.6, W-1.6, H-1.4, 5.5, 5.5, 3.8, 3.8, 10)]
        sh.path(poly(seam), 't', closed=True)
        zpath = [F(x, y) for x, y in rrect(2.6, 2.6, W-2.6, H-1.4, 4.6, 4.6, 3.2, 3.2, 10)]
        # keep only left, top, right sides (drop the bottom run = hinge)
        zp = poly(zpath)
        # rrect starts at top-left arc; bottom run is between the bottom-right and bottom-left arcs
        n = 10
        left_top_right = zp[0:3*n]            # tl arc, tr arc, br arc
        bl = zp[3*n:4*n]                      # bl arc
        draw_zip(sh, [bl[-1]] + left_top_right[:1] + left_top_right)  # from bottom-left up, over, down to bottom-right
        # main-zip pulls parked at the top-left corner of the panel
        draw_pull(sh, px(F(2.6, 5.5)), 92, 20)
        draw_pull(sh, px(F(2.6, 9.0)), 96, 20)
        # front dump pocket: smooth panel occupying the right ~2/3, zip along its top edge
        pk = [F(9.6, 7.2), F(7.4, H-1.6)]
        sh.path(poly(pk), 't')
        sh.path(offset(poly(pk), -4.5), 's')
        zt = [F(9.6, 7.2), F(W-2.6, 7.2)]
        draw_zip(sh, resample(poly(zt), 4))
        draw_pull(sh, px(F(11.0, 7.2)), 100, 19)
        draw_pull(sh, px(F(14.0, 7.2)), 97, 19)
        # lash loops on the textured strip
        for y in (13.5, 21.0):
            r = [F(x, yy) for x, yy in rrect(4.2, y, 5.6, y+2.8, .6, .6, .6, .6, 4)]
            sh.path(poly(r), 'h', closed=True)
        # velcro patch bottom-right
        r = [F(x, yy) for x, yy in rrect(W-7.6, H-9.6, W-3.6, H-5.6, .4, .4, .4, .4, 3)]
        sh.path(poly(r), 'lf', closed=True)
        r2 = [F(x, yy) for x, yy in rrect(W-7.1, H-9.1, W-4.1, H-6.1, .3, .3, .3, .3, 3)]
        sh.path(poly(r2), 's', closed=True)
        # webbing loops at the bottom-right corner
        for (x, y, a) in ((W-3.2, H-1.2, 60), (W-1.0, H-3.4, 20)):
            p = px(F(x, y)); ang = math.radians(a)
            tip = (p[0]+math.cos(ang)*14, p[1]+math.sin(ang)*14)
            lp = bez(p, (p[0]+math.cos(ang)*10-math.sin(ang)*5, p[1]+math.sin(ang)*10+math.cos(ang)*5),
                     (p[0]+math.cos(ang)*10+math.sin(ang)*5, p[1]+math.sin(ang)*10-math.cos(ang)*5), p, 14)
            sh.path(lp, 'lf', closed=True)

    if view == 'iso':
        crease = [(x, RT, z) for x, z in rrect(0, zf(RT), W, D, RC, RC, RC, RC, 8)]
        sh.path(poly(crease), 't', closed=True)
        sh.path(poly([Lf(3.0, D-1.6), Lf(H-2.5, D-1.6)]), 's')
    if view in ('side', 'iso'):
        # side (bag-left) face: laptop-compartment zip near the back edge, parked pulls at the top
        zl = [Lf(y, D-2.6) for y in np.linspace(1.4, 30.0, 12)]
        draw_zip(sh, poly(zl))
        draw_pull(sh, px(Lf(3.2, D-2.6)), 90 if view == 'side' else 95, 19)
        draw_pull(sh, px(Lf(6.6, D-2.6)), 90 if view == 'side' else 95, 19)
        # stretch bottle / side pocket: angled elastic top edge, binding stitch, gathered fabric
        top = [Lf(24.2, 1.2), Lf(24.6, 6), Lf(25.4, 12), Lf(26.4, D-1.4)]
        sh.path(chaikin(poly(top), 1, closed=False), 'l')
        sh.path(offset(chaikin(poly(top), 1, closed=False), 5), 's')
        sh.path(poly([Lf(24.2, 1.2), Lf(H-0.8, 1.2)]), 't')
        sh.path(poly([Lf(26.4, D-1.4), Lf(H-0.8, D-1.4)]), 't')
        for z in (5.5, 10.0, 14.5):
            g = bez(Lf(25.0+z*0.1, z), Lf(30, z-0.6), Lf(36, z+0.5), Lf(41, z-0.2), 12)
            sh.path(poly(g), 's')
        # back-panel foam edge seen in profile
        if view == 'side':
            sh.path(poly([Lf(3.0, D-1.6), Lf(H-2.5, D-1.6)]), 's')
            # front-panel zip seen on the front edge
            zs = [(0.9 + inset(y), y, zf(y)+0.9) for y in np.linspace(3.0, H-3.5, 24)]
            draw_zip(sh, poly(zs), w=4.0, tooth=4.2)
            # top-face zip crossing (front pocket zip is on the front face, not visible)

    if view == 'back':
        # padded back panel with diagonal quilting, luggage pass-through sleeve, yoke, straps, sternum strap
        panel = [B(x, y) for x, y in rrect(1.9, 3.2, W-1.9, H-2.6, 4.6, 4.6, 3.2, 3.2, 10)]
        pp = poly(panel)
        sh.path(pp, 't', closed=True)
        sh.path(offset(pp + pp[:2], -4.5)[1:-1], 's')
        cid = 'clipPanel'
        sh.parts.append(f'<clipPath id="{cid}"><path d="{sh._d(pp, True)}"/></clipPath>')
        sh.parts.append(f'<g clip-path="url(#{cid})">')
        for k in range(-6, 12):
            x0 = 1.9 + k*5.2; y0 = 3.2
            line = poly([B(x0, y0), B(x0 + 40*math.cos(math.radians(38)), y0 + 40*math.sin(math.radians(38)))])
            line = poly([B(x0 + 40*math.cos(math.radians(38)), y0 + 40*math.sin(math.radians(38))), B(x0, y0)])
            sh.path(line, 's')
        sh.parts.append('</g>')
        # luggage pass-through sleeve edges
        for y in (18.0, 27.0):
            sh.path(poly([B(3.4, y), B(W-3.4, y)]), 'l')
        # yoke / top seam
        sh.path(poly([B(3.0, 3.2), B(W-3.0, 3.2)]), 'l')
        # straps (in front of the panel)
        for side in (-1, +1):
            inner, outer, _ = strap_edges(side)
            sh.path(poly(outer) + poly(inner)[::-1], 'lf', closed=True)
            sh.path(offset(poly(outer), -3.5*side if side > 0 else 3.5)[6:-2], 's')
            sh.path(offset(poly(inner), 3.5*side if side > 0 else -3.5)[6:-2], 's')
            wb = poly(webbing(side))
            sh.path(wb, 'l'); sh.path(offset(wb, 3.2), 'l'); sh.path(offset(wb, -3.2), 'l')
            sh.path(rrect(wb[1][0]-9, wb[1][1]-6, wb[1][0]+9, wb[1][1]+6, 2, 2, 2, 2, 3), 'h', closed=True)
            sh.path([(wb[1][0]-6, wb[1][1]-1.5), (wb[1][0]+6, wb[1][1]-1.5)], 'l')
            sh.path([(wb[1][0]-6, wb[1][1]+1.5), (wb[1][0]+6, wb[1][1]+1.5)], 'l')
        # yoke patch over the strap roots
        yk = [B(x, y) for x, y in ((W/2-9.5, 2.4), (W/2+9.5, 2.4), (W/2+8.2, 7.6), (W/2-8.2, 7.6))]
        sh.path(chaikin(poly(yk), 1), 'lf', closed=True)
        sh.path(chaikin(poly(yk), 1), 'lf', closed=True)
        sh.path(offset(chaikin(poly(yk), 1) + chaikin(poly(yk), 1)[:1], 4)[1:], 's')
        # sternum strap with centre buckle
        ys = 29.5
        a = px(B(W/2-8.5, ys)); b = px(B(W/2+8.5, ys))
        sh.path([a, (a[0]+ (b[0]-a[0])*0.34, a[1])], 'l'); sh.path([(a[0]+(b[0]-a[0])*0.66, a[1]), b], 'l')
        sh.path([(a[0], a[1]-6), (a[0]+ (b[0]-a[0])*0.34, a[1]-6)], 'l'); sh.path([(a[0]+(b[0]-a[0])*0.66, a[1]-6), b[:1][0] and (b[0], b[1]-6)], 'l')
        cx = (a[0]+b[0])/2
        sh.path(rrect(cx-17, a[1]-10, cx+17, a[1]+4, 3, 3, 3, 3, 3), 'h', closed=True)
        sh.path([(cx-3, a[1]-10), (cx-3, a[1]+4)], 'l'); sh.path([(cx+3, a[1]-10), (cx+3, a[1]+4)], 'l')
        # laptop-zip pulls parked on the bag-left side (viewer's right)
        draw_pull(sh, px((0.4, 3.2, D-2.6)), 90, 19)
        draw_pull(sh, px((0.4, 6.6, D-2.6)), 90, 19)

def make_sheet(labels=True):
    sh = Sheet()
    views = [('front', P_FRONT), ('iso', P_ISO), ('side', P_LEFT), ('back', P_BACK)]
    cells = {'front': (0, 0), 'iso': (1, 0), 'side': (0, 1), 'back': (1, 1)}
    CW, CH = 800, 760
    for name, P in views:
        # centre the silhouette in its cell
        sil = silhouette(P)
        xs = [p[0] for p in sil]; ys = [p[1] for p in sil]
        cx, cy = cells[name]
        sh.off(cx*CW + CW/2 - (min(xs)+max(xs))/2, cy*CH + 60 + 35 - min(ys))
        draw_view(sh, P, name)
        if labels:
            sh.off(cx*CW + CW/2, cy*CH + CH - 22)
            sh.text((0, 0), {'front': 'Front', 'iso': 'Three-quarter', 'side': 'Side', 'back': 'Back'}[name])
    body = '\n'.join(sh.parts)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {2*CW} {2*CH}" width="{2*CW}" height="{2*CH}">
<title>Evergoods CIVIC Travel Bag 26L - ULTRA — technical drawing</title>
<style>{CSS}.lbl{{text-anchor:middle}}</style>
<rect width="100%" height="100%" fill="#fff"/>
{body}
</svg>'''

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'ctb26.svg'
    open(out, 'w').write(make_sheet())
    print('wrote', out)

def make_view(name, pad=40):
    P = {'front': P_FRONT, 'iso': P_ISO, 'side': P_LEFT, 'back': P_BACK}[name]
    sh = Sheet()
    sil = silhouette(P)
    xs = [p[0] for p in sil]; ys = [p[1] for p in sil]
    # generous margins so straps / handle / pulls are inside
    mx = {'front': 40, 'back': 60, 'side': 110, 'iso': 60}[name]
    w = (max(xs)-min(xs)) + 2*mx + (110 if name == 'side' else 0)
    h = (max(ys)-min(ys)) + 2*pad + 60
    sh.off(mx - min(xs) + (110 if name == 'side' else 0), pad + 40 - min(ys))
    draw_view(sh, P, name)
    body = '\n'.join(sh.parts)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}">
<title>Evergoods CIVIC Travel Bag 26L - ULTRA — {name} view</title>
<style>{CSS}</style>
{body}
</svg>'''

if __name__ == '__main__':
    import os
    d = os.path.dirname(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'ctb26.svg'))
    for v in ('front', 'side', 'back', 'iso'):
        open(os.path.join(d, f'ctb26-{v}.svg'), 'w').write(make_view(v))
    print('wrote views')
