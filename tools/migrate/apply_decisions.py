#!/usr/bin/env python3
"""Apply Anish's rulings of 13 Nov 2026 to the data. Run last, after merge_proposals.py.

    python3 tools/migrate/apply_decisions.py

What it does, by ruling:
 1  A review list and a plain sourcing line per model. The three "no review found" notes go.
 2  Points reported on another build stay, labelled with the build, each waiting on a call.
 3  Other builds of the same bag are added as comparison records, so build-to-build
    weight differences are computed.
 4  Maker statements move from pros and cons to a features list. Lines that restate a data field go.
 5  Five lines dropped.
 6  Two cons become pros; the CT21 Lite ID panel becomes a feature.
 7  Summary lines show both ends (tools/summary_lines.py).
 8  ULTRA 800TX and ULTRA 800 stay in. Axodyne is on file, held.
 +  Stock and availability are removed. Each build gets a link out.
"""
import copy, glob, os
import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'data')
TODAY = '2026-11-13'
WF = 'Page opened and read by Claude through WebFetch on 13 Nov 2026; not yet spot-checked by Anish'
FC = 'Opened by Claude through Firecrawl on 13 Nov 2026'


def load(p):
    return yaml.safe_load(open(p, encoding='utf-8'))


def dump(p, obj, header=''):
    with open(p, 'w', encoding='utf-8') as f:
        if header:
            f.write(''.join('# ' + l + '\n' for l in header.strip().split('\n')))
        yaml.safe_dump(obj, f, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=False)


# ------------------------------------------------------------------ sources
NEW_SOURCES = {
    # Anish's own bags: a check with basis 'own' points here. No URL, because there is no page.
    'anish-own-bag': dict(kind='own', publisher='Anish', title='My own bag'),
    'ula-x50-cicada': dict(url='https://www.ula-equipment.com/product/x50-cicada/', kind='maker-page', publisher='ULA Equipment',
                           title='X50 Cicada', archived=None, last_ok=TODAY, opened_by='Claude, WebFetch'),
    'ula-x-pac-dragonfly': dict(url='https://www.ula-equipment.com/product/xpac-dragonfly/', kind='maker-page', publisher='ULA Equipment',
                                title='ULA X-Pac Dragonfly', archived=None, last_ok=TODAY, opened_by='Claude, WebFetch'),
    'db-hugger-backpack-30l-oatmilk': dict(url='https://dbjourney.com/en-ca/products/hugger-backpack-30l-oatmilk', kind='maker-page', publisher='Db Journey',
                                           title='Hugger Backpack 30L Oatmilk', archived=None, last_ok=TODAY, opened_by='Claude, WebFetch'),
    'alpaka-kickstarter-momentum-collection': dict(
        url='https://www.kickstarter.com/projects/alpaka/momentum-collection-light-on-weight-heavy-on-durability', kind='maker-other',
        publisher='ALPAKA', title='Momentum Collection Kickstarter campaign', archived=None, last_ok=TODAY, opened_by='Claude, Firecrawl'),
    'alpaka-video-what-is-axodyne': dict(url='https://www.youtube.com/watch?v=tqMaQdpKa6s', kind='video', publisher='ALPAKA',
                                         title='What is Axodyne?', published='2026-01-05', archived=None, last_ok=TODAY,
                                         opened_by='Claude, Firecrawl (transcript)'),
    'alpaka-video-momentum-collection-deep-dive': dict(url='https://www.youtube.com/watch?v=JU0IFOcYZyw', kind='video', publisher='ALPAKA',
                                                       title='Momentum Collection Deep Dive', published='2025-12-15', archived=None, last_ok=TODAY,
                                                       opened_by='Claude, Firecrawl (transcript)'),
    'alpaka-video-momentum-kickstarter': dict(url='https://www.youtube.com/watch?v=U_Wa0feAXNY', kind='video', publisher='ALPAKA',
                                              title='Momentum Collection Kickstarter video', archived=None, last_ok=TODAY,
                                              opened_by='Claude, Firecrawl (transcript)'),
    'alpaka-video-white-axodyne-deep-dive': dict(url='https://www.youtube.com/watch?v=7zRiEPeOJMU', kind='video', publisher='ALPAKA',
                                                 title='Momentum Collection in White Axodyne Deep Dive', published='2026-10-23', archived=None,
                                                 last_ok=TODAY, opened_by='Claude, Firecrawl (transcript)'),
}

# ------------------------------------------------------------------ materials
NOT_UHMWPE = dict(uhmwpe_role='none', uhmwpe_content=dict(published=False, statement='Not sold as a UHMWPE fabric.'),
                  in_uhmwpe_section=dict(decision='not-applicable',
                                         reasons='Not a UHMWPE fabric. On file only so builds of the same bag can be compared.'))
NEW_MATERIALS = {
    'cordura-1680d-ballistic-nylon': dict(name='1680D CORDURA ballistic nylon', maker='CORDURA brand; mill not stated', family='nylon', **NOT_UHMWPE,
                                          note='Name as on Aer\'s pages.'),
    'nylon-420d-high-tenacity': dict(name='420d High Tenacity Nylon', maker='Not stated', family='nylon', **NOT_UHMWPE,
                                     note='Name as on Evergoods\' page, which gives Nylon 6,6 for most colours and Nylon 6 for Solution Dyed Black.'),
    'x-pac-x50': dict(name='X-Pac X50', maker='Dimension-Polyant', family='X-Pac', **NOT_UHMWPE, note='Name as on ULA\'s X50 Cicada page.'),
    'x-pac-grade-not-stated': dict(name='X-Pac', maker='Dimension-Polyant', family='X-Pac', **NOT_UHMWPE,
                                   note='ULA\'s X-Pac Dragonfly page lists "X-Pac, UltraStretch" without a grade.'),
    'polyester-recycled': dict(name='100% Polyester (recycled)', maker='Not stated', family='polyester', **NOT_UHMWPE,
                               note='As Db lists the main material of the standard Hugger Backpack 30L.'),
}
AXODYNE = dict(
    name='Axodyne', maker='ALPAKA (its own name for the fabric; mill not stated)', family='Axodyne', fibre='UHMWPE',
    construction='ALPAKA\'s Kickstarter campaign: UHMWPE fibres laid at 0° and 90°, a nylon reinforcing mesh and a TPU film layer. '
                 'Its "What is Axodyne?" video: two layers, UHMWPE fibres on top as a reinforcing mesh, not a woven fabric, with a TPU coat on the back.',
    uhmwpe_role='fibre-layer',
    uhmwpe_content=dict(published=False, statement='Role as ALPAKA\'s Kickstarter campaign describes it; its video calls the same layer a reinforcing mesh. No percentage, weight or denier in the campaign or in any of the four ALPAKA videos opened.',
                        source='https://www.kickstarter.com/projects/alpaka/momentum-collection-light-on-weight-heavy-on-durability'),
    in_uhmwpe_section=dict(
        decision='in', decided=TODAY,
        reasons='Anish\'s call, 13 Nov 2026, after reading what ALPAKA\'s campaign and videos say. His reasons, given earlier that day: ALPAKA launched it as a step up '
                'from its Axoflux fabric and promoted the UHMWPE content, strength, tear resistance and waterproofing; and the Momentum Collection bags, which he owns, '
                'are lighter and have the technical look and feel that sets UHMWPE bags apart from nylon ones. The share of UHMWPE is not published. No Axodyne bag is in the data yet.',
        draft=dict(
            alpaka_campaign_and_videos=[
                dict(source='alpaka-kickstarter-momentum-collection',
                     says='A multi-layer build: UHMWPE fibres laid at 0° and 90°, a nylon reinforcing mesh that gives the grid texture, and a TPU film. '
                          'Claims it is lighter than nylon and far stronger, and likens the fibre to the one in Dyneema and Ultra. '
                          'No percentage, weight or denier. Axoflux is not mentioned. No country of manufacture.'),
                dict(source='alpaka-video-what-is-axodyne',
                     says='Two layers: UHMWPE fibres on top, described as a reinforcing mesh and not a woven fabric (which is why contents show through), '
                          'with a TPU coat on the back. Mentions 210D and 600D fabric in passing and contrasts Axodyne with ordinary nylon and polyester. No percentage.'),
                dict(source='alpaka-video-momentum-kickstarter', says='Calls it a single layer composite. Waterproof, abrasion-resistant and light; no construction detail.'),
                dict(source='alpaka-video-momentum-collection-deep-dive', says='Waterproof, abrasion-resistant and light; no construction detail.'),
                dict(source='alpaka-video-white-axodyne-deep-dive', says='Adds nothing on the fabric.'),
            ],
            reading='By ALPAKA\'s account the UHMWPE is a laid grid of fibres inside a laminate with no woven nylon face. That is not the '
                    'gridstop case the disqualifier describes (UHMWPE threads in an ordinary nylon weave), but ALPAKA itself calls the fibre layer a mesh. '
                    'Anish ruled it in on 13 Nov 2026.',
            open_points=['UHMWPE share: not published anywhere found.',
                         'No ALPAKA material found comparing Axodyne with Axoflux, though Anish recalls the launch doing so.',
                         'Anish owns Momentum Collection bags; his handling notes are not recorded yet.'],
            status='decision made: in; the wording of the reason shown on the page is still to write', drafted=TODAY)),
    checks=[dict(date=TODAY, source='alpaka-kickstarter-momentum-collection', basis='page', method=FC, fields=['uhmwpe_content']),
            dict(date=TODAY, source='alpaka-video-what-is-axodyne', basis='page', method=FC + '; transcript, not the video itself',
                 fields=['uhmwpe_content'])])
