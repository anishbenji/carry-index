#!/usr/bin/env python3
"""Turn the hand-written decisions (decisions_a..d.py) into one reviewable plan file per bag:
research/reviews-2026-11-17/plan/<bag>.json. Reads the 17 Nov 2026 backup of data/ and the merged research files;
writes nothing under data/. Re-runnable: it overwrites the plan files.

    python3 tools/reviews_2026_11_17/make_plans.py

Every source a line cites must carry confirmed evidence (supports yes or partly) on one of the merged points the line
names, every merged point must be either used or listed in 'off' with a reason, and a card line may have at most 14
words; otherwise the script stops."""
import json, os, re, sys
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BACK = os.path.join(ROOT, '_backup-2026-11-17-data')
RES = os.path.join(ROOT, 'research', 'reviews-2026-11-17')
PLAN = os.path.join(RES, 'plan')
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True
import decisions_a, decisions_b, decisions_c, decisions_d  # noqa: E402
from approvals import APPROVED, REWORDED, DROPPED  # noqa: E402
seen_calls = set()

DEC = {}
for m in (decisions_a, decisions_b, decisions_c, decisions_d):
    DEC.update(m.BAGS)
ORDER = ['ctb26', 'cpp2', 'tp4', 'cicada', 'dfly', 'ct15l', 'ct15p', 'ct21l', 'ct21p', 'edx', 'slite', 'wlh30']
assert sorted(DEC) == sorted(ORDER)
TODAY = '2026-11-17'
PASS = 'reviews-2026-11-17'
MAKER = {'maker-page', 'maker-other'}
NUM = 'zero one two three four five six seven eight nine'.split()


def die(msg):
    raise SystemExit('make_plans: ' + msg)


def load_yaml(p):
    with open(p, encoding='utf-8') as f:
        return yaml.safe_load(f)


def norm(u):
    return re.sub(r'^https?://(www\.)?', '', u).rstrip('/').lower()


trim_pub = lambda pub: re.sub(r'\s*\([^)]*\)\s*$', '', pub).strip()
SRC0 = load_yaml(os.path.join(BACK, 'sources.yaml'))
BYURL = {norm(v['url']): k for k, v in SRC0.items() if v.get('url')}


def tool(s):
    s = s or ''
    if s.startswith('Firecrawl'):
        return 'Firecrawl'
    if s.startswith('WebFetch'):
        return 'WebFetch'
    die(f'unknown tool wording {s!r}')


def support_words(nr, no):
    n = nr + no
    if n < 1 or n > 9:
        die(f'support count {n} out of range')
    w = NUM[n]
    if n == 1:
        return 'one review' if nr else 'one owner review'
    if n == 2:
        return 'two reviews' if nr == 2 else 'two owner reviews' if no == 2 else 'one review and one owner review'
    if no == 0:
        return f'{w} reviews agree'
    if nr == 0:
        return f'{w} owner reviews agree'
    return f'{w} reviewers and owners agree'


NEW_SOURCES = {}   # id -> entry, across bags
TOUCHED = {}       # on-file id -> True (last_ok to update)
OPENED_BY = {}     # on-file id -> sentence to add to opened_by (an entry re-opened at another address)


