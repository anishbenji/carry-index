#!/usr/bin/env python3
"""Build the v0.1 data files from the old page's BAGS array plus the maker-page
checks made on 13 Nov 2026. Run from the repo root:  python3 tools/migrate/migrate.py
Re-running overwrites data/. Hand edits to data/ made after migration are lost,
so this script is for the first migration only."""
import copy, os, re, sys
import yaml

sys.path.insert(0, os.path.dirname(__file__))
from legacy_bags import BAGS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'data')
TODAY = '2026-11-13'
METHOD = 'Page opened and read by Claude through WebFetch; not yet spot-checked by Anish'
IN = 2.54


def dump(path, obj, header=''):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        if header:
            f.write(''.join('# ' + line + '\n' for line in header.strip().split('\n')))
        yaml.safe_dump(obj, f, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=False)


def cm(inches):
    return round(inches * IN, 1)


# ---------------------------------------------------------------- brands
BRANDS = {
    'evergoods': dict(name='Evergoods', site='https://evergoods.us', country='USA', country_checked=False,
        image_permission=dict(status='not_asked', terms='No reuse without written permission',
            terms_url='https://evergoods.us/policies/terms-of-service',
            contact='general address on its contact page; runs an affiliate programme for gear review sites')),
    'aer': dict(name='Aer', site='https://aersf.com', country='USA', country_checked=False,
        image_permission=dict(status='not_asked', terms='Personal, non-commercial viewing only; no copying or modifying',
            terms_url='https://aersf.com/pages/terms-and-conditions',
            contact='press address on its contact page')),
    'ula-equipment': dict(name='ULA Equipment', site='https://www.ula-equipment.com', country='USA', country_checked=False,
        image_permission=dict(status='not_asked', terms='Publication prohibited without written permission',
            terms_url='https://www.ula-equipment.com/privacy-copyright/',
            contact='a named staff address for permission requests')),
    'ctactical': dict(name='Ctactical', site='https://ctactical.com', country='Vietnam', country_checked=False,
        image_permission=dict(status='not_asked', terms='Says nothing about images either way',
            terms_url='https://ctactical.com/policies/terms-of-service',
            contact='general address on its contact page')),
    'matador': dict(name='Matador', site='https://www.matadorequipment.com', country='USA', country_checked=False,
        image_permission=dict(status='not_asked', terms='Other uses need prior written consent',
            terms_url='https://www.matadorequipment.com/policies/terms-of-service',
            contact='Creators and affiliates page; reviewers apply through AvantLink')),
    'carryology': dict(name='Carryology', site='https://www.carryology.com',
        image_permission=dict(status='not_asked', terms='Not checked')),
    'tortuga': dict(name='Tortuga', site='https://www.tortugabackpacks.com', country='USA', country_checked=False,
        image_permission=dict(status='not_asked', terms='Personal, non-commercial viewing only',
            terms_url='https://www.tortugabackpacks.com/pages/terms-of-service',
            contact='Contact page; the affiliate programme asks for 50,000 monthly visitors')),
    'db-journey': dict(name='Db Journey', site='https://dbjourney.com', country='Norway', country_checked=False,
        image_permission=dict(status='not_asked', terms='Commercial or public reuse needs prior permission',
            terms_url='https://dbjourney.com/en-no/pages/terms-conditions',
            contact='Contact form; it has creator and partnership pages')),
}

# ---------------------------------------------------------------- sources
def src(url, publisher, opened=True):
    return dict(url=url, kind='maker-page', publisher=publisher, archived=None, last_ok=TODAY if opened else None)