FABRIC_RULINGS = {
    'ultra-800tx': 'Stays in (Anish, 13 Nov 2026).',
    'ultra-800': 'Stays in (Anish, 13 Nov 2026).',
}

# ------------------------------------------------------------------ comparison builds
LB = 453.59237


def chk(source, fields, method=WF, note=None):
    c = dict(date=TODAY, source=source, basis='page', method=method, fields=fields)
    if note:
        c['note'] = note
    return c


SIBLINGS = {
    'aer-city-pack-pro-2-24l': [dict(
        id='city-pack-pro-2-24l', name='City Pack Pro 2 24L', record='comparison', page='aer-city-pack-pro-2-24l',
        fabric=dict(shell=['cordura-1680d-ballistic-nylon'], shell_as_written='1680D CORDURA ballistic nylon'),
        volume_l=24, weight_g=round(2.86 * LB), dims_cm=dict(h=46, w=30.5, d=18),
        as_written=dict(weight='2.86 lbs (the page gives no grams; 1297 g is our conversion)'),
        price=dict(amount=219, currency='USD', seller='aer'),
        checks=[chk('aer-city-pack-pro-2-24l', ['name', 'price', 'volume_l', 'weight_g', 'dims_cm', 'fabric.shell'])])],
    'aer-travel-pack-4-28l': [dict(
        id='travel-pack-4-28l', name='Travel Pack 4 28L', record='comparison', page='aer-travel-pack-4-28l',
        fabric=dict(shell=['cordura-1680d-ballistic-nylon'], shell_as_written='1680D CORDURA ballistic nylon'),
        volume_l=28, weight_g=round(3.52 * LB), dims_cm=dict(h=49, w=32, d=20),
        as_written=dict(weight='3.52 lbs (the page gives no grams; 1597 g is our conversion)'),
        price=dict(amount=239, currency='USD', seller='aer'),
        checks=[chk('aer-travel-pack-4-28l', ['name', 'price', 'volume_l', 'weight_g', 'dims_cm', 'fabric.shell'])],
        notes=dict(other_builds='Aer also sells a 28L X-Pac VX-42 build; its figures have not been read from Aer\'s page, so it is not on file.'))],
    'evergoods-civic-travel-bag-26l': [dict(
        id='civic-travel-bag-26l', name='CIVIC Travel Bag', record='comparison', page='evergoods-civic-travel-bag-26l',
        fabric=dict(shell=['nylon-420d-high-tenacity'], shell_as_written='420d High Tenacity Nylon'),
        volume_l=26, weight_g=1587, dims_cm=dict(h=48.2, w=29.2, d=20.3),
        as_written=dict(weight='3lbs 8oz | 1587g', dims='11.5 in W × 8 in D × 19 in H (29.2 × 20.3 × 48.2 cm)'),
        laptop=dict(max_in=16, type='padded, suspended pocket'),
        checks=[chk('evergoods-civic-travel-bag-26l', ['name', 'volume_l', 'weight_g', 'dims_cm', 'laptop', 'fabric.shell'],
                    note='26L is a size option on a listing shared with other sizes')],
        notes=dict(name='The listing is "CIVIC Travel Bag"; 26L is a size option on it.',
                   price='Not recorded. The page showed $270.00 with the 20L selected; the 26L price was not captured.'))],
    'ula-cicada-22l': [dict(
        id='x50-cicada', name='X50 Cicada', record='comparison', page='ula-x50-cicada',
        fabric=dict(shell=['x-pac-x50'], shell_as_written='X-Pac X50'),
        volume_l=22, weight_g=870.3, dims_cm=dict(h=45.7, w=27.9, d=12.7),
        as_written=dict(weight='30.7 OZ | 870.3 GM', dims='18″ × 11″ × 5″'),
        price=dict(amount=319.99, currency='USD', seller='ula-equipment'),
        checks=[chk('ula-x50-cicada', ['name', 'price', 'volume_l', 'weight_g', 'dims_cm', 'fabric.shell'])])],
    'ula-dragonfly-30l': [dict(
        id='x-pac-dragonfly', name='ULA X-Pac Dragonfly', record='comparison', page='ula-x-pac-dragonfly',
        fabric=dict(shell=['x-pac-grade-not-stated'], shell_as_written='X-Pac, UltraStretch'),
        volume_l=30, weight_g=799, dims_cm=dict(h=47, w=27.9, d=17.8),
        as_written=dict(weight='28 OZ | 799 GM (another part of the page says 800 g)', dims='Main body 18.5″ × 11″ × 7″', volume='1,857 cu in | 30 L'),
        made_in='USA',
        checks=[chk('ula-x-pac-dragonfly', ['name', 'volume_l', 'weight_g', 'dims_cm', 'fabric.shell', 'made_in'])],
        notes=dict(price='Not recorded. The page text read on 13 Nov 2026 gave no price.',
                   name='One reading of the page gave the title with "(30L)" after it.'))],
    'db-weigh-lighter-hugger-30l': [dict(
        id='hugger-backpack-30l-oatmilk', name='Hugger Backpack 30L Oatmilk', record='comparison', page='db-hugger-backpack-30l-oatmilk',
        fabric=dict(shell=['polyester-recycled'], shell_as_written='100% Polyester (recycled)', lining='100% Polyester (recycled)'),
        volume_l=30, weight_g=1230, dims_cm=dict(h=52, w=31, d=22.5),
        as_written=dict(weight='1.23 kg', dims='52 x 31 x 22.5 cm (H x W x D)'),
        made_in='Vietnam',
        checks=[chk('db-hugger-backpack-30l-oatmilk', ['name', 'volume_l', 'weight_g', 'dims_cm', 'fabric.shell', 'fabric.lining', 'made_in'],
                    note='Db\'s Canadian store page; one colourway of the standard Hugger Backpack 30L')],
        notes=dict(price='Not recorded. The Canadian page showed $260 without naming the currency.'))],
}
SELLER_FIX = {}  # filled from the first variant's seller when a sibling has a price

