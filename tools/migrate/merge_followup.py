#!/usr/bin/env python3
"""Second pass on 13 Nov 2026: pages opened with Firecrawl that WebFetch could not
open, and the search for where Ctactical bags are made. Run after merge_research.py."""
import glob, os
import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'data')
TODAY = '2026-11-13'
FC = 'Opened by Claude through Firecrawl on 13 Nov 2026'
SUB = 'Search subagent, page opened through WebFetch on 13 Nov 2026'


def load(p):
    return yaml.safe_load(open(p, encoding='utf-8'))


def dump(p, obj, header=''):
    with open(p, 'w', encoding='utf-8') as f:
        if header:
            f.write(''.join('# ' + l + '\n' for l in header.strip().split('\n')))
        yaml.safe_dump(obj, f, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=False)


sources = load(os.path.join(DATA, 'sources.yaml'))


def add(sid, url, kind, publisher, title, opened_by, published=None, relays=True):
    sources[sid] = dict(url=url, kind=kind, publisher=publisher, title=title, published=published,
                        relays_maker_info=relays, archived=None, last_ok=TODAY, opened_by=opened_by)
    return sid


CT_VN = {  # variant id -> page on the maker's Vietnamese-market store
    'ct15-lite-ultra200x': ('balo-ct15-lite-ultra200x', SUB + '; origin line also read word for word by Claude through Firecrawl'),
    'ct15-plus-ultra200x': ('balo-ct15-plus-ultra200x', SUB),
    'ct21-lite-ultra200x': ('balo-ct21-lite-ultra200x', SUB),
    'ct21-lite-ultra400x': ('balo-ct21-lite-ultra400x', SUB),
    'ct21-plus-ultra400x': ('balo-ct21-plus-ultra400x', SUB + '; also opened by Claude through WebFetch'),
    'ct21-plus-ultra200x': ('balo-ct21-plus-ultra200x', SUB),
}
for vid, (slug, by) in CT_VN.items():
    add('chuyentactical-' + slug, 'https://chuyentactical.com/' + slug, 'maker-page', 'Ctactical (Chuyên Tactical, its Vietnamese store)',
        'Balo ' + vid, by)
ks = add('tortuga-kickstarter-superlite', 'https://www.kickstarter.com/projects/tortugabackpacks/the-superlite-backpack-by-tortuga',
         'maker-other', 'Tortuga (Kickstarter)', 'Superlite by Tortuga: Ultralight (2.2 lb) Carry On Backpack', FC)
node = add('treeline-review-ula-ultra-node-20l-pack-review', 'https://www.treelinereview.com/gearreviews/ula-ultra-node-20l-pack-review',
           'review', 'Treeline Review', 'ULA Ultra Node 20L Pack Review (Tested)', FC, '2026-04-13', False)
united = add('united-carry-on-bags', 'https://www.united.com/en/us/fly/baggage/carry-on-bags.html', 'other', 'United Airlines',
             'Carry-on Bags', FC, None, False)

CLAIMS = {
    'slite-pro-2': dict(add=[(ks, 'same build (maker\'s campaign page)')], drop_lead='kickstarter.com', basis='maker', status='supported',
        note='Tortuga\'s Kickstarter campaign says the optional hip belt transfers up to 80% of the weight from shoulders to hips; Men\'s Gear relays it. Not on the product page, and no hands-on review gives a figure.'),
    'dfly-pro-1': dict(add=[(node, 'ULA Ultra Node 20L (a different bag)')], drop_lead='ula-ultra-node',
        append=' Treeline\'s Ultra Node review (13 Apr 2026) calls the Node the lightest adventure travel pack it tested, at 20.17 oz.'),
    'ct21p-con-1': dict(add=[(united, 'airline policy page')], drop_lead='united.com',
        note='Maker lists 47.5 x 34 x 21.5 cm. That exceeds the personal-item limits on the two airline pages opened: easyJet 45 x 36 x 20 cm and United 43 x 25 x 22 cm. "Many airlines" should come from the airline-fit data.'),
    'ct15l-pro-4': dict(drop_lead='ebay.com',
        append=' The eBay lead is an ended listing (the page now returns 404) for a "CT15+ Variant Special Edition" at US $239.99, fabric not stated.'),
}

for p in sorted(glob.glob(os.path.join(DATA, 'bags', '*', '*.yaml'))):
    b = load(p)
    for v in b['variants']:
        if v['id'] in CT_VN:
            v['made_in'] = 'Vietnam'
            v.pop('notes', None)
            v['checks'].append(dict(date=TODAY, source='chuyentactical-' + CT_VN[v['id']][0], basis='page', method=CT_VN[v['id']][1],
                                    fields=['made_in'],
                                    note='The maker\'s Vietnamese store lists "Xuất xứ: Việt Nam" (origin: Vietnam). The English ctactical.com page has no origin line.'))
        if v['id'] == 'superlite-backpack':
            v['checks'].append(dict(date=TODAY, source=ks, basis='page', method=FC, fields=['made_in'],
                                    note='Tortuga\'s Kickstarter campaign gives Vietnam; Pack Hacker lists the same.'))
    for c in b['claims']:
        u = CLAIMS.get(c['id'])
        if not u:
            continue
        for sid, about in u.get('add', []):
            if sid not in c['sources']:
                c['sources'].append(sid)
                c.setdefault('source_notes', []).append(dict(source=sid, about=about))
        if 'drop_lead' in u and 'leads' in c:
            c['leads'] = [l for l in c['leads'] if u['drop_lead'] not in l]
            if not c['leads']:
                del c['leads']
        if 'basis' in u:
            c['basis'] = u['basis']
        if 'status' in u:
            c['evidence']['status'] = u['status']
        if 'note' in u:
            c['evidence']['note'] = u['note']
        if 'append' in u:
            c['evidence']['note'] += u['append']
        c['evidence']['method'] = 'Search subagent through WebFetch, then Claude through Firecrawl, 13 Nov 2026'
    dump(p, b)

brands = load(os.path.join(DATA, 'brands.yaml'))
brands['ctactical']['country_note'] = ('About page (https://ctactical.com/pages/about-us), read in full 13 Nov 2026: invites visitors to Saigon and names chuyentactical.com as its website. '
                                       'That Vietnamese store is run by Công ty TNHH Saigon Outdoor Gear, Ho Chi Minh City.')
dump(os.path.join(DATA, 'brands.yaml'), brands,
     'Makers. country comes from the old page\'s "origin" field; country_checked says whether a page confirms it.\nimage_permission terms and contacts are from the 10 Nov 2026 handoff.')
dump(os.path.join(DATA, 'sources.yaml'), sources,
     'One entry per page. last_ok is the last date the page opened; null means it has not been opened.\narchived is for a link checker to fill. opened_by says who opened it and how.')
print('follow-up merged; sources now', len(sources))