SOURCES = {
    'evergoods-civic-travel-bag-ultra': src('https://evergoods.us/products/civic-travel-bag-ultra', 'Evergoods'),
    'aer-city-pack-pro-2-ultra-24l': src('https://aersf.com/products/city-pack-pro-2-ultra-24l', 'Aer'),
    'aer-travel-pack-4-ultra-28l': src('https://aersf.com/products/travel-pack-4-ultra-28l', 'Aer'),
    'ula-ultra-cicada': src('https://www.ula-equipment.com/product/ultra-cicada/', 'ULA Equipment'),
    'ula-ultra-cicada-ewp': src('https://www.ula-equipment.com/product/ultra-cicada-ewp/', 'ULA Equipment'),
    'ula-ultra-muse-cicada': src('https://www.ula-equipment.com/product/ultra-muse-cicada/', 'ULA Equipment'),
    'ula-ultra-30l-patchless-dragonfly': src('https://www.ula-equipment.com/product/ultra-30l-patchless-dragonfly/', 'ULA Equipment'),
    'ula-ultra-dragonfly': src('https://www.ula-equipment.com/product/ultra-dragonfly/', 'ULA Equipment'),
    'ula-30l-dragonfly-pass-thru': src('https://www.ula-equipment.com/product/30l-dragonfly-pass-thru/', 'ULA Equipment'),
    'ctactical-ct15-lite-ultra200x': src('https://ctactical.com/products/ct15-lite-ultra200x', 'Ctactical'),
    'ctactical-ct21-lite-ultra200x': src('https://ctactical.com/products/ct21-lite-ultra200x', 'Ctactical'),
    'ctactical-ct21-lite-ultra400x': src('https://ctactical.com/products/ct21-lite-ultra400x', 'Ctactical'),
    'ctactical-ct15-plus-ultra200x': src('https://ctactical.com/products/ct15-plus-ultra200x', 'Ctactical'),
    'ctactical-ct21-plus-ultra400x': src('https://ctactical.com/products/ct21-plus-ultra400x', 'Ctactical'),
    'ctactical-ct21-plus-ultra200x': src('https://ctactical.com/products/ct21-plus-ultra200x', 'Ctactical'),
    'matador-x-carryology-edx-ultra-backpack': src('https://www.matadorequipment.com/products/matador-x-carryology-edx-ultra-backpack', 'Matador'),
    'tortuga-superlite-backpack': src('https://www.tortugabackpacks.com/products/superlite-backpack', 'Tortuga'),
    'db-weigh-lighter-hugger-30l-weigh-darker': src('https://dbjourney.com/en-us/products/weigh-lighter-hugger-backpack-30l-weigh-darker', 'Db Journey'),
    'db-weigh-lighter-hugger-30l-monochrome': src('https://dbjourney.com/en-us/products/weigh-lighter-hugger-backpack-30l-monochrome', 'Db Journey', opened=False),
}

# ---------------------------------------------------------------- materials
PENDING = 'On the page since before the three tests were written down; reasons against the tests still to be written'

def mat(name, family, role, statement, source=None, decision='in', reasons=PENDING, construction='woven-face laminate',
        maker='Challenge Sailcloth', fibre='UHMWPE', published=False, note=None, decided='before 2026-11-13'):
    m = dict(name=name, maker=maker, family=family, fibre=fibre, construction=construction, uhmwpe_role=role,
             uhmwpe_content=dict(published=published, statement=statement),
             in_uhmwpe_section=dict(decision=decision, reasons=reasons, decided=decided))
    if source:
        m['uhmwpe_content']['source'] = source
    if note:
        m['note'] = note
    m['checks'] = []
    return m

MATERIALS = {
    'ultra-200x': mat('ULTRA 200X', 'ULTRA X', 'face',
        'Retailer Extremtextil describes the face as a UHMWPE and high-tenacity polyester blend; no share given. Not checked on Challenge\'s own page.',
        'https://www.extremtextil.de/en/detail/2df9fb36d501429cba9efb96c38ded84'),
    'ultra-400x': mat('ULTRA 400X', 'ULTRA X', 'face', 'Not checked yet.'),
    'ultra-200tx': mat('ULTRA 200TX', 'ULTRA TX', 'face',
        'Tortuga\'s page says it is made of UHMWPE and high-tenacity polyester; no share given. Not checked on Challenge\'s own page.',
        'https://www.tortugabackpacks.com/products/superlite-backpack'),
    'ultra-400tx': mat('ULTRA 400TX', 'ULTRA TX', 'face',
        'ULA\'s page describes a 400d Ultra PE fabric with a white taffeta backing; no share given. Not checked on Challenge\'s own page.',
        'https://www.ula-equipment.com/product/ultra-30l-patchless-dragonfly/'),
    'ultra-800tx': mat('ULTRA 800TX', 'ULTRA TX', 'face',
        'ULA\'s page describes an 800d Ultra PE blend with a film backing; no share given. Not checked on Challenge\'s own page.',
        'https://www.ula-equipment.com/product/ultra-30l-patchless-dragonfly/'),
    'ultra-800': mat('ULTRA 800', 'ULTRA', 'face', 'Not checked yet. Listed as a colour option on ULA\'s 30L Ultra Dragonfly page.'),
    'ultra-tx': mat('ULTRA TX (weight not stated)', 'ULTRA TX', 'face',
        'ULA\'s 30L Dragonfly Pass Thru page names "Challenge ULTRA TX" without a weight class.',
        'https://www.ula-equipment.com/product/30l-dragonfly-pass-thru/',
        note='Placeholder until the Pass Thru\'s fabric weight is confirmed.'),
    'aluula-graflyte': mat('ALUULA Graflyte', 'ALUULA', 'fused-film',
        'Db lists the main material as 100% polyethylene (ALUULA Graflyte).',
        'https://dbjourney.com/en-us/products/weigh-lighter-hugger-backpack-30l-weigh-darker',
        construction='fused laminate; construction not checked on ALUULA\'s own page', maker='ALUULA Composites', published=True),
    'ultragrid': mat('UltraGrid', 'UltraGrid', 'grid-only', 'Not checked yet.',
        decision='not-applicable', reasons='Used here only as a lining. As a shell it would meet the disqualifier (UHMWPE as a ripstop grid) if its composition is as recalled.',
        construction='nylon weave with a UHMWPE ripstop grid (from general knowledge; not checked on Challenge\'s page)', fibre='nylon with UHMWPE grid',
        decided='2026-11-13'),
    'ecopak-eplx840': mat('EcoPak EPLX840', 'ECOPAK', 'none', 'Not checked yet.',
        decision='not-applicable', reasons='Used here only as a base panel.', construction='not checked', fibre='not checked', decided='2026-11-13'),
}

