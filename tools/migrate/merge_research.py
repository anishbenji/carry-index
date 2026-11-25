#!/usr/bin/env python3
"""Merge the 13 Nov 2026 source search (research/*.json) into the data files.
One-off: run once after migrate.py.   python3 tools/migrate/merge_research.py"""
import glob, json, os, re
from urllib.parse import urlparse
import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'data')
TODAY = '2026-11-13'
BY = 'Search subagent, page opened through WebFetch on 13 Nov 2026'
SPOT = BY + '; also opened by Claude as a spot-check'
SPOT_URLS = {'https://evergoods.us/blogs/evergoods-road-to-launch/the-ultra-travel-system-coming-soon',
             'https://rushfaster.com.au/products/evergoods-civic-travel-bag-26l-ultra',
             'https://mensgear.net/tortuga-superlite-backpack/', 'https://www.challenge-outdoor.com/ultra-grid',
             'https://www.packhacker.com/travel-gear/tortuga/superlite-backpack/',
             'https://www.ula-equipment.com/product/ultra-cicada-ewp/'}


def load(p):
    return yaml.safe_load(open(p, encoding='utf-8'))


def dump(p, obj, header=''):
    with open(p, 'w', encoding='utf-8') as f:
        if header:
            f.write(''.join('# ' + l + '\n' for l in header.strip().split('\n')))
        yaml.safe_dump(obj, f, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=False)


def norm(url):
    u = urlparse(url.strip())
    host = u.netloc.lower().replace('www.', '')
    return host + u.path.rstrip('/') + ('?' + u.query if u.query else '')


def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')


sources = load(os.path.join(DATA, 'sources.yaml'))
by_url = {norm(v['url']): k for k, v in sources.items()}
KINDS = {'maker-page', 'maker-other', 'retailer', 'review', 'launch-coverage', 'video', 'forum', 'own', 'other'}


def source_id(s):
    """Return the id for an opened source, adding it to sources.yaml if new."""
    key = norm(s['url'])
    if key in by_url:
        sid = by_url[key]
        sources[sid]['last_ok'] = TODAY
        return sid
    u = urlparse(s['url'])
    tail = [p for p in u.path.split('/') if p]
    tail = tail[-1] if tail else (u.query or u.netloc)
    if u.query and not u.path.strip('/'):
        tail = u.query
    base = f"{slug(s['publisher'])[:28]}-{slug(tail)[:44]}".strip('-')
    sid, n = base, 2
    while sid in sources:
        sid, n = f'{base}-{n}', n + 1
    kind = s['kind'] if s['kind'] in KINDS else 'other'
    if re.search(r'easyjet|united', s['publisher'], re.I):
        kind = 'other'
    entry = dict(url=s['url'], kind=kind, publisher=s['publisher'])
    if s.get('title'):
        entry['title'] = s['title']
    entry['published'] = s.get('date')
    entry['relays_maker_info'] = bool(s.get('relays_maker_info'))
    entry['archived'] = None
    entry['last_ok'] = TODAY
    entry['opened_by'] = SPOT if s['url'] in SPOT_URLS else BY
    sources[sid] = entry
    by_url[key] = sid
    return sid


# ---------------------------------------------------------------- claims
research = {}
for name in ('evergoods-aer.json', 'ula.json', 'ctactical.json', 'edx-superlite-db.json'):
    for item in json.load(open(os.path.join(ROOT, 'research', name), encoding='utf-8')):
        research[item['id']] = item

bag_paths = sorted(glob.glob(os.path.join(DATA, 'bags', '*', '*.yaml')))
bags = {p: load(p) for p in bag_paths}
merged = 0
for p, b in bags.items():
    for c in b['claims']:
        r = research.get(c['id'])
        if not r:
            continue
        merged += 1
        ids, notes, leads = list(c.get('sources', [])), [], []
        for s in r.get('sources', []):
            if s.get('opened'):
                sid = source_id(s)
                if sid not in ids:
                    ids.append(sid)
                notes.append(dict(source=sid, about=s.get('about') or 'not stated'))
            else:
                leads.append(s['url'])
        c['sources'] = ids
        if notes:
            c['source_notes'] = notes
        if leads:
            c['leads'] = leads
        if r['status'] in ('supported', 'partly') and r.get('basis') in ('review', 'owner-reports', 'maker', 'sibling'):
            c['basis'] = r['basis']
            if r['basis'] == 'sibling' and 'sibling_of' not in c:
                others = [n['about'] for n in notes if not n['about'].startswith('same build')]
                c['sibling_of'] = others[0] if others else 'another build (see source notes)'
        c['evidence'] = dict(status=r['status'], note=r['note'], checked=TODAY, method=BY)

