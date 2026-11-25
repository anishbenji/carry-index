#!/usr/bin/env python3
"""Write the list of things that still need a human look.
    python3 tools/review_list.py > reports/claims-to-review.md"""
import glob, os, sys
import yaml
sys.path.insert(0, os.path.dirname(__file__))
from validate import resolve

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
bags = [yaml.safe_load(open(p, encoding='utf-8')) for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'bags', '*', '*.yaml')))]
src = yaml.safe_load(open(os.path.join(ROOT, 'data', 'sources.yaml'), encoding='utf-8'))
out = []
w = out.append
claims = [c for b in bags for c in b['claims']]
n_draft = sum(1 for c in claims if c['status'] == 'draft')
n_assign = sum(1 for c in claims if c['status'] == 'to-assign')
n_feat = sum(len(b['features']) for b in bags)

w('# Things still to look at\n')
w('Written 13 Nov 2026 from the data package (v0.9), after the rulings, the line-by-line calls and the wording read-through of that day were applied. Sources were read by Claude and by search subagents through page-summarising tools; '
  'check names and wording against the page before linking.\n')
n_ok = sum(1 for c in claims if c['status'] == 'approved')
feats = [f for b in bags for f in b['features']]
w('## Waiting on a check\n')
held = [(b, c) for b in bags for c in b['claims'] if c['status'] == 'held']
for b, c in held:
    w(f"- **{b['model']['label']}**, \"{c['text']}\" (`{c['id']}`): held off the card. {c.get('wording_note', '')}")
if not held:
    w('- Nothing is held.')
w('')
w('## Wording\n')
w(f"- Anish read the cards line by line on 13 Nov 2026: {n_ok} pros, cons and notes and {sum(1 for f in feats if f.get('status') == 'approved')} maker features are kept as worded.")
drafts = [c for c in claims if c['status'] == 'draft'] + [f for f in feats if f.get('status') == 'draft']
for c in drafts:
    w(f"- Not read yet: \"{c['text']}\" (`{c['id']}`)")
if n_assign:
    w(f'- {n_assign} lines from another build still wait on a call (`reports/other-build-review.md`).')
w('- His two notes on the CIVIC Travel Bag 26L - ULTRA (`data/my-notes.yaml`) have draft card wording that is his to rewrite.')
w('- The "why it\'s here" line for each fabric is still a draft, and Axodyne, now in, has none yet (`reports/fabric-reasons.md`).')
w('')
w('## Cards with little on them\n')
w('| Bag | Pros | Cons | Maker features |')
w('|---|---|---|---|')
for b in bags:
    p = sum(1 for c in b['claims'] if c['kind'] == 'pro')
    c = sum(1 for c in b['claims'] if c['kind'] == 'con')
    if p + c <= 3:
        w(f"| {b['model']['label']} | {p} | {c} | {len(b['features'])} |")
w('')
w('These are the bags with few or no reviews of the listed build on file. Your own notes would fill them faster than more searching.\n')

w('## Old lines the search could not support\n')
w('No longer typed on the cards: each was dropped, or is worked out from data instead. The old wording and what the search found are kept under `legacy.claims` in the bag\'s file.\n')
for b in bags:
    rows = [c for c in b['legacy']['claims'] if c.get('evidence', {}).get('status') in ('not_found', 'contradicted')]
    if not rows:
        continue
    w(f"**{b['model']['label']}**\n")
    for c in rows:
        tag = 'Contradicted. ' if c['evidence']['status'] == 'contradicted' else ''
        now = 'Now computed from data.' if any('computed' in o for o in c['outcome']) else 'Dropped.'
        w(f"- \"{c['text']}\" (`{c['id']}`). {tag}{c['evidence']['note']} {now}")
    w('')

w('## Facts with no source\n')
w('| Fact | State |')
w('|---|---|')
w('| Where the EDX is made | Not on Matador\'s page, Carryology\'s articles or the press release |')
w('| Aer weights in grams | Aer gives pounds only. Rushfaster\'s 1.30 kg and 1.60 kg match the Cordura builds (1,297 g and 1,597 g by conversion), not the Ultra ones. The data keeps our conversions |')
w('| Weigh Darker as a limited colourway | No source says limited; Db lists it as "Drop 2" of three. The record still has `release: limited`, unchecked |')
w('| 30L Dragonfly Pass Thru fabric weight | Page says "Challenge ULTRA TX"; its fabric block describes only ULTRA 400TX, so 400TX is implied, not stated |')
w('| Price of the 420D CIVIC Travel Bag in 26L | The page showed $270.00 with the 20L selected. Not recorded |')
w('| Price of the ULA X-Pac Dragonfly | Not in the page text read on 13 Nov 2026. Not recorded |')
w('| US price of the standard Hugger Backpack 30L | Only Db\'s Canadian page was opened ($260, currency not named). Not recorded |')
w('| Axodyne\'s UHMWPE share | Not in ALPAKA\'s campaign or any of its four videos opened |')
w('| "The back-panel complaint has been there for all versions" of the CIVIC Travel Bag | Anish\'s own note. One owner review of the ULTRA build is on file; reviews of other versions have not been searched for it |')
w('| The seven unsourced figures from the 10 Nov review | The list was not available in this chat. Compare it with this note |')
w('')

w('## Fields still unverified in the data\n')
w('| Build | Fields with no check |')
w('|---|---|')
for b in bags:
    for v in b['variants']:
        unv = [f for f, c in resolve(v).items() if not c]
        if unv:
            w(f"| {v['name']} | {', '.join(unv)} |")