# ---------------------------------------------------------------- section
SECTION = dict(
    id='uhmwpe-backpacks', title='UHMWPE backpacks', category='backpack',
    rule=dict(category='backpack', shell_material='in_uhmwpe_section.decision == in',
              tests=['Role of the fibre: UHMWPE is a main structural part of the fabric, by the maker\'s description',
                     'Positioning: the maker presents it as a UHMWPE fabric',
                     'Experience: bags in it differ from the maker\'s nylon bags the way UHMWPE bags usually do'],
              disqualifier='UHMWPE only as a ripstop grid or minor reinforcement in an ordinary nylon or polyester weave'),
    scope_note='EDC and travel backpacks. Inclusion is an editorial call per fabric, shown with its reasons.',
    exclusions=[dict(name='Able Carry Max EDC',
                     reason='No evidence found that Able Carry released a Challenge ULTRA build',
                     decided='before Rev AE; date not recorded')],
    revision=dict(letter='AE', date='2026-11-10'),
    changelog=[],
)

# ---------------------------------------------------------------- variants (maker pages, 13 Nov 2026)
CT_LINING_SMOKE = 'Challenge Sailcloth UltraGrid - Blue Smoke'
CT_LINING_WAVE = 'Challenge Sailcloth UltraGrid - Blue Wave'
CT_BASE = 'EcoPak EPLX840 Black'
BASE_FIELDS = ['name', 'price', 'volume_l', 'weight_g', 'dims_cm', 'laptop', 'fabric.shell']


def ct(vid, name, page, shell, lining, vol, g, g_text, d, d_text, lap, price):
    return dict(id=vid, name=name, page=page,
        fabric=dict(shell=[shell], shell_as_written='Challenge Sailcloth ' + name.split(' - ')[1],
                    lining=lining, lining_material='ultragrid', base=CT_BASE, base_material='ecopak-eplx840'),
        volume_l=vol, weight_g=g, dims_cm=dict(h=47.5, w=d[0], d=d[1]),
        as_written=dict(weight=g_text, dims=d_text),
        laptop=dict(max_in=lap), price=dict(amount=price, currency='USD', seller='ctactical'),
        availability='sold_out', release='regular', colourways=[dict(name='Black Magic')],
        _checked=BASE_FIELDS + ['availability', 'fabric.lining', 'fabric.base', 'colourways'])


ULA_CICADA = dict(volume_l=22, weight_g=800, dims_cm=dict(h=cm(18), w=cm(11), d=cm(5)),
                  as_written=dict(weight='28.2 oz | 799.5 g', dims='18" x 11" x 5"', volume='1,342 cu in | 22 L', laptop='15.5" x 10"'),
                  laptop=dict(max_in=15.5, type='sleeve'), made_in='USA')
ULA_DFLY = dict(volume_l=30, dims_cm=dict(h=cm(18.5), w=cm(11), d=cm(7)), laptop=dict(max_in=15, type='sleeve'), made_in='USA')

