"""Split a vectorised 2x2 sheet into four per-view SVGs (ink subpaths + patch groups + defs)."""
import re, sys
src, prefix = sys.argv[1], sys.argv[2]
# --mid=x,y sheet centre (default 1024,1024); --layout=TL,TR,BL,BR view names (default iso,side,back,front)
MX, MY = next(([float(v) for v in a[6:].split(',')] for a in sys.argv if a.startswith('--mid=')), (1024, 1024))
LAYOUT = next((a[9:].split(',') for a in sys.argv if a.startswith('--layout=')), ['iso', 'side', 'back', 'front'])
svg = open(src).read()
defs = (re.search(r'<defs>.*?</defs>', svg, re.S) or [None]) and (re.search(r'<defs>.*?</defs>', svg, re.S).group(0) if '<defs>' in svg else '')
d = re.search(r'<path fill="#111" fill-rule="evenodd" d="([^"]+)"', svg).group(1)
subs = re.findall(r'M[^M]+', d)
groups = re.findall(r'<g class="patch">.*?</g>', svg, re.S)
def bbox(s):
    pts = [(float(a), float(b)) for a, b in re.findall(r'(-?\d+\.?\d*),(-?\d+\.?\d*)', s)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return min(xs), min(ys), max(xs), max(ys)
def quad(bb):
    cx, cy = (bb[0]+bb[2])/2, (bb[1]+bb[3])/2
    return LAYOUT[(0 if cy < MY else 2) + (0 if cx < MX else 1)]
views = {v: {'subs': [], 'groups': [], 'bb': []} for v in LAYOUT}
for s in subs:
    bb = bbox(s); v = quad(bb); views[v]['subs'].append(s); views[v]['bb'].append(bb)
for g in groups:
    bb = bbox(g); v = quad(bb); views[v]['groups'].append(g); views[v]['bb'].append(bb)
for v, V in views.items():
    x0 = min(b[0] for b in V['bb']) - 30; y0 = min(b[1] for b in V['bb']) - 30
    x1 = max(b[2] for b in V['bb']) + 30; y1 = max(b[3] for b in V['bb']) + 30
    out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {y0:.0f} {x1-x0:.0f} {y1-y0:.0f}">\n<title>{v} view</title>\n{defs}\n'
           f'<path fill="#111" fill-rule="evenodd" d="{" ".join(V["subs"])}"/>\n' + '\n'.join(V['groups']) + '\n</svg>')
    open(f'{prefix}-{v}.svg', 'w').write(out); print(v, len(V['subs']), 'subpaths', len(V['groups']), 'patches')
