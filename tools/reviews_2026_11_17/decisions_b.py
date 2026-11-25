"""Editorial decisions for the 17 Nov 2026 wider-sources pass, part B (dfly, ct15l, ct15p)."""

BAGS = {}

DF = '30l-ultra-dragonfly'
DFP = '30l-dragonfly-pass-thru'
BAGS['dfly'] = dict(
    merged=['dfly'],
    src={
        's1': dict(id='danny-packs-video-ula-dragonfly-ultra-30l-review', pub='Danny Packs (YouTube)', kind='video',
                   about="same build (30L Ultra Dragonfly); he bought it himself; affiliate links"),
        's2': dict(id='the-mountainborn-video-ula-dragonfly-ultra-30', pub='The Mountainborn (YouTube)', kind='video',
                   about="same build (30L Ultra Dragonfly, ULTRA 400TX); a couple of months of use; bought with his own money"),
        's3': dict(id='pack-and-roam-video-ula-dragonfly-30l-review', pub='Pack & Roam (YouTube)', kind='video',
                   about="same build (30L Ultra Dragonfly, ULTRA 400TX); about a month of use; he bought it himself; affiliate links"),
        's4': dict(id='chase-reeves-video-ula-dragonfly', pub='Chase Reeves (YouTube)', kind='video',
                   about="same build (30L Dragonfly Pass Thru, shown beside a 36L); bags sent by ULA, not paid; affiliate links"),
        's5': dict(about="30L Dragonfly, fabric not named; affiliate links, and the author runs his own bag brand"),
        's6': dict(id='nomads-nation-ula-dragonfly-pass-thru-review', pub='Nomads Nation', kind='review',
                   about="same build (30L Dragonfly Pass Thru, ULTRA 400TX); a couple of weeks of use; price links, and the site runs its own bag brand"),
        's9': dict(about="earlier ULTRA 800 build of the 30L Ultra Dragonfly; affiliate links"),
        's10': dict(about="same build (30L Ultra Dragonfly); about eight months to a year of testing; affiliate links, sample status not stated"),
        's11': dict(about="same build (30L Ultra Dragonfly); customer reviews on ULA's own page, most without naming the fabric"),
        's12': dict(id='iron-heart-forum-903570', pub='Iron Heart forum', kind='forum',
                    about="36L Ultra Dragonfly Pass-Through, a different size; an owner's forum post"),
    },
    same={'s1': [DF], 's2': [DF], 's3': [DF], 's4': [DFP], 's6': [DFP], 's10': [DF], 's11': [DF]},
    add=[
        dict(pt=[13], kind='con', text="Zippers can feel stiff or sticky.", src=['s2', 's6', 's9'], scope='design',
             label="Also from a review of the earlier ULTRA 800 build", gen="Earlier fabric run of the same 30L design (2023)", size="Same, 30L",
             fabric="ULTRA 400TX (The Mountainborn, Nomads Nation), ULTRA 800 (Carryology)",
             found="Two of the three sources are the current 30L Ultra Dragonfly and Pass Thru; Carryology's earlier build used the same water-resistant zipper type."),
    ],
    widen=[
        dict(id='dfly-con-1', pt=[0], src=['s2', 's3'], label=None, drop=['reddit-r-onebag-read-through-ula-dragonfly-review-from-an-extremely-avera'],
             note="The Mountainborn could not get shells into the front pocket 'because of this narrow opening', and Pack & Roam says it gets hard to access when the pack is full. Both tested the ULTRA 400TX build."),
        # Anish accepted the suggested rewording on 17 Nov 2026 (comment 'ok' on the reading list)
        dict(id='dfly-pro-3', pt=[9], src=['s1'], label=None,
             retext="Just the right amount of organisation.",
             retext_why="Anish accepted this wording on 17 Nov 2026 ('ok'), so that the line says only what both sources back; easy reach when the pack is stuffed was Treeline Review's point alone.",
             note="Danny Packs (30L Ultra Dragonfly) says 'it provides the right amount of organization'."),
        # Anish accepted the suggested rewording on 17 Nov 2026 (comment 'ok' on the reading list)
        dict(id='dfly-pro-4', pt=[5], src=['s1', 's11'], label=None,
             retext="Comfortable to wear.",
             retext_why="Anish accepted this wording on 17 Nov 2026 ('ok'), so that the line says only what all three sources back; only Treeline Review tested for about eight months. Four sources also call the straps thin and say comfort fades above roughly 25 lb.",
             note="Danny Packs calls it 'surprisingly comfortable to wear' and an owner on ULA's page calls it 'the most comfortable pack I've ever worn'."),
        dict(id='dfly-pro-2-b', pt=[4], src=['s2'], label="Also from a review of the 2022 X-Pac build",
             note="The Mountainborn (30L Ultra Dragonfly) carried a tripod in the side pocket under the strap every day for two weeks."),
    ],
    flag=[
        dict(id='dfly-pro-2', why="The new sources do not confirm the 64 oz fit. The Mountainborn found the side pockets 'really tight' and hard to load with the pack full; Danny Packs, Pack & Roam and Chase Reeves had no trouble with bottles."),
    ],
    partly=[
        dict(id='dfly-con-3', pt=[7], src=['s3', 's9'], suggest="Not suited to heavy loads.",
             confirm="Pack & Roam (ULTRA 400TX) says it is 'definitely not a bag for heavy bulky gear', and Carryology (earlier ULTRA 800 build) says it is not a heavy hauler. Both back the heavy-load half only, not the organisation half."),
    ],
    off={
        1: "One reviewer, and it contradicts the approved line dfly-con-1.",
        2: "The quotes do not back the fuller claim; dfly-pro-2 stays as it is.",
        3: "One video, contradicted by three others; noted against dfly-pro-2.",
        6: "Four sources call the straps thin, but the line would sit against dfly-pro-4 on the same card, and dfly-con-3 already covers heavy loads. Recorded under where sources disagree.",
        8: "From a review that does not name its fabric; dfly-con-3 already covers organisation.",
        10: "dfly-pro-1 is Treeline's own verdict, so it cannot be widened; the For list is full.",
        11: "Capacity is contested (one video says it holds less than expected), and the For list is full.",
        12: "One video, against three sources who say it holds more than expected.",
        15: "One clear source and one partial; fabric feel left for your own review.",
        16: "Standing is contested: two say no, three say it usually stands.",
        17: "Contested: Treeline calls the laptop sleeve its favourite feature.",
        18: "Short tests and a general claim; durability needs longer use.",
        20: "One review of an unnamed fabric, against three sources who praise the handle.",
    },
    disagree=[
        "Straps: Pack & Roam and The Mountainborn (both ULTRA 400TX), Nomads Nation and Carryology call the straps thin and say comfort fades above roughly 25 lb; Danny Packs says the strap width keeps them from digging in, and Treeline's tester had no comfort issues.",
        "Side pockets: The Mountainborn finds them tight when the pack is full; Danny Packs, Pack & Roam and Chase Reeves do not.",
        "Standing: Pack & Roam and Danny Packs say it does not reliably stand; The Mountainborn, Nomads Nation (Pass Thru) and a ULA owner say it usually does.",
        "Capacity: Danny Packs, Chase Reeves and a ULA owner say it holds more than expected; The Mountainborn says it holds less than the 30L label suggests.",
        "Zippers: The Mountainborn, Nomads Nation and Carryology find them stiff or sticky; Chase Reeves has not noticed much of an issue.",
        "Organisation: Treeline calls it 'primo'; Nomads Nation and Pack & Roam call it minimal.",
    ],
    sourcing="Based on Treeline Review's review of the 30L Ultra Dragonfly, video reviews from The Mountainborn, Pack & Roam and Danny Packs, owner reviews on ULA's site and r/onebag, Nomads Nation's review of the Pass Thru, reviews of earlier builds from Pack Hacker and Carryology, plus ULA's own pages.",
)