VARIANTS = {
 'ctb26': [dict(id='civic-travel-bag-26l-ultra', name='CIVIC Travel Bag 26L - ULTRA', page='evergoods-civic-travel-bag-ultra',
    fabric=dict(shell=['ultra-200x'], shell_as_written='Black Magic ULTRA 200X shell textile',
                lining='White 210D Nylon 6,6 with PU coating and silicone finish', other='#10 and #8 YKK RCPU coated exterior zippers'),
    volume_l=26, weight_g=1459, dims_cm=dict(h=48.2, w=29.2, d=20.3),
    as_written=dict(weight='3lbs 3.5oz (1459g)', dims='11.5"W x 8"D x 19"H (29.2W x 20.3D x 48.2H cm)'),
    laptop=dict(max_in=16, type='padded, suspended pocket'), opening='Panel-load clamshell',
    price=dict(amount=425, currency='USD', seller='evergoods'), availability='in_stock', release='limited',
    warranty='Lifetime warranty', colourways=[dict(name='Black Magic')],
    _checked=BASE_FIELDS + ['availability', 'opening', 'fabric.lining', 'warranty', 'colourways'])],

 'cpp2': [dict(id='city-pack-pro-2-ultra-24l', name='City Pack Pro 2 Ultra 24L', page='aer-city-pack-pro-2-ultra-24l',
    fabric=dict(shell=['ultra-400x'], shell_as_written='Ultra400X exterior by Challenge Sailcloth',
                lining='Lightweight ripstop nylon interior (bluesign® approved)', other='YKK® waterproof zippers'),
    volume_l=24, weight_g=1166, dims_cm=dict(h=46, w=30.5, d=18),
    as_written=dict(weight='2.57 lbs (the page gives no grams; 1166 g is our conversion)', dims='Height: 18" (46 cm), Width: 12" (30.5 cm), Depth: 7" (18 cm)'),
    laptop=dict(max_in=16, type='padded, suspended pocket'), opening='Lay-flat clamshell',
    price=dict(amount=269, currency='USD', seller='aer'), availability='sold_out', release='regular',
    colourways=[dict(name='Ultra')],
    _checked=BASE_FIELDS + ['availability', 'fabric.lining', 'colourways'])],

 'tp4': [dict(id='travel-pack-4-ultra-28l', name='Travel Pack 4 Ultra 28L', page='aer-travel-pack-4-ultra-28l',
    fabric=dict(shell=['ultra-400x'], shell_as_written='Ultra400X exterior by Challenge Sailcloth',
                lining='Nylon ripstop interior liner (bluesign® approved)', other='YKK® zippers (lockable)'),
    volume_l=28, weight_g=1488, dims_cm=dict(h=49, w=32, d=20),
    as_written=dict(weight='3.28 lbs (the page gives no grams; 1488 g is our conversion)', dims='Height 19.25" (49 cm), Width 12.75" (32 cm), Depth 8" (20 cm)'),
    laptop=dict(max_in=16), opening='Full clamshell + 3 compartments',
    price=dict(amount=289, currency='USD', seller='aer'), availability='sold_out', release='regular',
    colourways=[dict(name='Ultra')],
    _checked=BASE_FIELDS + ['availability', 'fabric.lining', 'colourways'])],

 'cicada': [
   dict(id='ultra-cicada', name='ULTRA Cicada', page='ula-ultra-cicada',
    fabric=dict(shell=['ultra-400tx'], shell_as_written='ULTRA 400TX', lining='210D Liner', other='UltraStretch Mesh, YKK Aquaguard zippers'),
    **ULA_CICADA, opening='Front-loading hybrid',
    price=dict(amount=349.99, currency='USD', seller='ula-equipment'), availability='sold_out', release='regular',
    colourways=[dict(name='Black Beauty')],
    _checked=BASE_FIELDS + ['availability', 'fabric.lining', 'colourways']),
   dict(id='ultra-cicada-ewp', name='ULTRA Cicada EWP', page='ula-ultra-cicada-ewp',
    fabric=dict(shell=['ultra-400tx'], shell_as_written='ULTRA 400TX', lining='210D liner (Silverado UltraGrid)', lining_material='ultragrid',
                other='UltraStretch mesh, YKK Aquaguard zippers; two external angled UltraStretch mesh bottle pockets'),
    **ULA_CICADA, opening='Front-loading hybrid',
    price=dict(amount=349.99, currency='USD', seller='ula-equipment'), availability='in_stock', release='regular',
    colourways=[dict(name='ULTRA 400TX Black Magic')],
    _checked=BASE_FIELDS + ['fabric.lining', 'colourways']),
   dict(id='ultra-muse-cicada-ewp', name='ULTRA Muse Cicada EWP', page='ula-ultra-muse-cicada',
    fabric=dict(shell=['ultra-400tx'], shell_as_written='ULTRA 400TX', lining='210D UltraGrid', lining_material='ultragrid',
                other='CORDURA TrueLock, UltraStretch Mesh, standard YKK zippers'),
    **ULA_CICADA, opening='Front-loading hybrid',
    price=dict(amount=349.99, currency='USD', seller='ula-equipment'), availability='in_stock', release='regular',
    colourways=[dict(name='Black Beauty + Coyote')],
    _checked=BASE_FIELDS + ['fabric.lining', 'colourways']),
 ],

 'dfly': [
   dict(id='30l-patchless-ultra-dragonfly', name='30L Patchless Ultra Dragonfly', page='ula-ultra-30l-patchless-dragonfly',
    fabric=dict(shell=['ultra-400tx', 'ultra-800tx'], shell_as_written='Challenge ULTRA™, ULTRA TX, UltraStretch™', other='UltraStretch mesh front and side pockets'),
    **ULA_DFLY, weight_g=777, as_written=dict(weight='27.4 oz | 777 g', dims='18.5" x 11" x 7" (main body)', volume='1,857 cu in | 30 L'),
    opening='Front-loading', price=dict(amount=289.99, currency='USD', seller='ula-equipment'), availability='unknown', release='regular',
    colourways=[dict(name='ULTRA 400TX Black Magic', shell='ultra-400tx'), dict(name='ULTRA 400TX White Lightning', shell='ultra-400tx'),
                dict(name='ULTRA 800TX White Lightning', shell='ultra-800tx')],
    _checked=BASE_FIELDS + ['colourways']),
   dict(id='30l-ultra-dragonfly', name='30L Ultra Dragonfly', page='ula-ultra-dragonfly',
    fabric=dict(shell=['ultra-400x', 'ultra-400tx', 'ultra-800tx', 'ultra-800'], shell_as_written='Challenge ULTRA and ULTRA TX, UltraStretch mesh',
                other='Velcro/removable 2" x 3" logo patch'),
    **ULA_DFLY, weight_g=777, as_written=dict(weight='27.4 oz (777 g)', dims='18.5" x 11" x 7" (main body)', volume='1,857 cu in (30 L)'),
    opening='Front-loading', price=dict(amount=289.99, currency='USD', seller='ula-equipment'), availability='unknown', release='regular',
    colourways=[dict(name='400X Black', shell='ultra-400x'), dict(name='ULTRA 400TX Black Magic', shell='ultra-400tx'),
                dict(name='ULTRA 400TX White Lightning', shell='ultra-400tx'), dict(name='ULTRA 800TX Black Magic', shell='ultra-800tx'),
                dict(name='ULTRA 800TX White Lightning', shell='ultra-800tx'), dict(name='ULTRA 800 Black Magic', shell='ultra-800'),
                dict(name='ULTRA 800 White Lightning', shell='ultra-800')],
    _checked=BASE_FIELDS + ['colourways']),
   dict(id='30l-dragonfly-pass-thru', name='30L Dragonfly Pass Thru', page='ula-30l-dragonfly-pass-thru',
    fabric=dict(shell=['ultra-tx'], shell_as_written='Challenge ULTRA™ TX', other='UltraStretch™ mesh; luggage pass-through sleeve'),
    **ULA_DFLY, weight_g=880, as_written=dict(weight='31 OZ | 880 GM', dims='18.5" x 11" x 7" (main body)', volume='1,857 CU IN | 30 L'),
    opening='Front-loading', price=dict(amount=319.99, currency='USD', seller='ula-equipment'), availability='unknown', release='regular',
    colourways=[dict(name='Black Magic')],
    _checked=BASE_FIELDS + ['colourways']),
 ],

 'ct15l': [ct('ct15-lite-ultra200x', 'CT15 Lite - ULTRA200X', 'ctactical-ct15-lite-ultra200x', 'ultra-200x', CT_LINING_SMOKE,
              22, 1180, '1.18 kg / 2.6 lbs', (29, 16), '47.5 x 29 x 16cm/18.7 x 11.4 x 6.3in', 15, 215)],
 'ct21l': [ct('ct21-lite-ultra200x', 'CT21 Lite - ULTRA200X', 'ctactical-ct21-lite-ultra200x', 'ultra-200x', CT_LINING_SMOKE,
              27, 1150, '1150 g (2.54 lb)', (34, 18.5), '47.5 x 34 x 18.5 cm (18.7 x 13.4 x 7.3 in)', 16, 225),
           ct('ct21-lite-ultra400x', 'CT21 Lite - ULTRA400X', 'ctactical-ct21-lite-ultra400x', 'ultra-400x', CT_LINING_WAVE,
              27, 1190, '1190 g (2.62 lb)', (34, 18.5), '47.5 x 34 x 18.5 cm (18.7 x 13.4 x 7.3 in)', 16, 220)],
 'ct15p': [ct('ct15-plus-ultra200x', 'CT15 Plus - ULTRA200X', 'ctactical-ct15-plus-ultra200x', 'ultra-200x', CT_LINING_SMOKE,
              28, 1440, '1.44 kg / 3.17 lbs', (29, 20.5), '47.5 x 29 x 20.5cm / 18.7 x 11.4 x 8in', 15, 235)],
 'ct21p': [ct('ct21-plus-ultra400x', 'CT21 Plus - ULTRA400X', 'ctactical-ct21-plus-ultra400x', 'ultra-400x', CT_LINING_WAVE,
              33, 1440, '1440 g (3.17 lb)', (34, 21.5), '47.5 x 34 x 21.5 cm (18.7 x 13.4 x 8.4 in)', 16, 240),
           ct('ct21-plus-ultra200x', 'CT21 Plus - ULTRA200X', 'ctactical-ct21-plus-ultra200x', 'ultra-200x', CT_LINING_SMOKE,
              33, 1390, '1390 g (3.06 lb)', (34, 21.5), '47.5 x 34 x 21.5 cm (18.7 x 13.4 x 8.4 in)', 16, 245)],

 'edx': [dict(id='matador-x-carryology-edx-ultra-backpack', name='Matador® x Carryology EDX Ultra™ Backpack', page='matador-x-carryology-edx-ultra-backpack',
    fabric=dict(shell=['ultra-200tx'], shell_as_written='Challenge® Ultra 200TX UHMWPE composite laminate',
                other='Toray Ultrasuede®, nylon monomesh, EVA foam, HydraGuard™ seam binding, Number 5 YKK® PU coated sealing zippers'),
    volume_l=22, weight_g=520, dims_cm=dict(h=45, w=27, d=20),
    as_written=dict(weight='18oz (520g)', dims='7.8 x 10.8 x 17.9in (20 x 27 x 45cm)', volume='22 liters'),
    laptop=dict(max_in=16, type='magnetic sleeve'), opening='Panel-load, packable',
    price=dict(amount=260, currency='USD', seller='matador'), availability='sold_out', release='limited',
    warranty='3-year warranty; repair only, with store credit if repair is not feasible',
    _checked=BASE_FIELDS + ['availability', 'warranty'])],

 'slite': [dict(id='superlite-backpack', name='Superlite Backpack', page='tortuga-superlite-backpack',
    fabric=dict(shell=['ultra-200tx'], shell_as_written='ULTRA 200TX, made of UHMWPE and high-tenacity polyester', other='YKK zippers, Woojin buckles'),
    volume_l=34, weight_g=1000, dims_cm=dict(h=53, w=32, d=20),
    as_written=dict(weight='2.2 lbs (1.0 kg)', dims='21 x 12.5 x 8 in (53 x 32 x 20 cm)'),
    laptop=dict(max_in=16), opening='Suitcase-style clamshell',
    price=dict(amount=325, currency='USD', seller='tortuga'), availability='not_released', release='pre-launch',
    _checked=BASE_FIELDS + ['availability', 'release'])],

 'wlh30': [dict(id='weigh-lighter-hugger-backpack-30l-weigh-darker', name='Weigh Lighter Hugger Backpack 30L Weigh Darker',
    page='db-weigh-lighter-hugger-30l-weigh-darker',
    fabric=dict(shell=['aluula-graflyte'], shell_as_written='Main: 100% Polyethylene (ALUULA Graflyte™)', lining='93.7% Polyamide, 6.3% Polyester'),
    volume_l=30, weight_g=520, dims_cm=dict(h=cm(20.47), w=cm(12.2), d=cm(8.86)),
    as_written=dict(weight='1.15 lbs in the specifications; 520g in the description', dims='20.47 x 12.2 x 8.86 in (H x W x D)'),
    laptop=dict(max_in=16, type='padded compartment'), opening='Full clamshell',
    price=dict(amount=399, currency='USD', seller='db-journey'), availability='sold_out', release='limited', made_in='Vietnam',
    colourways=[dict(name='Weigh Darker'), dict(name='Monochrome', page='db-weigh-lighter-hugger-30l-monochrome')],
    _checked=BASE_FIELDS + ['availability', 'fabric.lining', 'made_in', 'colourways'])],
}