# ------------------------------------------------------------------ claim rulings
DUP = {  # restates a data field (ruling 4)
    'ct15l-pro-2': 'fabric.lining and fabric.base', 'ct15l-con-1': 'the list of builds', 'ct15l-con-2': 'laptop',
    'ct21l-pro-2': 'weight_g of the two builds', 'ct15p-pro-3': 'fabric.lining and fabric.base', 'ct15p-con-2': 'laptop',
    'ct15p-con-3': 'the list of builds', 'ct21p-pro-2': 'the list of builds', 'edx-con-4': 'warranty',
    'ctb26-pro-4-b': 'fabric.lining', 'ctb26-pro-5': 'warranty', 'cicada-pro-1': 'fabric.shell and weight_g',
}
DROP5 = {'cicada-pro-4-b', 'ct15p-con-1', 'edx-pro-2', 'slite-pro-4', 'wlh30-con-3'}  # ruling 5
SITE_NOTES = {'ct15l-con-3', 'wlh30-con-1', 'slite-con-4-b'}  # ruling 1
RENAME = {'cicada-con-1-b': 'cicada-pro-6', 'slite-con-1': 'slite-pro-5'}  # ruling 6
COMPUTE_STATE = {
    'cpp2-pro-4': 'Built. Weight against the 1680D CORDURA build, from the two records (tools/summary_lines.py).',
    'tp4-pro-1': 'Built. Weight against the 1680D CORDURA build, from the two records. The X-Pac VX-42 build is not on file, so "lightest 28 L option" is not claimed.',
    'ct15l-pro-1': 'Built. "Lowest price" standout in tools/summary_lines.py, shown only while true.',
    'wlh30-pro-1': 'Built. "Lightest" standout in tools/summary_lines.py, shown only while true.',
    'edx-pro-1': 'Built. "Lightest" standout in tools/summary_lines.py, shown only while true.',
    'wlh30-pro-2': 'Built. "Only build listed in a fabric from ..." standout in tools/summary_lines.py.',
    'tp4-con-3': 'Built. Airline fit per build in tools/airline_fit.py. The counts are in reports/airline-fit.md and on the page\'s airline-fit widget.',
    'ct21p-con-1': 'Built. Airline fit per build in tools/airline_fit.py. The counts are in reports/airline-fit.md and on the page\'s airline-fit widget.',
    'ct21l-pro-1': 'Not built. Needs a volume band to compare within; pick the bands first.',
    'ct21p-pro-3': 'Not built. Needs a volume band to compare within; pick the bands first.',
}
CLOSE = {  # ruling 2: how close the other build is, and Claude's reading. Anish decides each.
    'tp4-pro-2': dict(generation='Same generation (Travel Pack 4)', size='28L for the X-Pac VX-42 review; 35L for the two Cordura reviews',
                      fabric='X-Pac VX-42 and 1680D Cordura', suggestion='likely',
                      why='Pocket layout is design, not fabric, and one of the three reviews is of this 28L size.'),
    'tp4-pro-3-b': dict(generation='Same generation (Travel Pack 4)', size='35L, larger than this bag', fabric='1680D Cordura', suggestion='check',
                        why='Aer lists the same harness parts on the 28L Ultra, but the 25 lb test was on the larger bag.'),
    'wlh30-pro-3': dict(generation='Standard Hugger; review pages dated January and December 2024', size='Same, 30L', fabric='Recycled polyester',
                        suggestion='likely', why='Opening and top pocket are layout. Db\'s Weigh Lighter photos would confirm it.'),
    'wlh30-con-2': dict(generation='Standard Hugger; review page dated January 2024', size='Same, 30L', fabric='Recycled polyester', suggestion='check',
                        why='The Weigh Lighter build weighs less than half the standard bag by Db\'s figures, so straps and padding may not be the same parts.'),
    'wlh30-con-2-b': dict(generation='Standard Hugger; review page dated January 2024', size='Same, 30L', fabric='Recycled polyester', suggestion='check',
                          why='Can be confirmed or ruled out from Db\'s Weigh Lighter page and photos.'),
    'ctb26-pro-1': dict(generation='Same generation', size='Same, 26L (the owner names the CTB26)', fabric='420D nylon', suggestion='likely',
                        why='Pocket count is layout, not fabric.'),
    'ctb26-pro-1-b': dict(generation='Same generation', size='Same, 26L (the owner names the CTB26)', fabric='420D nylon', suggestion='likely',
                          why='How pockets share space is layout, not fabric.'),
    'ctb26-pro-2': dict(generation='Same generation', size='Same, 26L (the owners name the CTB26)', fabric='420D nylon', suggestion='likely',
                        why='Bottle pockets are layout; worth confirming they are built the same on the ULTRA version.'),
    'ctb26-pro-3': dict(generation='Same generation', size='Same, 26L (the owner names the CTB26)', fabric='420D nylon', suggestion='check',
                        why='How a bag holds its shape when lifted by a handle can change with the shell fabric.'),
    'ctb26-con-2': dict(generation='Same generation', size='Same, 26L (the owners name the CTB26)', fabric='420D nylon', suggestion='likely',
                        why='About the back panel, not the shell. Worth confirming the ULTRA version uses the same panel.'),
    'dfly-pro-2-b': dict(generation='Earlier build, reviewed in 2022', size='Same, 30L', fabric='X-Pac X50', suggestion='check',
                         why='Side pockets may have changed since 2022. Treeline\'s 2026 review of the Ultra build is cited here for a bottle, not a tripod.'),
    'dfly-con-1-b': dict(generation='Not stated', size='Same, 30L', fabric='Not stated; the review sits under a "30L X-Pac Dragonfly" heading',
                         suggestion='likely', why='Owners of the Ultra and Pass Thru builds say much the same about this pocket (dfly-con-1).'),
    'dfly-con-3-c': dict(generation='Earlier build, reviewed in January 2023', size='Same, 30L', fabric='ULTRA 800, the fabric before 800TX',
                         suggestion='check', why='The closest of the other builds. Can be checked against ULA\'s current page.'),
}
SOURCING = {  # ruling 1: one plain line. The publishers named are checked against the sources the lines cite.
    'aer-city-pack-pro-2-24l': ('Based on Stranded Variable\'s review of this build, plus Aer\'s own pages.', ['Stranded Variable']),
    'aer-travel-pack-4-28l': ('Based on reviews of this build from visionswell and The Modern Xplorer, reviews of other Travel Pack 4 builds from '
                              'Better Trail, Stranded Variable and Pack Hacker, plus Aer\'s own pages.',
                              ['visionswell', 'The Modern Xplorer', 'Better Trail', 'Stranded Variable', 'Pack Hacker']),
    'ctactical-ct15-lite': ('Based on Ctactical\'s own pages, plus an owner review of the CT15 Plus on Ctactical\'s site.', ['Ctactical']),
    'ctactical-ct15-plus': ('Based on an owner review on Ctactical\'s site, plus Ctactical\'s own pages.', ['Ctactical']),
    'ctactical-ct21-lite': ('Based on Ctactical\'s own pages.', []),
    'ctactical-ct21-plus': ('Based on Ctactical\'s own pages.', []),
    'db-weigh-lighter-hugger-30l': ('Based on Db\'s own pages, plus a review of the standard Hugger 30L from Dream Big, Travel Far.',
                                    ['Dream Big, Travel Far']),
    'evergoods-civic-travel-bag-26l': ('Based on owner reviews on Evergoods\' site for both the ULTRA and the 420D nylon builds, my own use, and Evergoods\' own pages.', ['Evergoods']),
    'matador-edx': ('Based on Matador\'s and Carryology\'s own pages, plus my own bag for how it opens.', []),
    'tortuga-superlite-backpack': ('Based on reviews from Pack Hacker and Nomads Nation, plus Tortuga\'s own pages.', ['Pack Hacker', 'Nomads Nation']),
    'ula-cicada-22l': ('Based on owner reviews on ULA\'s site, plus ULA\'s own pages.', ['ULA Equipment']),
    'ula-dragonfly-30l': ('Based on Treeline Review\'s review of the 30L Ultra Dragonfly, owner reviews on ULA\'s site and r/onebag, reviews of earlier builds '
                          'from Pack Hacker and Carryology, plus ULA\'s own pages.', ['Treeline Review', 'ULA Equipment', 'Pack Hacker', 'Carryology']),
}
NEW = 'New on 13 Nov 2026, from the one owner review on Ctactical\'s page for this build (undated, read through WebFetch). Not on the old page.'
JANK = dict(source='ctactical-ct15-plus-ultra200x', about='same build; one owner review on the page, undated')
EXTRA_CLAIMS = {  # owner reviews found while looking at what other builds can tell us (ruling 2)
    'ctactical-ct15-plus': [
        dict(id='ct15p-pro-4', kind='pro', text='Comfortable harness, and the somewhat airy back panel helps in Singapore\'s weather.', voice='owners',
             support='one owner review', scope='design', basis='owner-reports', sources=['ctactical-ct15-plus-ultra200x'],
             observed_on=['ct15-plus-ultra200x'], status='draft', source_notes=[dict(JANK)], wording_note=NEW),
        dict(id='ct15p-pro-5', kind='pro', text='The right bottle pocket fits a 46 oz Yeti; the left one is smaller to make room for the side handle.', voice='owners',
             support='one owner review', scope='design', basis='owner-reports', sources=['ctactical-ct15-plus-ultra200x'],
             observed_on=['ct15-plus-ultra200x'], status='draft', source_notes=[dict(JANK)], wording_note=NEW),
    ],
    'ctactical-ct15-lite': [
        dict(id='ct15l-pro-5', kind='pro', text='Comfortable harness, with a somewhat airy back panel.', voice='owners', support='one owner review',
             scope='design', basis='sibling', sources=['ctactical-ct15-plus-ultra200x'], observed_on=[],
             from_build=dict(label='From an owner review of the CT15 Plus - ULTRA200X', generation='Same generation', size='28 L against this bag\'s 22 L',
                             fabric='Same, ULTRA200X', suggestion='check',
                             why='The closest build there is: same line, same fabric. Whether the two share a harness and back panel is not stated on Ctactical\'s pages.',
                             assigned='pending'),
             status='to-assign', source_notes=[dict(source='ctactical-ct15-plus-ultra200x', about='CT15 Plus - ULTRA200X; one owner review on the page, undated')],
             wording_note='New on 13 Nov 2026. Not on the old page.'),
    ],
}
DROP_REASON = {  # reasons reworded now that stock is not recorded
    'ct21l-con-3': 'Stock only. The card links out instead of recording stock.',
    'cicada-con-4': 'Stock only; the card links out instead. AquaGuard zips are on the EWP too.',
    'slite-con-4': 'Release timing and stock; the card links out instead.',
    'edx-con-3': "Stock; the card links out instead. 'Every run' and 'extremely' are unsupported.",
    'wlh30-con-4': 'No source calls Weigh Darker limited. Stock is not recorded any more, and the Monochrome colourway is in colourways.',
}
DROP5_NOTE = {'wlh30-con-3': ' It came from a 2019 review of an older build.'}

