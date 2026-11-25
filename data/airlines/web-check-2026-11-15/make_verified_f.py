#!/usr/bin/env python3
"""Turn the 15 Nov 2026 web checks (airlines-b1/b2/b3.json) into data/airlines/verified/verified-F.json.

Rules (decided by Claude, listed in the report for Anish):
- confirmed: figures stay as on file (so a silent page never changes the personal-item flags); extras the page
  printed and the file lacked are added (listed in EXTRA); units read from what the page printed.
- changed: the page's figures replace the file's, except overrides in OVERRIDE (silence is not a rule).
- partial: some figures confirmed, others not found -> status "partial" (seed kept where null; stays unchecked).
- unverified / held: left out; the file is unchanged.
"""
import json, sys

AIR = {a['n']: a for a in json.load(open(sys.argv[1]))}
OUT = sys.argv[2]
DATE = '2026-11-15'
IN, LB = 2.54, 0.45359237

# airlines whose "changed" or "confirmed" reading is held back, with the reason (kept out of the file)
HOLD = {
    'uTair Airlines': 'Page read gives the lowest Economy fares (Minimum/Optimum: one 5 kg, 40x30x20 bag); standard-fare limits not read',
}
# confirmed or changed, but a figure on file was not found on the page: keep the seed for it, stay unchecked
PARTIAL = {'Aeromexico', 'RwandAir'}  # S7 and Air Caraibes were fully read in Chrome later the same day
# per-airline fixes to the subagent's reading
OVERRIDE = {
    # page silent on a personal item: keep the file's flags (silence is not a rule)
    'Tunisair': {'keep_pi': True},
    'Spring Airlines': {'keep_pi': True},
    'Juneyao Airlines': {'keep_pi': True},
    # the 40x30x15 / 3 kg on file is a duty-free bag allowance, not a personal item; no personal-item rule printed
    'Turkmenistan Airlines': {'pi': {'dims_cm': None, 'linear_cm': None, 'weight_kg': None, 'underSeatOnly': False, 'allowed': True}},
    # Air Caraibes: carry-on size not in page text; accessory and 12 kg shared confirmed
    'Air Caraibes': {'keep_co': True, 'keep_pi': True},
}


def r1(x):
    return None if x is None else round(x + 1e-9, 1)


def srt(d):
    return sorted(d, reverse=True) if d else None


def piece_units(p):
    """units object for a piece from what the page printed (cm/kg and/or in/lb)."""
    printed, conv = {}, []
    out = {}
    pairs = (('d', 'dims_cm', 'dims_in', 'd_in'), ('l', 'linear_cm', 'linear_in', 'l_in'), ('kg', 'weight_kg', 'weight_lb', 'lb'))
    for q, mk, ik, ok in pairs:
        m, i = p.get(mk), p.get(ik)
        sys_ = [s for s, v in (('metric', m), ('imperial', i)) if v not in (None, [])]
        printed[q] = sys_ or None
        if i not in (None, []):
            out[ok] = srt(i) if q == 'd' else i
        elif m not in (None, []):
            if q == 'd':
                out[ok] = [r1(x / IN) for x in srt(m)]
            elif q == 'l':
                out[ok] = r1(m / IN)
            else:
                out[ok] = r1(m / LB)
            conv.append(ok)
        else:
            out[ok] = None
        if m in (None, []) and i not in (None, []):
            conv.append(q)
    return dict(printed=printed, d_in=out['d_in'], l_in=out['l_in'], lb=out['lb'], converted=conv, read=DATE, from_='page')


def metric(p):
    """metric figures: printed metric, else converted from printed imperial."""
    d = srt(p.get('dims_cm')) or ([r1(x * IN) for x in srt(p['dims_in'])] if p.get('dims_in') else None)
    l = p.get('linear_cm') if p.get('linear_cm') is not None else (r1(p['linear_in'] * IN) if p.get('linear_in') else None)
    kg = p.get('weight_kg') if p.get('weight_kg') is not None else (r1(p['weight_lb'] * LB) if p.get('weight_lb') else None)
    return d, l, kg


def fix_units(u):
    u = dict(u)
    u['from'] = u.pop('from_')
    return u