MODELS = {
 'ctb26': dict(id='evergoods-civic-travel-bag-26l', brand='evergoods', label='CIVIC Travel Bag 26L', family='CIVIC Travel Bag'),
 'cpp2': dict(id='aer-city-pack-pro-2-24l', brand='aer', label='City Pack Pro 2 24L', family='City Pack Pro 2'),
 'tp4': dict(id='aer-travel-pack-4-28l', brand='aer', label='Travel Pack 4 28L', family='Travel Pack 4'),
 'cicada': dict(id='ula-cicada-22l', brand='ula-equipment', label='Cicada 22L', family='Cicada'),
 'dfly': dict(id='ula-dragonfly-30l', brand='ula-equipment', label='Dragonfly 30L', family='Dragonfly'),
 'ct15l': dict(id='ctactical-ct15-lite', brand='ctactical', label='CT15 Lite', family='CT15'),
 'ct21l': dict(id='ctactical-ct21-lite', brand='ctactical', label='CT21 Lite', family='CT21'),
 'ct15p': dict(id='ctactical-ct15-plus', brand='ctactical', label='CT15 Plus', family='CT15'),
 'ct21p': dict(id='ctactical-ct21-plus', brand='ctactical', label='CT21 Plus', family='CT21'),
 'edx': dict(id='matador-edx', brand='matador', collab='carryology', label='EDX', family='EDX'),
 'slite': dict(id='tortuga-superlite-backpack', brand='tortuga', label='Superlite Backpack 34L', family='Superlite'),
 'wlh30': dict(id='db-weigh-lighter-hugger-30l', brand='db-journey', label='Weigh Lighter Hugger 30L', family='Hugger'),
}
CLASS = dict(st='structured', ul='ultralight', pk='packable')
SIBLINGS = {'edx': 'Earlier EDX runs (prior generation)', 'wlh30': 'Standard Hugger Backpack 30L'}

