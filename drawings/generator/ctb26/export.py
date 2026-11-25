"""Assemble the traced views into per-view SVGs (tight crop) and a 2x2 sheet."""
import re, draw
from draw import SVG, VIEWS, CSS
TITLE = 'Evergoods CIVIC Travel Bag 26L - ULTRA'
LABEL = {'front': 'Front', 'iso': 'Three-quarter', 'side': 'Side', 'back': 'Back'}

def build(name):
    s = SVG(); VIEWS[name](s)
    if getattr(s, 'body_open', False): s.parts.append('</g>')
    body = '\n'.join(s.parts)
    # bbox = body silhouette plus anything hanging off it (pulls, straps), but not the clipped
    # construction lines, which run past the body: take every path drawn before the clip group
    pre = body.split('<clipPath id="body">')[0]
    nums = [(float(a), float(b)) for a, b in re.findall(r'(-?\d+\.?\d*),(-?\d+\.?\d*)', pre)]
    xs = [p[0] for p in nums]; ys = [p[1] for p in nums]
    return body, (min(xs), min(ys), max(xs), max(ys))

views = {v: build(v) for v in VIEWS}
# per-view SVGs, cropped with a margin, ids made unique per file
for v, (body, (x0, y0, x1, y1)) in views.items():
    m = 40
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0-m:.0f} {y0-m:.0f} {x1-x0+2*m:.0f} {y1-y0+2*m:.0f}">
<title>{TITLE} — {LABEL[v].lower()} view</title>
<style>{CSS}</style>
{body}
</svg>'''
    open(f'ctb26-{v}.svg', 'w').write(svg)

# 2x2 sheet: every view at the same scale (all four photos were shot at near-identical scale)
CW, CH, SC = 900, 900, 0.55
parts = []
for i, v in enumerate(['front', 'iso', 'side', 'back']):
    body, (x0, y0, x1, y1) = views[v]
    body = re.sub(r'id="(\w+)"', lambda mm: f'id="{mm.group(1)}_{v}"', body)
    body = re.sub(r'url\(#(\w+)\)', lambda mm: f'url(#{mm.group(1)}_{v})', body)
    cx, cy = (i % 2)*CW + CW/2, (i // 2)*CH + 40
    tx = cx - SC*(x0+x1)/2; ty = cy - SC*y0
    parts.append(f'<g transform="translate({tx:.1f},{ty:.1f}) scale({SC})">{body}</g>')
    parts.append(f'<text class="lbl" x="{cx:.0f}" y="{(i//2)*CH + CH - 24}">{LABEL[v]}</text>')
sheet = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {2*CW} {2*CH}" width="{2*CW}" height="{2*CH}">
<title>{TITLE} — technical drawing</title>
<style>{CSS}.lbl{{font:600 15px/1 Archivo,Inter,Helvetica,Arial,sans-serif;fill:#111;letter-spacing:.14em;text-transform:uppercase;text-anchor:middle}}</style>
<rect width="100%" height="100%" fill="#fff"/>
{chr(10).join(parts)}
</svg>'''
open('ctb26.svg', 'w').write(sheet)
print('ok')
