#!/usr/bin/env python3
"""Write what each card now holds, and the list of points from other builds that wait on a call.
    python3 tools/applied_doc.py      -> reports/cards.md, reports/other-build-review.md"""
import glob, os
import yaml
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
bags = [yaml.safe_load(open(p, encoding='utf-8')) for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'bags', '*', '*.yaml')))]
src = yaml.safe_load(open(os.path.join(ROOT, 'data', 'sources.yaml'), encoding='utf-8'))
_np = os.path.join(ROOT, 'data', 'my-notes.yaml')
NOTES = {n['id']: n for n in (yaml.safe_load(open(_np, encoding='utf-8')) if os.path.exists(_np) else [])}


def links(ids, limit=4):
    seen, parts = set(), []
    for s in ids:
        pub = src[s]['publisher']
        if pub not in seen:
            seen.add(pub)
            parts.append(f"[{pub}]({src[s]['url']})")
    return ', '.join(parts[:limit]) + (' and more' if len(parts) > limit else '')


def cards():
    L = ['# What each card holds now\n',
         'Generated from the data on 13 Nov 2026, after the rulings, the line-by-line calls and the wording read-through of that day were applied. '
         'Lines marked ✓ were shown to Anish one by one and kept as worded. '
         'Lines marked "other build" are shown with the build they come from. Nothing here is on the published page yet.\n']
    tot = dict(p=0, c=0, n=0, f=0, k=0)
    for b in bags:
        m = b['model']
        L.append(f"## {m['label']}\n")
        L.append(f"*{m['sourcing']}*\n")
        listed = [v for v in b['variants'] if v.get('record') != 'comparison']
        L.append('Links to: ' + ', '.join(f"[{v['name']}]({v['link']['url']})" for v in listed) + '\n')
        for kind, title in (('pro', 'Pros'), ('con', 'Cons'), ('note', 'Good to know')):
            rows = [c for c in b['claims'] if c['kind'] == kind]
            tot[kind[0]] += len(rows)
            if not rows:
                continue
            L.append(f'**{title}**\n')
            for c in rows:
                tag = c['support']
                if c.get('from_build'):
                    tag += '; other build: ' + c['from_build']['label'][0].lower() + c['from_build']['label'][1:]
                if kind == 'note':
                    tag = f"beside the {c.get('about', 'spec')} spec; " + tag
                mark = {'approved': ' ✓', 'held': ' (held: not on the card until checked)'}.get(c['status'], '')
                L.append(f"- {c['text']} ({tag}; {links(c['sources'])}) `{c['id']}`" + mark)
                if c.get('my_note'):
                    n = NOTES[c['my_note']]
                    L.append(f"  - My note (draft wording): {n['draft_text']} His words: \"{n['said']}\"")
            L.append('')
        if b['features']:
            tot['f'] += len(b['features'])
            L.append('**Maker says**\n')
            for f in b['features']:
                L.append(f"- {f['text']} ({links(f['sources'])}) `{f['id']}`" + (' ✓' if f.get('status') == 'approved' else ''))
            L.append('')
        if b['computed']:
            tot['k'] += len(b['computed'])
            L.append('**Computed instead of typed**\n')
            for k in b['computed']:
                L.append(f"- Was: \"{k['was']}\". {k['state']}")
            L.append('')
        gone = [o for c in b['legacy']['claims'] for o in c['outcome'] if 'dropped' in o or 'not carried over' in o]
        if gone:
            L.append(f'<details><summary>Old lines not carried over ({len(gone)})</summary>\n')
            for c in b['legacy']['claims']:
                for o in c['outcome']:
                    if 'dropped' in o or 'not carried over' in o:
                        L.append(f"- \"{c['text']}\": {o.split(': ', 1)[1]}")
            L.append('\n</details>\n')
    L.insert(2, f"{tot['p']} pros, {tot['c']} cons, {tot['n']} \"Good to know\" notes, {tot['f']} maker features and {tot['k']} computed lines across {len(bags)} bags.\n")
    open(os.path.join(ROOT, 'reports', 'cards.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')


FURTHER = [  # read on 13 Nov 2026; further from the listed builds, so not added to the data
    ('CT21 Lite, CT21 Plus', 'nomads-nation-ctactical-ct21-v3-review', 'CT21 V3, 21 L, 500D Cordura. Earlier generation, different fabric, smaller.',
     'Thick, padded shoulder straps that spread weight well; flat back panel with no airflow channels; no built-in bottle pocket; heavy for 21 L. '
     'The current bags list bottle pockets, so that con does not carry.'),
    ('CT21 Lite, CT21 Plus', 'the-brooks-review-p-34836', 'CT21 V3.0 Slick, 21 L, X-Pac X50. Earlier generation, different fabric, smaller.',
     'Stitching and zippers praised; front and internal pockets liked; carries weight worse than a GORUCK by the author\'s account; '
     'the laptop compartment\'s two metal zipper pulls can be felt against the back; seatbelt-style webbing expected to fuzz.'),
    ('CT21 Lite', 'ctactical-ct21-plus-ultra200x', 'CT21 Plus - ULTRA200X. Same generation and fabric; adds the Plus section.',
     'One owner line: excellent quality, very well made. Already on the CT21 Plus card.'),
    ('CT21 Plus', 'ctactical-ct21-plus-ultra400x', 'CT21 Plus - ULTRA400X. Same build.',
     'One owner line praising the company as a whole. Says nothing about the bag, so not used.'),
]


def review():
    rows = [(b, c) for b in bags for c in b['claims'] if c.get('from_build')]
    pending = [c for _, c in rows if c['from_build'].get('assigned') == 'pending']
    L = ['# Points that come from another build\n',
         f'13 Nov 2026. {len(rows)} lines on the cards were reported on a different build of the same bag. Each is shown with the build it comes from. '
         + ('Anish went through them one by one that day; the table records his call and what a check of the listed build\'s own page found.\n'
            if not pending else f'{len(pending)} still wait on a call.\n'),
         'Order of preference when more than one build is on file: same generation first, then same fabric family, then same size.\n']
    for b in bags:
        mine = [c for _, c in rows if _ is b]
        if not mine:
            continue
        L.append(f"## {b['model']['label']}\n")
        L.append('| Line | From | How close | Found on the listed build\'s page | Call | Source |')
        L.append('|---|---|---|---|---|---|')
        for c in mine:
            fb = c['from_build']
            close = f"{fb.get('generation', '')}. Size: {fb.get('size', '')}. Fabric: {fb.get('fabric', '')}."
            call = {'yes': 'Kept', 'pending': 'Waiting', 'no': 'Dropped'}[fb.get('assigned', 'pending')]
            if c.get('my_note'):
                call += '; matches his own use'
            L.append(f"| {c['text']} ({c['kind']}, `{c['id']}`) | {fb['label']} | {close} | {fb.get('found') or fb.get('why', '')} | {call} | {links(c['sources'])} |")
        L.append('')
    L.append('## Decided another way on 13 Nov 2026\n')
    L += ['- **Weigh Lighter Hugger 30L**, "Thin shoulder straps and basic back padding, though the reviewer found the straps comfortable" (from a review of the standard Hugger): dropped. Db\'s page for this build says nothing about straps or padding.',
          '- **Weigh Lighter Hugger 30L**, clamshell opening and top pocket (from reviews of the standard Hugger): now a "Maker says" line, because Db\'s own page for this build lists both.',
          '- **CIVIC Travel Bag 26L**, bottle pockets (from 420D owners): now sourced to an owner review on the ULTRA page, so it carries no other-build label.',
          '- **Dragonfly 30L**, "With the pack full, the front stash pocket is nearly unusable": folded into the one front-pocket con. Its review sits in a block headed "30L X-Pac Dragonfly" that also holds a review naming ULTRA 800TX, so the heading does not show the build and the line carries no other-build label.',
          '- **CT15 Plus**, "Workmanship praised, with many thoughtful, useful features" and **CT21 Plus**, "Quality praised as excellent and very well made": general praise from owner reviews on Ctactical\'s pages, not added.', '']
    L.append('## Lines on the listed build that other builds also back up\n')
    L.append('These lines rest on a source for the listed build. The sources below say the same or a related thing about another build. '
             'They are on file but not counted as extra support. If you want one counted, say which.\n')
    for b in bags:
        skip = ('different bag', 'comparison bag', 'Cordura version, same size')
        mine = [(c, [o for o in c.get('other_builds', []) if not any(w in o['about'] for w in skip)]) for c in b['claims']]
        mine = [(c, os_) for c, os_ in mine if os_]
        if not mine:
            continue
        L.append(f"**{b['model']['label']}**\n")
        for c, os_ in mine:
            L.append(f"- {c['text']} (`{c['id']}`)")
            for o in os_:
                L.append(f"  - [{src[o['source']]['publisher']}]({src[o['source']]['url']}): {o['about']}")
        L.append('')
    L.append('## Further off: read, not added\n')
    L.append('Reviews of builds a generation or more away from the listed ones. Kept out of the data because closer sources are preferred; here in case a point is worth chasing.\n')
    L.append('| For | Source | Build | What it says |')
    L.append('|---|---|---|---|')
    for who, s, build, says in FURTHER:
        L.append(f"| {who} | [{src[s]['publisher']}]({src[s]['url']}) | {build} | {says} |")
    L.append('')
    L.append('## Old lines dropped because they came from another build\n')
    for b in bags:
        for c in b['legacy']['claims']:
            for o in c['outcome']:
                if 'dropped' in o and any(w in o for w in ('420D', 'earlier', 'another fabric', 'Older-build', 'another build', 'older build')):
                    L.append(f"- **{b['model']['label']}**: \"{c['text']}\". {o.split(': ', 1)[1]}")
    L.append('')
    open(os.path.join(ROOT, 'reports', 'other-build-review.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    return len(rows)


cards()
print('cards.md written;', review(), 'other-build lines')