# ------------------------------------------------------------------ Anish's calls, 13 Nov 2026 (asked one by one)
D13 = '2026-11-13'
KEEP = {  # other-build lines he kept, with what a check of the listed build's page found that day
    'tp4-pro-2': 'Aer\'s pages list the same pockets and compartments for the 28L Ultra and the 28L Cordura.',
    'tp4-pro-3-b': 'Aer lists load lifters, a framesheet and hip-belt points on the 28L Ultra too. The 25 lb test was on the 35L.',
    'ct15l-pro-5': 'Ctactical describes the same shoulder padding (PU sponge) and back panel (breathable mesh, EVA foam, ventilation grooves) on both pages.',
    'wlh30-con-2-b': 'Db\'s page for the Weigh Lighter build lists neither a sternum strap nor a bottle pocket.',
    'ctb26-pro-1': 'Evergoods lists the usual CIVIC Travel Bag pocket set on the ULTRA page; it does not say outright that the layout is identical.',
    'ctb26-pro-1-b': 'Evergoods lists the usual CIVIC Travel Bag pocket set on the ULTRA page; it does not say outright that the layout is identical.',
    'ctb26-pro-3': 'Nothing on the ULTRA page covers it. Anish kept it because it matches his own use of the 26L ULTRA.',
    'ctb26-con-2': 'No owner review on the ULTRA page mentions breathability; the page captions a photo "Breathable Back Panel".',
    'dfly-pro-2-b': 'ULA\'s current page says the side pockets fit 64 oz bottles and does not mention tripods.',
    'dfly-con-1-b': 'Owners of the Ultra and Pass Thru builds say the same pocket\'s zipper opening is too tight.',
    'dfly-con-3-c': 'ULA\'s current page lists a padded back panel and names no frame sheet, frame or stays.',
}
DROPPED_BY_ANISH = {
    'wlh30-con-2': 'Dropped by Anish, 13 Nov 2026. Db\'s page for this build says nothing about straps or padding, and the build is far lighter than the standard Hugger.',
}
TO_FEATURE = {
    'wlh30-pro-3': dict(id='wlh30-feat-3', text='Full clamshell opening to the whole main compartment, plus a quick-access top pocket.', scope='design',
                        sources=['db-weigh-lighter-hugger-30l-weigh-darker'], applies_to=['weigh-lighter-hugger-backpack-30l-weigh-darker'],
                        replaces='wlh30-pro-3', was_kind='pro', status='draft'),
}
RESOURCED = {
    'ctb26-pro-2': dict(text='The external bottle pockets are a big plus.', support='one owner review', basis='owner-reports',
                        sources=['evergoods-civic-travel-bag-ultra'], observed_on=['civic-travel-bag-26l-ultra'],
                        source_notes=[dict(source='evergoods-civic-travel-bag-ultra', about='same build; an owner review on the ULTRA page, read 13 Nov 2026')],
                        other_builds=[dict(source='evergoods-civic-travel-bag-26l', about='420D nylon build; two owners call the bottle pockets the best')],
                        wording_note='Re-sourced on 13 Nov 2026 to an owner review of the ULTRA build, at Anish\'s call.'),
}
ADDED_AFTER_CALLS = {
    'evergoods-civic-travel-bag-26l': [
        dict(id='ctb26-con-6', kind='con', text='The stiff back panel\'s bottom edges can dig into the lower back.', voice='owners', support='one owner review',
             scope='design', basis='owner-reports', sources=['evergoods-civic-travel-bag-ultra'], observed_on=['civic-travel-bag-26l-ultra'], status='draft',
             source_notes=[dict(source='evergoods-civic-travel-bag-ultra', about='same build; an owner review on the ULTRA page, read 13 Nov 2026')],
             my_note='note-ctb26-back-panel', wording_note='New on 13 Nov 2026, added at Anish\'s call. Not on the old page.'),
    ],
}
MY_NOTES = [
    dict(id='note-ctb26-handles', date=D13, variant='civic-travel-bag-26l-ultra', about='ctb26-pro-3', experience='own use',
         said='Keep it, I have experienced it myself', draft_text='Matches my own use of the bag.', status='draft'),
    dict(id='note-ctb26-back-panel', date=D13, variant='civic-travel-bag-26l-ultra', about='ctb26-con-6', experience='not experienced',
         said='I have not experienced it myself - this complaint has been there for all versions of this bag, and it has affected some people and not others',
         draft_text='I haven\'t had this myself. The complaint has come up for every version of this bag, and it bothers some people and not others.', status='draft'),
]
NOTE_FOR = {n['about']: n['id'] for n in MY_NOTES}
MY_BAGS = [dict(variant=v, date=D13, review='planned') for v in
           ('civic-travel-bag-26l-ultra', 'matador-x-carryology-edx-ultra-backpack', 'weigh-lighter-hugger-backpack-30l-weigh-darker')]


