# Research notes: How to read a fabric (hub)

Page: `design/materials/v1/index.html` · written 23 Oct 2026 · sources opened 23 Oct 2026.

Topic outline started from u/strandedvariable's deep-dive series on r/ManyBaggers ([Nylon](https://www.reddit.com/r/ManyBaggers/comments/1t696j3/deepdive_nylon/), [X-Pac](https://www.reddit.com/r/ManyBaggers/comments/1t8242k/deepdive_xpac/), [Ultra](https://www.reddit.com/r/ManyBaggers/comments/1tdvnd5/deepdive_ultra/)). Text is original; every number was checked against the sources below, not taken from the series.

## Research files

- `research/hub-tests.md`
- `research/laminates.md (Part C, delamination)`
- `research/nylon-polyester.md (section C, coatings)`

## Decisions and corrections

- Classes are my grouping by how layers are joined (woven+coated, laminated, unwoven composite, fused). No textbook source uses exactly these four; standards (ASTM D751, ISO 12947-2) separate coated/laminated fabrics from plain wovens.
- Weave claims follow textile engineering, not bag folklore: basket and twill weaves tear harder than plain weave; plain weave abrades least in the one study found. The deep-dive had basket weave backwards on tear.
- Worked weight example rebuilt from the US Army's 500D duck construction (48 × 35 yarns/in). The deep-dive's 12 × 12 yarns/cm example can't reach real 500D weights, and its steps added up to 177–197 g/m², not 230.
- Ripstop's WWII-parachute origin is presented as unconfirmed; the earliest primary source found is a 1960 patent.
- Delamination section separates laminate failure from PU coating peel (Tom Bihn uses the word for the latter).
- Waterproof context uses the Gore-cited 1.7–3.4 bar estimate for kneeling or sitting on wet ground (Kwon & Nam 2001). Laminate makers don't state the method behind 13.8 bar.

## Fact-check

An independent fact-check on 23 Oct 2026 compared every number and claim on this page with its cited source. Report: `factcheck/hub-compare-glossary.md`. Every WRONG, UNSUPPORTED, UNSOURCED, MISCITED and ARITHMETIC row was fixed, and most PARTLY rows; the few minor PARTLY rows left as written are listed in the project doc.

## Open questions

- The test method behind X-Pac's and ULTRA's 13.8 bar / 200 psi is not published.
- Taber wheel, load and end point for X-Pac, ECOPAK and ULTRA abrasion figures are not published.
- No source found that measures laminate crinkle or noise.

## Sources (107, numbered as on the page)

