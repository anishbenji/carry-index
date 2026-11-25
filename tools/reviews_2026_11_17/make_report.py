#!/usr/bin/env python3
"""Write reports/review-sources-2026-11-17.md (for Anish) and research/reviews-2026-11-17/applied.json (the same
facts for machines) from the plan files, the backup and the data as applied.
    python3 tools/reviews_2026_11_17/make_report.py"""
import json, os, re
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BACK = os.path.join(ROOT, '_backup-2026-11-17-data')
RES = os.path.join(ROOT, 'research', 'reviews-2026-11-17')
ORDER = ['ctb26', 'cpp2', 'tp4', 'cicada', 'dfly', 'ct15l', 'ct15p', 'ct21l', 'ct21p', 'edx', 'slite', 'wlh30']
PASS = 'reviews-2026-11-17'
MAKER = {'maker-page', 'maker-other'}
KIND = {'pro': 'For', 'con': 'Against', 'note': 'Good to know'}
NUMW = 'zero one two three four five six seven eight nine'.split() + [str(i) for i in range(10, 200)]
load = lambda p: yaml.safe_load(open(p, encoding='utf-8'))
trim = lambda p: re.sub(r'\s*\([^)]*\)\s*$', '', p).strip()
SRC = load(os.path.join(ROOT, 'data', 'sources.yaml'))
SRC0 = load(os.path.join(BACK, 'sources.yaml'))


def plain(pub):
    """A publisher name as the research files wrote it, in the short form the cards use."""
    m = re.match(r'YouTube\s*[-(]\s*(.+?)\)?$', pub)
    return trim(m.group(1) if m else pub)


def link(sid):
    return f"[{trim(SRC[sid]['publisher'])}]({SRC[sid]['url']})"


def links(sids):
    out, seen = [], set()
    for s in sids:
        p = trim(SRC[s]['publisher'])
        if p not in seen:
            seen.add(p)
            out.append(link(s))
    return ', '.join(out)


def shown(c):
    return c.get('status') == 'approved' or (c.get('status') == 'draft' and c.get('added_in') == PASS)


def publishers(claims, counted_extra):
    """Publishers behind the lines on a card. A maker's own page under a reviewers' line is a spec check and is not
    counted, unless this pass added it for the owner reviews on it."""
    out = []
    for c in claims:
        if not shown(c):
            continue
        for s in c['sources']:
            if SRC[s]['kind'] in MAKER and c.get('voice') == 'reviewers' and (c['id'], s) not in counted_extra and c.get('status') != 'draft':
                continue
            p = trim(SRC[s]['publisher'])
            if p not in out:
                out.append(p)
    return out


def counts(claims):
    k = {'pro': 0, 'con': 0, 'note': 0}
    for c in claims:
        if shown(c):
            k[c['kind']] += 1
    return k