# ---------------------------------------------------------------- spec facts (curated from research/specs.json)
def S(url, publisher, kind, title=None, relays=False, date=None):
    return source_id(dict(url=url, publisher=publisher, kind=kind, title=title, relays_maker_info=relays, date=date))

rf_ctb = S('https://rushfaster.com.au/products/evergoods-civic-travel-bag-26l-ultra', 'Rushfaster', 'retailer', 'Evergoods Civic Travel Bag 26L Ultra', True)
eg_post = S('https://evergoods.us/blogs/evergoods-road-to-launch/the-ultra-travel-system-coming-soon', 'Evergoods', 'maker-other', 'The Ultra Travel System: coming soon', True)
rf_cpp2 = S('https://rushfaster.com.au/products/aer-city-pack-pro-2-ultra-24l', 'Rushfaster', 'retailer', 'Aer City Pack Pro 2 Ultra 24L', True)
rf_tp4 = S('https://rushfaster.com.au/products/aer-travel-pack-4-ultra-28l', 'Rushfaster', 'retailer', 'Aer Travel Pack 4 Ultra 28L', True)
ula_fabric = S('https://www.ula-equipment.com/fabric', 'ULA Equipment', 'maker-other', 'Fabrics', True)
ph_slite = S('https://www.packhacker.com/travel-gear/tortuga/superlite-backpack/', 'Pack Hacker', 'review', 'Tortuga Superlite Backpack Review', False, '2026-06-16')
ch_weave = S('https://www.challenge-outdoor.com/ultra-weave', 'Challenge Outdoor', 'maker-other', 'UltraWeave', True)
ch_coll = S('https://www.challenge-outdoor.com/ultra-collection', 'Challenge Outdoor', 'maker-other', 'Ultra collection', True)
ch_guide = S('https://static1.squarespace.com/static/62018e9b29f2cd0fc23c3a0c/t/63d8117224b90b2859f159a4/1675104626522/2023_EcoPak-Guide_v3.pdf', 'Challenge Outdoor', 'maker-other', '2023 Outdoor Fabric Guide (PDF)', True, '2023')
ch_grid = S('https://www.challenge-outdoor.com/ultra-grid', 'Challenge Outdoor', 'maker-other', 'UltraGrid', True)
ch_eplx = S('https://www.challenge-outdoor.com/eplx-collection', 'Challenge Outdoor', 'maker-other', 'EcoPak EPLX collection', True)
al_tech = S('https://aluula.com/technology/', 'ALUULA Composites', 'maker-other', 'Technology', True)
ggg = S('https://garagegrowngear.com/blogs/gear-gab/aluula-graflyte-weaving-a-new-future-for-ultralight-fabric', 'Garage Grown Gear', 'launch-coverage', 'ALUULA Graflyte', True)
xt_200 = S('https://www.extremtextil.de/en/ultra-200-x-backpack-laminate-with-uhmwpe-133g-sqm/72682', 'Extremtextil', 'retailer', 'ULTRA 200 X', True)
xt_400 = S('https://www.extremtextil.de/en/ultra-400-x-backpack-laminate-with-uhmwpe-178g-sqm/72683', 'Extremtextil', 'retailer', 'ULTRA 400 X', True)


def chk(v, source, fields, note=None):
    c = dict(date=TODAY, source=source, basis='page', method=BY, fields=fields)
    if note:
        c['note'] = note
    v['checks'].append(c)