def apply_calls(mid, claims, features, old):
    out = []
    for n in claims:
        cid = n['id']
        if cid in DROPPED_BY_ANISH:
            for o in old:
                if o['id'] == n.get('replaces'):
                    o['outcome'].append(f'{cid}: {DROPPED_BY_ANISH[cid]}')
            continue
        if cid in TO_FEATURE:
            features.append(dict(TO_FEATURE[cid]))
            for o in old:
                if o['id'] == n.get('replaces'):
                    o['outcome'].append(f'{cid}: moved to features on 13 Nov 2026 at Anish\'s call; Db\'s page for this build lists both.')
            continue
        if n.get('from_build'):  # Challenge writes ULTRA in capitals; only the capitalisation changes
            n['from_build']['label'] = n['from_build']['label'].replace('Ultra 800', 'ULTRA 800')
        if cid in RESOURCED:
            r = copy.deepcopy(RESOURCED[cid])
            n.pop('from_build', None)
            n.update(r)
            n['status'] = 'draft'
        elif cid in KEEP:
            n['from_build'].update(found=KEEP[cid], assigned='yes', decided=D13)
            n['from_build'].pop('suggestion', None)
            n['from_build'].pop('why', None)
            n['status'] = 'approved'
        if cid in NOTE_FOR:
            n['my_note'] = NOTE_FOR[cid]
        out.append(n)
    out += copy.deepcopy(ADDED_AFTER_CALLS.get(mid, []))
    return out


# ------------------------------------------------------------------ wording read-through, 13 Nov 2026 (asked line by line)
READ_OK = {  # shown to Anish as worded, and kept
    'cpp2-pro-1', 'cpp2-pro-2', 'cpp2-pro-3', 'cpp2-pro-4-b', 'cpp2-con-1', 'cpp2-con-3', 'cpp2-con-4', 'tp4-con-1', 'tp4-con-2',
    'ct15p-pro-4', 'ct15p-pro-5', 'ctb26-pro-2', 'ctb26-con-5', 'ctb26-con-6', 'slite-pro-1', 'slite-pro-3', 'slite-pro-5',
    'slite-con-2', 'slite-con-3', 'dfly-pro-1', 'dfly-pro-2', 'dfly-pro-3', 'dfly-con-3',
}
FEATURES_OK = {
    'tp4-feat-3', 'ct15l-feat-3', 'ct15l-feat-c4', 'ct15p-feat-1', 'ct21l-feat-3', 'ct21l-feat-4', 'ct21l-feat-c1', 'ct21p-feat-1',
    'wlh30-feat-2-b', 'wlh30-feat-4', 'wlh30-feat-3', 'ctb26-feat-4', 'ctb26-feat-c3', 'edx-feat-1-b', 'edx-feat-3', 'edx-feat-3-b',
    'edx-feat-4', 'slite-feat-1-b', 'slite-feat-2', 'cicada-feat-5', 'cicada-feat-5-b',
}
CT21L_CHECK = ('Re-read on both CT21 Lite pages on 13 Nov 2026, at Anish\'s request: the specification lists say the same. '
               'Photos were not looked at; two captions mention the zipped passport pocket, pass-through strap and collapsible bottle pocket.')
FEATURE_CHECKED = {'ct21l-feat-3': CT21L_CHECK, 'ct21l-feat-4': CT21L_CHECK, 'ct21l-feat-c1': CT21L_CHECK}
READ_DROP = {
    'cicada-pro-3': 'Dropped by Anish on reading, 13 Nov 2026.',
    'cicada-con-2': 'Dropped by Anish on reading, 13 Nov 2026.',
    'cicada-con-2-b': 'Dropped by Anish on reading, 13 Nov 2026.',
    'cicada-con-1': 'Folded into cicada-pro-6 at Anish\'s call, 13 Nov 2026: one line on which 16-inch laptops fit.',
    'dfly-pro-4-b': 'Dropped by Anish on reading, 13 Nov 2026.',
    'dfly-con-1-b': 'Folded into dfly-con-1 at Anish\'s call, 13 Nov 2026: one line on the front mesh pocket.',
    'dfly-con-3-b': 'Folded into dfly-con-3 at Anish\'s call, 13 Nov 2026.',
}
READ_REWORD = {  # his direction, Claude's wording; 'approved' where he then saw the wording and kept it
    'cicada-pro-2': dict(text='Self-stands very well: one owner says better than any bag they have used.', approved=True,
                         wording_note='Anish asked for "general consensus is that it self stands very well". The sources on file are one owner review and ULA\'s own '
                                      'launch Q&A; Pack Hacker and The Brooks Review do not mention it. So the line says one owner, and ULA\'s statement is a "Maker says" line. He agreed to both.'),
    'cicada-pro-4': dict(text='The EWP\'s water bottle pockets sit flush with the sides and disappear when empty.', approved=True,
                         wording_note='Anish\'s wording, with "the sides" for "the body". The owner review says the pockets are nearly invisible when empty. "Flush" was checked by '
                                      'Claude on 13 Nov 2026 against ULA\'s front and left-side photos of the ULTRA Cicada EWP, opened in the browser: the mesh pockets lie flat '
                                      'against the side panels and do not break the bag\'s outline.'),
    'cicada-pro-6': dict(id='cicada-note-1', kind='note', about='laptop', text='A 16-inch MacBook Pro fits easily; a bulkier 16-inch Dell did not.',
                         support='two owner reviews', sources=['ula-ultra-cicada-ewp'], approved=True,
                         wording_note='Anish: neither a pro nor a con, since few bags take laptops much bigger than a 16-inch MacBook Pro. Filed as a "Good to know" note beside the '
                                      'laptop sleeve spec (15.5 x 10 in, 10 in opening, by ULA\'s page).'),
    'dfly-pro-4': dict(text='The S-shaped shoulder straps stayed comfortable through about eight months of testing.', approved=True,
                       wording_note='Reworded at Anish\'s request. Treeline\'s tester also says his back gets sweaty with this pack and calls that nothing new. Checked on 13 Nov 2026 '
                                    'whether that is a common complaint: Carryology (Ultra 800 build) praises the air-mesh back panel, Pack Hacker\'s 2022 review (X-Pac build) calls it good '
                                    'for hot days, Pack Hacker\'s 36L review says the pack can get hot, Nomads Nation says nothing, and none of the 21 owner reviews on ULA\'s Ultra Dragonfly '
                                    'page mentions heat or sweat. Not shown to be worse than other packs, so it is left off the card.'),
    'dfly-con-1': dict(text='The zippered front mesh pocket is the exception to the easy access: owners find its opening tight, and close to unusable when the pack is full.',
                       sources=['ula-30l-dragonfly-pass-thru', 'ula-ultra-dragonfly', 'ula-ultra-30l-patchless-dragonfly',
                                'reddit-r-onebag-read-through-ula-dragonfly-review-from-an-extremely-avera'], approved=True,
                       wording_note='Rewritten at Anish\'s request to sit with the pro on easy access. Treeline\'s "easy to reach when stuffed" names the top pocket and the outside '
                                    'laptop pocket and says nothing about the front pocket, so the two do not contradict. The "nearly unusable when full" review (June 2025) sits in '
                                    'a review block headed "30L X-Pac Dragonfly" that also holds a review naming ULTRA 800TX, so the heading does not show which build it was.'),
    'dfly-con-2': dict(text='The zipper pull cords can come unknotted.', approved=True,
                       wording_note='At Anish\'s call the owner\'s fix is left out, and the line was held until the current pulls were confirmed to be knotted cord. '
                                    'The owner review is from October 2024 and names the ULTRA 800TX build; an r/onebag post reports the same. ULA\'s pages list "silent" or '
                                    '"quiet" zipper pulls without naming the material. Checked by Claude on 13 Nov 2026 in the browser: ULA\'s three-quarter photo of the '
                                    '30L Dragonfly Pass Thru, uploaded January 2025 (after the complaint), shows knotted cord pulls on the main zipper. The photos on the '
                                    'Patchless and Ultra listings date from 2022 and 2024, so they do not show it either way. Released on that evidence.'),
    'dfly-con-3': dict(text='Not suited to heavy packers or those who want maximum organisation.', approved=True,
                       wording_note='Merged with the organisation line at Anish\'s call, in the wording shown to him.'),
}
READ_ADD_FEATURES = {
    'ula-cicada-22l': [dict(id='cicada-feat-6', text='Stands up on its own.', scope='design', sources=['ula-equipment-p-536810'],
                            applies_to=['ultra-cicada', 'ultra-cicada-ewp', 'ultra-muse-cicada-ewp'], replaces='cicada-pro-2', was_kind='pro', status='approved',
                            checked='From ULA\'s launch Q&A of 6 Aug 2025, which predates the EWP build. Found again by search on 13 Nov 2026.')],
}


