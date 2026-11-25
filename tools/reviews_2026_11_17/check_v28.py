#!/usr/bin/env python3
"""Independent check of design/carry-journal-v28.html against data/: every shown line (approved, or draft added by
the 17 Nov 2026 pass) is on its card with its text, support, build label and one link per publisher; sourcing lines
match; the approach note and Rev AM are on the page; no card line exceeds 14 words among the new ones.
    python3 tools/reviews_2026_11_17/check_v28.py"""
import glob, html, json, os, re, sys
import yaml
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
page = open(os.path.join(ROOT, 'design', 'carry-journal-v28.html'), encoding='utf-8').read()
src = yaml.safe_load(open(os.path.join(ROOT, 'data', 'sources.yaml'), encoding='utf-8'))
sec = yaml.safe_load(open(os.path.join(ROOT, 'data', 'sections', 'uhmwpe-backpacks.yaml'), encoding='utf-8'))
a = page.index('const BAGS = ') + len('const BAGS = ')
BAGS = json.JSONDecoder().raw_decode(page[a:].replace('<\\/', '</'))[0]
by = {e['id']: e for e in BAGS}
trim = lambda p: re.sub(r'\s*\([^)]*\)\s*$', '', p).strip()
errs, n_new, n_all, n_links = [], 0, 0, 0
for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'bags', '*', '*.yaml'))):
    b = yaml.safe_load(open(p, encoding='utf-8'))
    e = by[b['model']['legacy_id']]
    lines = {l['id']: l for l in e['pros'] + e['cons']}
    lines.update({n['id']: n for c in e['cells'] if c.get('full') for n in c['notes']})
    if e['sourcing'] != b['model']['sourcing']:
        errs.append(f'{e["id"]}: sourcing differs')
    want_ids = []
    for c in b['claims']:
        show = c.get('status') == 'approved' or (c.get('status') == 'draft' and c.get('added_in') == 'reviews-2026-11-17')
        if not show:
            if c['id'] in lines:
                errs.append(f'{c["id"]} shown but should be hidden')
            continue
        want_ids.append(c['id'])
        n_all += 1
        l = lines.get(c['id'])
        if l is None:
            errs.append(f'{c["id"]} missing from its card')
            continue
        if c.get('status') == 'draft':
            n_new += 1
            if len(c['text'].split()) > 14:
                errs.append(f'{c["id"]}: more than 14 words')
        if l['text'] != c['text'] or l.get('support') != c.get('support') or l.get('fb') != (c.get('from_build') or {}).get('label'):
            errs.append(f'{c["id"]}: text, support or build label differs on the card')
        pubs, urls = [], []
        for s in c['sources']:
            pb = trim(src[s]['publisher'])
            if pb not in pubs:
                pubs.append(pb)
                urls.append(src[s]['url'])
        if [x['pub'] for x in l['srcs']] != pubs or [x['url'] for x in l['srcs']] != urls:
            errs.append(f'{c["id"]}: source links differ: {[x["pub"] for x in l["srcs"]]} vs {pubs}')
        n_links += len(pubs)
    if sorted(lines) != sorted(want_ids):
        errs.append(f'{e["id"]}: card lines {sorted(lines)} differ from data {sorted(want_ids)}')
    print(f"{e['id']:7} For {len(e['pros'])} Against {len(e['cons'])} notes {sum(len(c['notes']) for c in e['cells'] if c.get('full'))} | {e['sourcing'][:90]}")
note = html.escape(sec['approach_note'], quote=True)
if page.count(note) != 1:
    errs.append(f'approach note found {page.count(note)} times')
if 'Rev AM' not in page or 'Updated 17 Nov 2026 · Rev AM' not in page:
    errs.append('Rev AM kicker missing')
if html.escape(sec['changelog'][0]['note']) not in page and sec['changelog'][0]['note'] not in page:
    errs.append('changelog line missing')
for bad in ('carry-journal-v27.html', 'Rev AL —'):
    if bad in page:
        errs.append(f'left in the page: {bad}')
m = re.search(r'<ul class="refs" data-ref="reviews">(.*?)</ul>', page, re.S)
refs = re.findall(r'href="([^"]+)"[^>]*>([^<]+)<', m.group(1)) if m else []
print(len(refs), 'publishers in the reference list:')
print('; '.join(f'{html.unescape(n)} -> {u}' for u, n in refs))
print(f'{n_all} lines on cards, {n_new} of them new; {n_links} source links; {len(errs)} problems')
for x in errs:
    print('PROBLEM', x)
sys.exit(1 if errs else 0)
