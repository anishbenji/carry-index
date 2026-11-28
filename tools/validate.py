#!/usr/bin/env python3
"""Validate the Carry Journal data files and report what is unverified.

    python3 tools/validate.py [--today YYYY-MM-DD] [--report reports/validation-report.md]

Exit code 1 if any error is found. Errors block publishing; warnings do not.
"""
import argparse, datetime, glob, json, os, re, sys
import yaml
from jsonschema import Draft202012Validator

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA = os.path.join(ROOT, 'data')
TRACKED = ['name', 'price', 'release', 'volume_l', 'weight_g', 'dims_cm', 'laptop', 'opening',
           'fabric.shell', 'fabric.lining', 'fabric.base', 'made_in', 'warranty', 'colourways']
LAUNCH_CRITICAL = ['name', 'price', 'volume_l', 'weight_g', 'dims_cm']
FRESH_DAYS = {'price': 30}
FRESH_DEFAULT = 180


def load(path):
    with open(path, encoding='utf-8') as f:
        return yaml.safe_load(f)


def get(v, field):
    cur = v
    for part in field.split('.'):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def resolve(variant):
    """Per-field provenance: the latest check that lists the field, or None."""
    out = {}
    for f in TRACKED:
        if get(variant, f) is None:
            continue
        hits = [c for c in variant.get('checks', []) if f in c['fields']]
        out[f] = max(hits, key=lambda c: c['date']) if hits else None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--today', default=datetime.date.today().isoformat())
    ap.add_argument('--report', default=os.path.join(ROOT, 'reports', 'validation-report.md'))
    args = ap.parse_args()
    today = datetime.date.fromisoformat(args.today)

    schema = json.load(open(os.path.join(ROOT, 'schema', 'carry-journal.schema.json'), encoding='utf-8'))
    errors, warnings = [], []

    def check_schema(obj, defname, label):
        v = Draft202012Validator({'$ref': f'#/$defs/{defname}', '$defs': schema['$defs']})
        for e in sorted(v.iter_errors(obj), key=lambda e: list(e.absolute_path)):
            errors.append(f'{label}: schema: {"/".join(map(str, e.absolute_path)) or "(root)"}: {e.message}')

    brands = load(os.path.join(DATA, 'brands.yaml'))
    materials = load(os.path.join(DATA, 'materials.yaml'))
    sources = load(os.path.join(DATA, 'sources.yaml'))
    check_schema(brands, 'brandsFile', 'brands.yaml')
    check_schema(materials, 'materialsFile', 'materials.yaml')
    check_schema(sources, 'sourcesFile', 'sources.yaml')
    sections = []
    for p in sorted(glob.glob(os.path.join(DATA, 'sections', '*.yaml'))):
        s = load(p)
        check_schema(s, 'sectionFile', os.path.relpath(p, ROOT))
        sections.append(s)

    bags = []
    for p in sorted(glob.glob(os.path.join(DATA, 'bags', '*', '*.yaml'))):
        b = load(p)
        check_schema(b, 'bagFile', os.path.relpath(p, ROOT))
        bags.append((os.path.relpath(p, ROOT), b))

    # ---- integrity
    model_ids, variant_ids, claim_ids = set(), set(), set()
    all_variant_ids = {v['id'] for _, b in bags for v in b['variants']}
    model_tokens = {}
    for label, b in bags:
        m = b['model']
        if m['id'] in model_ids:
            errors.append(f'{label}: duplicate model id {m["id"]}')
        model_ids.add(m['id'])
        for key in ('brand', 'collab'):
            if key in m and m[key] not in brands:
                errors.append(f'{label}: model.{key} "{m[key]}" is not in brands.yaml')
        model_tokens[m['id']] = [m['label']] + [v['name'] for v in b['variants']]
        for v in b['variants']:
            # units: both systems on file, and each "converted" figure agrees with the figure it was worked out from
            un = v.get('units')
            if not un:
                errors.append(f'{label}: {v["id"]}: no units block')
            else:
                wm, wi = un['weight']['metric'], un['weight']['imperial']
                if wm['g'] != v.get('weight_g'):
                    errors.append(f'{label}: {v["id"]}: units.weight.metric.g differs from weight_g')
                if wm['from'] == 'converted' and wi['from'] == 'converted':
                    errors.append(f'{label}: {v["id"]}: weight is marked converted in both systems')
                if abs(wi['lb'] * 453.59237 - wm['g']) > max(8, 0.02 * wm['g']):
                    errors.append(f'{label}: {v["id"]}: {wi["lb"]} lb and {wm["g"]} g disagree by more than 2%')
                if wi['from'] == 'converted' and abs(wi['lb'] - wm['g'] / 453.59237) > 0.0051:
                    errors.append(f'{label}: {v["id"]}: converted pounds are not the gram figure to 2 decimals')
                if wm['from'] == 'converted' and abs(wm['g'] - wi['lb'] * 453.59237) > 0.51:
                    errors.append(f'{label}: {v["id"]}: converted grams are not the pound figure to the whole gram')
                dm = un.get('dims')
                if not dm and v.get('record') != 'comparison':
                    errors.append(f'{label}: {v["id"]}: a listed build needs units.dims')
                if dm:
                    cm, inch = dm['metric']['cm'], dm['imperial']['in']
                    if v.get('dims_cm') and cm != [v['dims_cm'][k] for k in 'hwd']:
                        errors.append(f'{label}: {v["id"]}: units.dims.metric.cm differs from dims_cm')
                    if dm['metric']['from'] == 'converted' and dm['imperial']['from'] == 'converted':
                        errors.append(f'{label}: {v["id"]}: dimensions are marked converted in both systems')
                    for c_cm, c_in in zip(cm, inch):
                        if abs(c_cm - c_in * 2.54) > 0.7:
                            errors.append(f'{label}: {v["id"]}: {c_in} in and {c_cm} cm disagree by more than 0.7 cm')
                        if dm['metric']['from'] == 'converted' and abs(c_cm - c_in * 2.54) > 0.051:
                            errors.append(f'{label}: {v["id"]}: converted centimetres are not the inch figure to 1 decimal')
                        if dm['imperial']['from'] == 'converted' and abs(c_in - c_cm / 2.54) > 0.051:
                            errors.append(f'{label}: {v["id"]}: converted inches are not the centimetre figure to 1 decimal')
            if v['id'] in variant_ids:
                errors.append(f'{label}: duplicate variant id {v["id"]}')
            variant_ids.add(v['id'])
            if v['page'] not in sources:
                errors.append(f'{label}: {v["id"]}: page "{v["page"]}" is not in sources.yaml')
            fab = v['fabric']
            for mid in fab['shell'] + [fab[k] for k in ('lining_material', 'base_material') if k in fab]:
                if mid not in materials:
                    errors.append(f'{label}: {v["id"]}: material "{mid}" is not in materials.yaml')
            if v.get('record') != 'comparison' and 'link' not in v:
                errors.append(f'{label}: {v["id"]}: no link out')
            if v.get('price') and v['price']['seller'] not in brands:
                errors.append(f'{label}: {v["id"]}: price.seller "{v["price"]["seller"]}" is not in brands.yaml')
            for cw in v.get('colourways', []):
                if 'shell' in cw and cw['shell'] not in fab['shell']:
                    errors.append(f'{label}: {v["id"]}: colourway "{cw["name"]}" names a shell not listed on the variant')
                if 'page' in cw and cw['page'] not in sources:
                    errors.append(f'{label}: {v["id"]}: colourway page "{cw["page"]}" is not in sources.yaml')
            for c in v.get('checks', []):
                if c['source'] not in sources:
                    errors.append(f'{label}: {v["id"]}: check source "{c["source"]}" is not in sources.yaml')
                if c['basis'] == 'sibling' and 'from' not in c:
                    errors.append(f'{label}: {v["id"]}: a sibling check must say where the value is from')
                if datetime.date.fromisoformat(c['date']) > today:
                    errors.append(f'{label}: {v["id"]}: check dated in the future ({c["date"]})')
        for f in b.get('features', []):
            if f['id'] in claim_ids:
                errors.append(f'{label}: duplicate id {f["id"]}')
            claim_ids.add(f['id'])
            for s in f['sources']:
                if s not in sources:
                    errors.append(f'{label}: {f["id"]}: source "{s}" is not in sources.yaml')
            for vid in f['applies_to']:
                if vid not in {v['id'] for v in b['variants']}:
                    errors.append(f'{label}: {f["id"]}: applies_to "{vid}" is not a build of this bag')
        for r in m.get('reviews', []):
            if r['source'] not in sources:
                errors.append(f'{label}: review list source "{r["source"]}" is not in sources.yaml')
        for c in b['claims']:
            if c['id'] in claim_ids:
                errors.append(f'{label}: duplicate claim id {c["id"]}')
            claim_ids.add(c['id'])
            if not c['sources']:
                errors.append(f'{label}: {c["id"]}: a pro or con needs a source')
            if c['basis'] == 'sibling' and 'from_build' not in c:
                errors.append(f'{label}: {c["id"]}: a point from another build must say which build')
            if c['basis'] == 'maker':
                errors.append(f'{label}: {c["id"]}: maker statements belong in features')
            if re.search(r'no (independent |hands-on )?review', c['text'], re.I):
                errors.append(f'{label}: {c["id"]}: says a review was not found; the review list covers that')
            for s in c['sources']:
                if s not in sources:
                    errors.append(f'{label}: {c["id"]}: source "{s}" is not in sources.yaml')
            for vid in c.get('observed_on', []):
                if vid not in all_variant_ids:
                    errors.append(f'{label}: {c["id"]}: observed_on "{vid}" is not a variant')

    # ---- my notes
    notes_path = os.path.join(DATA, 'my-notes.yaml')
    # my-notes.yaml is private (ignored by git), so it exists only in the owner's main checkout.
    # Without it (worktrees, CI) the my_note links cannot be checked; say so instead of failing.
    notes_present = os.path.exists(notes_path)
    notes = load(notes_path) if notes_present else []
    check_schema(notes, 'notesFile', 'my-notes.yaml')
    note_ids = {n['id'] for n in notes}
    for n in notes:
        if n['variant'] not in all_variant_ids:
            errors.append(f'my-notes.yaml: {n["id"]}: variant "{n["variant"]}" is not a build')
        if n.get('about') and n['about'] not in claim_ids:
            errors.append(f'my-notes.yaml: {n["id"]}: about "{n["about"]}" is not a line on a card')
    for label, b in bags:
        for c in b['claims']:
            if c.get('my_note') and notes_present and c['my_note'] not in note_ids:
                errors.append(f'{label}: {c["id"]}: my_note "{c["my_note"]}" is not in my-notes.yaml')

    owned_path = os.path.join(DATA, 'my-bags.yaml')
    owned = load(owned_path) if os.path.exists(owned_path) else []
    check_schema(owned, 'ownedFile', 'my-bags.yaml')
    listed = {v['id'] for _, b in bags for v in b['variants'] if v.get('record') != 'comparison'}
    for o in owned:
        if o['variant'] not in listed:
            errors.append(f'my-bags.yaml: "{o["variant"]}" is not a listed build')

    # ---- provenance
    rows, unverified_total, verified_total = [], 0, 0
    for label, b in bags:
        for v in b['variants']:
            prov = resolve(v)
            ver = [f for f, c in prov.items() if c]
            unv = [f for f, c in prov.items() if not c]
            verified_total += len(ver)
            unverified_total += len(unv)
            for f in ([] if v.get('record') == 'comparison' else LAUNCH_CRITICAL):
                if get(v, f) is None:
                    errors.append(f'{label}: {v["id"]}: missing launch-critical field {f}')
                elif prov.get(f) is None:
                    errors.append(f'{label}: {v["id"]}: launch-critical field {f} has no check')
            stale = []
            for f, c in prov.items():
                if c and (today - datetime.date.fromisoformat(c['date'])).days > FRESH_DAYS.get(f, FRESH_DEFAULT):
                    stale.append(f)
            if stale:
                warnings.append(f'{label}: {v["id"]}: stale checks: {", ".join(stale)}')
            last = max((c['date'] for c in v.get('checks', [])), default='never')
            rows.append((b['model']['label'], v['name'] + (' (comparison build)' if v.get('record') == 'comparison' else ''), len(ver), unv, last))

    # ---- claims
    by_voice, by_status, n_features, n_computed = {}, {}, 0, 0
    for label, b in bags:
        others = [t for mid, toks in model_tokens.items() if mid != b['model']['id'] for t in toks]
        n_features += len(b.get('features', []))
        n_computed += len(b.get('computed', []))
        for c in b['claims']:
            by_voice[c.get('voice', 'not set')] = by_voice.get(c.get('voice', 'not set'), 0) + 1
            by_status[c.get('status', 'not set')] = by_status.get(c.get('status', 'not set'), 0) + 1
            if any(t in c['text'] for t in others):
                errors.append(f'{label}: {c["id"]}: text names another bag')
        for f in b.get('features', []):
            if any(t in f['text'] for t in others):
                errors.append(f'{label}: {f["id"]}: text names another bag')
    n_claims = sum(by_voice.values())
    ev, ev_rows = {}, []
    for label, b in bags:
        for c in b.get('legacy', {}).get('claims', []):
            st = c.get('evidence', {}).get('status', 'not searched')
            ev[st] = ev.get(st, 0) + 1
            ev_rows.append((b['model']['label'], c['id'], st, c.get('evidence', {}).get('note', ''), ' '.join(c.get('outcome', []))))

    # ---- section membership
    membership = {}
    for s in sections:
        ids = []
        for _, b in bags:
            if b['model']['category'] != s['category']:
                continue
            for v in b['variants']:
                if any(materials[m]['in_uhmwpe_section']['decision'] == 'in' for m in v['fabric']['shell'] if m in materials):
                    ids.append(v['id'])
        membership[s['id']] = ids

    # ---- report
    L = []
    L.append(f'# Validation report\n')
    L.append(f'Run for {args.today}. {len(bags)} models, {len(variant_ids)} builds (comparison builds included), {n_claims} pros and cons, '
             f'{len(materials)} materials, {len(sources)} sources, {len(brands)} brands.\n')
    L.append(f'**{len(errors)} errors, {len(warnings)} warnings.** Errors block publishing.\n')
    if not notes_present:
        L.append('Skipped: my_note links not checked (data/my-notes.yaml is private and not present here).\n')
    if errors:
        L.append('## Errors\n')
        L += [f'- {e}' for e in errors]
        L.append('')
    if warnings:
        L.append('## Warnings\n')
        L += [f'- {w}' for w in warnings]
        L.append('')
    L.append('## Field checks per variant\n')
    L.append(f'{verified_total} field values are covered by a check; {unverified_total} are not and would show as unverified.\n')
    L.append('| Model | Variant | Checked fields | Unverified fields | Last check |')
    L.append('|---|---|---|---|---|')
    for model, name, n, unv, last in rows:
        L.append(f'| {model} | {name} | {n} | {", ".join(unv) or "none"} | {last} |')
    L.append('')
    for sid, ids in membership.items():
        L.append(f'## Section: {sid}\n')
        L.append(f'{len(ids)} variants match the section rule.\n')
    L.append('## Pros and cons\n')
    L.append(f'{n_claims} pros and cons, {n_features} maker features, {n_computed} lines computed from data.\n')
    L.append('| Voice | Count |')
    L.append('|---|---|')
    for k in sorted(by_voice):
        L.append(f'| {k} | {by_voice[k]} |')
    L.append('')
    L.append('| Status | Count |')
    L.append('|---|---|')
    for k in sorted(by_status):
        L.append(f'| {k} | {by_status[k]} |')
    L.append('')
    L.append('### What happened to each line of the old page\n')
    L.append('| Search result on the old wording | Count |')
    L.append('|---|---|')
    for k in sorted(ev):
        L.append(f'| {k} | {ev[k]} |')
    L.append('')
    L.append('| Model | Old line | Search result | What the search found | Outcome |')
    L.append('|---|---|---|---|---|')
    for row in ev_rows:
        L.append('| ' + ' | '.join(str(x).replace('|', '/') for x in row) + ' |')
    L.append('')
    os.makedirs(os.path.dirname(args.report), exist_ok=True)
    with open(args.report, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')

    n_cmp = sum(1 for _, b in bags for v in b['variants'] if v.get('record') == 'comparison')
    print(f'{len(bags)} models, {len(variant_ids) - n_cmp} builds in sections, {n_cmp} comparison builds, '
          f'{n_claims} pros and cons, {n_features} features, {n_computed} computed')
    print(f'{verified_total} checked field values, {unverified_total} unverified')
    if not notes_present:
        print('skipped: my_note links not checked (data/my-notes.yaml is private and not present here)')
    print(f'{len(errors)} errors, {len(warnings)} warnings -> {os.path.relpath(args.report, ROOT)}')
    for e in errors:
        print('ERROR', e)
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
