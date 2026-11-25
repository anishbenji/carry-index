#!/usr/bin/env python3
"""Fixes from the fact check of 17 Nov 2026 (reports/fact-check-2026-11-17.md), each one approved by Anish that day.
Run after tools/reviews_2026_11_17/apply_plans.py, which rebuilds data/ from the backup; this script then edits data/.

1. ULA Cicada (three builds): ULA gives a sleeve measurement ("Laptop Sleeve: 15.5" x 10"), not a laptop size. The
   card shows "Sleeve 15.5 x 10 in" (variant.laptop.shown). The figure on file stays 15.5.
2. ULTRA Muse Cicada EWP: fabric as ULA writes it, "ULTRA 400TX + CORDURA® TrueLock™".
The Aer "lighter than" lines are a calculation, not data: see lb_basis in tools/summary_lines.py.
"""
import json, os, sys
import yaml
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def die(m):
    raise SystemExit('factcheck apply_fixes: ' + m)


def load(p):
    with open(p, encoding='utf-8') as f:
        return yaml.safe_load(f)


def dump(p, obj):
    with open(p, 'w', encoding='utf-8') as f:
        yaml.safe_dump(obj, f, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=False)


p = os.path.join(ROOT, 'data', 'bags', 'ula-equipment', 'ula-cicada-22l.yaml')
if open(p, encoding='utf-8').read().startswith('#'):
    die('comment header in the Cicada file; not handled')
b = load(p)
n = 0
for v in b['variants']:
    if v['id'] in ('ultra-cicada', 'ultra-cicada-ewp', 'ultra-muse-cicada-ewp'):
        if v['as_written'].get('laptop') != '15.5" x 10"' or v['laptop'].get('max_in') != 15.5:
            die(f"{v['id']}: laptop on file is not the 15.5 x 10 in sleeve")
        v['laptop']['shown'] = 'Sleeve 15.5 × 10 in'
        n += 1
    if v['id'] == 'ultra-muse-cicada-ewp':
        if v['fabric']['shell_as_written'] != 'ULTRA 400TX':
            die('Muse fabric wording already changed')
        v['fabric']['shell_as_written'] = 'ULTRA 400TX + CORDURA® TrueLock™'
if n != 3:
    die(f'{n} Cicada builds found, expected 3')
dump(p, b)

sp = os.path.join(ROOT, 'schema', 'carry-journal.schema.json')
sch = json.load(open(sp, encoding='utf-8'))
lp = sch['$defs']['variant']['properties']['laptop']['properties']
if 'shown' not in lp:
    lp['shown'] = dict(type='string', description="What the card shows instead of the size, for a maker that gives a sleeve measurement and no laptop size (ULA Cicada: 'Sleeve 15.5 × 10 in'). Added after the fact check of 17 Nov 2026.")
    with open(sp, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sch, indent=2, ensure_ascii=False) + '\n')

# 3. ULA "Made in": point each build's check at its own product page, which prints "MADE IN THE U.S.A.", instead of
#    ULA's /fabric page ("designed, cut & sewn in Utah"). Approved by Anish on 17 Nov 2026 (fix 6a).
PAGE = {'ultra-cicada': 'ula-ultra-cicada', 'ultra-cicada-ewp': 'ula-ultra-cicada-ewp', 'ultra-muse-cicada-ewp': 'ula-ultra-muse-cicada',
        '30l-patchless-ultra-dragonfly': 'ula-ultra-30l-patchless-dragonfly', '30l-ultra-dragonfly': 'ula-ultra-dragonfly',
        '30l-dragonfly-pass-thru': 'ula-30l-dragonfly-pass-thru'}
srcs = load(os.path.join(ROOT, 'data', 'sources.yaml'))
m = 0
for fn in ('ula-cicada-22l.yaml', 'ula-dragonfly-30l.yaml'):
    p = os.path.join(ROOT, 'data', 'bags', 'ula-equipment', fn)
    b = load(p)
    for v in b['variants']:
        if v['id'] not in PAGE:
            continue
        if PAGE[v['id']] not in srcs:
            die(f"source {PAGE[v['id']]} not in sources.yaml")
        hit = [c for c in v['checks'] if c.get('fields') == ['made_in'] and c['source'] == 'ula-equipment-fabric']
        if len(hit) != 1:
            die(f"{v['id']}: expected one made_in check on the fabric page, found {len(hit)}")
        c = hit[0]
        c['source'] = PAGE[v['id']]
        c['date'] = '2026-11-17'
        c['method'] = 'Product page saved by Claude from the Mac on 17 Nov 2026 (research/factcheck-2026-11-17/pages)'
        c['note'] = 'The product page prints "MADE IN THE U.S.A.". ULA\'s fabric page says its packs are designed, cut and sewn in Utah.'
        m += 1
    dump(p, b)
if m != 6:
    die(f'{m} ULA made_in checks moved, expected 6')

# 4. CT15 Lite: "Ships from Vietnam." becomes "Standard delivery ships from Vietnam." Approved by Anish on 17 Nov 2026 (fix 5c).
p = os.path.join(ROOT, 'data', 'bags', 'ctactical', 'ctactical-ct15-lite.yaml')
b = load(p)
hit = [f for f in b['features'] if f['id'] == 'ct15l-feat-c4']
if len(hit) != 1 or hit[0]['text'] != 'Ships from Vietnam.':
    die('ct15l-feat-c4 is not the "Ships from Vietnam." line')
hit[0]['text'] = 'Standard delivery ships from Vietnam.'
dump(p, b)
print('fact-check fixes applied: Cicada sleeve wording on 3 builds, Muse fabric wording, 6 ULA made-in checks moved to product pages, CT15 Lite shipping line')
