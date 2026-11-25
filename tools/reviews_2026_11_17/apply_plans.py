#!/usr/bin/env python3
"""Apply research/reviews-2026-11-17/plan/*.json to data/ (Rev AM, 17 Nov 2026).

    python3 tools/reviews_2026_11_17/apply_plans.py

Always starts from the backup taken before this pass (_backup-2026-11-17-data), so it can be re-run after a plan is
fixed: the 12 bag files, data/sources.yaml and data/sections/uhmwpe-backpacks.yaml are rewritten from the backup plus
the plans. Nothing else under data/ is touched. Also adds two optional fields to the schema if they are missing
(claim.added_in, section.approach_note). YAML is dumped with the settings of tools/migrate/apply_decisions.py."""
import json, os, sys
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from approvals import ADD_FEATURES  # noqa: E402
BACK = os.path.join(ROOT, '_backup-2026-11-17-data')
DATA = os.path.join(ROOT, 'data')
PLAN = os.path.join(ROOT, 'research', 'reviews-2026-11-17', 'plan')
ORDER = ['ctb26', 'cpp2', 'tp4', 'cicada', 'dfly', 'ct15l', 'ct15p', 'ct21l', 'ct21p', 'edx', 'slite', 'wlh30']
TODAY = '2026-11-17'
APPROACH = ("These pages put checked specs next to what reviewers and owners broadly agree on. "
            "As I get to review bags myself, I'll add my own reviews or link to them.")
CHANGELOG = ("For and Against lines now draw on many more reviews, videos and owner posts, each linked. "
             "A line taken from another version of a bag says which.")


def die(msg):
    raise SystemExit('apply_plans: ' + msg)


def load(p):
    with open(p, encoding='utf-8') as f:
        return yaml.safe_load(f)


def header(p):
    out = []
    for line in open(p, encoding='utf-8'):
        if line.startswith('#'):
            out.append(line)
        else:
            break
    return ''.join(out)


def dump(p, obj, head=''):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(head)
        yaml.safe_dump(obj, f, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=False)


# ---- sources
sp = json.load(open(os.path.join(PLAN, '_sources.json'), encoding='utf-8'))
src_path = os.path.join(BACK, 'sources.yaml')
sources = load(src_path)
for sid in sp['last_ok_update']:
    if sid not in sources:
        die(f'{sid} not on file')
    sources[sid]['last_ok'] = TODAY
for sid, add in sp.get('opened_by_add', {}).items():
    sources[sid]['opened_by'] = ((sources[sid]['opened_by'].rstrip('. ') + '; ') if sources[sid].get('opened_by') else '') + add
for sid, e in sp['new'].items():
    if sid in sources:
        die(f'{sid} already on file')
    sources[sid] = e
dump(os.path.join(DATA, 'sources.yaml'), sources, header(src_path))