CT_OPEN = 'Main compartment opens flat, up to 180°'
for p, b in bags.items():
    for v in b['variants']:
        i = v['id']
        if i == 'civic-travel-bag-26l-ultra':
            v['made_in'] = 'Vietnam'
            chk(v, rf_ctb, ['made_in'], 'From a retailer; no Evergoods page states it')
            chk(v, eg_post, ['release'], 'Evergoods calls it a limited edition collection with no restock planned')
        elif i in ('city-pack-pro-2-ultra-24l', 'travel-pack-4-ultra-28l'):
            v['opening'] = 'Lay-flat main compartment'
            chk(v, v['page'], ['opening'], 'Aer\'s wording; "clamshell" appears only in reviews of the Cordura build')
            v['made_in'] = 'China'
            chk(v, rf_cpp2 if i.startswith('city') else rf_tp4, ['made_in'], 'From a retailer; Aer\'s FAQ says only that soft goods are made in China and Vietnam')
        elif i in ('ultra-cicada', 'ultra-cicada-ewp', 'ultra-muse-cicada-ewp'):
            v['opening'] = 'Front-loading'
            if i != 'ultra-cicada-ewp':
                chk(v, v['page'], ['opening'], 'ULA\'s wording; "hybrid" is not on the page')
            chk(v, ula_fabric, ['made_in'], 'ULA says its packs are designed, cut and sewn in Utah')
        elif i in ('30l-patchless-ultra-dragonfly', '30l-ultra-dragonfly', '30l-dragonfly-pass-thru'):
            if i == '30l-patchless-ultra-dragonfly':
                chk(v, v['page'], ['opening'])
            chk(v, ula_fabric, ['made_in'], 'ULA says its packs are designed, cut and sewn in Utah')
        elif i.startswith('ct'):
            v['opening'] = CT_OPEN + ('; separate Plus compartment' if 'plus' in i else '')
            v['made_in'] = 'Vietnam'  # no check: see notes
            v['notes'] = {'made_in': 'From Anish (13 Nov 2026): Ctactical is a Vietnamese maker. No page opened states where the bags are made; the about page places the company in Saigon and says it designed and manufactured its backpack. ctactical.vn redirects to ctactical.com.'}
            if i in ('ct15-lite-ultra200x', 'ct21-lite-ultra200x', 'ct15-plus-ultra200x', 'ct21-plus-ultra400x'):
                chk(v, v['page'], ['opening'], 'Ctactical\'s wording; "panel-load" is not on the page')
        elif i == 'matador-x-carryology-edx-ultra-backpack':
            chk(v, v['page'], ['release'], 'Matador marks it a limited edition; no quantity given')
        elif i == 'superlite-backpack':
            v['opening'] = 'Clamshell that opens flat like a suitcase'
            chk(v, v['page'], ['opening'])
            v['made_in'] = 'Vietnam'
            chk(v, ph_slite, ['made_in'], 'From Pack Hacker\'s hands-on review; Tortuga\'s product page does not state it')
        elif i == 'weigh-lighter-hugger-backpack-30l-weigh-darker':
            chk(v, v['page'], ['opening'])

# ---------------------------------------------------------------- materials
materials = load(os.path.join(DATA, 'materials.yaml'))


def mcheck(mid, source, fields, note=None):
    c = dict(date=TODAY, source=source, basis='page', method=BY, fields=fields)
    if note:
        c['note'] = note
    materials[mid]['checks'].append(c)


