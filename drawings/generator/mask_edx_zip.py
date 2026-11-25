"""EDX three-quarter view (13 Sep sheet): hide the zip Gemini drew along the BACK edge of the side bottle pocket
(two zip-tape lines and the hanging pull). Nothing is redrawn; a <mask> hides only the band between the pocket's
seam line (L1) and the bag's back outline (L4), from just below the pocket's top corner loop to just above the
pocket's bottom edge, plus the tip of the pull that pokes past the outline. All other paths are untouched; the short stretch of the back outline that the pull covered is restored with a 2.4-unit stroke.
usage: mask_edx_zip.py in.svg out.svg"""
import sys, re, numpy as np
src, dst = sys.argv[1:3]
y = np.array([671, 700, 760, 780, 800, 840, 880, 920, 960, 1000, 1020])
L1 = np.interp(y, [670, 760, 780, 800, 840, 880, 920, 960, 1000, 1036], [1554.8, 1555, 1554, 1553, 1551, 1548.5, 1547.5, 1546, 1545, 1543.5])
L4 = np.interp(y, [670, 700, 760, 780, 820, 860, 900, 940, 1000, 1036], [1577, 1576.5, 1575, 1573.5, 1572.5, 1571.5, 1570, 1569.5, 1570, 1570])
left = [(x + 2.0, yy) for x, yy in zip(L1, y)]
right = [(x - 1.8, yy) for x, yy in zip(L4, y)]
# bottom: follow the pocket's bottom edge (measured: y = 1036 - 0.45*(x - 1548)), 1.8 units above it
edge = lambda x: 1036 - 0.45 * (x - 1548) - 1.8
xl = float(np.interp(1035, [1000, 1036], [1545, 1543.5])) + 2.0; xr = right[-1][0]
bottom = [(x, edge(x)) for x in np.linspace(xl, xr, 6)]
band = left + bottom + right[::-1]
tip = [(1576.6, 745), (1586, 745), (1586, 781), (1576.6, 781)]
pts = lambda P: ' '.join(f'{a:.1f},{b:.1f}' for a, b in P)
s = open(src, encoding='utf-8').read()
m = re.match(r'(\s*<svg[^>]*>)(.*)(</svg>\s*)$', s, re.S)
head, body, tail = m.groups()
mask = (f'\n<defs><mask id="edx-nozip" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="30000" height="30000">'
        f'<rect x="-10000" y="-10000" width="30000" height="30000" fill="#fff"/>'
        f'<polygon points="{pts(band)}" fill="#000"/><polygon points="{pts(tip)}" fill="#000"/></mask></defs>'
        f'\n<g mask="url(#edx-nozip)">')
# the pull used to cover part of the bag's back outline: restore that stretch with a stroke of the same weight
outline = [(1577, 666), (1576.3, 700), (1575.3, 725), (1574.7, 745), (1574.2, 765), (1573.6, 782), (1573.2, 800)]
fix = f'<path d="M{pts(outline).replace(" ", " L")}" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>\n'
open(dst, 'w', encoding='utf-8').write(head + mask + body + '</g>\n' + fix + tail)
print('ok', dst)