def apply_reading(mid, claims, features, old):
    def log(n, msg):
        for o in old:
            if o['id'] == n.get('replaces'):
                o['outcome'].append(f"{n['id']}: {msg}")
    out = []
    for n in claims:
        cid = n['id']
        if cid in READ_DROP:
            log(n, READ_DROP[cid])
            continue
        if cid in READ_REWORD:
            r = dict(READ_REWORD[cid])
            ok, held = r.pop('approved', False), r.pop('held', False)
            n.pop('from_build', None)
            n.update(r)
            n['status'] = 'held' if held else 'approved' if ok else 'draft'
            log(n, 'reworded on 13 Nov 2026 at Anish\'s direction.')
        elif cid in READ_OK:
            n['status'] = 'approved'
        out.append(n)
    features += copy.deepcopy(READ_ADD_FEATURES.get(mid, []))
    for f in features:
        if f['id'] in FEATURES_OK:
            f['status'] = 'approved'
        if f['id'] in FEATURE_CHECKED:
            f['checked'] = FEATURE_CHECKED[f['id']]
    return out

# Opening style checked on each build's own page on 13 Nov 2026, at Anish's request.
# A subagent read each page through WebFetch; Claude re-read the same pages the same way.
# The EDX is not here: no Matador or Carryology page for any EDX run names how the main compartment opens.
OPENING_METHOD = 'Read on the build\'s own page by a search subagent and again by Claude, both through WebFetch, on 13 Nov 2026'
OPENING_CHECKS = {
    'ct21-lite-ultra400x': 'Under "Internal": the main compartment opens flat, up to 180 degrees.',
    'ct21-plus-ultra200x': 'Under "Internal": the main compartment opens flat, up to 180 degrees. The description calls the Plus section a separate compartment from the main one.',
    'ultra-cicada-ewp': 'ULA\'s description calls it a front-loading backpack and the feature list has "Front Loading".',
    '30l-ultra-dragonfly': 'ULA\'s description opens with "Front-loading". Five owner reviews on the page describe a clamshell opening.',
    '30l-dragonfly-pass-thru': 'ULA\'s description calls it a front-loading panel bag. Nothing on the page says clamshell.',
}

# Units (Anish, 13 Nov 2026): the page switches between metric and imperial, so each build keeps the
# maker's own figure in each system apart from a figure we converted. Per build:
#   w   : the maker's imperial weight as printed: ('lb', 2.57), ('oz', 27.4), ('lb+oz', 3, 3.5), or None if the page prints none
#   wm  : where the gram figure comes from: 'maker' or 'converted' (from the pounds above)
#   din : the maker's dimensions in inches [h, w, d], or None if the page prints none
#   dcm : where the centimetre figure comes from: 'maker', 'converted' (from the inches) or None (no dimensions line on file)
# Db prints one system per country page: pounds and inches on its US page, kilograms and centimetres on its UK and Canadian pages.
# Both are Db's own figures (read 13 Nov 2026). Ctactical's four CT21 pages were re-read the same day: both systems are printed.
# Rounding for converted figures: grams to the whole gram, pounds to 2 decimals, centimetres and inches to 1 decimal.
UNITS = {
    'city-pack-pro-2-ultra-24l': dict(w=('lb', 2.57), wm='converted', din=[18, 12, 7], dcm='maker'),
    'city-pack-pro-2-24l': dict(w=('lb', 2.86), wm='converted', din=None, dcm=None),
    'travel-pack-4-ultra-28l': dict(w=('lb', 3.28), wm='converted', din=[19.25, 12.75, 8], dcm='maker'),
    'travel-pack-4-28l': dict(w=('lb', 3.52), wm='converted', din=None, dcm=None),
    'ct15-lite-ultra200x': dict(w=('lb', 2.6), wm='maker', din=[18.7, 11.4, 6.3], dcm='maker'),
    'ct15-plus-ultra200x': dict(w=('lb', 3.17), wm='maker', din=[18.7, 11.4, 8], dcm='maker'),
    'ct21-lite-ultra200x': dict(w=('lb', 2.54), wm='maker', din=[18.7, 13.4, 7.3], dcm='maker'),
    'ct21-lite-ultra400x': dict(w=('lb', 2.62), wm='maker', din=[18.7, 13.4, 7.3], dcm='maker'),
    'ct21-plus-ultra400x': dict(w=('lb', 3.17), wm='maker', din=[18.7, 13.4, 8.4], dcm='maker'),
    'ct21-plus-ultra200x': dict(w=('lb', 3.06), wm='maker', din=[18.7, 13.4, 8.4], dcm='maker'),
    'weigh-lighter-hugger-backpack-30l-weigh-darker': dict(w=('lb', 1.15), wm='maker', din=[20.47, 12.2, 8.86], dcm='maker'),
    'hugger-backpack-30l-oatmilk': dict(w=None, wm='maker', din=None, dcm='maker'),
    'civic-travel-bag-26l-ultra': dict(w=('lb+oz', 3, 3.5), wm='maker', din=[19, 11.5, 8], dcm='maker'),
    'civic-travel-bag-26l': dict(w=('lb+oz', 3, 8), wm='maker', din=[19, 11.5, 8], dcm='maker'),
    'matador-x-carryology-edx-ultra-backpack': dict(w=('oz', 18), wm='maker', din=[17.9, 10.8, 7.8], dcm='maker'),
    'superlite-backpack': dict(w=('lb', 2.2), wm='maker', din=[21, 12.5, 8], dcm='maker'),
    'ultra-cicada': dict(w=('oz', 28.2), wm='maker', din=[18, 11, 5], dcm='converted'),
    'ultra-cicada-ewp': dict(w=('oz', 28.2), wm='maker', din=[18, 11, 5], dcm='converted'),
    'ultra-muse-cicada-ewp': dict(w=('oz', 28.2), wm='maker', din=[18, 11, 5], dcm='converted'),
    'x50-cicada': dict(w=('oz', 30.7), wm='maker', din=[18, 11, 5], dcm='converted'),
    '30l-patchless-ultra-dragonfly': dict(w=('oz', 27.4), wm='maker', din=[18.5, 11, 7], dcm='converted'),
    '30l-ultra-dragonfly': dict(w=('oz', 27.4), wm='maker', din=[18.5, 11, 7], dcm='converted'),
    '30l-dragonfly-pass-thru': dict(w=('oz', 31), wm='maker', din=[18.5, 11, 7], dcm='converted'),
    'x-pac-dragonfly': dict(w=('oz', 28), wm='maker', din=[18.5, 11, 7], dcm='converted'),
}
LB_G = 453.59237
IN_CM = 2.54