BAGS['ct15l'] = dict(
    merged=['ct15l'],
    src={
        's1': dict(id='pk-shiu-video-ctactical-ct15-lite-waxed-canvas', pub='PK Shiu (YouTube)', kind='video',
                   about="CT15 Lite in waxed canvas (same 2026 design, different fabric); a first-look packing video filmed indoors; no sponsor or gift statement"),
        's4': dict(about="CT15 Plus - ULTRA200X (same generation and fabric, with the extra Plus section); one owner review on Ctactical's own page, collected by store invitation"),
        's5': dict(id='ctactical-ct15-lite-robic-nylon-420d-ripstop', pub='Ctactical', kind='maker-page',
                   about="CT15 Lite in ROBIC Nylon 420D Ripstop (same design, different fabric); one anonymous owner review on Ctactical's own page"),
    },
    same={},
    add=[
        dict(pt=[7], kind='pro', text="The inside stretch sleeve fits an iPad Pro with its keyboard case and pencil.", src=['s1'], scope='design',
             label="From a first-look video of the waxed canvas CT15 Lite", gen="Same generation (2026 CT15 Lite)", size="Same model and size",
             fabric="Waxed canvas",
             found="Ctactical lists the same stretch compartment for an iPad and stylus on the 2026 Lite; the fabric does not change the layout."),
        dict(pt=[5], kind='pro', text="The quick-access pocket has plenty of room for a phone, ID and badges.", src=['s1'], scope='design',
             label="From a first-look video of the waxed canvas CT15 Lite", gen="Same generation (2026 CT15 Lite)", size="Same model and size",
             fabric="Waxed canvas",
             found="Ctactical lists the same top quick-access pocket on the 2026 Lite; the fabric does not change the layout."),
    ],
    widen=[],
    flag=[],
    off={
        0: "The only new voice is a first look filmed before the straps were adjusted or the bag taken outside; too thin to widen ct15l-pro-5.",
        1: "Already on the card as ct15l-pro-5, from the same owner review.",
        2: "A first-look remark on padding; ct15l-pro-5 already covers the back panel.",
        6: "A layout fact that the dimensions on the card already show.",
        9: "A 'Good to know' needs a spec to sit beside, and bottle pockets have none.",
        11: "One owner's general praise, of the kind you turned down on 13 Nov 2026.",
    },
    disagree=[
        "Inside the PK Shiu video the title, description and middle say CT15 Lite, but he twice calls the bag the Plus by mistake.",
        "The owner review behind ct15l-pro-5 is dated 9 April 2026 on the page; the old note called it undated.",
    ],
    sourcing="Based on Ctactical's own pages, an owner review of the CT15 Plus on Ctactical's site, and PK Shiu's first-look video of the waxed canvas CT15 Lite.",
)
