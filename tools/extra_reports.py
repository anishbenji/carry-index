#!/usr/bin/env python3
"""Write reports/fabric-reasons.md and reports/photos.md from the data.   python3 tools/extra_reports.py"""
import glob, json, os
import yaml
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
mats = yaml.safe_load(open(os.path.join(ROOT, 'data', 'materials.yaml'), encoding='utf-8'))
raw = {f['material']: f for f in json.load(open(os.path.join(ROOT, 'research', 'fabric-reasons.json'), encoding='utf-8'))}
L = ['# Fabric inclusion reasons\n',
     'Drafted 13 Nov 2026 by a subagent from the sources on file plus Challenge\'s, ALUULA\'s and ALPAKA\'s own pages. "Decision" is what the data holds now. '
     'ULTRA 800TX, ULTRA 800 and Axodyne are in, by Anish\'s calls of 13 Nov 2026. The "why it\'s here" wording is still a draft for every fabric.\n']
for mid, f in raw.items():
    name = mats[mid]['name']
    sec = mats[mid]['in_uhmwpe_section']
    L.append(f'## {name}\n')
    L.append(f"**Decision: {'held' if sec['decision'] == 'undecided' else sec['decision']}** (drafter suggested {f['suggested_decision']}). Why it's here (draft): {f['why_here']}\n")
    L.append(f"- **Role of the fibre:** {f['test1']['finding']}")
    L.append(f"- **Positioning (maker's claim):** {f['test2']['finding']}")
    L.append(f"- **Experience:** {f['test3']['finding']}")
    gaps = [g.replace('; the Kickstarter page would not open', ' (the Kickstarter page has since been opened; see below)') for g in f['gaps']]
    L.append('- **Gaps:** ' + ' '.join(g if g.endswith('.') else g + '.' for g in gaps))
    srcs = []
    for t in ('test1', 'test2', 'test3'):
        for u in f[t]['sources']:
            if u not in srcs:
                srcs.append(u)
    L.append('- **Sources:** ' + ', '.join(f'[{u.split("/")[2].replace("www.", "")}]({u})' for u in srcs))
    extra = sec.get('draft', {}).get('alpaka_campaign_and_videos')
    if extra:
        allsrc = yaml.safe_load(open(os.path.join(ROOT, 'data', 'sources.yaml'), encoding='utf-8'))
        L.append('')
        L.append('**What ALPAKA\'s campaign and videos say** (opened 13 Nov 2026 through Firecrawl; videos read as transcripts)\n')
        for e in extra:
            L.append(f"- [{allsrc[e['source']]['title']}]({allsrc[e['source']]['url']}): {e['says']}")
        L.append('')
        L.append(f"Reading: {sec['draft']['reading']}\n")
        L.append('Still open: ' + ' '.join(sec['draft']['open_points']))
        L.append('')
        L.append(f"Decision recorded: {sec['reasons']}")
    L.append('')
open(os.path.join(ROOT, 'reports', 'fabric-reasons.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

media = json.load(open(os.path.join(ROOT, 'research', 'media.json'), encoding='utf-8'))
P = ['# Photos the old page uses\n',
     'Extracted 13 Nov 2026 from the published page\'s code and footer by a subagent. Each model file now lists these under `model.photos`, all with permission "none". This is what the permission requests need to cover.\n',
     '| Model | File | Where used | View | Credit on the page | Edits the page describes | Shows |', '|---|---|---|---|---|---|---|']
n = 0
for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'bags', '*', '*.yaml'))):
    b = yaml.safe_load(open(p, encoding='utf-8'))
    for ph in b['model'].get('photos', []):
        n += 1
        cell = lambda x: (x or 'none').replace('|', '/')
        P.append(f"| {b['model']['label']} | `{ph['file'].split('/')[-1]}` | {ph['role']} | {cell(ph.get('view'))} | {cell(ph.get('credit_text'))} | {cell(ph.get('edits'))} | {cell(ph.get('shows'))} |")
P.append('')
P.append(f'{n} photo uses across 12 models, plus four drawings per model (our own).\n')
P.append('## What this shows\n')
P += ['- The page has two photo sources only: one card photo per bag and a hero strip with a front and a three-quarter photo per bag. There is no gallery.',
      '- The footer credits five hero photos (CIVIC Travel Bag, Cicada, Dragonfly, EDX, Superlite Backpack). The other hero photos have no credit at all; card captions give only a domain.',
      '- Only the CIVIC Travel Bag front has source links. It combines a retailer\'s Instagram photo with a Reddit user\'s photo, as the handoff noted.',
      '- Three photos are described as edited: the CIVIC Travel Bag front (patch swapped), the Cicada front (props removed) and the EDX three-quarter view (background removed). The page also whitens plain backgrounds in the browser on every photo.',
      '- Photos that do not show the listed build: the Dragonfly hero front is the 30L Dragonfly Pass Thru and its card file is named "34L"; the Cicada hero is the Muse colourway.',
      '- One file is published but unused: an EDX carousel image.',
      '- Several hero and card files share a file name under different hashes, so some may be the same picture twice.', '']
open(os.path.join(ROOT, 'reports', 'photos.md'), 'w', encoding='utf-8').write('\n'.join(P) + '\n')
print('reports written;', n, 'photo uses')