def _r(x, places):
    from decimal import Decimal, ROUND_HALF_UP
    q = Decimal(1).scaleb(-places)
    v = float(Decimal(str(x)).quantize(q, rounding=ROUND_HALF_UP))
    return int(v) if v == int(v) else v


def _num(x):
    return ('%g' % x)


def units_block(v):
    """The maker's figure and the converted figure, per system, for weight and dimensions."""
    u = UNITS[v['id']]
    g = v['weight_g']
    out = {}
    w = u['w']
    if w is None:
        imp = dict(lb=_r(g / LB_G, 2), **{'from': 'converted'})
    elif w[0] == 'lb':
        imp = dict(lb=w[1], **{'from': 'maker'})
    elif w[0] == 'oz':
        imp = dict(lb=_r(w[1] / 16, 2), shown=_num(w[1]) + ' oz', **{'from': 'maker'})
    else:
        imp = dict(lb=_r(w[1] + w[2] / 16, 2), shown='%s lb %s oz' % (_num(w[1]), _num(w[2])), **{'from': 'maker'})
    out['weight'] = dict(metric=dict(g=g, **{'from': u['wm']}), imperial=imp)
    if u['wm'] == 'converted':
        assert w and w[0] == 'lb' and _r(w[1] * LB_G, 0) == g, (v['id'], g)
    cm = v.get('dims_cm')
    if cm and u['dcm']:
        cm = [cm['h'], cm['w'], cm['d']]
        if u['din']:
            inch = dict(**{'in': u['din'], 'from': 'maker'})
        else:
            inch = dict(**{'in': [_r(x / IN_CM, 1) for x in cm], 'from': 'converted'})
        if u['dcm'] == 'converted':
            assert [_r(x * IN_CM, 1) for x in u['din']] == [_r(x, 1) for x in cm], (v['id'], cm)
        out['dims'] = dict(metric=dict(cm=cm, **{'from': u['dcm']}), imperial=inch)
    return out


LINK_OVERRIDE = {
    'matador-x-carryology-edx-ultra-backpack': dict(
        source='carryology-collaboration-par-matador-x-carryology-edx-ultra-collection-ex', kind='partner-page',
        note='A limited run made with Carryology, so the card links to Carryology\'s page. The specs were checked on Matador\'s page.'),
}