applied, rows, body = {}, [], []
tot = dict(add=0, confirmed=0, approved_new=0, reworded_new=0, dropped_new=0, held=0, widen=0, reworded=0, partly=0, flag=0)
PARTLY = []
for bag in ORDER:
    plan = json.load(open(os.path.join(RES, 'plan', bag + '.json'), encoding='utf-8'))
    rel = plan['file'][len('data/'):]
    b0, b1 = load(os.path.join(BACK, rel)), load(os.path.join(ROOT, 'data', rel))
    extra = {(w['id'], s) for w in plan['widen'] for s in w['add_sources']}
    p0, p1 = publishers(b0['claims'], set()), publishers(b1['claims'], extra)
    k0, k1 = counts(b0['claims']), counts(b1['claims'])
    c1 = {c['id']: c for c in b1['claims']}
    name = b1['model']['label']
    rows.append(f"| {name} | {len(p0)} | {len(p1)} | {k0['pro']} | {k1['pro']} | {k0['con']} | {k1['con']} | {k0['note']} | {k1['note']} |")
    new_shown = [a for a in plan['add'] if a['claim']['status'] == 'draft']
    new_held = [a for a in plan['add'] if a['claim']['status'] == 'held' and a.get('call') != 'dropped']
    new_conf = [a for a in plan['add'] if a.get('own')]
    new_ok = [a for a in plan['add'] if a.get('call') in ('approved', 'reworded')]
    new_drop = [a for a in plan['add'] if a.get('call') == 'dropped']
    tot['approved_new'] += sum(1 for a in new_ok if a['call'] == 'approved'); tot['reworded_new'] += sum(1 for a in new_ok if a['call'] == 'reworded'); tot['dropped_new'] += len(new_drop)
    tot['confirmed'] += len(new_conf); tot['reworded'] += sum(1 for w in plan['widen'] if w.get('text_after'))
    tot['add'] += len(new_shown); tot['held'] += len(new_held); tot['widen'] += len(plan['widen']); tot['flag'] += len(plan['flag']); tot['partly'] += len(plan['partly_backed'])
    PARTLY += [(name, x) for x in plan['partly_backed']]
    applied[bag] = dict(
        label=name, file=plan['file'],
        claims_added=[dict(id=a['claim']['id'], kind=a['claim']['kind'], text=a['claim']['text'], support=a['claim']['support'],
                           sources=a['claim']['sources'], publishers=a['publishers'],
                           from_build_label=(a['claim'].get('from_build') or {}).get('label'), merged_points=a['points']) for a in new_shown],
        claims_approved_by_anish=[dict(id=a['claim']['id'], kind=a['claim']['kind'], text=a['claim']['text'], support=a['claim']['support'], call=a['call'],
                           sources=a['claim']['sources'], publishers=a['publishers'],
                           from_build_label=(a['claim'].get('from_build') or {}).get('label'), merged_points=a['points']) for a in new_ok],
        claims_dropped_by_anish=[dict(id=a['claim']['id'], kind=a['claim']['kind'], text=a['claim']['text']) for a in new_drop],
        claims_confirmed_by_anish=[dict(id=a['claim']['id'], kind=a['claim']['kind'], text=a['claim']['text'], support=a['claim']['support'],
                           sources=a['claim']['sources'], publishers=a['publishers'],
                           from_build_label=(a['claim'].get('from_build') or {}).get('label'), merged_points=a['points']) for a in new_conf],
        claims_held=[dict(id=a['claim']['id'], kind=a['claim']['kind'], text=a['claim']['text'], support=a['claim']['support'],
                          sources=a['claim']['sources'], from_build_label=(a['claim'].get('from_build') or {}).get('label'),
                          question_for_anish=a.get('question'), merged_points=a['points']) for a in new_held],
        approved_lines_partly_backed=plan['partly_backed'],
        claims_widened=[dict(id=w['id'], text=w.get('text_after') or w['text'], text_before=w['text'] if w.get('text_after') else None, support_before=w['support_before'], support_after=w['support_after'],
                             sources_added=w['add_sources'], sources_removed=w.get('drop_sources', []), publishers_after=w['publishers_after'],
                             from_build_label_before=w['label_before'], from_build_label_after=w['label_after'], merged_points=w['points']) for w in plan['widen']],
        flagged_approved_lines=plan['flag'], left_off=plan['left_off'], disagreements=plan['disagreements'],
        sources_not_used=plan['unusable_sources'],
        publishers_before=p0, publishers_after=p1, n_publishers_before=len(p0), n_publishers_after=len(p1),
        lines_before=k0, lines_after=k1, sourcing_before=plan['sourcing_before'], sourcing_after=plan['sourcing_after'])

    L = [f'## {name}\n']
    L.append(f"Publishers behind the card: {len(p0)} before, {len(p1)} now" + (f" ({', '.join(p1)})." if p1 else '.') + '\n')
    L.append(f"The line under the specs now reads: \"{plan['sourcing_after']}\"\n")
    if new_shown:
        L.append('**New lines (you have not read these)**\n')
        for a in new_shown:
            c = a['claim']
            fb = (c.get('from_build') or {}).get('label')
            L.append(f"- {KIND[c['kind']]}: \"{c['text']}\" ({c['support']}; {links(c['sources'])}" + (f"; shown with \"{fb}\"" if fb else '; all on this build') + f") `{c['id']}`")
        L.append('')
    if new_ok:
        L.append('**New lines you approved on 17 Nov 2026**\n')
        for a in new_ok:
            c = a['claim']
            fb = (c.get('from_build') or {}).get('label')
            L.append(f"- {KIND[c['kind']]}: \"{c['text']}\" ({c['support']}; {links(c['sources'])}" + (f"; shown with \"{fb}\"" if fb else '; all on this build') + f") `{c['id']}`" + (' (reworded by you)' if a['call'] == 'reworded' else ''))
        L.append('')
    if new_drop:
        L.append('**New lines you took off the card on 17 Nov 2026**\n')
        for a in new_drop:
            L.append(f"- {KIND[a['claim']['kind']]}: \"{a['claim']['text']}\" `{a['claim']['id']}`")
        L.append('')
    if plan['widen']:
        L.append('**Lines you kept, now with wider support** (wording unchanged unless it says otherwise)\n')
        for w in plan['widen']:
            c = c1[w['id']]
            s = f"- \"{w.get('text_after') or w['text']}\" `{w['id']}`: {w['support_before']} → {w['support_after']}. Added: {links(w['add_sources'])}."
            if w.get('text_after'):
                s += f" Reworded with your approval on 17 Nov 2026; it was \"{w['text']}\"."
            if w['label_after'] != w['label_before']:
                s += (f" Build label changed from \"{w['label_before']}\" to \"{w['label_after']}\"." if w['label_before']
                      else f" Now shown with \"{w['label_after']}\".")
            note = w['wording_note_append'].split("'. ", 1)[1] if "'. " in w['wording_note_append'] else ''
            gone = ''
            if ' Taken off the line the same day' in note:
                note, gone = note.split(' Taken off the line the same day', 1)
                gone = ' Taken off the line' + gone
            note = note.split(' Build label ')[0]
            L.append(s + (' ' + note if note else '') + gone)
        L.append('')
    if plan['partly_backed']:
        L.append('**Approved lines the new sources only partly back** (left exactly as they were)\n')
        for x in plan['partly_backed']:
            L.append(f"- \"{x['text']}\" `{x['id']}` (still {x['support']}): {x['confirm']} That part is confirmed by {NUMW[x['n_publishers']]} new "
                     f"publisher{'s' if x['n_publishers'] != 1 else ''} ({links(x['sources'])}). If you want the wider support, a wording they all back: \"{x['suggested_rewording']}\"")
        L.append('')
    L.append('**Approved lines to look at again**\n')
    if plan['flag']:
        for f in plan['flag']:
            L.append(f"- \"{f['text']}\" `{f['id']}`: {f['why']}")
    else:
        L.append('- None.')
    L.append('')
    if bag == 'edx':
        L.append('**EDX: checked against your own bag**\n')
        L.append('You own the EDX Ultra, so you can settle these directly. Every point rests on one voice, a first-impressions video of the first EDX (2023, X-Pac).\n')
        for a in new_conf:
            c = a['claim']
            L.append(f"Confirmed by you on 17 Nov 2026 and now on the card: \"{c['text']}\" `{c['id']}`, shown with \"{c['from_build']['label']}\".\n")
        if new_held:
            L.append('Still open. This point is in the data but held off the card, because it is not settled whether it carries over to the Ultra.\n')
            for n_, a in enumerate(new_held, 1):
                c = a['claim']
                L.append(f"{n_}. {a['question']} The first-EDX reviewer says: \"{c['text']}\" `{c['id']}`. {c['from_build']['found']}")
            L.append('')
        L.append('The lines from the video that you have not read:\n')
        for a in new_shown:
            c = a['claim']
            L.append(f"- {KIND[c['kind']]}: \"{c['text']}\" `{c['id']}`. Why it should carry over: {c['from_build']['found']}")
        L.append('')
    if plan['left_off']:
        L.append('**Confirmed, but left off the card**\n')
        for o in plan['left_off']:
            L.append(f"- {KIND[o['kind']]}: \"{o['text']}\" ({', '.join(plain(x) for x in o['publishers'])}). {o['why']}")
        L.append('')
    if plan['disagreements']:
        L.append('**Where sources disagreed**\n')
        for x in plan['disagreements']:
            L.append(f'- {x}')
        L.append('')
    if plan['unusable_sources']:
        L.append('**Sources set aside (not used as evidence)**\n')
        for u in plan['unusable_sources']:
            L.append(f"- {plain(u['publisher'])}: {u['why'].rstrip('.')}.")
        L.append('')
    body.append('\n'.join(L))