def build(bag):
    d = DEC[bag]
    ctx = json.load(open(os.path.join(RES, 'ctx', bag + '.json'), encoding='utf-8'))
    rel = ctx['file']
    b0 = load_yaml(os.path.join(BACK, rel[len('data/'):]))
    text0 = open(os.path.join(BACK, rel[len('data/'):]), encoding='utf-8').read()
    legacy = b0['model']['legacy_id']
    assert legacy == bag
    merged = {n: json.load(open(os.path.join(RES, 'merged', n + '.json'), encoding='utf-8')) for n in d['merged']}
    variants = [v['id'] for v in b0['variants']]

    # ---- sources
    S = {}          # key -> dict(id, pub, kind, vtype, about, new, m (merged record), file)
    unusable = []
    for name, mj in merged.items():
        for s in mj['sources']:
            key = s['key']
            if not s['usable']:
                unusable.append(dict(key=key, file=name, publisher=s['publisher'], url=s['url'], why=s.get('problem') or 'marked not usable'))
                if key in d['src']:
                    die(f'{bag}: decisions name unusable source {key}')
                continue
            if key in S:
                die(f'{bag}: source key {key} appears twice')
            dec = d['src'].get(key)
            if dec is None:
                die(f'{bag}: no decision entry for usable source {key} ({s["publisher"]})')
            on = BYURL.get(norm(s['url']))
            if 'use' in dec:
                # the same page, already on file under another address (a short link): keep the entry on file
                sid = dec['use']
                if sid not in SRC0:
                    die(f'{bag} {key}: {sid} is not on file')
                if trim_pub(SRC0[sid]['publisher']) != trim_pub(s['publisher']):
                    die(f'{bag} {key}: {sid} is by {SRC0[sid]["publisher"]}, not {s["publisher"]}')
                OPENED_BY[sid] = (f"opened again on 17 Nov 2026 at {s['url']} by a research subagent through {tool(s.get('researcher_opened_with'))} "
                                  f"and re-opened by a separate checking subagent through {tool(s.get('checker_opened_with'))}")
            elif 'id' in dec:
                sid = dec['id']
                if on and on != sid:
                    die(f'{bag} {key}: url is on file as {on}, decisions say {sid}')
                if sid in SRC0 and not on:
                    die(f'{bag} {key}: id {sid} exists on file with another url')
            else:
                sid = on
                if not sid:
                    die(f'{bag} {key}: not on file and no id given ({s["url"]})')
            new = sid not in SRC0
            if new:
                entry = dict(url=s['url'], kind=dec['kind'], publisher=dec['pub'])
                if s.get('title'):
                    entry['title'] = s['title']
                if s.get('published'):
                    entry['published'] = str(s['published'])
                entry['archived'] = None
                entry['last_ok'] = TODAY
                entry['opened_by'] = (f"Research subagent, page opened through {tool(s.get('researcher_opened_with'))} on 17 Nov 2026; "
                                      f"re-opened by a separate checking subagent through {tool(s.get('checker_opened_with'))}")
                if sid in NEW_SOURCES and norm(NEW_SOURCES[sid]['url']) != norm(entry['url']):
                    die(f'{sid}: two urls')
                NEW_SOURCES.setdefault(sid, entry)
                kind, pub = dec['kind'], dec['pub']
            else:
                TOUCHED[sid] = True
                kind, pub = SRC0[sid]['kind'], SRC0[sid]['publisher']
            if not dec.get('about'):
                die(f'{bag} {key}: no about')
            S[key] = dict(id=sid, pub=trim_pub(pub), kind=kind, vtype='review' if kind in ('review', 'video', 'launch-coverage') else 'owner',
                          about=dec['about'], new=new, m=s, file=name)
    for key in d['src']:
        if key not in S:
            die(f'{bag}: decisions name source {key}, which is not a usable source in the merged files')
    for key, vs in d['same'].items():
        if key not in S or any(v not in variants for v in vs):
            die(f'{bag}: bad same entry {key} {vs}')

    def kind_of(sid):
        return NEW_SOURCES[sid]['kind'] if sid in NEW_SOURCES else SRC0[sid]['kind']

    def pub_of(sid):
        return trim_pub(NEW_SOURCES[sid]['publisher'] if sid in NEW_SOURCES else SRC0[sid]['publisher'])

    def vtype_of(sid):
        return 'review' if kind_of(sid) in ('review', 'video', 'launch-coverage') else 'owner'

    # ---- points
    P = {}
    for name, mj in merged.items():
        for p in mj['points']:
            P[(name, p['index'])] = p

    def ref(pt):
        if isinstance(pt, int):
            return (d['merged'][0], pt)
        n, i = pt.split(':')
        return (n, int(i))

    used = set()

    def check_evidence(pts, keys, who):
        quotes = []
        for k in keys:
            hit = False
            for r in pts:
                if r not in P:
                    die(f'{bag} {who}: point {r} is not in the merged file (dropped or missing)')
                for e in P[r]['evidence']:
                    if e['source'] == k and e.get('supports') in ('yes', 'partly') and e.get('quote_found') in ('exact', 'near'):
                        hit = True
                        quotes.append(f'{S[k]["pub"]}: "{e["quote"]}"')
            if not hit:
                die(f'{bag} {who}: source {k} has no confirmed evidence on points {pts}')
        return quotes

    def ref_words(pts):
        by = {}
        for n, i in pts:
            by.setdefault(n, []).append(i)
        out = []
        for n, idx in by.items():
            out.append(f'research/reviews-2026-11-17/merged/{n}.json ' + ('point ' if len(idx) == 1 else 'points ') + ', '.join(map(str, idx)))
        return '; '.join(out)

    def count(sids, voice, added):
        """Independent publishers: (reviews, owners). A maker's own page cited by a reviewers' line as a spec check does
        not count; a maker's page holding owner reviews counts once as owners."""
        seen, nr, no = [], 0, 0
        for sid in sids:
            if kind_of(sid) in MAKER and voice == 'reviewers' and sid not in added:
                continue
            p = pub_of(sid)
            if p in seen:
                continue
            seen.append(p)
            if vtype_of(sid) == 'review':
                nr += 1
            else:
                no += 1
        return nr, no, seen

    nums = {}
    for k3 in ('pro', 'con', 'note'):
        found = [int(x) for x in re.findall(rf'\b{re.escape(legacy)}-{k3}-(\d+)', text0)]
        nums[k3] = max(found) if found else 0

    adds = []
    for a in d['add']:
        pts = [ref(x) for x in a['pt']]
        used.update(pts)
        text = a['text']
        if len(text.split()) > 14:
            die(f'{bag}: more than 14 words: {text}')
        quotes = check_evidence(pts, a['src'], text)
        sids = []
        for k in a['src']:
            if S[k]['id'] not in sids:
                sids.append(S[k]['id'])
        nr, no, pubs = count(sids, 'owners', set(sids))
        voice = 'reviewers' if nr >= no else 'owners'
        obs = [v for v in variants if any(v in d['same'].get(k, []) for k in a['src'])]
        basis = 'sibling' if not obs else ('review' if voice == 'reviewers' else 'owner-reports')
        if basis == 'sibling' and not a.get('label'):
            die(f'{bag}: other-build line without a label: {text}')
        if a.get('label') is None and any(k not in d['same'] for k in a['src']):
            die(f'{bag}: line cites another build but has no label: {text}')
        nums[a['kind']] += 1
        c = dict(id=f'{legacy}-{a["kind"]}-{nums[a["kind"]]}', kind=a['kind'], text=text, voice=voice, support=support_words(nr, no),
                 scope=a['scope'], basis=basis, sources=sids, observed_on=obs)
        if a.get('label'):
            c['from_build'] = dict(label=a['label'], generation=a['gen'], size=a['size'], fabric=a['fabric'], found=a['found'], decided=TODAY)
        c['status'] = a.get('status', 'draft')
        c['source_notes'] = [dict(source=S[k]['id'], about=S[k]['about']) for k in a['src']]
        if a['kind'] == 'note':
            c['about'] = a['about']
        c['evidence'] = dict(status='supported', note='Confirmed quotes. ' + '; '.join(quotes), checked=TODAY,
                             method='Research subagent found the sources; a separate checking subagent re-opened each one and confirmed the quotes.')
        c['wording_note'] = ('Added 17 Nov 2026 from the wider source search; Anish has not read this wording. ' + ref_words(pts) + '.')
        if c['status'] == 'held':
            c['wording_note'] += (' Held off the card on 17 Nov 2026: whether the point carries over to this build is not settled. '
                                  'It goes on the card if Anish confirms it on his own bag.')
        if a.get('own'):
            # Anish read the line and confirmed it on his own bag, so it is approved and observed on this build
            if c['status'] != 'approved':
                die(f'{bag}: own-bag line must be approved: {text}')
            c['observed_on'] = list(variants)
            c['wording_note'] = 'Added 17 Nov 2026 from the wider source search. ' + a['own'] + ' ' + ref_words(pts) + '.'
        call = None
        if c['id'] in REWORDED:
            new_text, said = REWORDED[c['id']]
            if c['status'] != 'draft' or len(new_text.split()) > 14:
                die(f"{bag}: cannot reword {c['id']}")
            c['wording_note'] = (f"Added 17 Nov 2026 from the wider source search as '{c['text']}'. Anish reworded and approved it the same day "
                                 f"(his comment on the reading list: '{said}'). " + ref_words(pts) + '.')
            c['text'] = new_text
            c['status'] = 'approved'
            call = 'reworded'
        elif c['id'] in APPROVED:
            if c['status'] != 'draft':
                die(f"{bag}: cannot approve {c['id']}, it is not a draft")
            c['status'] = 'approved'
            c['wording_note'] = (f"Added 17 Nov 2026 from the wider source search. Anish read and approved this wording the same day "
                                 f"(his comment on the reading list: '{APPROVED[c['id']]}'). " + ref_words(pts) + '.')
            call = 'approved'
        elif c['id'] in DROPPED:
            if c['status'] != 'draft':
                die(f"{bag}: cannot drop {c['id']}, it is not a draft")
            c['status'] = 'held'
            c['wording_note'] = (f"Added 17 Nov 2026 from the wider source search. Anish took it off the card the same day "
                                 f"(his comment on the reading list: '{DROPPED[c['id']]}'). " + ref_words(pts) + '.')
            call = 'dropped'
        seen_calls.add(c['id'])
        c['added_in'] = PASS
        adds.append(dict(claim=c, publishers=pubs, points=[f'{n}:{i}' for n, i in pts], question=a.get('question'),
                         own=bool(a.get('own')), call=call))

    claims0 = {c['id']: c for c in b0['claims']}
    widens = []
    for w in d['widen']:
        c = claims0.get(w['id'])
        if c is None or c.get('status') != 'approved':
            die(f'{bag}: {w["id"]} is not an approved line')
        pts = [ref(x) for x in w['pt']]
        used.update(pts)
        for r in pts:
            if P[r].get('matches_claim') not in (w['id'], w.get('absorb')):
                die(f'{bag}: point {r} does not match {w["id"]} (matches {P[r].get("matches_claim")})')
        check_evidence(pts, w['src'], w['id'])
        new = []
        for k in w['src']:
            sid = S[k]['id']
            if sid not in c['sources'] and sid not in new:
                new.append(sid)
        if not new:
            die(f'{bag}: {w["id"]} gains no new source')
        drop = list(w.get('drop', []))
        for s_ in drop:
            if s_ not in c['sources']:
                die(f'{bag}: {w["id"]} does not cite {s_}')
        voice = c.get('voice', 'reviewers')
        nr0, no0, pubs0 = count(c['sources'], voice, set())
        nr, no, pubs = count([s_ for s_ in c['sources'] if s_ not in drop] + new, voice, set(new))
        if not [p_ for p_ in pubs if p_ not in pubs0]:
            die(f'{bag}: {w["id"]} gains no new publisher')
        obs_add = [v for v in variants if any(v in d['same'].get(k, []) for k in w['src']) and v not in c.get('observed_on', [])]
        old_label = (c.get('from_build') or {}).get('label')
        other = [k for k in w['src'] if k not in d['same']]
        if other and not (w.get('label') or old_label):
            die(f'{bag}: {w["id"]} gains another-build source but has no label')
        added_pubs = [p for p in pubs if p not in pubs0]
        note = f"17 Nov 2026: support widened with {', '.join(added_pubs)} ({ref_words(pts)}); was '{c.get('support')}'. {w['note']}"
        if w.get('label') and w['label'] != old_label:
            note += (f" Build label changed from '{old_label}' to '{w['label']}' to fit the wider sources." if old_label
                     else f" Build label '{w['label']}' added because the new sources cover other builds.")
        if drop:
            note += (f" Taken off the line the same day: {', '.join(pub_of(s_) for s_ in drop)}, "
                     + w.get('drop_why', 'a source read through a mirror site, which the 17 Nov 2026 check does not accept.'))
        text_after = w.get('retext')
        if text_after:
            if len(text_after.split()) > 14:
                die(f'{bag}: more than 14 words: {text_after}')
            note += f" Reworded the same day from '{c['text']}' to '{text_after}'. {w['retext_why']}"
        if w.get('absorb'):
            other = claims0.get(w['absorb'])
            if other is None or other.get('status') != 'approved' or not text_after:
                die(f"{bag}: {w['id']} cannot absorb {w.get('absorb')}")
            note += f" This line now also covers '{other['text']}' ({w['absorb']}), merged into it the same day at Anish's call."
        widens.append(dict(id=w['id'], text=c['text'], text_after=text_after, absorb=w.get('absorb'), add_sources=new, drop_sources=drop, support_before=c.get('support'), support_after=support_words(nr, no),
                           publishers_before=pubs0, publishers_after=pubs, label_before=old_label, label_after=w.get('label') or old_label,
                           observed_on_add=obs_add, source_notes_add=[dict(source=S[k]['id'], about=S[k]['about']) for k in w['src'] if S[k]['id'] in new],
                           wording_note_append=note, points=[f'{n}:{i}' for n, i in pts]))

    partly = []
    for w in d.get('partly', []):
        c = claims0.get(w['id'])
        if c is None or c.get('status') != 'approved':
            die(f'{bag}: {w["id"]} is not an approved line')
        if any(x['id'] == w['id'] for x in widens):
            die(f'{bag}: {w["id"]} is both widened and partly backed')
        pts = [ref(x) for x in w['pt']]
        used.update(pts)
        for r in pts:
            if P[r].get('matches_claim') != w['id']:
                die(f'{bag}: point {r} does not match {w["id"]}')
        check_evidence(pts, w['src'], w['id'])
        sids = []
        for k in w['src']:
            if S[k]['id'] not in sids and S[k]['id'] not in c['sources']:
                sids.append(S[k]['id'])
        _nr, _no, pubs = count(sids, 'owners', set(sids))
        partly.append(dict(id=w['id'], text=c['text'], support=c.get('support'), confirm=w['confirm'], publishers=pubs, n_publishers=len(pubs),
                           sources=sids, suggested_rewording=w['suggest'], points=[f'{n}:{i}' for n, i in pts]))

    for f in d['flag']:
        if f['id'] not in claims0:
            die(f'{bag}: flag for unknown line {f["id"]}')
    offs = []
    for k, why in d['off'].items():
        r = ref(k)
        if r not in P:
            die(f'{bag}: off point {k} not in merged')
        if r in used:
            die(f'{bag}: point {k} is both used and left off')
        used.add(r)
        offs.append(dict(point=f'{r[0]}:{r[1]}', kind=P[r]['kind'], text=P[r]['text'], build=P[r]['build'], publishers=P[r]['publishers'], why=why))
    missing = sorted(set(P) - used)
    if missing:
        die(f'{bag}: points neither used nor left off: {missing}')

    reviews = [dict(source=S[k]['id'], covers=(S[k]['m'].get('covers') or '').strip().rstrip('.') + '. Discloses: ' + (S[k]['m'].get('discloses') or 'nothing stated').strip())
               for k in S]
    plan = dict(bag=bag, file=rel, label=b0['model']['label'], merged=d['merged'],
                sources={k: dict(id=v['id'], publisher=v['pub'], kind=v['kind'], new=v['new'], url=v['m']['url'], about=v['about']) for k, v in S.items()},
                unusable_sources=unusable, add=adds, widen=widens, partly_backed=partly,
                flag=[dict(id=f['id'], text=claims0[f['id']]['text'], why=f['why']) for f in d['flag']],
                left_off=offs, dropped_by_checker=[dict(file=n, index=x['index'], text=x['text'], why=x.get('why')) for n, mj in merged.items() for x in mj['dropped']],
                disagreements=d['disagree'], sourcing_before=b0['model']['sourcing'], sourcing_after=d['sourcing'], reviews=reviews)
    with open(os.path.join(PLAN, bag + '.json'), 'w', encoding='utf-8') as f:
        json.dump(plan, f, ensure_ascii=False, indent=1)
    return plan


os.makedirs(PLAN, exist_ok=True)
plans = [build(b) for b in ORDER]
for _id in list(APPROVED) + list(REWORDED) + list(DROPPED):
    if _id not in seen_calls:
        die(f'approvals.py names {_id}, which is not a new line of this pass')
with open(os.path.join(PLAN, '_sources.json'), 'w', encoding='utf-8') as f:
    json.dump(dict(new=NEW_SOURCES, last_ok_update=sorted(TOUCHED), opened_by_add=OPENED_BY), f, ensure_ascii=False, indent=1)
for p in plans:
    print(f"{p['bag']:7} add {len(p['add'])} widen {len(p['widen'])} partly {len(p['partly_backed'])} flag {len(p['flag'])} off {len(p['left_off'])} sources {len(p['sources'])}")
print(len(NEW_SOURCES), 'new sources;', len(TOUCHED), 'on file to re-date')
