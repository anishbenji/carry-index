# Fact-check: hub-compare-glossary

Pages checked: `index.html` (How to read a fabric), `compare.html` (Side by side), `glossary.html`.
Every cited URL was opened once with WebFetch on 23 Oct 2026. No source was unreachable. The ISO 13937-2 and AATCC TM127 store pages loaded, but they show only a title or summary and no method details. For ASTM standards only the free scope and significance text was read; nothing was bought.

Conversions used: 1 lbf = 4.448 N; 1 oz/yd² = 33.906 g/m²; 1 bar = 10,197 mmH₂O = 14.504 psi; 1 mil = 25.4 µm (NIST SP 811 B.9 confirms all of these).

---

## 1. index.html — How to read a fabric

**OK: about 110 claims and figures checked and matching.** They include:
- the whole fibre table (densities, regain, melting points, saturation of 8.5% and 9–10%);
- the 210D diameters (161, 147 and 175 µm), the ±9% figures and 400D UHMWPE ≈ 470D nylon;
- the tex, decitex and denier definitions, the coin etymology and Dale's 9,600-aune silk count;
- the worked 500D example: 48×35 ypi → 18.9×13.8 per cm; 182; 200; +25–34 → 225–234; Army Class 3 at 7.0–8.0 oz/yd² = 237–271; shops at 220, 240, 249 and 271; Shelby's 4% PU ≈ 10 g/m²;
- the mil conversions and "39 times";
- 1 bar ≈ 10,200 mm ≈ 14.5 psi, and 13.8 bar ≈ 140 m ≈ 200 psi;
- Kwon & Nam's 172–345 kPa = 1.7–3.4 bar, and their Mullen 160 psi vs 14.5 psi water-column maximum;
- the 1943 nylon-duck substitution; the Carryology 1944, 2×2, 1050D, 18 oz and 840–1680D description; the 1960 patent filing ("conventional rip-stop threads"); the MIL-C-7020 history back to 8 Oct 1965; Heddels' "a bit hazy";
- AB 1817 (backpacks covered, 100 ppm from 2025, 50 ppm from 1 Jan 2027) and the EU PFHxA dates;
- the X-Pac adhesive quote ("cross-linking sailcloth adhesive system"), the no-machine-wash/dry rules, the Arc'teryx Graflyte heat warning, ALUULA's "no adhesives", and the SectionHiker crease advice (the "reviewer" tag is correct);
- the BPL owner reports;
- the ASTM D3884, D4157 and D4966 wear-life warnings; ACT's "no correlation" and FibreGuard's "aren't directly comparable or convertible"; Taber's 250/500/1000 g loads; ISO 12947-2's exclusion of coated and laminated fabrics; RISE's 9/12 kPa, wool and Lissajous; Venom's air permeability of zero; EN 20811 withdrawn and replaced by ISO 811:2018; the BPL Alpha SL "yet to be fully established".