def main():
    sources = load(os.path.join(DATA, 'sources.yaml'))
    for k, v in NEW_SOURCES.items():
        sources.setdefault(k, v)
    for k in ('aer-city-pack-pro-2-24l', 'aer-travel-pack-4-28l', 'evergoods-civic-travel-bag-26l'):
        sources[k]['last_ok'] = TODAY
    dump(os.path.join(DATA, 'sources.yaml'), sources,
         'One entry per page. last_ok is the last date the page opened; null means it has not been opened.\n'
         'archived is for a link checker to fill. opened_by says who opened it and how.')

    materials = load(os.path.join(DATA, 'materials.yaml'))
    for k, why in FABRIC_RULINGS.items():
        sec = materials[k]['in_uhmwpe_section']
        sec['decision'], sec['decided'] = 'in', TODAY
        sec['reasons'] = why + ' The one-line reason shown on the page is still the draft below.'
        if 'draft' in sec:
            sec['draft']['status'] = 'decision made: in; the wording of the reason is still a draft'
    for k, v in NEW_MATERIALS.items():
        materials.setdefault(k, v)
    materials['axodyne'] = AXODYNE
    dump(os.path.join(DATA, 'materials.yaml'), materials,
         'Fabrics. A check lists the page a value was read from. in_uhmwpe_section.draft holds drafted reasons whose wording Anish has not read yet.\n'
         'Fabrics marked not-applicable are on file only so builds of the same bag can be compared.')

    stats = dict(claims=0, to_assign=0, features=0, computed=0, dropped=0, siblings=0, reviews=0)
    for p in sorted(glob.glob(os.path.join(DATA, 'bags', '*', '*.yaml'))):
        b = load(p)
        mid = b['model']['id']
        full_ids = [v['id'] for v in b['variants']]

        # ---- variants: no stock, a link out
        for v in b['variants']:
            v.pop('availability', None)
            for c in v.get('checks', []):
                c['fields'] = [f for f in c['fields'] if f != 'availability']
            v['checks'] = [c for c in v.get('checks', []) if c['fields']]
            if v['id'] == 'weigh-lighter-hugger-backpack-30l-weigh-darker':
                # Db prints one system per country page; both read on 13 Nov 2026
                v['as_written']['weight'] = '1.15 lbs in the specifications on the US page; 0.52 kg on the UK and Canadian pages; 520g in the description'
                v['as_written']['dims'] = '20.47 x 12.2 x 8.86 in (H x W x D) on the US page; 52 x 31 x 22.5 cm (H x W x D) on the UK and Canadian pages'
            if v['id'] == 'matador-x-carryology-edx-ultra-backpack':
                # Anish owns this bag. His words, 14 Nov 2026: "It's a partial panel/top loader. The main compartment zip
                # comes down to the top of the water bottle pocket". No Matador or Carryology page names the opening.
                v['opening'] = 'Opens from the top; the main zip runs partway down, to the top of the bottle pockets'
                v['checks'].append(dict(date='2026-11-14', source='anish-own-bag', basis='own', fields=['opening'],
                                        method="Anish's own bag, described by him on 14 Nov 2026",
                                        note='His words: "It\'s a partial panel/top loader. The main compartment zip comes down to the top of the water bottle pocket". The old value also said "packable"; that is not about the opening and is already a "Maker says" line (lays flat or packs into its mesh bag).'))
            v['units'] = units_block(v)
            if v['id'] in OPENING_CHECKS:
                assert not any('opening' in c['fields'] for c in v['checks']), v['id']
                v['checks'].append(chk(v['page'], ['opening'], method=OPENING_METHOD, note=OPENING_CHECKS[v['id']]))
            ov = LINK_OVERRIDE.get(v['id'])
            link = dict(url=sources[ov['source'] if ov else v['page']]['url'], kind=ov['kind'] if ov else 'product-page', affiliate_url=None)
            if ov:
                link['note'] = ov['note']
            ordered = {}
            for k, val in v.items():
                ordered[k] = val
                if k == 'page':
                    ordered['link'] = link
            v.clear()
            v.update(ordered)
        for s in SIBLINGS.get(mid, []):
            s = dict(s)
            ordered = {}
            for k, val in s.items():
                ordered[k] = val
                if k == 'page':
                    ordered['link'] = dict(url=sources[s['page']]['url'], kind='product-page', affiliate_url=None)
            ordered['units'] = units_block(ordered)
            b['variants'].append(ordered)
            stats['siblings'] += 1

        # ---- claims
        claims, features, computed, old = [], [], [], []
        for c in b['claims']:
            notes = c.get('source_notes', [])
            outcomes = []
            for pr in c.get('proposals', []):
                pid = pr['id']
                if pid in SITE_NOTES:
                    outcomes.append(f'{pid}: not carried over. The model now has a review list and a sourcing line instead.')
                    stats['dropped'] += 1
                elif pid in DROP5:
                    outcomes.append(f'{pid}: dropped on review (ruling 5).' + DROP5_NOTE.get(pid, ''))
                    stats['dropped'] += 1
                elif pid in DUP:
                    outcomes.append(f'{pid}: dropped. It restates data already on the record ({DUP[pid]}).')
                    stats['dropped'] += 1
                elif pr['action'] == 'drop':
                    outcomes.append(f'{pid}: dropped. {DROP_REASON.get(pid) or pr.get("reason", "")}'.strip())
                    stats['dropped'] += 1
                elif pr['action'] == 'compute' or pid in ('cpp2-pro-4', 'tp4-pro-1'):
                    computed.append(dict(replaces=c['id'], was=c['text'], rule=pr.get('computed_as') or 'Weight against the other builds of the same bag, from their records.',
                                         state=COMPUTE_STATE[pid]))
                    outcomes.append(f'{pid}: computed from data. {COMPUTE_STATE[pid]}')
                    stats['computed'] += 1
                elif pr.get('voice') == 'maker':
                    features.append(dict(id=pid.replace('-pro-', '-feat-').replace('-con-', '-feat-c'), text=pr['proposed_text'],
                                         scope=pr.get('scope', c['scope']), sources=pr['sources'],
                                         applies_to=pr.get('observed_on') or list(full_ids), replaces=c['id'], was_kind=c['kind'], status='draft'))
                    outcomes.append(f'{pid}: moved to features (maker statement).')
                    stats['features'] += 1
                else:
                    nid = RENAME.get(pid, pid)
                    n = dict(id=nid, kind=pr['kind'], text=pr['proposed_text'], voice=pr['voice'], support=pr['support'],
                             scope=pr.get('scope', c['scope']), basis=pr['basis'], sources=pr['sources'], observed_on=pr.get('observed_on', []))
                    if pr['basis'] == 'sibling':
                        n['from_build'] = dict(label=pr['build_label'], **CLOSE[pid], assigned='pending')
                        n['status'] = 'to-assign'
                        stats['to_assign'] += 1
                    else:
                        n['status'] = 'draft'
                    kept = [dict(x) for x in notes if x['source'] in pr['sources']]
                    if kept:
                        n['source_notes'] = kept
                    other = [dict(x) for x in notes if x['source'] not in pr['sources'] and not x['about'].startswith('same build')]
                    if other and pr['basis'] != 'sibling':
                        n['other_builds'] = other
                    n['replaces'] = c['id']
                    if pr.get('reason'):
                        n['wording_note'] = pr['reason']
                    claims.append(n)
                    outcomes.append(f'{pid}: {"kept" if pr["action"] == "keep" else "reworded"}' + (f' as {nid}, now a {pr["kind"]}' if nid != pid else '')
                                    + ('; from another build, waiting on a call' if pr['basis'] == 'sibling' else '') + '.')
                    stats['claims'] += 1
            o = {k: c[k] for k in ('id', 'kind', 'text', 'scope', 'basis', 'sources') if k in c}
            for k in ('flags', 'evidence', 'leads', 'source_notes'):
                if c.get(k):
                    o[k] = copy.deepcopy(c[k])
            o['outcome'] = outcomes
            old.append(o)
        for n in copy.deepcopy(EXTRA_CLAIMS.get(mid, [])):
            claims.append(n)
            stats['claims'] += 1
            stats['to_assign'] += n['status'] == 'to-assign'
            stats['added'] = stats.get('added', 0) + 1
        claims = apply_calls(mid, claims, features, old)
        claims = apply_reading(mid, claims, features, old)
        claims.sort(key=lambda n: ('pro', 'con', 'note').index(n['kind']))
        b['claims'] = claims
        b['features'] = features
        b['computed'] = computed
        b['legacy']['claims'] = old

        # ---- review list and sourcing line
        cited = {}
        for n in claims:
            about = {x['source']: x['about'] for x in n.get('source_notes', [])}
            for s in n['sources']:
                kind = sources[s]['kind']
                if kind in ('review', 'forum') or (kind == 'maker-page' and n['voice'] == 'owners'):
                    e = cited.setdefault(s, dict(source=s, covers=about.get(s, 'not recorded'), used_for=[]))
                    e['used_for'].append(n['id'])
        for o in old:  # reviews on file that no current line cites
            for x in o.get('source_notes', []):
                if sources[x['source']]['kind'] in ('review', 'forum') and x['source'] not in cited:
                    cited[x['source']] = dict(source=x['source'], covers=x['about'], used_for=[])
        b['model']['reviews'] = list(cited.values())
        stats['reviews'] += len(cited)
        text, expect = SOURCING[mid]
        pubs = {sources[e['source']]['publisher'] for e in cited.values() if e['used_for']}
        missing = [x for x in expect if x not in pubs]
        assert not missing, f'{mid}: sourcing line names {missing}, which no line cites'
        b['model']['sourcing'] = text

        b['migration']['proposals'] = 'Applied on 13 Nov 2026 by tools/migrate/apply_decisions.py, following Anish\'s rulings of that day.'
        b['migration']['claims'] = ('Anish read every line on 13 Nov 2026, one question at a time; approved lines are the ones he kept as shown. '
                                    'Lines from another build name the build. Old wording and search results are under legacy.claims.')
        b['migration']['availability'] = 'Removed on 13 Nov 2026. Each build links out instead; the old strings stay under legacy.'
        out = {}
        for k in ('migration', 'model', 'variants', 'features', 'claims', 'computed', 'legacy'):
            out[k] = b[k]
        dump(p, out)
    sp = os.path.join(DATA, 'sections', 'uhmwpe-backpacks.yaml')
    sec = load(sp)
    sec['revision'] = dict(letter='AH', date='2026-11-14')
    sec['scope_note'] = 'EDC and travel backpacks with a UHMWPE fabric shell. Which fabrics count is my call, fabric by fabric. Three things I look at:'
    sec['rule']['tests'] = ['The fibre does real work: UHMWPE is a main structural part of the fabric, going by the maker\'s own description',
                            'The maker sells it as a UHMWPE fabric',
                            'Bags in it stand apart from the maker\'s nylon bags the way UHMWPE bags usually do: lighter, with the technical look and feel']
    sec['rule']['disqualifier'] = 'A fabric is out if UHMWPE is only a ripstop grid or a minor reinforcement in an ordinary nylon or polyester weave'
    for e in sec['exclusions']:
        if e['name'] == 'Able Carry Max EDC':
            e['reason'] = 'I found no sign that Able Carry has released a Challenge ULTRA build'
    sec['changelog'] = [dict(rev='AH', date='2026-11-14', note='Airline limits show the airline\'s own inches and pounds where it prints them; figures I converted are marked ≈. How the EDX opens, from my own bag.'),
                        dict(rev='AG', date=TODAY, note='Units: a switch in the header shows weights, sizes and airline limits in metric or imperial. Weight per litre is L/lb in imperial.'),
                        dict(rev='AF', date=TODAY, note='Now Carry Journal. Cards rebuilt from sourced data that Anish read line by line. Each build links to its own page.'),
                        dict(rev='AE', date='2026-11-10', note='Data corrections: Aer availability, EDX name, price and source, CT21 Plus weight.')]
    dump(sp, sec, 'One listing page.')
    dump(os.path.join(DATA, 'my-bags.yaml'), MY_BAGS,
         'Bags Anish owns, as he said on 13 Nov 2026. He plans his own review of each. The page marks these cards.')
    dump(os.path.join(DATA, 'my-notes.yaml'), MY_NOTES,
         'Anish\'s own notes. Kept apart from sourced lines. "said" is his wording; "draft_text" is a draft for the card that is his to rewrite.')
    print(stats)


if __name__ == '__main__':
    main()
