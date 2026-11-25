#!/usr/bin/env python3
"""Attach the 13 Nov 2026 drafts to the data as proposals. Nothing rendered changes:
claim text, fabric decisions and photo use stay as they were until Anish approves.
Run after merge_followup.py.   python3 tools/migrate/merge_proposals.py"""
import glob, json, os
import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'data')
RES = os.path.join(ROOT, 'research')


def load(p):
    return yaml.safe_load(open(p, encoding='utf-8'))


def dump(p, obj, header=''):
    with open(p, 'w', encoding='utf-8') as f:
        if header:
            f.write(''.join('# ' + l + '\n' for l in header.strip().split('\n')))
        yaml.safe_dump(obj, f, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=False)


# ---- claim proposals, with the independent review's findings
drafts = {}
for p in sorted(glob.glob(os.path.join(RES, 'rewrites-*.json'))):
    for d in json.load(open(p, encoding='utf-8')):
        drafts[d['id']] = d
review = {}
rp = os.path.join(RES, 'rewrite-review.json')
if os.path.exists(rp):
    for i in json.load(open(rp, encoding='utf-8')).get('issues', []):
        review.setdefault(i['id'], []).append(i)

KEEP = ['id', 'action', 'proposed_text', 'kind', 'voice', 'support', 'basis', 'build_label', 'scope', 'observed_on', 'sources', 'computed_as', 'reason']
SOURCE_IDS = set(load(os.path.join(DATA, 'sources.yaml')))
SITE = dict(voice='site', support='site search, 13 Nov 2026', basis='site')

# Reconciliation after the independent review (Claude, 13 Nov 2026). Where the reviewer's fix needed a
# choice between options, the choice made is recorded here so Anish can overrule it.
OVERRIDES = {
    'ct15l-con-3': dict(action='reword', kind='con', proposed_text='No independent review of this build was found in a 13 Nov 2026 search.',
                        computed_as=None, **SITE, decision='Reviewer: not computable from the data. Reworded as a dated site note, like the two below.'),
    'wlh30-con-1': dict(**SITE, decision='Reviewer: not the maker speaking. Marked as a dated site note.'),
    'slite-con-4-b': dict(**SITE, decision='Reviewer: not the maker speaking. Marked as a dated site note.'),
    'dfly-con-2': dict(proposed_text='The cord zipper pulls can come unknotted, and one owner swapped them for metal split rings.',
                       decision='Folded the split-ring workaround in here after review; the separate line said more than the owner did.'),
    'dfly-con-2-b': dict(action='drop', proposed_text=None, reason='Folded into dfly-con-2 after review: the owner never says the swap fixed the problem.'),
    'dfly-con-3': dict(support='one review', basis='review', sources=['treeline-review-ula-ultra-30l-dragonfly-pack-review'],
                       decision='Reviewer: only Treeline supports this for the current build. The frame point moved to its own line.'),
    'ct15l-con-4': dict(action='reword', kind='con', proposed_text='Ships from Vietnam.', voice='maker', support='maker', basis='maker', scope='general',
                        sources=['ctactical-shipping-policy', 'ctactical-return-policy-warranty-policy'],
                        decision='Reviewer: the drop lost a supported fact that matters for import duties. Kept as a plain line; drop it if you prefer.'),
}
EXTRA = {
    'dfly-con-3-c': dict(id='dfly-con-3-c', action='reword', proposed_text='No frame sheet or stays.', kind='con', voice='reviewers', support='one review',
                         basis='sibling', build_label='From a review of the earlier Ultra 800 build', scope='design',
                         sources=['carryology-ula-ultra-dragonfly-review'], reason='Split out after review: only Carryology, on an earlier build, says this.'),
}
drafts.update(EXTRA)
ALLOWED = dict(kind={'pro', 'con'}, support=None, computed_as=None, voice={'maker', 'reviewers', 'owners', 'site'},
               basis={'maker', 'review', 'owner-reports', 'sibling', 'site'})