| # | Section | Claim (short quote from the page) | Cited | Verdict | What the source actually says | Suggested fix |
|---|---|---|---|---|---|---|
| H1 | Tests › intro | "ASTM's own summaries describe tear and abrasion results as comparative … and labs often disagree" | 72, 73 | PARTLY | D2261 §5.2 does say values "reflect comparative performance of similar fabrics tested and measured in the same way". But §5.1 says the method suits acceptance testing "since current estimates of between-laboratory precision are acceptable". D3884 says lab tests are reliable for relative performance when differences are large, and says nothing about labs disagreeing. (D1424, which isn't cited here, warns that "technicians may fail to get good agreement … on certain fabrics".) | Drop "and labs often disagree", or cite D1424 [75] and narrow it to the Elmendorf test. |
| H2 | Coatings › PU | "A US Army lab found the ester type far more vulnerable than the ether type" | 47 | PARTLY | ARL-TR-6949 says polyester urethanes are "more vulnerable to hydrolysis than polyether urethane". It states this as background; the study didn't test the two types against each other. The report doesn't say "far". | "A US Army lab report notes that ester-type PU is more vulnerable to hydrolysis than ether-type." |
| H3 | Delamination › Glue | "Challenge says it uses a proprietary adhesive with no solvents" | 63 | PARTLY | "our proprietary adhesive, which does not contain toxic solvents or VOC's". | "…with no toxic solvents or VOCs". |
| H4 | Delamination › Does it happen? | "Mountain Laurel Designs said in 2023 that the newer ULTRA X fabric resists it better" | 70 | PARTLY | Ron Bell (MLD), 26 Jun 2023: "Ultra X should be even better at resisting any delamination vs the 1st gen Ultra". That is an expectation, not a finding. | "MLD said in 2023 that ULTRA X *should* resist it better", and tag it **maker claim**. |
| H5 | Coatings › DWR | "It doesn't make anything waterproof" | 53 | PARTLY | Patagonia defines DWR as finishes that "help moisture bead up and roll off". It doesn't say DWR isn't waterproofing. | Cite a source that says this, or soften the wording. |
| H6 | Coatings › DWR | "long-chain C8 first, then C6, now fluorine-free C0 … C0 needs re-proofing more often" | 54 | PARTLY | Mammut never uses the terms C8, C6 or C0. It says it dropped C8 in 2015 and began stepping back from C6 in 2016, aiming for PFC-free by 2025. It says PFC-free DWR "is not as resistant to wash and wear" and recommends "a regular wash and DWR refresh", without comparing frequency. | Keep the sequence but drop the C-labels or source them elsewhere. Rephrase as "PFC-free DWR wears off more easily, so needs refreshing". |
| H7 | Coatings › PU | "The fix is to strip the old coat with rubbing alcohol and recoat" | 48 | PARTLY (minor) | SylvanSport: first soak in cool water with unscented detergent; "for tougher spots, you can soak it in rubbing alcohol"; then rinse, dry and re-treat. | "Strip it (detergent soak, rubbing alcohol for stubborn areas) and recoat." |
| H8 | Coatings figure | "Polyurethane (PU) or TPU painted or laminated onto the back. It seals the weave." | 32 | PARTLY | Carryology [32] mentions only PU ("the most common"). It doesn't mention TPU or sealing the weave. | Add a TPU source (e.g. [50]) or drop "or TPU" from this citation. |
| H9 | Weaves › Origin stories | "Ballistic nylon was a DuPont fabric for WWII flak jackets, meant to stop fragments, not bullets." | none (the next sentence cites 34) | UNSOURCED | No citation of its own. [34] (AMEDD) mentions neither DuPont nor fragments. Carryology [32] does support it ("DuPont's answer…", "designed to stop ballistic fragments", "it won't stop a bullet"). | Add [32] to this sentence. |
| H10 | Weaves | "'Oxford' is strictly a 2×1 basket" | 24, 25 | PARTLY | CottonWorks: Oxford "is *sometimes referred to as* a 2 x 1 basket weave". Canvas ETC: two warps as one, crossing "either one (2×1) or two (2×2)" wefts. Neither says "strictly". | "Oxford is usually described as a 2×1 basket weave…" |
| H11 | Weaves › Tear and abrasion | "In one lab study plain weave abraded least" | 31 | PARTLY | Azeem et al.: in the warp direction "satin and twill fabric were more affected by the abradant than plain fabric". Twill and satin results reverse between warp and weft. No overall ranking is given. | "…plain weave lost less mass than twill and satin when rubbed along the warp." |
| H12 | Denier | "Real yarns are fatter because of the air between filaments" | 17 | PARTLY | Swicofil says multifilament diameter "strongly depends on how the filaments lie within the yarn" (twist, intermingling). It doesn't mention air. | "…because the filaments don't pack solid." |
| H13 | Fibres | "nylon 6 or nylon 6,6, named after the six-carbon chemicals each is made from" | 3 | PARTLY (minor) | True for 6,6 (adipic acid and hexamethylenediamine). For nylon 6, Britannica says it is named "because it has six carbon atoms in the basic unit" (caprolactam). | "…named for the six carbons in their building blocks." |
| H14 | Weaves | "Warp yarns run along the roll; weft (or fill) yarns run across it" | 23 | PARTLY (minor) | Pratt says only "warp (vertical threads)" and "weft (horizontal threads)". | Minor. Cite a source that says "lengthwise". |
| H15 | Weaves | "Ripstop: a plain weave with a grid of stronger yarns" | 26 | PARTLY (minor) | Wikipedia (Fairchild) gives the 5–8 mm grid and the "two or three fine yarns" option, but doesn't say the base is a plain weave. | Minor. Leave as is or add a source. |
| H16 | Weaves | "Twill: floats that step over by one yarn each row" | 24 | PARTLY (minor) | CottonWorks describes the diagonal twill line and the 2/2 float, but not a one-yarn step. | Minor. |
| H17 | Tests › Tear table | ISO 13937-2: "Two 'legs' of a cut specimen pulled apart" | 46, 76 | PARTLY (minor) | The ISO page gives only the title ("trouser-shaped test specimens (Single tear method)") and status: current, confirmed 2023. Shelby only names the standard. Neither describes the legs. | Minor. The description is the standard one, but neither cited page shows it. |
| H18 | Tests › Tensile | "Grab tests clamp the middle of a wider strip; strip tests pull the full width" | 78, 79 | PARTLY (minor) | The D5034 and D5035 abstracts don't describe clamp geometry. D5034 does support "no simple relationship between grab tests and strip tests … fabric assistance". | Minor. |
| H19 | Tests › Abrasion table (Taber) | "wheels range from mild rubber (CS-10) to hard vitrified (H-18). The end point … a hole, a broken yarn, weight loss or strength loss" | 80, 81, 82 | PARTLY | CCSI: CS10 is "Rubber & Abrasive Grain", "Mild"; Calibrade wheels are "vitrified (clay)", but H-18 isn't named. Taber's end points: "loss in breaking strength, yarn breakage, loss in coating, change in gloss, color loss", plus weight loss. No source lists "a hole". | Drop "a hole" (or source it). Name H-18 from Taber's wheels page. |
| H20 | Fabric weight › worked example | "12 by 12 yarns per cm … gives only about 134 g/m² before crimp" | none | ARITHMETIC (minor) | (12+12) × 500 ÷ 90 = 133.3 | "about 133 g/m²". The claim that this version is common ("you'll often see") is also unsourced. |
| H21 | Laminates | "Dimension-Polyant calls its scrim X-PLY; Challenge calls its version CrossPly." / "Film: … usually PET" / "Backer: …" | none | UNSOURCED (minor) | True per x-pac.com product pages ("X-PLY® at 22°"), Challenge collection pages ("45° Blue CrossPly", "PET film") and the ALPAKA interview [57] (X4 taffeta backing). | Add [57] and/or the maker pages. |
| H22 | Fabric classes | Fused: "A weave and a film joined by heat with no glue, all polyethylene" | none | UNSOURCED (minor) | Not cited. ALUULA [64] supports "no adhesives" and "100% polyethylene"; the weave-plus-film structure isn't sourced here. | Cite [64] (and a structure source). |
| H23 | Tests › Waterproofing | "In practice a bag leaks at its zips and seams long before its fabric does." | none | UNSOURCED (minor) | Stated as fact with no source. | Label it as the writer's view, or cite. |
| H24 | Denier | Tag "my arithmetic" on "400D UHMWPE ≈ 470D nylon" | — | PARTLY (label) | The arithmetic is right (400 × 1.14 ÷ 0.97 = 470). But the house-rules key lists the tag as "my calculation"; "my arithmetic" isn't one of the defined tags. | Change the tag text to "my calculation". |
| H25 | Source list [6] | "Malkin et al. … — UHMWPE review" | 6 | WRONG (label, minor) | It's a research article ("Characterization and Rheological Properties of UHMWPEs", Polymers 16(24) 3501, 16 Dec 2024), not a review. It does define UHMWPE as "MW of several (usually 3–6) million Da". | Relabel "UHMWPE characterisation paper". |

---

## 2. compare.html — Side by side

**Charts:**
- Weight chart: every dot's position matches its label exactly (the scale runs 0–420 g/m²).
- Tear chart: the circle and square markers match their tooltip values exactly. The triangle markers sit within about 3 N, which is marker geometry.

**Source values recomputed, all OK:**
- **ULTRA:** 69.4, 103.1 / 133.2, 187.7 and 250 lb → 309, 459 / 592, 835 and 1,112 N.
- **ECOPAK:** EPX70RS 24.7, EPX200 33.1 / 34.6, EPX300RS 37.4, EPX400 45.7, EPX600 42.6, EPLX200 21.3, EPLX400 36.6, EPLX840 51.3 and EPLX1680 114.1 lb → 110, 147 / 154, 166, 203, 189, 95, 163, 228 and 508 N.
- **X-Pac hyperTEC:** 273.1, 281 and 533 / 480 N (Extremtextil names ASTM D2261-13 for all three).
- **Dyneema:** 27, 42 and 250 lb → 120, 187 and 1,112 N.
- **Ultradyne:** 65 / 80 lb → 289 / 356 N.
- **Venom:** 19.3 lbf → 86 N.

**Other values confirmed:**
- All weights and abrasion cycles in the tables, and all waterproof claims.
- Prices on 23 Oct 2026, unchanged: VX21 €38.90, EPX200 €33.40, ULTRA 200X €67.90.
- 20,000 mm ≈ 2 bar, 3,000 mm ≈ 0.3 bar, 1,000 mm ≈ 0.1 bar.

**OK: about 140 values and claims.**

| # | Section | Claim (short quote from the page) | Cited | Verdict | What the source actually says | Suggested fix |
|---|---|---|---|---|---|---|
| C1 | Abrasion prose | "At similar weight, ULTRA's published figures are roughly four to nine times X-Pac's and ECOPAK's." | (table: 4, 5, 6, 8, 9, 11, 33) | ARITHMETIC | From the page's own table (figures confirmed at source): ULTRA 400X (208 g/m², 8,800) vs VX21 (210), EPX200 (216) and EPLX200 (162), all 500 cycles = **17.6×**. ULTRA 200X (155, 4,400) vs those = 8.8×. ULTRA 800X (335, 16,000+) vs X42/VX42 (1,700) = 9.4×; vs RX30 (2,000) = 8×; vs EPX400 (3,000) = 5.3×; vs EPLX840 (334 g/m², 4,400) = **3.6×**. | "roughly 3½ to 18 times (about 9× for most like-for-like pairs)", or name the pairs. |
| C2 | Lede | "Graflyte is missing from the charts because nobody publishes its numbers." | none | WRONG | The weight chart on the same page plots Graflyte V-98 (98 g/m², Durston [20]) and VA (130 g/m², Arc'teryx [21]), and the prose cites V-98 as one of the lightest. Graflyte is missing only from the tear chart. | "Graflyte appears only in the weight chart, because nobody publishes its strength figures." |
| C3 | What each class gives up › ULTRA | "The highest published tear and abrasion figures of the laminates, for the weight." | 13, 34, 52 | PARTLY | Abrasion holds. Tear doesn't hold, by the page's own tear chart: X-Pac UX20 sT 533 N at 161 g/m² vs ULTRA 200X 459 N at 155; UX10 273 N at 85 g/m² (3.2 N per g/m²) vs ULTRA 100X 309 N at 122 (2.5). The tear section itself says "ULTRA and hyperTEC sit well above ECOPAK". | "The highest published abrasion figures, and tear on a par with X-Pac hyperTEC…" |
| C4 | What each class gives up › Graflyte | "no published numbers at all" | 55, 56 | PARTLY | Weights are published: Durston 98 g/m² [20]; Arc'teryx "Graflyte VA, 130gsm" [21]; GGG "V98 … 52 & 78gsm" [56]; Inertia "between 1.53 and 2.89 ounces per square yard" [55]. Inertia (Jan 2024): "no official testing data has yet been released". | "no published strength, tear or abrasion figures". |
| C5 | Waterproofing prose | "Coated nylon's 1,000 mm is fine for rain but not for sitting in a puddle." | none (paragraph cites 42) | UNSOURCED | No source for "fine for rain". The cited Kwon & Nam [42] puts "highly water resistant … resists penetration in rain" at 13.79–172.37 kPa (2–25 psi). 1,000 mm ≈ 9.8 kPa (1.4 psi) is below that band. | Cite a source for rain adequacy, or soften: "may be marginal in sustained rain and won't survive sitting in a puddle". |
| C6 | Tear intro | "Only fabrics … from ASTM D2261 … That's Challenge's whole range" | 8, 9, 11 | PARTLY (minor) | EPX, EPLX and UltraWeave all print D2261. But Challenge's UltraStretch [37] prints "ASTM D1424-09" (Elmendorf), and the page itself lists UltraStretch under other methods. | "That's Challenge's ECOPAK and ULTRA ranges". |
| C7 | Tear chart | X-Pac UX10 sT plotted at 116 g/m² on an axis labelled "Weight, g/m² (maker figure)" | 29 | PARTLY | 116 g/m² is Extremtextil's figure [29]. Dimension-Polyant's own launch announcement [7] gives "UX10 ST … 122g/square meter". | Plot at 122, or note "retailer weight" in the tooltip. |
| C8 | Weight prose | "A TX backer adds 80 to 107 g/m² to ULTRA, by Challenge's own figures" | 11 | PARTLY | Challenge's gsm column gives +100 (200TX 255 vs 200X 155), +107 (400TX 315 vs 208) and +80 (800TX 415 vs 335), so the range holds by gsm. But Challenge's own oz/yd² column gives 200TX 5.9 vs 4.6 = **+44 g/m²**, so its figures disagree with each other. The +80 also comes from 800TX, which isn't in the chart. | "80 to 107 g/m² by Challenge's gsm figures (its oz/yd² figure for 200TX implies only ~45)". |
| C9 | Weight prose | "ULTRA 200X and UX20 sT sit almost on top of each other in the mid-150s" | 2, 7, 11 | PARTLY (minor) | Maker figures are 155 (Challenge) and 161 (x-pac.com). "Mid-150s" holds only if UX20 sT's 154 comes from the press release. | "at 155 and 161 g/m²". |
| C10 | Abrasion prose | "Taber says those [wheel, load, end point] must match before two numbers compare" | 32 | PARTLY (minor) | Taber: "When comparing materials of different specific gravities, test parameters must be the same including wheel selection and load." No end point is mentioned, and the statement is about specific gravity. | "…wheel and load must match". |
| C11 | Abrasion prose | "Abrasion is the one property where lab cycles and real wear are known to drift apart" | 36 | PARTLY | D3884 says lab results "should not be relied upon for prediction of actual wear-life … unless there are data showing the specific relationship" and may "not always reveal a difference known to exist" in use. It doesn't say abrasion is the *only* such property. | "Abrasion is where ASTM itself warns lab cycles don't predict wear life". |
| C12 | Abrasion prose | "some find ULTRA very tough, and some desert hikers aren't impressed" | 34, 35 | PARTLY (minor) | SectionHiker: "Woven UHMWPE is extremely tough against scuffs and granite scrapes." BPL thread: one desert hiker, GW Hayduke ("Ultra's abrasion resistance has not impressed me compared to the lowly Cordura"); Chris L mentions "a handful of anecdotal reports". | "a desert hiker on BPL wasn't impressed", or tag **owner report**. |
| C13 | What each class gives up › Coated | "Quiet, soft, and easy to sew and repair" | 44, 45 | PARTLY | The GEAR AID page says only "Quickly fix rips and tears on down jackets, tents and backpacks". It says nothing about coated nylon being quiet, soft or easy to sew. ULA [45] supports only "replacing and repairing robic materials is significantly more streamlined than Ultra" and Ultra being "a bit more rigid". Nothing supports "quiet". | Narrow to "easier to repair than Ultra [45]", or add sources for quiet and soft. |
| C14 | What each class gives up › Coated | "more weight for the strength" | 46, 47 | UNSUPPORTED | Bushwalk supports "soak into the exposed fibers" and PU going to "goo". ARL covers hydrolysis. Neither compares weight for strength. | Cite the tear chart and the nylon page's data, or drop. |
| C15 | Weight chart | "1000D Cordura, coated … 329 / 381" (tooltip: Ennis 329, Rockywoods 381) | 24, 25 | PARTLY (minor) | Ennis: "329 gsm … Polyurethane Coating" (OK). The Rockywoods blog lists "CTD1000MS-CORDURA-Black: 11.24 Oz/Sq Yd" (= 381 g/m²) but doesn't say it is coated. | Note that the coating is unstated for the 381 figure. |
| C16 | Full table › Venom | "86 / 125 N" | 27 | PARTLY (minor) | The data sheet gives Weft "28 + lbF" (= 124.5+ N), with a "+". | "86 / 125+ N". |

---

## 3. glossary.html — Glossary

**OK: about 50 entries checked and matching.** They include:
- weft, ends and picks (48 × 35), crimp, denier, tex and dtex, tenacity, g/m², plain, basket, twill, ripstop and ballistic;
- bright filament ("high tenacity nylon 6,6 bright filament"), hand (Fairchild via Threads), TPU, silnylon ("only one thing sticks to silicone: silicone"), scrim and X-PLY at 22°;
- ECOPAK CrossPly at 45°, mil, delamination, PSA, welding ("None of our ECOPAK fabrics are weldable as there is no TPU film");
- tongue, Elmendorf, trapezoid and slit tear; grab tensile; seam strength; air permeability; hydrostatic head;
- PET, rPET, UHMWPE ("3–6 million Da"), Ultra-PE / U-PE, gel spinning, creep and monomaterial.

| # | Section | Claim (short quote from the page) | Cited | Verdict | What the source actually says | Suggested fix |
|---|---|---|---|---|---|---|
| G1 | Coatings › PU | "It can go sticky with age" | 10, 14 | UNSUPPORTED | Carryology [10] says PU "adds water resistance and stiffens the fabric slightly"; it doesn't mention stickiness. ARL [14] describes "cracking or extreme softening", blistering and coatings that "became hard and brittle". It doesn't mention stickiness either. | Cite Bushwalk ("stick to itself and become one big ball of goo"), SylvanSport or iFixit, as the hub does. |
| G2 | Coatings › Hydrolysis | "In ester-type PU it shows as stickiness and peeling" | 14 | PARTLY | ARL: polyester urethanes are "more vulnerable to hydrolysis". The symptoms it describes are cracking, extreme softening, blistering and seams coming apart. It doesn't mention stickiness or peeling. | "…shows as softening, cracking and blistering [14]; on bags, as stickiness and flaking [48]". |
| G3 | Tests › Wyzenbeek | "back-and-forth rubbing over a cylinder. Results in double rubs" | 34 | UNSUPPORTED | The D4157 abstract says only "woven textile fabrics using the oscillatory cylinder tester". It describes neither the motion nor the unit. The ACT guideline (hub [86]) does say "rubbed back and forth" and "double rub cycles". | Add the ACT guideline as a source. |
| G4 | Tests › Taber | "only comparable with the same wheel, load and end point" | 31 | PARTLY | Taber: parameters "must be the same including wheel selection and load" when comparing materials of different specific gravities. No end point is mentioned. | Drop "and end point", or source it. |
| G5 | Tests › CS-10, H-18 | "H-18 is hard vitrified clay" | 32 | PARTLY | CCSI describes Calibrade wheels as "vitrified (clay) and silicon carbide", but never names H-18. CS10: "Rubber & Abrasive Grain", "Mild" (OK). | Cite Taber's wheel page for H-18. |
| G6 | Tests › CRE | "the machine most ASTM tear and tensile methods prefer" | 25 | PARTLY (minor) | D2261: "The CRE-type tensile testing machine has become the preferred test apparatus for determining tongue tearing strength." That covers D2261 only (D5587 also prefers CRE). | "…the machine ASTM's tongue and trapezoid tear methods prefer". |
| G7 | Tests › Martindale | "Results in rubs" | 33 | PARTLY (minor) | RISE: "The result is reported as the number of cycles". | "Results in rubs or cycles". |
| G8 | Tests › Strip / Grab | "a full-width strip is pulled" / "the middle of a wide strip is gripped" | 30, 29 | PARTLY (minor) | Neither abstract describes clamp geometry. D5035 says only "the force required to break a specific width of fabric". | Minor. |
| G9 | Tests › Mullen tester | "A high-pressure water-resistance tester in ASTM D751" | 37 | PARTLY (minor) | The D751 abstract lists "Procedure A—Mullen Type Tester" under Hydrostatic Resistance, but gives no pressures. Kwon & Nam (hub [94]) supply the 160 psi figure. | Add Kwon & Nam. |
| G10 | Yarn and weave › Oxford | "Strictly a 2×1 basket weave" | 2, 8 | PARTLY | CottonWorks: "sometimes referred to as a 2 x 1 basket weave". Canvas ETC: "(2×1) or two (2×2)". | "Usually a 2×1 basket weave". |
| G11 | Yarn and weave › Float | "Long floats snag and wear faster" | 4 | PARTLY (minor) | Azeem: "long floats and less interlacement reduced the abrasion resistance". The paper doesn't discuss snagging. | Drop "snag" or add a source (CottonWorks ties snagging to plain weave's stability). |
| G12 | Yarn and weave › Warp | "Yarns running lengthwise along the roll" | 1 | PARTLY (minor) | Pratt: "warp (vertical threads)". | Minor. |
| G13 | Yarn and weave › AJT | "matte, canvas-like feel" | 10 | PARTLY (minor) | [10] says "roughen and loop the filaments, giving it that matte, almost slightly furry surface". "Canvas-like" comes from the other Carryology article (hub [33]). | "matte, slightly furry", or add hub [33]. |
| G14 | Yarn and weave › High-tenacity | "Yarn drawn harder during spinning for more strength" | 13 | PARTLY | Wikipedia: "fibers are drawn to increase strength and orientation". It says nothing about HT yarn being drawn harder. | Cite a source that defines HT. |
| G15 | Fibres › Solution-dyed | "Yarn coloured before it's spun, for better colourfastness" | 10 | PARTLY (minor) | [10]: "woven from solution-dyed yarns for better UV and color fastness". It doesn't describe the process. | Add a definition source. |
| G16 | Coatings › DWR | "It doesn't make a fabric waterproof" | 17 | PARTLY | Patagonia: finishes "help moisture bead up and roll off". It has no "not waterproof" statement. | As H5. |
| G17 | Coatings › C6, C0 | "Fluorinated DWR (C6) and fluorine-free DWR (C0)" | 18 | PARTLY | Mammut describes C6 treatments as "shorter-chain C6" and the goal as "PFC-free". It never uses "C0". | Source the "C0" label elsewhere (e.g. the Challenge EPX page: "C0 DWR (No Fluorocarbons)"). |
| G18 | Coatings › X-PLY, CrossPly | "diagonal yarns at … 45° (ECOPAK, ULTRA)" | 20, 21, 22 | PARTLY (minor) | X21: "X-PLY® at 22°" and EPX: "45° Blue CrossPly" (both OK). The UltraWeave collection page [22] lists only "Ultra-PE CrossPly", with no angle. | Source ULTRA's 45° elsewhere or drop it. |
| G19 | Coatings › Film, Backer | "usually PET" / "such as X-Pac's X4 taffeta or ULTRA TX's ripstop" | none | UNSOURCED (minor) | Supported by the ALPAKA interview (X4 "woven taffeta backing") and Challenge [22] ("70d recycled polyester ripstop"; "0.75 mil PET film"). | Add [22] and the ALPAKA interview. |
| G20 | Fibres › Nylon 6, 6,6 | "named for their six-carbon starting chemicals" | 40 | PARTLY (minor) | As H13: nylon-6 is "so named because it has six carbon atoms in the basic unit". | As H13. |
| G21 | Fibres › Cordura | "Mostly nylon, some polyester" | 48 | PARTLY | The FAQ supports "ingredient brand", "certified mill partners" and "trademarks of INVISTA". It never names a fibre type. (The re/cor page [42] shows both nylon and polyester yarns.) | Cite [42] or a CORDURA fabric-range page for the fibre mix. |
| G22 | Fibres › Robic | "Hyosung's high-tenacity nylon yarn brand" | 49 | PARTLY | The Hyosung page lists only the product names "CREORA Robic Nylon" and "CREORA Robic-Air Nylon", with no description. | Cite a page that describes Robic as high-tenacity. |
| G23 | Source list [43] | "Malkin et al. … — UHMWPE review" | 43 | WRONG (label, minor) | As H25: it's a research article. | Relabel. |

---

## Verdict counts (all three pages)

| Verdict | Hub | Compare | Glossary | Total |
|---|---|---|---|---|
| OK (approx.) | ~110 | ~140 | ~50 | ~300 |
| WRONG | 1 (label) | 1 | 1 (label) | 3 |
| PARTLY | 19 | 12 | 19 | 50 |
| UNSUPPORTED | 0 | 1 | 2 | 3 |
| MISCITED | 0 | 0 | 0 | 0 |
| UNSOURCED | 4 | 1 | 1 | 6 |
| ARITHMETIC | 1 | 1 | 0 | 2 |
| UNREACHABLE | 0 | 0 | 0 | 0 |
| **Non-OK rows** | **25** | **16** | **23** | **64** |

The hub's 19 PARTLY rows include the "my arithmetic" tag-label row (H24).
