#!/usr/bin/env python3
"""Computed summary lines: what replaces the typed verdict on each card.
Every comparison is worked out from the data, so it stays true as bags are added.
Stock is not shown; each card links out instead.   python3 tools/summary_lines.py > reports/summary-lines.md"""
import glob, os, sys
import yaml
sys.path.insert(0, os.path.dirname(__file__))
from validate import resolve

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
NEEDED = ['volume_l', 'weight_g', 'price']


def money(p):
    a = p['amount']
    return ('$' if p['currency'] == 'USD' else p['currency'] + ' ') + (f'{a:,.2f}' if a != int(a) else f'{int(a):,}')


def grams(g):
    """The maker's figure as recorded: a decimal is kept (799.5 g), a whole number gets none."""
    return (f'{round(g):,}' if g == round(g) else f'{g:,.1f}') + ' g'


def load():
    materials = yaml.safe_load(open(os.path.join(ROOT, 'data', 'materials.yaml'), encoding='utf-8'))
    rows, models = [], []
    for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'bags', '*', '*.yaml'))):
        b = yaml.safe_load(open(p, encoding='utf-8'))
        if b['model']['category'] != 'backpack':
            continue
        models.append(b)
        for v in b['variants']:
            if v.get('record') == 'comparison':
                continue
            if not any(materials[m]['in_uhmwpe_section']['decision'] == 'in' for m in v['fabric']['shell']):
                continue
            prov = resolve(v)
            rows.append(dict(model=b['model'], v=v, verdict=b.get('legacy', {}).get('verdict', ''), bag=b,
                             ok=all(prov.get(f) for f in NEEDED)))
    return rows, models, materials


def standouts(rows, materials):
    """Extremes at both ends, among builds whose figures are all checked. One held by more than two builds is not shown."""
    pool = [r for r in rows if r['ok']]
    n = len(pool)
    out = {r['v']['id']: [] for r in rows}
    metrics = [
        (lambda v: round(v['weight_g']), 'Lightest', 'Heaviest'),
        (lambda v: round(v['weight_g'] / v['volume_l'], 1), 'Fewest grams per litre', 'Most grams per litre'),
        (lambda v: v['price']['amount'], 'Lowest price', 'Highest price'),
        (lambda v: v['volume_l'], 'Smallest volume', 'Largest volume'),
    ]
    for fn, low, high in metrics:
        vals = [(fn(r['v']), r['v']['id']) for r in pool]
        for label, pick in ((low, min), (high, max)):
            best = pick(x for x, _ in vals)
            holders = [i for x, i in vals if x == best]
            if len(holders) > 2:
                continue
            for i in holders:
                among = f' of the {n} builds listed' if n == len(rows) else f' of the {n} builds with checked figures'
                out[i].append(('Joint ' + label[0].lower() + label[1:] if len(holders) == 2 else label) + among)
    # the only build in a fabric from its fabric maker
    by_maker = {}
    for r in rows:
        for m in r['v']['fabric']['shell']:
            by_maker.setdefault(materials[m]['maker'], set()).add(r['v']['id'])
    for maker, ids in by_maker.items():
        if len(ids) == 1 and len(by_maker) > 1:
            out[next(iter(ids))].append(f'Only build listed in a fabric from {maker}')
    return out, n


def line(v):
    return ' · '.join([f"{v['volume_l']:g} L", grams(v['weight_g']), f"{v['weight_g'] / v['volume_l']:.1f} g/L", money(v['price'])])


G_PER_LB = 453.59237


def lb_basis(v, o):
    """(this build's pounds, the other build's pounds) when a weight difference should be worked out from the makers'
    own pound figures: the other build's grams are our conversion of its pounds, while this build's grams are a maker's
    own figure from another page (Aer prints kilograms on its UK store and pounds on its US pages). Anish's call on
    17 Nov 2026 after the fact check: both sides of such a line come from the same pages. Otherwise None."""
    try:
        wv, wo = v['units']['weight'], o['units']['weight']
        if (wv['metric']['from'], wo['metric']['from'], wv['imperial']['from'], wo['imperial']['from']) == ('maker', 'converted', 'maker', 'maker'):
            return (wv['imperial']['lb'], wo['imperial']['lb'])
    except (KeyError, TypeError):
        pass
    return None


