#!/usr/bin/env python3
"""Merge the willmybagfit seed with airline-site checks into airlines.json.

  willmybagfit-seed.psv   seed for every airline (unverified)
  verified/*.json         checks against the airline's own page (verifier agents, or the
                          monthly checker in tools/airline-checker) - these win over the seed
  airlines.json           output used by the page build and by the checker

Every dimension list is stored largest first. Run from anywhere:
  python3 data/airlines/build_airlines.py
"""
import json, glob, os, re
HERE = os.path.dirname(os.path.abspath(__file__))

def num(s):
    s = s.strip()
    return float(s) if s and re.fullmatch(r'[\d.]+', s) else None

def piece(field):
    L, W, D, w, flag = (field.split(',') + [''] * 5)[:5]
    dims = [num(L), num(W), num(D)]
    dims = sorted(dims, reverse=True) if all(dims) else None
    combined = w.startswith('C')
    kg = num(w[1:] if combined else w)
    return {'d': dims, 'l': None, 'kg': None if combined else kg,
            'us': flag == 'UNDERSEAT', 'no': flag == 'NONE'}, (kg if combined else None)

def load_seed():
    out = {}
    for line in open(os.path.join(HERE, 'willmybagfit-seed.psv'), encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        name, region, co, pi, upd, url = line.rstrip('\n').split('|')
        co_p, ck1 = piece(co)
        pi_p, ck2 = piece(pi)
        co_p.pop('us'); co_p.pop('no')
        name = RENAME.get(name, name)
        out[name] = {'n': name, 'r': region, 'co': co_p, 'pi': pi_p, 'ckg': ck1 or ck2,
                     'src': url, 'v': None, 'seed': upd, 'note': ''}
    return out

def as_piece(p, personal):
    if p is None:
        return None
    d = p.get('dims_cm')
    r = {'d': sorted(d, reverse=True) if d else None, 'l': p.get('linear_cm'), 'kg': p.get('weight_kg')}
    if personal:
        r['us'] = bool(p.get('underSeatOnly'))
        r['no'] = p.get('allowed') is False
    return r

def merge(seed):
    for f in sorted(glob.glob(os.path.join(HERE, 'verified', '*.json'))):
        for v in json.load(open(f, encoding='utf-8')):
            if v.get('status') not in ('verified', 'partial'):
                continue
            name = v['name']
            base = seed.get(name, {'n': name, 'r': v.get('region', '?'), 'seed': None})
            co, pi = as_piece(v.get('carryOn'), False), as_piece(v.get('personal'), True)
            if v['status'] == 'partial':      # keep seed values where the check found nothing
                for k, new in (('co', co), ('pi', pi)):
                    old = base.get(k) or {}
                    for kk, vv in (new or {}).items():
                        if vv in (None, False) and old.get(kk) not in (None,):
                            new[kk] = old[kk]
            base.update({'co': co, 'pi': pi, 'ckg': v.get('combined_kg'), 'src': v.get('source') or base.get('src'),
                         'v': v.get('checked') if v['status'] == 'verified' else None,
                         'note': v.get('fareNote', ''), 'quote': v.get('quote', ''),
                         'r': v.get('region') or base.get('r')})
            # units readings from every file (a check's reading is kept even when zz-manual wins the figures)
            for k, u in (('co', (v.get('carryOn') or {}).get('units')), ('pi', (v.get('personal') or {}).get('units')),
                         ('ckg', v.get('combinedUnits'))):
                if u:
                    base.setdefault('units', {}).setdefault(k, []).append(u)
            seed[name] = base
    return seed

# Airlines whose network is mostly split across two regions. Edit freely; any airline can carry several.
EXTRA_REGIONS = {
    'Turkish Airlines': ['Europe'], 'SunExpress Airlines': ['Middle East'], 'Aeroflot': ['Asia'],
    'S7': ['Europe'], 'uTair Airlines': ['Europe'], 'Azerbaijan Airlines': ['Europe'],
    'EgyptAir': ['Middle East'], 'Hawaiian Airlines': ['Oceania'], 'Copa Airlines': ['South America'],
}
# Airlines that changed their public name: seed name -> current name (sources in the comment)
RENAME = {
    'Liat 20': 'Liat Air',   # LIAT (2020) Limited trades as Liat Air since Jul 2025 (Jamaica Observer, 23 Jul 2025)
}
# Airlines left out of airlines.json because travellers can't book their own scheduled flights (seed stays as captured).
DEFUNCT = {
    'PLAY Airlines': 'Ceased all flights 29 Sep 2025 (Reuters, 29 Sep 2025); flyplay.com no longer resolves',
    'Island Air': 'Ceased operations 10 Nov 2017 (Hawaii Magazine, 10 Nov 2017); islandair.com no longer resolves',
    # Removed 13 Nov 2026 (Anish's call): no scheduled flights of their own to book
    'Eastern Airlines': 'No scheduled flights since Feb 2024; charter, ACMI and cargo only (Wikipedia: Eastern Airlines, LLC)',
    'Bamboo Airways': 'Stopped selling scheduled tickets from 1 Aug 2026; charters only, not formally shut down (AeroCorner, 2 Aug 2026). Re-add if it returns',
    'Mesa Airlines': 'Merged into Republic Airways 24 Nov 2025 (BusinessWire); flies only as United Express, booked through United, whose limits apply',
}
# Airlines whose own page says there is no weight limit (stored as "inf"; null = not published).
NO_WEIGHT_LIMIT = {'Air Canada': ('co', 'pi')}

def units_ok(fig, imp, tol_in, per):
    """units were read against these metric figures: imperial within the checker's tolerance (lib/units.mjs)."""
    ok = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    if isinstance(fig, list):
        return isinstance(imp, list) and len(imp) == len(fig) and all(abs(i - f / per) <= tol_in for i, f in zip(imp, fig))
    return imp is None if not ok(fig) else ok(imp) and abs(imp - fig / per) <= tol_in

def pick_units(a, key, p):
    """The latest units reading that fits the figures on file; None if there is none (the page converts)."""
    found = (a.get('units') or {}).get(key, [])
    # newest first; on the same day a full page beats a stored quote, then the later file
    for u in sorted(reversed(found), key=lambda u: (u.get('read') or '', u.get('from') == 'page'), reverse=True):
        if units_ok(p.get('kg'), u.get('lb'), 1.5, 0.45359237) and (key == 'ckg' or (
                units_ok(p.get('d'), u.get('d_in'), 1.0, 2.54) and units_ok(p.get('l'), u.get('l_in'), 1.0, 2.54))):
            return u
    if found:
        print(f"{a['n']}: {key} units left out, they do not fit the figures on file")
    return None

def finalize(a, notes):
    """Explicit schema: every field present; null = not published, "inf" = airline says no limit."""
    r = a.get('r')
    regions = r if isinstance(r, list) else [r]
    regions += [x for x in EXTRA_REGIONS.get(a['n'], []) if x not in regions]
    co = {'d': None, 'l': None, 'kg': None, **(a.get('co') or {})}
    pi = {'d': None, 'l': None, 'kg': None, 'us': False, 'no': False, **(a.get('pi') or {})}
    for k in NO_WEIGHT_LIMIT.get(a['n'], ()):
        (co if k == 'co' else pi)['kg'] = 'inf'
    if pi['no']:
        pi.update({'d': None, 'l': None, 'kg': None})
    for k, p in (('co', co), ('pi', pi)):     # units only where a check stored them; none means the page converts
        u = None if k == 'pi' and pi['no'] else pick_units(a, k, p)
        if u:
            p['units'] = u
    nt = notes.get(a['n'], {})
    out = {'n': a['n'], 'r': regions, 'co': co, 'pi': pi, 'ckg': a.get('ckg')}
    cku = pick_units(a, 'ckg', {'kg': a.get('ckg')})
    if cku:
        out['cku'] = cku
    out.update({'notes': {'co': nt.get('co', []), 'pi': nt.get('pi', []), 'gen': nt.get('gen', [])},
                'src': a.get('src'), 'v': a.get('v'), 'seed': a.get('seed'), 'quote': a.get('quote', '')})
    return out

if __name__ == '__main__':
    notes = json.load(open(os.path.join(HERE, 'notes.json'), encoding='utf-8'))
    data = sorted((finalize(a, notes) for a in merge(load_seed()).values() if a['n'] not in DEFUNCT), key=lambda a: a['n'].lower())
    json.dump(data, open(os.path.join(HERE, 'airlines.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"{len(data)} airlines, {sum(1 for a in data if a['v'])} checked on the airline's own site")