n_new = len(SRC) - len(SRC0)
N_LABELS = sum(1 for b in applied.values() for w in b['claims_widened'] if w['from_build_label_before'] != w['from_build_label_after'])
PARTLY_LINES = [f"- **{name}**, \"{x['text']}\" `{x['id']}`: {x['confirm']} Confirmed for that part by {NUMW[x['n_publishers']]} new publisher{'s' if x['n_publishers'] != 1 else ''} "
                f"({', '.join(x['publishers'])}). Suggested: \"{x['suggested_rewording']}\"" for name, x in PARTLY]
head = ['# Wider sources behind the cards, 17 Nov 2026 (Rev AM)\n',
        'You asked for the For and Against lines to rest on more sources, so each card reads as what reviewers and owners broadly agree on. '
        'Search helpers found reviews, videos and owner posts for all 12 bags. Separate checkers then opened every source again and confirmed each quote. '
        'Only confirmed points were used.\n',
        f'What changed: **{tot["add"]} new lines** on the cards that you have not read, {tot["approved_new"] + tot["reworded_new"]} more new lines that you read and approved on 17 Nov 2026, {NUMW[tot["confirmed"]]} that you confirmed on your own EDX, '
        f'**{tot["widen"]} lines you kept that now show wider support** ({NUMW[tot["reworded"]]} of them reworded with your approval, the rest untouched), '
        f'and {n_new} more sources on file ({len(SRC)} in all). {NUMW[tot["held"]].capitalize()} more new line, on the EDX, is held off the card. '
        'The new page is `design/carry-journal-v28.html`. Nothing is published.\n',
        'A second, independent check then compared every new or widened line with its confirmed quotes. The rule it applied: a line\'s count may only include sources whose quotes back the whole line as worded. '
        f'That took the wider support back off nine kept lines. You have since settled eight of them with a new wording; {NUMW[tot["partly"]]} is still exactly as you approved it and is listed below.\n',
        '## How to read this\n',
        '- New lines are in the data as drafts. The page shows them like any other line, with no marker. Tell me which to keep, reword or drop.',
        '- "Publishers" counts independent voices: several owner reviews on one shop count once, and Pack Hacker\'s site and video count once.',
        '- A line that draws on another version of a bag says so on the card ("From ...", "Also from ...", "Mostly from ...").',
        '- Where sources disagreed with each other, the topic was left off the card and is listed under the bag.\n',
        '## Things for you to decide\n',
        f'1. Read the {tot["add"]} new lines. The full list is also in `reports/claims-to-review.md`.',
        f'2. {NUMW[tot["partly"]].capitalize()} kept line could show wider support if you accept a plainer wording (you settled the other eight on 17 Nov 2026; they are now under each bag as reworded lines). It is in the next section, and the closer look you asked for is in `research/reviews-2026-11-17/followup-dfly-organisation.md`. After reading it you chose to leave the line as it is (17 Nov 2026).',
        f'3. {NUMW[tot["flag"]].capitalize()} lines you approved are listed under "Approved lines to look at again", each with the reason. None was changed. On 17 Nov 2026 you said all of them stay approved as they are.',
        f'4. When a kept line gained sources from another build, I added or adjusted the small build label under it so the card stays truthful ({NUMW[N_LABELS]} lines; each is noted below). Say if you would rather keep those sources off the line.',
        '5. EDX: you confirmed the line about standing, and it is on the card. The line about the inside zip pocket stays off the card; you set that question aside on 17 Nov 2026.',
        '6. CIVIC Travel Bag: two ULTRA owners say they trust it in rain. It was left off only because the For list is full at five; you may want to swap it in.',
        '7. Dragonfly: `dfly-con-2` (zipper pull cords) still cites an r/onebag thread read through a mirror site, which this pass does not accept. It was not touched. The same source was taken off `dfly-con-1`, which now rests on three accepted publishers.\n',
        '## Approved lines the new sources only partly back\n',
        'These lines are exactly as you approved them: same wording, same sources, same count. The new sources confirm part of each line, so they were not added. Each entry says what they do confirm and offers a wording all of them would back.\n'] + PARTLY_LINES + ['',
        '## Before and after\n',
        '| Bag | Publishers before | Publishers now | For before | For now | Against before | Against now | Good to know before | Good to know now |',
        '|---|---|---|---|---|---|---|---|---|'] + rows + ['']
