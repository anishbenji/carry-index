#!/usr/bin/env python3
"""Airline fit per listed build, computed from data/airlines/airlines.json.
The rules are the ones the page's widget uses (design/build/build_v18.py and v18/fit.js):
sizes compared largest to largest; Fits = at least the margin under every limit; Close = within
the margin; No = more than the margin over. Margin = larger of 1.5 cm or 5 % of the limit
(3 cm or 3 % for total-size limits). Weight: the empty build against each piece's allowance.

    python3 tools/airline_fit.py > reports/airline-fit.md
"""
import glob, json, os, sys
import yaml
sys.path.insert(0, os.path.dirname(__file__))
from validate import resolve

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FIT = dict(tolCm=1.5, tolPct=0.05, linCm=3, linPct=0.03, wGreen=0.15, wAmber=0.25)
RANK = {'fits': 0, 'close': 1, 'no': 2}


def cls(v, lim, t):
    return 'fits' if v <= lim - t else 'close' if v <= lim + t else 'no'


def dims_fit(bag, L):
    """bag: three sides, largest first. L: {'d': [..] or None, 'l': number or None}. None when no size is published."""
    d, lin = L.get('d'), L.get('l')
    if d == 'inf' or lin == 'inf':
        return 'fits', []
    if not d and not lin:
        return None, []
    worst, parts = 'fits', []
    if d:
        for side, lim in zip(bag, sorted(d, reverse=True)):
            c = cls(side, lim, max(FIT['tolCm'], FIT['tolPct'] * lim))
            parts.append((side, lim, c))
            if RANK[c] > RANK[worst]:
                worst = c
    if lin:
        total = sum(bag)
        c = cls(total, lin, max(FIT['linCm'], FIT['linPct'] * lin))
        parts.append((total, lin, c))
        if RANK[c] > RANK[worst]:
            worst = c
    return worst, parts


def weight_band(kg, allow):
    if allow is None:
        return None
    if allow == 'inf':
        return 'no limit'
    p = kg / allow
    return 'light' if p < FIT['wGreen'] else 'medium' if p <= FIT['wAmber'] else 'heavy'


def evaluate(v, airlines):
    d = v['dims_cm']
    bag = sorted([d['h'], d['w'], d['d']], reverse=True)
    kg = v['weight_g'] / 1000
    out = dict(co={}, pi={}, cow={}, piw={}, pi_over=[], co_over=[])
    for a in airlines:
        co, _ = dims_fit(bag, a['co'])
        key = co or 'no size'
        out['co'][key] = out['co'].get(key, 0) + 1
        if co == 'no':
            out['co_over'].append(a['n'])
        if a['pi'].get('no'):
            key = 'not allowed'
        else:
            pi, _ = dims_fit(bag, a['pi'])
            key = pi or 'no size'
            if pi == 'no':
                out['pi_over'].append(a['n'])
        out['pi'][key] = out['pi'].get(key, 0) + 1
        w = weight_band(kg, a['co'].get('kg') if a['co'].get('kg') is not None else a.get('ckg'))
        if w:
            out['cow'][w] = out['cow'].get(w, 0) + 1
        if not a['pi'].get('no'):
            pw = weight_band(kg, a['pi'].get('kg') if a['pi'].get('kg') is not None else a.get('ckg'))
            if pw:
                out['piw'][pw] = out['piw'].get(pw, 0) + 1
    return out


def piece_line(counts, piece):
    sized = sum(counts.get(k, 0) for k in ('fits', 'close', 'no'))
    if not sized:
        return f'{piece}: no airline here publishes a size'
    bits = [f"fits {counts.get('fits', 0)} of {sized}"]
    if counts.get('close'):
        bits.append(f"close on {counts['close']}")
    if counts.get('no'):
        bits.append(f"too big for {counts['no']}")
    return f'{piece}: ' + ', '.join(bits)


def card_line(e):
    return piece_line(e['co'], 'Carry-on') + '. ' + piece_line(e['pi'], 'Personal item') + '.'


def load_builds():
    materials = yaml.safe_load(open(os.path.join(ROOT, 'data', 'materials.yaml'), encoding='utf-8'))
    rows = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'bags', '*', '*.yaml'))):
        b = yaml.safe_load(open(p, encoding='utf-8'))
        for v in b['variants']:
            if v.get('record') == 'comparison':
                continue
            if not any(materials[m]['in_uhmwpe_section']['decision'] == 'in' for m in v['fabric']['shell']):
                continue
            prov = resolve(v)
            if prov.get('dims_cm') and prov.get('weight_g'):  # checked figures only
                rows.append((b['model']['label'], v))
    return rows


def main():
    path = os.path.join(ROOT, 'data', 'airlines', 'airlines.json')
    if not os.path.exists(path):
        sys.exit('data/airlines/airlines.json not found; run python3 data/airlines/build_airlines.py')
    airlines = json.load(open(path, encoding='utf-8'))
    checked = [a for a in airlines if a.get('v')]
    rows = load_builds()
    print('# Airline fit per build\n')
    print(f'Computed from `data/airlines/airlines.json` ({len(airlines)} airlines, {len(checked)} checked on the airline\'s own site) '
          'with the same rules as the page\'s airline-fit widget. Card lines use the checked airlines only. '
          'Counts are of airlines that publish a size for that piece: many publish none for the personal item, and some allow none. '
          '"Close" means within the soft-bag margin, so it depends on how full the bag is. Each build is measured on its own dimensions and weight.\n')
    print('## Card lines (checked airlines)\n')
    print('| Build | Size as listed | Line |')
    print('|---|---|---|')
    res = {}
    for label, v in rows:
        e = evaluate(v, checked)
        res[v['id']] = (e, evaluate(v, airlines))
        d = v['dims_cm']
        print(f"| {v['name']} | {d['h']:g} × {d['w']:g} × {d['d']:g} cm | {card_line(e)} |")
    print('\n## All airlines, checked or not\n')
    print('The other airlines carry figures from willmybagfit.com that have not been checked on the airline\'s site.\n')
    print('| Build | Line |')
    print('|---|---|')
    for label, v in rows:
        print(f"| {v['name']} | {card_line(res[v['id']][1])} |")
    print('\n## Empty weight against the allowance (checked airlines)\n')
    print('Light is under 15 % of the allowance, medium 15 to 25 %, heavy over 25 %.\n')
    print('| Build | Weight | Carry-on allowance | Personal-item allowance |')
    print('|---|---|---|---|')
    order = ('light', 'medium', 'heavy', 'no limit')
    fmt = lambda c: ', '.join(f'{c[k]} {k}' for k in order if c.get(k)) or 'no weight limits published'
    for label, v in rows:
        e = res[v['id']][0]
        print(f"| {v['name']} | {round(v['weight_g']):,} g | {fmt(e['cow'])} | {fmt(e['piw'])} |")
    print('\n## Checked airlines each build is too big for\n')
    for label, v in rows:
        e = res[v['id']][0]
        if e['co_over'] or e['pi_over']:
            print(f"**{v['name']}**\n")
            if e['co_over']:
                print(f"- Carry-on: {', '.join(e['co_over'])}")
            if e['pi_over']:
                print(f"- Personal item: {', '.join(e['pi_over'])}")
            print()


if __name__ == '__main__':
    main()