def lb_detail(mb):
    """What goes in the brackets of such a line: the two pound figures the difference was worked out from."""
    return f'{mb[1]:g} lb against {mb[0]:g} lb'


def build_gaps(b):
    """Weight of each listed build against every other build of the same bag on file. Checked figures only.
    Other builds that share a weight are named together in one line."""
    out = []
    vs = [v for v in b['variants'] if v.get('weight_g') and resolve(v).get('weight_g')]
    for v in vs:
        if v.get('record') == 'comparison':
            continue
        groups = {}
        for o in vs:
            if o['id'] == v['id']:
                continue
            cmp_ = o.get('record') == 'comparison'
            mb = lb_basis(v, o) if cmp_ else None
            d = round((mb[0] - mb[1]) * G_PER_LB) if mb else round(v['weight_g'] - o['weight_g'])
            if not cmp_ and d <= 0:
                continue  # two listed builds: said once, from the heavier side; equal weights are on the model card line
            fab = (o['fabric'].get('shell_as_written') or o['name']) if cmp_ else None
            groups.setdefault((d, o['weight_g'], fab, mb), []).append(o['name'])
        for (d, w, fab, mb), names in groups.items():
            who = names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' and ' + names[-1]
            detail = (lb_detail(mb) if mb else grams(w)) + (' each' if len(names) > 1 else '') + (f', {fab}' if fab else '')
            if d == 0:
                out.append((v['name'], f'Same weight as {who} ({detail})'))
            else:
                out.append((v['name'], f"{abs(d):,} g {'lighter' if d < 0 else 'heavier'} than {who} ({detail})"))
    return out


def main():
    rows, models, materials = load()
    so, n = standouts(rows, materials)
    print('# Computed summary lines\n')
    print(f'Generated from the data for the {len(rows)} builds in the UHMWPE backpacks section. These replace the typed verdict on each card. '
          'Every comparison is recomputed when the data changes, names no other bag, and uses only checked figures. '
          'Both ends are shown (lightest and heaviest, and so on). A standout shared by more than two builds is not shown. '
          'Stock is not shown: each card links to the product page.\n')
    print('| Build | Summary line | Standouts | Links to | Old verdict (retired) |')
    print('|---|---|---|---|---|')
    seen = set()
    for r in rows:
        v, m = r['v'], r['model']
        old = r['verdict'] if m['id'] not in seen else '(same card)'
        seen.add(m['id'])
        host = v['link']['url'].split('/')[2].replace('www.', '')
        print(f"| {v['name']} | {line(v)} | {'. '.join(so[v['id']]) or 'none'} | [{host}]({v['link']['url']}) | {old} |")
    print('\n## Against other builds of the same bag\n')
    print('Worked out from the two records, using each maker\'s own figures. The other builds are on file for this comparison only and are not listed in the section. '
          'Aer gives pounds, so its grams are our conversion.\n')
    print('| Build | Computed line |')
    print('|---|---|')
    for b in models:
        for name, text in build_gaps(b):
            print(f'| {name} | {text} |')
    print('\n## Model cards with more than one build\n')
    print('| Model | Card line |')
    print('|---|---|')
    by = {}
    for r in rows:
        by.setdefault(r['model']['label'], []).append(r['v'])
    for label, vs in by.items():
        if len(vs) < 2:
            continue
        w = sorted({v['weight_g'] for v in vs})
        pr = sorted({v['price']['amount'] for v in vs})
        vol = sorted({v['volume_l'] for v in vs})
        rng = lambda xs, f: f(xs[0]) if len(xs) == 1 else f'{f(xs[0])} to {f(xs[-1])}'
        print(f"| {label} | {len(vs)} builds · {rng(vol, lambda x: f'{x:g} L')} · {rng(w, grams)} · "
              f"{rng(pr, lambda a: '$' + (f'{a:,.2f}' if a != int(a) else f'{int(a):,}'))} |")


if __name__ == '__main__':
    main()