# ---- bags
for bag in ORDER:
    plan = json.load(open(os.path.join(PLAN, bag + '.json'), encoding='utf-8'))
    rel = plan['file'][len('data/'):]
    b = load(os.path.join(BACK, rel))
    if header(os.path.join(BACK, rel)):
        die(f'{rel} has a comment header; not handled')
    claims = {c['id']: c for c in b['claims']}
    for w in plan['widen']:
        c = claims[w['id']]
        if c['text'] != w['text'] or c.get('status') != 'approved':
            die(f'{w["id"]}: text or status differs from the plan')
        for s in w['add_sources']:
            if s not in sources:
                die(f'{w["id"]}: {s} not in sources')
            if s not in c['sources']:
                c['sources'].append(s)
        for s in w.get('drop_sources', []):
            c['sources'] = [x for x in c['sources'] if x != s]
            if c.get('source_notes'):
                c['source_notes'] = [x for x in c['source_notes'] if x['source'] != s]
        c['support'] = w['support_after']
        if w.get('text_after'):
            c['text'] = w['text_after']
        if w.get('absorb'):
            o = claims[w['absorb']]
            if o.get('status') != 'approved':
                die(f"{w['absorb']}: not an approved line, cannot be merged")
            o['status'] = 'held'
            o['wording_note'] = ((o['wording_note'].rstrip() + ' ') if o.get('wording_note') else '') + (
                f"17 Nov 2026: merged into {w['id']} at Anish's call and taken off the card as a separate line.")
        if w['observed_on_add']:
            c['observed_on'] = list(c.get('observed_on') or []) + [v for v in w['observed_on_add'] if v not in (c.get('observed_on') or [])]
        if w['source_notes_add']:
            c['source_notes'] = list(c.get('source_notes') or []) + w['source_notes_add']
        if w['label_after'] != w['label_before']:
            if c.get('from_build'):
                c['from_build']['label'] = w['label_after']
            else:
                c['from_build'] = dict(label=w['label_after'], decided=TODAY)
        c['wording_note'] = ((c['wording_note'].rstrip() + ' ') if c.get('wording_note') else '') + w['wording_note_append']
    for a in plan['add']:
        c = a['claim']
        if c['id'] in claims:
            die(f'{c["id"]} already exists')
        for s in c['sources']:
            if s not in sources:
                die(f'{c["id"]}: {s} not in sources')
        b['claims'].append(c)
        claims[c['id']] = c
    for f in ADD_FEATURES.get(bag, []):
        if any(x['id'] == f['id'] for x in b.get('features') or []):
            die(f"{f['id']} already exists")
        for s in f['sources']:
            if s not in sources:
                die(f"{f['id']}: {s} not in sources")
        b['features'] = list(b.get('features') or []) + [dict(f)]
    m = b['model']
    m['sourcing'] = plan['sourcing_after']
    revs = m.setdefault('reviews', [])
    by = {r['source']: r for r in revs}
    for r in plan['reviews']:
        if r['source'] in by:
            by[r['source']]['covers'] = r['covers']
        else:
            e = dict(source=r['source'], covers=r['covers'], used_for=[])
            revs.append(e)
            by[r['source']] = e
    for r in revs:
        # keep what was listed, except a line of this file that no longer cites the source
        uf = [x for x in (r.get('used_for') or []) if x not in claims or r['source'] in claims[x]['sources']]
        for c in b['claims']:
            if r['source'] in c['sources'] and c['id'] not in uf:
                uf.append(c['id'])
        r['used_for'] = uf
    dump(os.path.join(DATA, rel), b)

# ---- section
sec_path = os.path.join(BACK, 'sections', 'uhmwpe-backpacks.yaml')
sec = load(sec_path)
out = {}
for k, v in sec.items():
    out[k] = v
    if k == 'scope_note':
        out['approach_note'] = APPROACH
if 'approach_note' not in out:
    die('section has no scope_note to put the approach note after')
out['revision'] = dict(letter='AM', date=TODAY)
out['changelog'] = [dict(rev='AM', date=TODAY, note=CHANGELOG)] + list(sec.get('changelog', []))
dump(os.path.join(DATA, 'sections', 'uhmwpe-backpacks.yaml'), out, header(sec_path))

# ---- schema (two optional fields; added once)
sch_path = os.path.join(ROOT, 'schema', 'carry-journal.schema.json')
text = open(sch_path, encoding='utf-8').read()
sch = json.loads(text)
changed = False
cp = sch['$defs']['claim']['properties']
if 'added_in' not in cp:
    cp['added_in'] = dict(type='string', description="Name of the research pass that added this line, such as reviews-2026-11-17. "
                          "A draft line is shown on the page only when the build script names its pass (build_v28.py shows reviews-2026-11-17).")
    changed = True
want = ("How many independent publishers: 'one review', 'one owner review', 'two reviews', 'two owner reviews', "
        "'one review and one owner review', 'three reviews agree', 'three owner reviews agree', 'four reviewers and owners agree' "
        "(numbers spelled out up to nine). Older lines may say 'reviewers agree' or 'owner reviews agree'.")
if cp['support'].get('description') != want:
    cp['support']['description'] = want
    changed = True
spz = sch['$defs']['sectionFile']['properties']
if 'approach_note' not in spz:
    new = {}
    for k, v in spz.items():
        new[k] = v
        if k == 'scope_note':
            new['approach_note'] = dict(type='string', description="One or two plain sentences on what the pages are: checked specs beside reviewer and owner consensus, with Anish's own reviews to follow. Shown with the scope note.")
    sch['$defs']['sectionFile']['properties'] = new
    changed = True
if changed:
    with open(sch_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sch, indent=2, ensure_ascii=False) + '\n')
print('applied', len(ORDER), 'plans;', len(sp['new']), 'sources added,', len(sp['last_ok_update']), 're-dated; schema', 'updated' if changed else 'unchanged')
