"""Replace the traced speckle of a hook-and-loop logo patch with a clean vector version:
a rounded quad filled with a dot 'loop field' pattern, and the white slash across it.
Usage: patches.py in.svg out.svg  (patch specs are edited below per bag)."""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
# each patch: corner quad (TL, TR, BR, BL), slash end points, slash width, outline stroke
PATCHES = [
  dict(quad=[(1588,1783),(1678,1783),(1678,1873),(1588,1873)], slash=[(1601,1861),(1666,1795)], w=15, r=7),   # front view
  # three-quarter view: quad re-extracted from the PNG (convex hull of the patch's dark pixels -> 4 corners):
  # corners (743,809) (808,793) (808,870) (741,885) -> centre, edge directions and size below; dots share the projection
  dict(centre=(775,839), u=(1,-0.235), v=(-0.013,1), size=(65,75), w=12, r=5, sx=0.87),
]
svg = open(src).read()
d = re.search(r'd="([^"]+)"', svg).group(1)
subs = re.findall(r'M[^M]+', d)
def bbox(sp):
    pts = [(float(a), float(b)) for a, b in re.findall(r'(-?\d+\.?\d*),(-?\d+\.?\d*)', sp)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return min(xs), min(ys), max(xs), max(ys)
for P in PATCHES:      # expand axis-defined patches into corner quads + slash + pattern matrix
    if 'centre' in P:
        cx, cy = P['centre']; ux, uy = P['u']; vx, vy = P['v']; hw, hh = P['size'][0]/2, P['size'][1]/2
        at = lambda a, b: (cx + a*ux + b*vx, cy + a*uy + b*vy)
        P['quad'] = [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)]
        P['slash'] = [at(-hw*0.72, hh*0.73), at(hw*0.72, -hh*0.73)]
        sx = P.get('sx', 1); P['matrix'] = f'matrix({ux*sx:.3f},{uy*sx:.3f},{vx:.3f},{vy:.3f},0,0)'
keep = []
for sp in subs:
    x0, y0, x1, y1 = bbox(sp)
    inside = any(x0 >= min(p[0] for p in P['quad'])-10 and y0 >= min(p[1] for p in P['quad'])-10 and
                 x1 <= max(p[0] for p in P['quad'])+10 and y1 <= max(p[1] for p in P['quad'])+10 for P in PATCHES)
    if not inside: keep.append(sp)
defs = ('<defs><pattern id="loop" width="5.2" height="5.2" patternUnits="userSpaceOnUse">'
        '<circle cx="1.3" cy="1.3" r="1.05" fill="#111" opacity=".62"/><circle cx="3.9" cy="3.9" r="1.05" fill="#111" opacity=".62"/></pattern></defs>')
def rounded_quad(q, r):
    # rounded corners via quadratic curves between shortened edges
    n = len(q); out = []
    for i in range(n):
        p0, p1, p2 = q[i-1], q[i], q[(i+1) % n]
        def toward(a, b, t):
            L = ((b[0]-a[0])**2 + (b[1]-a[1])**2) ** .5; return (a[0] + (b[0]-a[0])*t/L, a[1] + (b[1]-a[1])*t/L)
        a = toward(p1, p0, r); b = toward(p1, p2, r)
        out.append(('L' if out else 'M') + f'{a[0]:.1f},{a[1]:.1f}'); out.append(f'Q{p1[0]:.1f},{p1[1]:.1f} {b[0]:.1f},{b[1]:.1f}')
    return ' '.join(out) + ' Z'
groups = []
for i, P in enumerate(PATCHES):
    q = rounded_quad(P['quad'], P['r']); (sx0, sy0), (sx1, sy1) = [(round(a,1), round(b,1)) for a, b in P['slash']]
    pid = 'loop'
    if P.get('matrix'):
        pid = f'loop{i}'
        defs = defs.replace('</defs>', f'<pattern id="{pid}" href="#loop" patternTransform="{P["matrix"]}"/></defs>')
    groups.append(f'<g class="patch"><path d="{q}" fill="url(#{pid})" stroke="#111" stroke-width="3.2" stroke-linejoin="round"/>'
                  f'<line x1="{sx0}" y1="{sy0}" x2="{sx1}" y2="{sy1}" stroke="#111" stroke-width="{P["w"]}" stroke-linecap="round"/>'
                  f'<line x1="{sx0}" y1="{sy0}" x2="{sx1}" y2="{sy1}" stroke="#fff" stroke-width="{P["w"]-5}" stroke-linecap="round"/></g>')
out = re.sub(r'<path fill="#111" fill-rule="evenodd" d="[^"]+"/>',
             lambda m: defs + '\n<path fill="#111" fill-rule="evenodd" d="' + ' '.join(keep) + '"/>\n' + '\n'.join(groups), svg, count=1)
open(dst, 'w').write(out); print('kept', len(keep), 'of', len(subs), 'subpaths; added', len(groups), 'patches')