w('')

w('## Conflicts between sources\n')
w('- **Db\'s "54% lighter":** Db\'s page for the Weigh Lighter build says it keeps the Hugger silhouette but is 54% lighter, at 520 g, without naming the standard weight. Db\'s listed 1.23 kg for the standard Hugger Backpack 30L works out to 58%. The base Db used is not known.')
w('- **ULA X-Pac Dragonfly weight:** 799 g in one part of the page, 800 g in another.')
w('- **ULTRA 200X fabric weight:** 4.6 oz/yd² on Challenge\'s UltraWeave page; 3.9 oz/yd² (133 g/m²) at ULA and Extremtextil.')
w('- **ULTRA 200X UHMWPE share:** Extremtextil\'s page lists both 43% and 67%. Challenge gives none.')
w('- **ULA\'s "800" Dragonfly option:** listed at 8.5 oz/yd², which is Challenge\'s weight for plain ULTRA 800, not ULTRA800TX (10.85 oz/yd²).')
w('- **UltraGrid weight:** 4.3 oz/yd² on Challenge\'s page; 3.9 oz/yd² in its 2023 guide.')
w('- **"Stronger than steel":** Challenge says 15 times; ALUULA, in trade coverage, says eight.')
w('- **Axodyne\'s layers:** ALPAKA\'s campaign describes several layers; its "What is Axodyne?" video says two; its Kickstarter video says a single layer composite.')
w('- **Superlite Backpack standing upright:** Pack Hacker says it does not; Nomads Nation says it does, with a lean.')
w('- **ULA Cicada laptop fit:** ULA\'s bespoke Cicada pages say 13 to 14 inch; its August 2025 overview says a 16-inch MacBook Pro. The bespoke builds may differ.')
w('- **ULA Muse page:** six exterior pockets in the description, four in the feature list.')
w('- **Ctactical volumes:** the older CT21 V3.0, near-identical in outer size to the CT21 Lite, was rated 21 L against 27 L now. The new figures are close to outer-box volumes.')
w('')

w('## Settled\n')
w('- **Where Ctactical bags are made:** Vietnam. Ctactical\'s Vietnamese store, chuyentactical.com, lists "Xuất xứ: Việt Nam" (origin: Vietnam) on the page for each of the six bags.')
w('- **Superlite Backpack "80% of load to the hips":** Tortuga\'s Kickstarter campaign says the optional hip belt transfers up to 80% of the weight from shoulders to hips. It is the maker\'s claim, and now sits under "Maker says".')
w('- **Stock and restocks:** no longer recorded. Each card links to the product page, or to Carryology\'s page for the EDX.')
w('- **Airline fit:** computed per build in `reports/airline-fit.md` from the current `data/airlines/airlines.json`. As a personal item, every listed build is too big for nearly all checked airlines that publish a size, so that is not a con of any one bag.')
w('- **Bags Anish owns:** the CIVIC Travel Bag 26L - ULTRA, the Matador® x Carryology EDX Ultra™ Backpack and the Weigh Lighter Hugger Backpack 30L Weigh Darker (`data/my-bags.yaml`). The page marks them; his own reviews are planned.')
w('- **Axodyne:** in, by Anish\'s call on 13 Nov 2026.')
w('- **CT21 Lite maker lines:** re-read on both product pages on 13 Nov 2026; the bottle pockets, passport pocket, pass-through, YKK RCF zipper sizes and the 9.8 x 4.8 cm ID loop panel are all in the specification lists.')
w('- **Cicada EWP bottle pockets "flush":** checked against ULA\'s front and left-side product photos; the mesh pockets lie flat against the side panels.')
w('- **Cicada self-standing:** one owner review and ULA\'s own launch Q&A say so. Pack Hacker and The Brooks Review do not mention it, so the card does not say "consensus".')
w('- **Dragonfly zipper pulls:** ULA\'s January 2025 photo of the 30L Dragonfly Pass Thru shows knotted cord pulls on the main zipper, so the con about cords coming unknotted is on the card. The Patchless and Ultra listings\' own photos are older than the complaint.')
w('- **Dragonfly sweaty back:** only Treeline\'s tester says so, calling it nothing new. Other reviews praise the back panel or say only that the 36L can get hot; none of 21 owner reviews on ULA\'s page mentions it. Left off the card.')
w('- **Opening style on five builds:** read on each build\'s own page on 13 Nov 2026, by a subagent and again by Claude. CT21 Lite - ULTRA400X and CT21 Plus - ULTRA200X: "opens flat, up to 180 degrees" under "Internal". ULTRA Cicada EWP: "front-loading backpack" and "Front Loading" in the feature list. 30L Ultra Dragonfly: "Front-loading" in ULA\'s description, and five owner reviews call it a clamshell. 30L Dragonfly Pass Thru: "front-loading panel" bag. The EDX was the last one (next line).')
w('- **How the EDX opens:** from Anish\'s own bag, 14 Nov 2026: it opens from the top, and the main zip runs partway down, to the top of the bottle pockets (his words: a partial panel and top loader). No Matador or Carryology page names the opening, so the card gives his own bag as the source.')
w('')

leads = sorted({l for b in bags for c in b['legacy']['claims'] for l in c.get('leads', [])})
w('## Pages that would not open\n')
w('Possible sources that were found but could not be read, by WebFetch or by Firecrawl.\n')
for l in leads:
    w(f'- {l}')
w('')
print('\n'.join(out))