stats = dict(proposals=0, revised=0, flagged=0)
for p in sorted(glob.glob(os.path.join(DATA, 'bags', '*', '*.yaml'))):
    b = load(p)
    variant_ids = {v['id'] for v in b['variants']}
    for c in b['claims']:
        out = []
        for did in (c['id'], c['id'] + '-b', c['id'] + '-c'):
            d = drafts.get(did)
            if not d:
                continue
            pr = {k: d.get(k) for k in KEEP if d.get(k) not in (None, [], '')}
            issues = [dict(i) for i in review.get(did, [])]
            for i in issues:
                before = json.dumps(pr, sort_keys=True, ensure_ascii=False)
                if i.get('suggested_text') and pr.get('proposed_text') and i['suggested_text'] != pr['proposed_text']:
                    pr.setdefault('before_review', pr['proposed_text'])
                    pr['proposed_text'] = i['suggested_text']
                    stats['revised'] += 1
                for k, val in (i.get('suggested_changes') or {}).items():
                    if k == 'sources':
                        val = [x for x in val if x in SOURCE_IDS]
                        if val:
                            pr['sources'] = val
                    elif k == 'observed_on':
                        pr['observed_on'] = val
                    elif k in ALLOWED and (ALLOWED[k] is None or val in ALLOWED[k]):
                        pr[k] = val
                i['applied'] = json.dumps(pr, sort_keys=True, ensure_ascii=False) != before
            o = OVERRIDES.get(did)
            if o:
                for i in issues:
                    i['applied'] = True
            if o:
                if o.get('proposed_text') and pr.get('proposed_text') and o['proposed_text'] != pr['proposed_text']:
                    pr.setdefault('before_review', pr['proposed_text'])
                for k, val in o.items():
                    if k == 'sources':
                        val = [x for x in val if x in SOURCE_IDS]
                    if val is None:
                        pr.pop(k, None)
                    else:
                        pr[k] = val
            pr['observed_on'] = [v for v in pr.get('observed_on') or [] if v in variant_ids]
            if not pr['observed_on']:
                del pr['observed_on']
            if pr.get('sources') is not None:
                pr['sources'] = [x for x in pr['sources'] if x in SOURCE_IDS]
            pr['status'] = 'awaiting approval'
            if issues:
                pr['review'] = [dict(severity=i['severity'], issue=i['issue'], applied=bool(i.get('applied')),
                                     **({'suggests': 'drop'} if (i.get('suggested_changes') or {}).get('action') == 'drop' else {})) for i in issues]
                stats['flagged'] += 1
            out.append(pr)
            stats['proposals'] += 1
        if out:
            c['proposals'] = out
    # ---- photos
    media = json.load(open(os.path.join(RES, 'media.json'), encoding='utf-8'))
    m = media['bags'].get(b['model'].get('legacy_id'))
    if m:
        b['model']['photos'] = [{k: ph.get(k) for k in ('file', 'role', 'view', 'credit_text', 'credit_url', 'source_page', 'edits', 'shows')}
                                | {'permission': 'none'} for ph in m['photos']]
    b['migration']['proposals'] = 'Each claim carries drafted proposals (13 Nov 2026) awaiting approval; see reports/claim-rewrites.md'
    b['migration']['photos'] = 'model.photos lists every photo the old page used, as its code and footer describe them; permission is none for all'
    dump(p, b)

# ---- fabric reasons
materials = load(os.path.join(DATA, 'materials.yaml'))
for f in json.load(open(os.path.join(RES, 'fabric-reasons.json'), encoding='utf-8')):
    if f['material'] in materials:
        materials[f['material']]['in_uhmwpe_section']['draft'] = {
            'test1_role': f['test1'], 'test2_positioning': f['test2'], 'test3_experience': f['test3'],
            'suggested_decision': f['suggested_decision'], 'why_here': f['why_here'], 'gaps': f['gaps'],
            'status': 'awaiting approval', 'drafted': '2026-11-13'}
dump(os.path.join(DATA, 'materials.yaml'), materials,
     'Fabrics. Checked on 13 Nov 2026 against Challenge\'s and ALUULA\'s own pages where a check is listed.\nin_uhmwpe_section.draft holds drafted reasons awaiting Anish\'s decision.')
print(stats)