recs, report = [], []
for f in sys.argv[3:]:
    for c in json.load(open(f)):
        n, res = c['name'], c['result']
        a = AIR.get(n)
        if a is None:
            report.append(f'{n}: not in airlines.json, skipped'); continue
        if n in HOLD:
            report.append(f'{n}: held ({HOLD[n]})'); continue
        if res == 'unverified':
            report.append(f'{n}: unverified, file unchanged'); continue
        ov = OVERRIDE.get(n, {})
        co_p, pi_p = c['carryOn'] or {}, c['personal'] or {}
        if 'pi' in ov:
            pi_p = {**pi_p, **ov['pi']}
        if res == 'confirmed' or ov.get('keep_co'):
            co = {'dims_cm': a['co']['d'], 'linear_cm': a['co']['l'], 'weight_kg': a['co']['kg']}
            if res == 'confirmed':   # add what the page printed and the file lacked
                d, l, kg = metric(co_p)
                co['linear_cm'] = co['linear_cm'] if co['linear_cm'] is not None else l
                co['weight_kg'] = co['weight_kg'] if co['weight_kg'] is not None else kg
        else:
            d, l, kg = metric(co_p)
            co = {'dims_cm': d, 'linear_cm': l, 'weight_kg': kg}
        if res == 'confirmed' or ov.get('keep_pi'):
            fp = a['pi']
            pi = {'dims_cm': fp['d'], 'linear_cm': fp['l'], 'weight_kg': fp['kg'],
                  'underSeatOnly': fp.get('us', False), 'allowed': not fp.get('no', False)}
            if res == 'confirmed':
                d, l, kg = metric(pi_p)
                pi['weight_kg'] = pi['weight_kg'] if pi['weight_kg'] is not None else kg
                pi['linear_cm'] = pi['linear_cm'] if pi['linear_cm'] is not None else l
        else:
            d, l, kg = metric(pi_p)
            pi = {'dims_cm': d, 'linear_cm': l, 'weight_kg': kg,
                  'underSeatOnly': bool(pi_p.get('underSeatOnly')), 'allowed': pi_p.get('allowed', True) is not False}
        ckg = c.get('combined_kg')
        if ckg is None and c.get('combined_lb'):
            ckg = r1(c['combined_lb'] * LB)
        if res == 'confirmed' and ckg is None:
            ckg = a.get('ckg')
        if ov.get('keep_co') and ckg is None:
            ckg = a.get('ckg')
        co['units'] = fix_units(piece_units(co_p))
        pi['units'] = fix_units(piece_units(pi_p))
        status = 'partial' if n in PARTIAL else 'verified'
        rec = {'name': n, 'region': a['r'], 'carryOn': co, 'personal': pi, 'combined_kg': ckg,
               'fareNote': c.get('notes', ''), 'source': c['source'], 'quote': c.get('quote', ''),
               'checked': DATE, 'status': status,
               'by': f"Claude web check 15 Nov 2026 ({c.get('opened_by')}); airline's own page"}
        if ckg is not None:
            sys_ = [s for s, v in (('metric', c.get('combined_kg')), ('imperial', c.get('combined_lb'))) if v is not None]
            rec['combinedUnits'] = {'printed': {'kg': sys_ or None},
                                    'lb': c.get('combined_lb') if c.get('combined_lb') is not None else r1(ckg / LB),
                                    'converted': [] if c.get('combined_lb') is not None else ['lb'],
                                    'read': DATE, 'from': 'page'}
        recs.append(rec)
        # what changed against the file
        old = (a['co']['d'], a['co']['l'], a['co']['kg'], a['pi']['d'], a['pi']['l'], a['pi']['kg'], a['pi'].get('us'), a['pi'].get('no'), a.get('ckg'))
        new = (co['dims_cm'], co['linear_cm'], co['weight_kg'], pi['dims_cm'], pi['linear_cm'], pi['weight_kg'], pi['underSeatOnly'], not pi['allowed'], ckg)
        diff = [f'{k}: {o} -> {w}' for k, o, w in zip(('co.d', 'co.l', 'co.kg', 'pi.d', 'pi.l', 'pi.kg', 'pi.us', 'pi.no', 'ckg'), old, new)
                if (o != w) and not (isinstance(o, list) and isinstance(w, list) and [float(x) for x in o] == [float(x) for x in w])]
        report.append(f"{n}: {status} ({res})" + ('; ' + '; '.join(diff) if diff else '; figures unchanged'))

json.dump(recs, open(OUT, 'w'), ensure_ascii=False, indent=1)
print('\n'.join(report))
print(f'\n{len(recs)} records written to {OUT}')