# ---------------------------------------------------------------- claims
OWN_TOKENS = {'ctb26': ['CTB26', 'Evergoods'], 'cpp2': ['City Pack Pro'], 'tp4': ['Travel Pack 4', 'TP4'], 'cicada': ['Cicada'],
              'dfly': ['Dragonfly'], 'ct15l': ['CT15 Lite'], 'ct21l': ['CT21 Lite'], 'ct15p': ['CT15 Plus'], 'ct21p': ['CT21 Plus'],
              'edx': ['EDX'], 'slite': ['Superlite'], 'wlh30': ['Hugger']}
OUTSIDERS = ['Able Carry', 'Tom Bihn', 'GoRuck']
RE_LIST = re.compile(r'on the sheet|on the page|\bhere\b|^Cheapest|^Lightest|^Biggest|^Lighter than the \d|Joint-lightest|per dollar')
RE_STATE = re.compile(r'sold out|sold-out|out of stock|in stock|\$\d', re.I)
RE_GENERAL = re.compile(r'warranty|sold out|sold-out|out of stock|\$\d|Ships from|release|colorway|Quantities|secondhand|review coverage|hands-on reviews|pre-release|only — no|only;', re.I)
RE_MATERIAL = re.compile(r'Ultra|200X|400X|400TX|Graflyte|ALUULA|fabric|shell|Waterproof|[Ww]ater resistance|rain|Crinkly|\bg\b|\bkg\b|[Ww]eight|grams|[Ll]ight|heav|Monomesh|Cordura|EcoPak|UltraGrid', re.I)