tail = ['## Other things I noticed\n',
        '- The Brooks Review\'s Cicada review is on file once, under its short link; the entry now records that it was opened again on 17 Nov 2026 at its full address.',
        '- The City Pack Pro 2 file lists a Nomads Nation review of the CIVIC Travel Bag among its reviews. It is not used by any line. Left as it was.',
        '- Cicada: the checker could not find the words behind the "Maker says" line "Stands up on its own." on the two EWP pages it opened. Worth a look when you next check ULA\'s pages.',
        '- CT15 Plus and CT15 Lite: the owner review on Ctactical\'s page is dated 9 April 2026; the old note called it undated.',
        '- In the reference list at the foot of the page, a YouTube reviewer links to the video a card cites, because no channel address is on file.',
        '- On a few lines (two on the Superlite, one each on the City Pack Pro 2 and the Dragonfly) the maker\'s own page is linked as a spec check. It shows as a link but is not counted in "seven reviews agree" and the like.',
        '- CT15 Plus: "No side compression straps" was drafted as an Against line and then taken off, because the reviewer himself says a bag this size does not need them.',
        '- The Aer cards say nothing about why the bags feel tight for their size. No confirmed source gives a cause.\n',
        '## Where everything is\n',
        '- Page: `design/carry-journal-v28.html`, built by `design/build/build_v28.py`.',
        '- Data before this pass: `_backup-2026-11-17-data/`. To redo: change the choices in `tools/reviews_2026_11_17/decisions_*.py` and run `sh tools/reviews_2026_11_17/run_all.sh` (it rewrites the plan files in `research/reviews-2026-11-17/plan/`, the data, the page and the reports from the backup).',
        '- The same facts for machines: `research/reviews-2026-11-17/applied.json`.', '']
with open(os.path.join(ROOT, 'reports', 'review-sources-2026-11-17.md'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(head) + '\n' + '\n'.join(body) + '\n' + '\n'.join(tail))
with open(os.path.join(RES, 'applied.json'), 'w', encoding='utf-8') as f:
    json.dump(dict(date='2026-11-17', revision='AM', page='design/carry-journal-v28.html', sources_on_file_before=len(SRC0), sources_on_file_after=len(SRC),
                   totals=tot, bags=applied), f, ensure_ascii=False, indent=1)
print('\n'.join(rows))
print(tot, n_new, 'new sources;', N_LABELS, 'labels added or changed')