TX = 'Ultra and polyester woven face, 45° Ultra CrossPly, 0.5 mil RUV film, polyester ripstop backing'
upd = {
    'ultra-200x': dict(construction='UHMWPE and high-tenacity polyester woven face, Ultra cross-ply, 0.75 mil PET film',
        statement='Challenge gives no share. Retailer Extremtextil lists both 43% and 67% UHMWPE on its page. Fabric weight differs by source: 4.6 oz/yd² on Challenge\'s UltraWeave page, 3.9 oz/yd² (133 g/m²) at ULA and Extremtextil.',
        source='https://www.challenge-outdoor.com/ultra-weave', note='Challenge\'s UltraWeave page writes "Ultra200X".',
        checks=[(ch_weave, ['name_as_written', 'uhmwpe_role']), (ula_fabric, ['uhmwpe_content']), (xt_200, ['uhmwpe_content'])]),
    'ultra-400x': dict(construction='UHMWPE and high-tenacity polyester woven face, Ultra cross-ply, 0.75 mil PET film',
        statement='Challenge names it without a blend or weight. ULA gives 5.25 oz/yd² (178 g/m²); retailer Extremtextil gives a 67/33 UHMWPE and polyester face.',
        source='https://www.challenge-outdoor.com/ultra-weave', note='Challenge\'s UltraWeave page writes "Ultra400X".',
        checks=[(ch_weave, ['name_as_written', 'uhmwpe_role']), (ula_fabric, ['uhmwpe_content']), (xt_400, ['uhmwpe_content'])]),
    'ultra-200tx': dict(construction=TX, statement='No share given. 5.9 oz/yd² (200 g/m²) in Challenge\'s 2023 fabric guide, which may be out of date.',
        source=sources[ch_guide]['url'], note='The 2023 guide writes "ULTRA200TX".', checks=[(ch_guide, ['name_as_written', 'uhmwpe_role', 'uhmwpe_content'])]),
    'ultra-400tx': dict(construction=TX, statement='No share given. 7.2 oz/yd² (244 g/m²) in Challenge\'s 2023 fabric guide and on ULA\'s fabric page.',
        source=sources[ch_guide]['url'], note='The 2023 guide writes "ULTRA400TX". ULA describes the backing as white taffeta.',
        checks=[(ch_guide, ['name_as_written', 'uhmwpe_role', 'uhmwpe_content']), (ula_fabric, ['uhmwpe_content'])]),
    'ultra-800tx': dict(construction=TX, statement='No share given. 10.85 oz/yd² (367 g/m²) in Challenge\'s 2023 fabric guide.',
        source=sources[ch_guide]['url'], note='ULA\'s Dragonfly page quotes 8.5 oz/yd² for its 800 option, which is the weight Challenge lists for plain ULTRA 800, not ULTRA800TX.',
        checks=[(ch_guide, ['name_as_written', 'uhmwpe_role', 'uhmwpe_content'])]),
    'ultra-800': dict(statement='No share given. 8.5 oz/yd² (288 g/m²) on Challenge\'s Ultra collection page.',
        source='https://www.challenge-outdoor.com/ultra-collection', checks=[(ch_coll, ['uhmwpe_content'])]),
    'ultra-tx': dict(statement='ULA\'s 30L Dragonfly Pass Thru page says "Challenge ULTRA TX"; its fabric block describes only ULTRA 400TX (7.2 oz/yd²), so 400TX is implied, not stated.',
        source='https://www.ula-equipment.com/product/30l-dragonfly-pass-thru/'),
    'aluula-graflyte': dict(construction='Fused without adhesives, by ALUULA\'s general description of its fabrics; Graflyte is not described separately on ALUULA\'s technology page',
        statement='ALUULA says its fabrics are 100% polyethylene. Db lists the bag\'s main material as 100% polyethylene (ALUULA Graflyte). Trade coverage citing ALUULA reports woven 100% UHMWPE in 52, 78 and 98 g/m².',
        source='https://aluula.com/technology/', checks=[(al_tech, ['uhmwpe_role', 'uhmwpe_content']), (ggg, ['uhmwpe_content'])]),
    'ultragrid': dict(construction='Recycled 210d nylon base with a double 200d Ultra ripstop grid, C0 DWR, 1500 mm PU backing', fibre='recycled nylon with an Ultra grid',
        statement='The Ultra fibre is only the 5 mm grid. 4.3 oz/yd² (146 g/m²) on Challenge\'s page; 3.9 oz/yd² in its 2023 guide. The page says "Ultra grid" and does not use the word UHMWPE.',
        source='https://www.challenge-outdoor.com/ultra-grid', checks=[(ch_grid, ['name_as_written', 'uhmwpe_role', 'uhmwpe_content'])],
        reasons='Used here only as a lining. As a shell it would meet the disqualifier: the Ultra fibre is only a ripstop grid in a nylon weave.'),
    'ecopak-eplx840': dict(construction='840d recycled polyester face, 45° CrossPly, 0.5 mil RUV film', fibre='recycled polyester',
        statement='No UHMWPE mentioned. 9.85 oz/yd² (334 g/m²).', source='https://www.challenge-outdoor.com/eplx-collection',
        checks=[(ch_eplx, ['name_as_written', 'uhmwpe_role', 'uhmwpe_content'])]),
}
for mid, u in upd.items():
    m = materials[mid]
    for k in ('construction', 'fibre', 'note'):
        if k in u:
            m[k] = u[k]
    m['uhmwpe_content']['statement'] = u['statement']
    m['uhmwpe_content']['source'] = u['source']
    if 'reasons' in u:
        m['in_uhmwpe_section']['reasons'] = u['reasons']
    m['checks'] = []
    for sid, fields in u.get('checks', []):
        mcheck(mid, sid, fields)
    if 'checks' in m:
        m['checks'] = m.pop('checks')  # keep checks last

brands = load(os.path.join(DATA, 'brands.yaml'))
brands['ctactical']['country_checked'] = True
brands['ctactical']['country_note'] = 'About page (https://ctactical.com/pages/about-us), opened 13 Nov 2026: based in Saigon, Vietnam.'
dump(os.path.join(DATA, 'brands.yaml'), brands,
     'Makers. country comes from the old page\'s "origin" field; country_checked says whether a page confirms it.\nimage_permission terms and contacts are from the 10 Nov 2026 handoff.')

for p, b in bags.items():
    b['migration']['sources_search'] = 'Claims and spec gaps were searched on 13 Nov 2026; see evidence on each claim and reports/sources-search-2026-11-13.md'
    dump(p, b)
dump(os.path.join(DATA, 'sources.yaml'), sources,
     'One entry per page. last_ok is the last date the page opened; null means it has not been opened.\narchived is for a link checker to fill. opened_by says who opened it and how.')
dump(os.path.join(DATA, 'materials.yaml'), materials,
     'Fabrics. Checked on 13 Nov 2026 against Challenge\'s and ALUULA\'s own pages where a check is listed.')
print('claims merged:', merged, 'of', len(research), '| sources now:', len(sources))
print('research ids that are not claims:', sorted(set(research) - {c['id'] for b in bags.values() for c in b['claims']}))