def classify(bag_id, text):
    if 'extrapolated' in text:
        basis = 'sibling'
    elif re.search(r'\bowners?\b', text, re.I):
        basis = 'owner-reports'
    elif re.search(r'review|tester|testing|soak tests|Treeline|Carryology|Pack Hacker|T3’s|rated', text, re.I):
        basis = 'review'
    else:
        basis = 'unstated'
    scope = 'general' if RE_GENERAL.search(text) else ('material' if RE_MATERIAL.search(text) else 'design')
    flags = []
    others = [t for k, toks in OWN_TOKENS.items() if k != bag_id for t in toks] + OUTSIDERS
    if any(t in text for t in others):
        flags.append('names-other-bag')
    if RE_LIST.search(text):
        flags.append('list-comparison')
    if RE_STATE.search(text):
        flags.append('state-in-prose')
    return scope, basis, flags


# Claims whose content was seen on the maker's own page on 13 Nov 2026.
P = 'ctactical-'
CLAIM_OVERRIDES = {
    'ctb26-pro-5': ['evergoods-civic-travel-bag-ultra'],
    'ct15l-pro-2': [P + 'ct15-lite-ultra200x'],
    'ct15p-pro-3': [P + 'ct15-plus-ultra200x'],
    'ct21l-pro-2': [P + 'ct21-lite-ultra200x', P + 'ct21-lite-ultra400x'],
    'ct21p-pro-2': [P + 'ct21-plus-ultra400x', P + 'ct21-plus-ultra200x'],
    'cicada-pro-1': ['ula-ultra-cicada', 'ula-ultra-cicada-ewp', 'ula-ultra-muse-cicada'],
    'slite-pro-4': ['tortuga-superlite-backpack'],
    'wlh30-pro-1': ['db-weigh-lighter-hugger-30l-weigh-darker'],
    'wlh30-pro-2': ['db-weigh-lighter-hugger-30l-weigh-darker'],
    'edx-con-4': ['matador-x-carryology-edx-ultra-backpack'],
}