1. [ASTM D751-26 — coated fabrics (abstract)](https://store.astm.org/d0751-26.html)
2. [BSI — BS EN ISO 12947-2:2016, Martindale specimen breakdown](https://knowledge.bsigroup.com/products/textiles-determination-of-the-abrasion-resistance-of-fabrics-by-the-martindale-method-determination-of-specimen-breakdown)
3. [ALUULA — Technology](https://aluula.com/technology/)
4. [Nashville Pack — ALUULA Graflyte](https://nashvillepack.com/pages/aluula-graflyte%E2%84%A2)
5. [Britannica — Nylon](https://www.britannica.com/science/nylon)
6. [Britannica — Polyethylene terephthalate](https://www.britannica.com/science/polyethylene-terephthalate)
7. [CAMEO (MFA Boston) — Polyester fiber](https://cameo.mfa.org/wiki/Polyester_fiber)
8. [Malkin et al., Polymers 16(24) 3501 — UHMWPE characterisation paper](https://www.mdpi.com/2073-4360/16/24/3501) — Dec 2024
9. [Wikipedia — Spinning (polymers)](https://en.wikipedia.org/wiki/Spinning_(polymers))
10. [Dyneema — The science of Dyneema](https://www.dyneema.com/experience-more/the-science-of-dyneema)
11. [Swicofil — Fibre density chart](https://www.swicofil.com/commerce/basic-information/yarn-manual/density-chart)
12. [Wikipedia — Yarn conditioning (regain table from Kadolph, 1998)](https://en.wikipedia.org/wiki/Yarn_conditioning)
13. [DuPont — Zytel 101L nylon 6,6 data sheet (hosted by Protolabs)](https://Protolabs.com/media/tcebrq5j/zytel-101l.pdf) — created 3 May 2018
14. [BASF — Ultramid B3S HP R01 nylon 6 data sheet](https://download.basf.com/p1/8a80825f8ec1f32b018ee0f5a5bf6e14/en/Ultramid%25C2%25AE_B3S_HP_R01_UNCOLORED)
15. [Unirope — TB21 fibre characteristics (PDF)](https://www.unirope.com/wp-content/themes/unirope/pdfs/TB21_k-spec_fiber_characteristics.pdf)
16. [FIBER-LINE — UHMWPE data sheet](https://careers.polyone.com/sites/default/files/2021-06/fl.us-.datasheet-uhmwpe.pdf) — 2021
17. [MiniFIBERS — Dyneema SK crimped staple data sheet](https://www.minifibers.com/files/TD/PI-TDS_Dyneema-SK-Crimped-Staple.pdf) — undated
18. [DSM — Dyneema SK75 technical brochure (hosted by Pelican Rope)](https://pelicanrope.com/content/PDFs/DyneemaSK75_Tech_Sheet.pdf) — undated
19. [Swicofil — Yarn numbering systems](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
20. [ASTM D861 — tex system for yarn numbering (abstract)](https://store.astm.org/d0861-07r24e02.html)
21. [Dictionary.com — denier](https://www.dictionary.com/browse/denier?s=t)
22. [Etymonline — denier](https://www.etymonline.com/word/denier)
23. [The Metric Maven — The Nylon Curtain (quoting Dale, The Metric Failure, 1904)](https://themetricmaven.com/the-nylon-curtain-made-elsewhere/)
24. [MiniFIBERS — Fiber measurement conversions](https://www.minifibers.com/fiber-measurement-conversions)
25. [Pratt Textile Resource Library — Wovens](https://textileresearchlab.pratt.edu/construction/wovens)
26. [CottonWorks (Cotton Incorporated) — Basic woven fabric designs](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/) — modified 21 Apr 2025
27. [Canvas ETC — Denier and weave types: plain vs Oxford vs ripstop](https://www.canvasetc.com/denier-fabric-weave-types-plain-vs-oxford-vs-ripstop) — updated 8 Apr 2025
28. [Wikipedia — Ripstop](https://en.wikipedia.org/wiki/Ripstop) — cites Fairchild's Dictionary of Textiles
29. [Ripstop by the Roll — 210D ROBIC ripstop nylon](https://ripstopbytheroll.com/products/210d-robic-ripstop-nylon)
30. [Carryology — How to choose the right backpack fabric](https://www.carryology.com/insights/insights-1/how-to-choose-the-right-backpack-fabric/) — 23 Apr 2019
31. [UPTTI — lecture notes on tear strength (PDF)](https://uptti.ac.in/classroom-content/data/tear-1%2015-4-2020.pdf)
32. [Technical University of Liberec — Tear and tensile strength of cotton woven fabrics' basic structures](https://dspace.tul.cz/handle/15240/172131) — abstract
33. [Azeem et al. — weave structure and abrasion, Fibres & Textiles in Eastern Europe 26(1)](https://yadda.icm.edu.pl/baztech/element/bwmeta1.element.baztech-9e99ccb7-490d-4601-a8b8-62a5d66c9f0a/c/6_azeem_i_inni_fibres_2018_1.pdf) — 2018
34. [Carryology — The fascinating history and science behind backpack textiles](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/) — 23 Mar 2026
35. [Carryology — Ballistic nylon vs CORDURA](https://www.carryology.com/insights/insights-1/ballistic-nylon-vs-cordura-heavy-duty-durable-fabrics/) — 9 Aug 2017
36. [US Army AMEDD history — Personnel protective armor (WWII wound ballistics, ch. XI)](https://achh.army.mil/history/book-wwii-woundblstcs-chapter11/)
37. [US patent 3,032,072 — parachute fabric with rip-stop threads](https://patents.google.com/patent/US3032072A/en) — filed 1960, issued 1962
38. [MIL-C-7020 — Cloth, parachute, nylon, rip stop and twill weave](https://standards.globalspec.com/std/510507/mil-c-7020)
39. [Heddels — No more tears: ripping into ripstop](https://www.heddels.com/?p=166473) — updated Apr 2026
40. [NIST SP 811, Appendix B.9 — conversion factors](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
41. [Lam, Institute of Textiles & Clothing — Woven fabric calculations](https://studylib.net/doc/5714336/woven-fabric-calculation) — lecture notes
42. [US Army GL/PD 10-07 — Cloth, duck, textured nylon](https://ciehub.info/spec/PD/GL-PD-10-07_2009-10-26.pdf) — 26 Oct 2009
43. [Rockywoods — 500 denier coated CORDURA](https://rockywoods.com/products/500-denier-coated-cordura-nylon-fabric)
44. [Rockywoods — mil-spec 500 denier coated nylon](https://rockywoods.com/products/mil-spec-500-denier-coated-nylon-fabric-woodland-camo)
45. [Extremtextil — Cordura 500den coated](https://www.extremtextil.de/en/cordura-500den-coated.html)
46. [Ripstop by the Roll — 500D CORDURA MultiCam](https://ripstopbytheroll.com/products/500d-cordura-multicam)
47. [Sailrite — CORDURA 500D MultiCam](https://www.sailrite.com/Cordura-500D-MultiCam-Original-60-Fabric)
48. [Shelby Outdoor — Cordura 500D with DWR, PU coated](https://shelbyoutdoor.com/de/p103045/cordura-500d-with-dwr-pu-coated)
49. [Extremtextil — Nylon 210den TPU-coated one side](https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710)
50. [US Army Research Laboratory — Hydrolytic stability of PU-coated fabrics (ARL-TR-6949)](https://apps.dtic.mil/sti/tr/pdf/ADA606474.pdf) — Jun 2014
51. [SylvanSport — When your tent becomes sticky or the coating flakes off](https://support.sylvansport.com/when-your-tent-becomes-sticky-or-the-coating-flakes-off-the-urethane-coating-is-starting-to-break-down)
52. [iFixit — Tent fly sticks](https://www.ifixit.com/Wiki/Tent_Fly_Sticks) — community guide
53. [Extremtextil — Silnylon info](https://www.extremtextil.de/en/know-how/silnylon-info) — updated 23 Jul 2026
54. [Bushwalk FAQ — Silicone vs PU vs acrylic proofing](https://faq.bushwalk.com/FAQ_SiliconeVsPU.htm)
55. [Patagonia — DWR (durable water repellent)](https://www.patagonia.com/dwr-durable-water-repellent.html)
56. [Mammut — The DWR dilemma](https://www.mammut.com/uk/en/stories-guides/waterproofing) — Mar 2023
57. [Challenge Outdoor — EPX collection](https://www.challenge-outdoor.com/epx-collection) — undated
58. [SGS — California AB 1817 bans PFAS in apparel and textile products](https://www.sgs.com/en/news/2022/10/safeguards-12022-california-introduces-law-ab-1817-banning-pfas-on-apparel-and-textile-products) — Oct 2022
59. [Beveridge & Diamond — New EU PFHxA limits take effect amid expanding PFAS rules for apparel and textiles](https://www.bdlaw.com/publications/new-eu-pfhxa-limits-take-effect-amid-expanding-pfas-rules-for-apparel-and-textiles/) — 7 Oct 2026
60. [ALPAKA — Interview with Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant) — 1 Aug 2022
61. [Wikipedia — Scrim (material)](https://en.wikipedia.org/wiki/Scrim_(material))
62. [X-Pac — X21](https://www.x-pac.com/product/x21/) — dated 11 Jun 2025
63. [Challenge Outdoor — UltraWeave Collection (style specs)](https://www.challenge-outdoor.com/ultraweave-collection) — undated
64. [Carryology — Challenge Sailcloth: the dawn of Ultra fabrics](https://www.carryology.com/materials/challenge-sailcloth-the-dawn-of-ultra-fabrics/) — 2 Nov 2022
65. [Tom Bihn — What is X-Pac and why we're excited for it](https://www.tombihn.com/blogs/main/what-is-x-pac-and-why-were-excited-for-it) — 22 Nov 2022
66. [Tom Bihn — Delamination: what it is and what to do](https://www.tombihn.com/blogs/main/delamination-what-it-is-and-what-to-do) — 6 Feb 2026
67. [X-Pac — Care Instructions & FAQs](https://www.x-pac.com/care-instructions-faqs/) — page dated 14 Apr 2026
68. [Challenge Outdoor — Sustainability](https://www.challenge-outdoor.com/sustainability) — undated
69. [Arc'teryx — Alpha SL 30 Backpack](https://arcteryx.com/be/en/shop/alpha-sl-30-backpack-9660)
70. [Extremtextil — X-Pac VX03](https://www.extremtextil.de/en/x-pac-vx03-backpack-laminate-140g-sqm/71230.SW)
71. [SectionHiker — Ultra fabrics for ultralight backpacking gear](https://sectionhiker.com/ultra-fabrics-for-ultralight-backpacking-gear-tents-packs-and-stuff-sacks/) — 2025, updated Jun 2026
72. [Backpacking Light forum — X-Pac long term usage](https://backpackinglight.com/forums/topic/x-pac-long-term-usage) — 2017, maker and owner posts
73. [Backpacking Light forum — Ultra 200 delamination after a PCT thru-hike](https://backpackinglight.com/forums/topic/yet-another-story-of-ultra-200-delamination-after-a-pct-thru) — Jan 2023, owner reports
74. [Backpacking Light forum — Challenge Ultra new variations: UltraX, UltraTX](https://backpackinglight.com/forums/topic/challenge-ultra-new-variations-ultrax-ultratx/) — Feb–Jun 2023, maker posts
75. [Challenge Outdoor — FAQ](https://www.challenge-outdoor.com/faq) — undated
76. [ASTM D2261 — tearing strength by the tongue procedure (abstract)](https://store.astm.org/d2261-13r17.html)
77. [ASTM D3884-22 — abrasion resistance, rotary platform (abstract)](https://store.astm.org/d3884-22.html)
78. [ASTM D1424 — tearing strength by falling pendulum (Elmendorf) (abstract)](https://store.astm.org/d1424-25.html)
79. [ASTM D5587 — tearing strength by the trapezoid procedure (abstract)](https://store.astm.org/d5587-15r19.html)
80. [ISO 13937-2 — tear force of trouser-shaped test specimens](https://www.iso.org/standard/23370.html)
81. [Dyneema — Composite Hybrid 3.2 (CT5K.18/wov.32c)](https://www.dyneema.com/fabric-finder/dyneema-composite-hybrid-32/ct5k18wov32c)
82. [ASTM D5034 — breaking strength, grab test (abstract)](https://store.astm.org/d5034-21.html)
83. [ASTM D5035 — breaking force, strip method (abstract)](https://store.astm.org/d5035-11r19.html)
84. [Taber Industries — Rotary Platform Abraser](https://www.taberindustries.com/taber-rotary-abraser)
85. [CCSI — Taber abrasion media](https://www.ccsi-inc.com/product/p-abrader-taber-media-1/)
86. [Gardco — Taber abrading wheels (Calibrase CS-10, Calibrade H-18)](https://gardco.com/Taber-Abrading-Wheels/c/p-63850) — distributor catalogue
87. [Testex — ASTM D3884 explained](https://www.testextextile.com/?p=14883) — 2020, updated 2022
88. [RISE — Abrasion of textiles to SS-EN ISO 12947-2](https://www.ri.se/en/expertise-areas/services/abrasion-of-textiles-according-to-ss-en-iso-12947-2)
89. [Testex — ASTM D4966 Martindale](https://www.testextextile.com/astm-d4966-abrasion-resistance-american-standard-martindale-method/) — 22 Aug 2025
90. [ASTM D4157 — abrasion resistance, oscillatory cylinder (abstract)](https://store.astm.org/d4157-13r17.html)
91. [Association for Contract Textiles — Performance guidelines: abrasion (PDF)](https://csi.nebraska.gov/sites/default/files/ac_abrasion_040519_knit.pdf) — Mar 2019
92. [FibreGuard — Abrasion testing: Martindale and Wyzenbeek](https://fibreguard.com/sell/blog/abrasion-testing-for-performance-fabrics-explaining-martindale-and-wyzenbeek) — 7 Feb 2023
93. [X-Pac — X42](https://www.x-pac.com/product/x42/) — dated 11 Jun 2025
94. [AATCC TM127 — water resistance: hydrostatic pressure test](https://members.aatcc.org/store/tm127/535/) — full text paywalled
95. [Testex — Hydrostatic pressure test comparison](https://www.testextextile.com/hydrostatic-pressure-test-comparison-resistance-to-water-penetration-of-textiles/) — updated Oct 2023
96. [SIS — SS-EN 20811 (withdrawn)](https://www.sis.se/en/produkter/textile-and-leather-technology/products-of-the-textile-industry/textile-fabrics/ssen20811)
97. [SIS — SS-EN ISO 811:2018](https://www.sis.se/en/produkter/textile-and-leather-technology/products-of-the-textile-industry/textile-fabrics/ss-en-iso-8112018)
98. [Kwon & Nam — water-resistance test methods compared, Int. J. Costume Culture 4(3)](https://koreascience.kr/article/JAKO200111921100334.pdf) — 2001
99. [Carryology — Arc'teryx Alpha SL](https://www.carryology.com/?p=116614)
100. [Field Mag — Gossamer Gear Alchemy and Mirage review](https://www.fieldmag.com/articles/gossamer-gear-alchemy-mirage-backpack-review)
101. [Altitude Sports — Db Weigh Lighter Backpack 25L](https://www.altitude-sports.com/p/db-journey-weigh-lighter-backpack-25l-dbb-1000431400701) — incl. a buyer review
102. [ASTM D1683 — failure in sewn seams (abstract)](https://store.astm.org/d1683_d1683m-17r18.html)
103. [ASTM D737 — air permeability (abstract)](https://store.astm.org/d0737-18.html)
104. [Ripstop by the Roll — Venom UHMWPE TPU data sheet (PDF)](https://cdn.shopify.com/s/files/1/0261/6507/files/Data_Sheet_-_3.9_oz_Venom_UHMWPE_TPU.pdf?v=1602948992) — Oct 2020
105. [Threads — Get a handle on fabric hand](https://www.threadsmagazine.com/2021/04/21/get-a-handle-on-fabric-hand) — 21 Apr 2021
106. [ASTM D4966 — abrasion resistance, Martindale (abstract)](https://store.astm.org/d4966-22.html)
107. [Backpacking Light — Arc'teryx Alpha SL 30 technical analysis](https://backpackinglight.com/advances-materials-manufacturing-ultralight-backpacks-arcteryx-alpha-sl-30-technical/) — 10 May 2025