def build_bag(b):
    m = MODELS[b['id']]
    model = dict(id=m['id'], legacy_id=b['id'], brand=m['brand'])
    if 'collab' in m:
        model['collab'] = m['collab']
    model.update(label=m['label'], family=m['family'], category='backpack', use=['edc', 'travel'], build_class=CLASS[b['cls']])
    model['drawings'] = [dict(file=f"drawings/{b['id']}/sketch/{b['id']}-sketch-{v}.svg", kind='drawing',
                              view={'iso': 'three-quarter'}.get(v, v), shows_variant=None,
                              credit='Carry Journal', permission='own') for v in ('front', 'iso', 'back', 'side')]
    variants = []
    for i, v in enumerate(VARIANTS[b['id']]):
        v = copy.deepcopy(v)
        checked = v.pop('_checked')
        v.setdefault('opening', b['open'])  # from the old page; unchecked unless listed in _checked
        if i == 0:
            v['media'] = [dict(file=b['img'], kind='photo', view='unknown', shows_variant=None, credit=b['credit'],
                               source=b['src'], permission='none')]
        v['checks'] = [dict(date=TODAY, source=v['page'], basis='page', method=METHOD, fields=checked)]
        variants.append(v)
    claims = []
    for kind, key in (('pro', 'pros'), ('con', 'cons')):
        for n, text in enumerate(b[key], 1):
            scope, basis, flags = classify(b['id'], text)
            c = dict(id=f"{b['id']}-{kind}-{n}", kind=kind, text=text, scope=scope, basis=basis, sources=[], observed_on=[])
            if c['id'] in CLAIM_OVERRIDES:
                c['basis'] = 'maker'
                c['sources'] = CLAIM_OVERRIDES[c['id']]
            if basis == 'sibling':
                c['sibling_of'] = SIBLINGS[b['id']]
            if flags:
                c['flags'] = flags
            claims.append(c)
    legacy = dict(verdict=b['verdict'], price_note=b['priceNote'], avail=b['avail'], origin=b['origin'],
                  laptop=b['laptop'], fabric=b['fabric'], opening=b['open'], brand=b['brand'], src=b['src'])
    if 'gVar' in b:
        legacy['gVar'] = b['gVar']
    return dict(
        migration=dict(source='Ultra Carry Index page, Rev AE (v20)', migrated=TODAY,
                       claims='scope, basis and flags were assigned by rule from the wording; they need a read-through',
                       photos='only the card photo is carried over; other photos and the footer\'s edit notes are not migrated yet'),
        model=model, variants=variants, claims=claims, legacy=legacy)


def main():
    dump(os.path.join(DATA, 'brands.yaml'), BRANDS,
         'Makers. country comes from the old page\'s "origin" field and has not been checked.\nimage_permission terms and contacts are from the 10 Nov 2026 handoff.')
    dump(os.path.join(DATA, 'sources.yaml'), SOURCES,
         'One entry per page. last_ok is the last date the page opened; null means it has not been opened.\narchived is for a link checker to fill.')
    dump(os.path.join(DATA, 'materials.yaml'), MATERIALS,
         'Fabrics. name should be as the fabric\'s maker writes it; none of these has been checked on the fabric maker\'s own page yet (checks: []).')
    dump(os.path.join(DATA, 'sections', 'uhmwpe-backpacks.yaml'), SECTION, 'One listing page.')
    for b in BAGS:
        m = MODELS[b['id']]
        path = os.path.join(DATA, 'bags', m['brand'], m['id'] + '.yaml')
        dump(path, build_bag(b))
    print('wrote', len(BAGS), 'bag files')


if __name__ == '__main__':
    main()
