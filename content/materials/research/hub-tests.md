# Hub research: how to read a fabric (building blocks and test methods)

Researched 23 October 2026. All sources below were opened in this session with WebFetch. The shared WebSearch budget for this turn ran out near the end, so a few standards pages could not be located (see "Open questions / unreachable").

Note for the site owner: every ASTM store page now carries a notice that "using AI on ASTM standards" is prohibited. Only the free public abstract pages were read, and they are summarised here, not reproduced.

## Findings

### 1. Denier and dtex

**Definitions and conversion**
- Denier is the mass in grams of 9,000 m of yarn or filament. [Wikipedia: Units of textile measurement](https://en.wikipedia.org/wiki/Units_of_textile_measurement) (cites Gohl & Vilensky, *Textiles for Modern Living*, 1990); [Swicofil: yarn numbering systems](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
- Tex is grams per 1,000 m and decitex (dtex) is grams per 10,000 m. Tex is the system ISO/TC 38 approved for all fibres and yarns (ASTM D861). [ASTM D861-07(2024)e2 abstract](https://store.astm.org/d0861-07r24e02.html); [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
- Conversions: 1 tex = 9 den = 10 dtex, so dtex = den ÷ 0.9 (≈ 1.111 × den) and den = 0.9 × dtex. [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
- NIST lists 1 denier = 1.111 111 × 10⁻⁷ kg/m (rounded) and 1 tex = 1 × 10⁻⁶ kg/m (exact). [NIST SP 811 Appendix B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
- Denier is a "direct" system: a bigger number means a heavier, coarser yarn. Merriam-Webster's example says 100-denier yarn is finer than 150-denier. [Merriam-Webster: denier](https://www.merriam-webster.com/dictionary/denier)
- Denier per filament (dpf) is the yarn's denier divided by its number of filaments. [MiniFIBERS: fiber measurement conversions](https://www.minifibers.com/fiber-measurement-conversions)

**Where the name comes from**
- The denier was a French coin. Dictionary.com says it was introduced in the 8th century and minted until 1794, first in silver and later in copper. The word comes from Latin *denarius*. [Dictionary.com: denier](https://www.dictionary.com/browse/denier?s=t)
- Etymonline calls it a medieval French silver coin equivalent to the English penny, used from Charlemagne's time into the early modern period. [Etymonline: denier](https://www.etymonline.com/word/denier)
- Merriam-Webster puts the yarn unit and the coin under one headword with a single coin etymology, but doesn't explain how the unit came from the coin. [Merriam-Webster](https://www.merriam-webster.com/dictionary/denier)
- Wikipedia states that the unit "originates with the medieval French denier coin", but gives no citation for that sentence. [Wikipedia: Units of textile measurement](https://en.wikipedia.org/wiki/Units_of_textile_measurement)
- The best mechanism found comes from Samuel S. Dale's *The Metric Failure* (1904), as quoted by The Metric Maven:
  - French and Italian silk counts were the weight, in deniers (a coin-weight of 24 Paris grains), of 9,600 aunes of silk.
  - Converted to metric, that comes out at about 1 g per 9,000 m.
  - So the 9,000 m figure is a metric rounding of the old silk count.
  [The Metric Maven: The Nylon Curtain](https://themetricmaven.com/the-nylon-curtain-made-elsewhere/)
- Status: the coin origin is CONFIRMED. The derivation via the silk-trade coin-weight is supported by one secondary source (a blog quoting a 1904 book). The date of the silk system is only "pre-metric"; nothing found dates it to the medieval period.

**Why the same denier means a different thickness in different fibres**
- Denier is mass per length. For the same mass per length, a denser polymer takes up less cross-section, so a same-denier yarn in a denser fibre is thinner. This follows from the diameter formula below.
- Swicofil warns that a multifilament yarn's diameter can't be reliably stated in mm, because it depends on filament arrangement, twist and intermingling. Specific gravity gives only a rough thickness indication. [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)

**Densities (g/cm³)**

| Fibre | Density | Sources |
|---|---|---|
| Nylon (PA 6 and PA 6.6) | 1.14 | [Swicofil density chart](https://www.swicofil.com/commerce/basic-information/yarn-manual/density-chart) lists both at 1.14. [Lenntech](https://www.lenntech.com/chem-physical-resistance-data-fibres.htm) gives a range of 1.04–1.14 for polyamide. |
| Polyester (PET) | 1.38 | [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/density-chart); [Lenntech](https://www.lenntech.com/chem-physical-resistance-data-fibres.htm) |
| UHMWPE fibre | 0.97 | [FIBER-LINE UHMWPE data sheet](https://careers.polyone.com/sites/default/files/2021-06/fl.us-.datasheet-uhmwpe.pdf) gives specific gravity 0.97 for both its grades. [MiniFIBERS Dyneema SK crimped staple TDS](https://www.minifibers.com/files/TD/PI-TDS_Dyneema-SK-Crimped-Staple.pdf) gives 0.975 (typical value; undated, DCN 260601). [Wikipedia: UHMWPE](https://en.wikipedia.org/wiki/Ultra-high-molecular-weight_polyethylene) gives "as low as 0.97" for fibres such as Dyneema SK75, citing Crouch, *The Science of Armour Materials* (2017). |

- Discrepancy: Swicofil's chart lists UHMWPE at 0.90, which disagrees with the other three sources. Bulk (non-fibre) UHMWPE is about 0.93–0.94 per Wikipedia. [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/density-chart); [Wikipedia](https://en.wikipedia.org/wiki/Ultra-high-molecular-weight_polyethylene)
- DSM's own Dyneema SK75 brochure says only that the density is below 1 (so it floats). It gives no figure. [DSM Dyneema SK75 brochure (hosted by Pelican Rope)](https://pelicanrope.com/content/PDFs/DyneemaSK75_Tech_Sheet.pdf)
- The Solstice/Honeywell Spectra fibre pages that might give density returned 404 errors or redirects (see Unreachable).

**Yarn diameter from denier and density**
- MiniFIBERS (a fibre maker) gives diameter (µm) = 11.89 × √(dpf ÷ density in g/cm³). [MiniFIBERS](https://www.minifibers.com/fiber-measurement-conversions)
- The constant checks out from first principles: d = √(4·den / (9×10⁵·π·ρ)) cm, which gives 11.894 µm × √(den/ρ). It applies to a solid round filament, or to a whole yarn treated as if it were one solid rod.
- Real multifilament yarns are thicker than this because of air gaps (packing). [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
- Equivalent solid diameters computed with the formula (µm; rounded):

| Denier | Nylon 1.14 | PET 1.38 | UHMWPE 0.97 |
|---|---|---|---|
| 100D | 111 | 101 | 121 |
| 200D | 158 | 143 | 171 |
| 210D | 161 | 147 | 175 |
| 400D | 223 | 203 | 242 |
| 420D | 228 | 208 | 248 |
| 500D | 249 | 226 | 270 |
| 1000D | 352 | 320 | 382 |
| 1050D | 361 | 328 | 391 |

- Worked consequence (my arithmetic):
  - A PET yarn needs about 605D to match the cross-section of a 500D nylon yarn.
  - A UHMWPE yarn matches it at about 425D.
  - So a 400D UHMWPE yarn is roughly as "fat" as a 470D nylon one.

### 2. Weaves

**Plain weave**
- Each warp goes over one weft and under the next; the repeat is 2 ends × 2 picks. It has the most interlacings, making it stable, with few problems with skew, seam slippage or snagging. It is stiffer and drapes less. [CottonWorks (Cotton Incorporated): basic woven fabric designs](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/) (last modified 21 Apr 2025)

**Basket weave (and ballistic)**
- Groups of yarns weave together as one. A 2×2 basket has a 4-end × 4-pick repeat. CottonWorks says it is "not as stable" as plain weave. [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)
- Pratt Institute's textile library likewise rates basket weave less stable than plain and quicker to fray. [Pratt Textile Resource Library: wovens](https://textileresearchlab.pratt.edu/construction/wovens) (undated)
- Ballistic nylon (Wikipedia, which gives no citation for the weave details):
  - The original specification was an 18 oz nylon fabric in a 2×2 basketweave from 1050-denier high-tenacity yarn.
  - Today the term covers any nylon fabric with a "ballistic weave", typically 2×2 or 2×3. Wikipedia writes 2×3, not 3×2.
  - Common deniers are 840, 1050 and 1680.
  [Wikipedia: Ballistic nylon](https://en.wikipedia.org/wiki/Ballistic_nylon)
- History: DuPont developed it during WWII for flak jackets for airmen, to stop fragments rather than bullets. [Wikipedia: Ballistic nylon](https://en.wikipedia.org/wiki/Ballistic_nylon) (cites the AMEDD "Personnel Protective Armor" history for the flak-jacket use)
- Carryology dates it to around 1944. It also says ballistic is now a loose term for basketweave nylon from 840D to 1680D, and that its smooth surface is less abrasion-resistant than textured (Cordura-type) nylon. [Carryology: history and science behind backpack textiles](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/) (Mike Knispel, 23 Mar 2026)
- WaterField Designs, a bag maker, describes its ballistic as a tight 2×2 basket weave that "maximizes tear resistance in all directions" (maker claim, no test given). [WaterField Designs](https://www.sfbags.com/blogs/news/what-is-ballistic-nylon-and-why-does-waterfield-designs-use-it) (undated)

**Ripstop**
- Ripstop is a base weave (usually plain) with stronger, often thicker, reinforcement yarns woven in a crosshatch grid. The grid is typically 5–8 mm (0.2–0.3 in) apart. Some ripstops instead weave two or three fine yarns together at smaller intervals. [Wikipedia: Ripstop](https://en.wikipedia.org/wiki/Ripstop) (cites *Fairchild's Dictionary of Textiles*, 7th ed., p. 474)
- Carryology and Canvas ETC (a retailer) also give 5–8 mm. [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/); [Canvas ETC](https://www.canvasetc.com/denier-fabric-weave-types-plain-vs-oxford-vs-ripstop)
- History:
  - Nylon production went entirely to military uses in WWII, including parachute cloth.
  - The ripstop patent cited is a 1962 US Army filing for "parachute fabric containing stretch and non-stretch type ripstops" (US3032072A; inventors Weiner and Brandt).
  - Wikipedia does not say ripstop itself was used in WWII parachutes. Carryology says it "grew out of" WWII parachute needs but cites only the 1962 patent.
  [Wikipedia: Ripstop](https://en.wikipedia.org/wiki/Ripstop); [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)

**Twill**
- Twill has a diagonal line, with 2/1, 2/2 and 3/1 variants. Longer floats and fewer interlacings give 3/1 twill "higher tear strength" (denim, chino). [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)

**Oxford**
- Textile definition: a 2×1 basket, in which two warp ends weave as one over single picks. It usually has about twice as many ends as picks per inch. [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)
- In bag fabrics, "Oxford" is used loosely for 2×1 or 2×2 basket constructions, commonly at 210D, 420D, 500D and 600D. [Canvas ETC (retailer)](https://www.canvasetc.com/denier-fabric-weave-types-plain-vs-oxford-vs-ripstop) (updated 8 Apr 2025)
- Carryology notes Oxford nylon quality varies widely at the same denier and is usually PU-coated. [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)

**What weave does to tear strength (textile engineering)**
- Tear strength depends on single-thread strength and on how many threads bunch together and share the load at the tear tip.
- Looser structures, and weaves with fewer interlacings, let threads group, which raises tear strength. Twill and 2/2 matt (basket) group better than plain and resist tearing better.
- A high sett (tight weave) restricts yarn movement and lowers tear strength considerably.
- Crease-resist and drip-dry finishes may reduce tear strength.
- [UPTTI (Uttar Pradesh Textile Technology Institute) lecture notes on tear](https://uptti.ac.in/classroom-content/data/tear-1%2015-4-2020.pdf)
- A Technical University of Liberec paper on cotton plain, twill and sateen found that the weave pattern determines tear strength, and it recommends twill and matt weaves for higher tear strength. [TUL: Tear and tensile strength of cotton woven fabrics' basic structures (abstract)](https://dspace.tul.cz/handle/15240/172131)

**What weave does to abrasion (textile engineering)**
- Azeem et al. (2018) compared plain 1/1, twill 3/1 and satin 4/1, using ASTM D3886 inflated-diaphragm abrasion at 28 kPa with a 454 g load.
  - They found that "long floats and less interlacement" reduce abrasion resistance.
  - Plain weave resisted abrasion best and was the same in both directions.
  - Twill and satin wore faster where their floats faced the abradant.
  [Azeem et al., *Fibres & Textiles in Eastern Europe* 26(1), 2018](https://yadda.icm.edu.pl/baztech/element/bwmeta1.element.baztech-9e99ccb7-490d-4601-a8b8-62a5d66c9f0a/c/6_azeem_i_inni_fibres_2018_1.pdf)
- An encyclopedia review summarises a study reporting higher stiffness, abrasion and pilling resistance in plain weave than in twill and satin. [Encyclopedia MDPI: Weave structure and fabric properties](https://encyclopedia.pub/entry/history/compare_revision/66062)
- No peer-reviewed source was found that tests basket or ballistic weave for abrasion against plain weave.
  - Canvas ETC (a retailer) says 600D Oxford "might offer slightly better abrasion resistance" than 600D plain.
  - Carryology says ballistic's smooth surface abrades worse than textured nylon.
  Treat both as opinion. [Canvas ETC](https://www.canvasetc.com/denier-fabric-weave-types-plain-vs-oxford-vs-ripstop); [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)

**Thread count, ends and picks**
- Ends per inch is the number of warp ends in one inch of woven fabric (also called "sley" on the loom). [CottonWorks: ends per inch](https://cottonworks.com/encyclopedia-item/ends-per-inch/)
- Fabric construction is written as ends × picks per inch or per cm, e.g. 115 × 56. [CottonWorks: construction of fabric](https://cottonworks.com/encyclopedia-item/construction-of-fabric)
- Crimp is the waviness of a yarn in the fabric: (straightened yarn length − fabric length) ÷ fabric length × 100%. [Dr Jimmy Lam, Institute of Textiles & Clothing: woven fabric calculations](https://studylib.net/doc/5714336/woven-fabric-calculation); [Kumpikaitė et al., *Materials* 14(18):5157, 2021](https://www.mdpi.com/1996-1944/14/18/5157)

**Published formula for fabric weight (GSM)**
- Jimmy Lam (Institute of Textiles & Clothing) gives:
  - GSM = [ends/cm × (100 + warp crimp %) × warp tex + picks/cm × (100 + weft crimp %) × weft tex] ÷ 1000.
  - Worked example: 28 ends/cm × 18 tex at 2.5% crimp, plus 25 picks/cm × 21 tex at 9% crimp, gives about 108.8 g/m².
  [Jimmy Lam lecture (Studylib copy)](https://studylib.net/doc/5714336/woven-fabric-calculation)
- The same formula in fractional form: GSM = [EPC·Tw·(1 + Cw) + PPC·Tf·(1 + Cf)] ÷ 10.
  - It is used in a GATE Textile Engineering 2023 problem: 20 ends/cm × 30 tex plus 30 picks/cm × 25 tex, crimp ignored, gives 135 g/m².
  - The hosting page's own printed answer of 1350 is a unit slip.
  [Collegedunia: GATE TF 2023 question](https://questions.collegedunia.com/exams/questions/a-plain-woven-fabric-with-20-ends-per-cm-and-30-pi-68b2a1cd70db182ade790b2e)
- In denier terms (tex = den ÷ 9): GSM = [EPC·Dw·(1 + Cw) + PPC·Df·(1 + Cf)] ÷ 90. Derived from the above.
- Typical crimp varies widely by construction:
  - Lam's example uses 2.5% warp and 9% weft. [Lam](https://studylib.net/doc/5714336/woven-fabric-calculation)
  - Jacquard fabrics in one study measured about 11–28%. [Kumpikaitė et al. 2021](https://www.mdpi.com/1996-1944/14/18/5157)
- A garment-industry site gives a cotton-count (Ne) shortcut with a single crimp factor. Its own worked example doesn't match its formula, so don't use it. [Online Clothing Study](https://onlineclothingstudy.com/2012/01/how-to-determine-gsm-of-woven-fabric.html)
- Coatings and laminate layers add their own mass on top of the woven GSM. No source opened gives a typical PU add-on in g/m².

### 3. Coatings and laminates in general

**PU (polyurethane) coating**
- PU is the most common coating on Oxford nylon. It adds water resistance and slight stiffness. [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)
- Ageing:
  - Ester-based PU is more prone to hydrolysis and thermal ageing.
  - Ether-based PU resists hydrolysis better but is more prone to photo-oxidation.
  - Symptoms include tackiness, cracking, and flaking or peeling (loss of adhesion).
  - Humidity drives hydrolysis.
  [MoMu Studycenter: Degradation of polyurethanes](https://studycenter.momu.be/DAT/page/degradation_of_polyurethanes) (museum conservation resource, undated)

**TPU (thermoplastic polyurethane)**
- TPU is thermoplastic: it can be heat-sealed or welded (iron, hot air, high-frequency).
- Extremtextil describes its TPU-ether film as hydrolysis-resistant and suitable for prolonged humid use such as packrafts (maker/retailer guidance).
- [Extremtextil: Nylon 210den TPU-coated one side](https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710) (undated)

**Silicone**
- Silnylon is ripstop nylon (or polyester) coated on both sides with silicone. The coating makes it waterproof, improves UV stability and greatly increases tear resistance.
- Only silicone sticks to silicone, so PU seam sealers and seam tapes don't work; seams are sealed with silicone.
- Silnylon stretches slightly when wet.
- [Extremtextil: Silnylon info](https://www.extremtextil.de/en/know-how/silnylon-info) (updated 23 Jul 2026)

**DWR (durable water repellent)**
- DWR is a face finish that helps water bead up and roll off. [Patagonia: DWR](https://www.patagonia.com/dwr-durable-water-repellent.html) (undated, © 2026)
- Chemistry history (Patagonia):
  - DWR traditionally relied on PFAS.
  - Patagonia phased out long-chain C8 in 2013–2016 and then moved off C6.
  - It says all new products from Spring 2025 are made without intentionally added PFAS.
  [Patagonia](https://www.patagonia.com/dwr-durable-water-repellent.html)

**Laminate, film, scrim, backer**
- A laminate is two or more layers bonded together. Dimension-Polyant describes X-Pac as a laminated pack fabric descended from sailcloth laminates. [ALPAKA interview with Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant) (1 Aug 2022)
- Film: a continuous polymer sheet that provides the waterproof barrier, e.g. X-Pac's polyester (PET) film. [Extremtextil: X-Pac](https://www.extremtextil.de/en/x-pac)
- Scrim: a loose weave of fibres laminated into sailcloth to add strength and stability. [Wikipedia: Scrim (material)](https://en.wikipedia.org/wiki/Scrim_(material)) (cites Donaldson, *A Sailor's Guide to Sails*, 1984)
- X-PLY is Dimension-Polyant's laminated fibre reinforcement, not a print or weave effect. It is oriented at 22° to give off-axis support, and it acts as a rip-stop. [ALPAKA/Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant)
- Backer: a thin woven fabric (often taffeta) laminated on the inside face to protect the film.
  - Dimension-Polyant says X4 and LS use a woven taffeta backing and X3 uses a polyester film backing. [ALPAKA/Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant)
  - Extremtextil describes X4 as 4 layers including a lightweight inner lining. [Extremtextil: X-Pac](https://www.extremtextil.de/en/x-pac)

**Mil**
- 1 mil = 0.001 in = 2.54 × 10⁻⁵ m (exact) = 25.4 µm. [NIST SP 811 B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
- So 0.25 mil = 6.35 µm, 0.5 mil = 12.7 µm, and 0.75 mil ≈ 19 µm.
- Watch for "mil" written as "mm" in reviews. Carryology describes ULTRA's film as "0.5mm" and Tom Bihn describes RX30's backing as "0.5 mm". Both are almost certainly mil, which is 1/39 of a mm. [Carryology: Dawn of Ultra](https://www.carryology.com/materials/challenge-sailcloth-the-dawn-of-ultra-fabrics/); [TOM BIHN: What is X-Pac](https://www.tombihn.com/blogs/main/what-is-x-pac-and-why-were-excited-for-it)
- Extremtextil lists X-Pac film thickness as 0.5 mil for X3 and 0.25 mil for X4. [Extremtextil: X-Pac](https://www.extremtextil.de/en/x-pac)

**Units for fabric weight**
- 1 oz/yd² = 33.906 g/m² (NIST factor 3.390 575 × 10⁻² kg/m², not exact). [NIST SP 811 B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)

### 4. Test methods

General rule from the ASTM abstracts:
- Tear and abrasion numbers are empirical. They are meant to compare similar fabrics tested the same way, and they are not absolute properties.
- Every standard below recommends that labs run comparative tests, because between-lab bias is common.

#### Tear

| Standard | What it measures and how | Units | Setup notes | Status (as of page date) | Source |
|---|---|---|---|---|---|
| **ASTM D2261** tongue (single-rip), CRE | Force to *continue* a tear already started in a cut specimen. Not the force to initiate a tear. | SI (N) is standard; inch-pound (lbf) approximate | CRE tester preferred; CRT only by agreement. Two results: single-peak force, and the average of the five highest peaks. Valleys have no significance. Strong fabrics may need modified clamps. | Active version D2261-13(2024) | [ASTM D2261 abstract](https://store.astm.org/d2261-13r17.html) |
| **ASTM D1424** Elmendorf falling pendulum | Force to propagate a single-rip tear from a cut, measured with a falling pendulum | SI or US customary, each used independently | The fabric must not tear across the direction of force. Not suited to most knits. The standard warns technicians may not agree well on some fabrics. | Active D1424-25 (updated 24 Dec 2025) | [ASTM D1424-25 abstract](https://store.astm.org/d1424-25.html) |
| **ASTM D5587** trapezoid, CRE | Tear propagation from a pre-cut. The value isn't directly related to the force to start a tear. | SI standard; inch-pound approximate | CRE preferred; CRE and CRT results aren't interchangeable without a correlation. Reports single-peak force and the average of the five highest peaks. | Active D5587-15(2024) | [ASTM D5587 abstract](https://store.astm.org/d5587-15r19.html) |
| **ISO 13937-1** | Tear force by ballistic pendulum (Elmendorf) | not stated on page | — | Published 2000; confirmed 2023 | [ISO 13937-1](https://www.iso.org/standard/23369.html) |
| **ISO 13937-2** | Trouser-shaped specimen, single tear. The legs are pulled apart at constant speed and the propagation force is recorded. Replaces DIN 53859-2. | not stated on page | — | Published 2000; confirmed 2023 | [ISO 13937-2](https://www.iso.org/standard/23370.html); [FILK Freiberg lab](https://www.filkfreiberg.de/en/testing-certification/accredited-test-laboratory/standards-specifications/details/din-en-iso-13937-2) |
| **ISO 13937-3** | Wing-shaped specimen, single tear | not stated | — | Published 2000; confirmed 2023 | [ISO 13937-3](https://www.iso.org/standard/23371.html) |
| **ISO 13937-4** | (Tongue / double tear, expected) | — | — | UNCONFIRMED: page failed to load | — |
| **ASTM D751** coated fabrics, tear | Procedure A pendulum (§32); B tongue (§33–36); C trapezoidal (§37–40) | SI standard | For rubber- and plastic-coated fabrics (tarpaulins, rainwear and similar) | Active D751-26 (updated 17 Jul 2026) | [ASTM D751-26 abstract](https://store.astm.org/d0751-26.html) |

- Why tear numbers can't be swapped between methods: each method loads the tear differently (pendulum impact vs slow CRE pull, and different specimen shapes), and each reports a different statistic (pendulum reading vs single peak vs mean of the five highest peaks).
  - ASTM D2261 says no known procedure gives a "true" minimum tearing strength. [ASTM D2261](https://store.astm.org/d2261-13r17.html)
  - No published conversion between D1424 and D2261 was found.
- Example of the method zoo on a retailer sheet: Extremtextil quotes tear by "ASTM D 5735-95" and tensile by "ASTM D 5035-95". [Extremtextil 72710](https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710)
  - D5735's title was not checked here. It is not one of the usual woven-fabric tear methods.

#### Tensile

| Standard | Measures | Notes | Status | Source |
|---|---|---|---|---|
| **ASTM D5034** grab | Breaking force and elongation, gripping the centre of a wider specimen | Not for glass fabrics or knits/fabrics stretching over 11%. Grab results "cannot be directly compared" with strip: there is no simple relationship, because adjacent unclamped yarns help carry load depending on construction. Constant time-to-break of 20 ± 3 s is used in disputes. | Active D5034-21(2025) | [ASTM D5034 abstract](https://store.astm.org/d5034-21.html) |
| **ASTM D5035** strip (raveled or cut) | Breaking force and elongation of a strip | Raveled strip for wovens; cut strip for coated, nonwoven and felted fabrics. Fabrics over 200 N/cm need modified grips. Results from machines with different operating principles aren't recommended for comparison. | Active D5035-11(2024) | [ASTM D5035 abstract](https://store.astm.org/d5035-11r19.html) |
| **ISO 13934-1** strip | Maximum force and elongation at maximum force | CRE only. Not normally applicable to coated fabrics, nonwovens, glass or carbon fabrics, or fabrics of polyolefin tape yarns. | 2013 ed.; confirmed 2024 | [ISO 13934-1](https://www.iso.org/standard/60676.html) |
| **ISO 13934-2** grab | Maximum force | Same exclusions, including coated fabrics; CRE only | 2014 ed.; confirmed 26 Aug 2025 | [ISO 13934-2](https://www.iso.org/standard/60677.html) |
| **ASTM D751** | Grab (Procedure A) and cut strip (Procedure B) for coated fabrics | — | Active D751-26 | [ASTM D751-26](https://store.astm.org/d0751-26.html) |

- Unit trap: some sheets give grab tensile in "lbF/in" (e.g. RBTR's Venom sheet in the source pack). Grab force isn't normalised per inch of width the way strip results can be, so "/in" on a grab result is ambiguous. Not verified with a source; flag it for checking.

#### Abrasion

**ASTM D3884: Taber rotary platform, double head**
- The specimen (about 100 mm, square or round) sits on a turntable running at 60 or 72 rpm. Two abrasive wheels rest on it; the turntable drives them in opposite directions, giving a rub-wear pattern of crossed arcs over about 30 cm². A vacuum removes debris. [Taber Industries: Rotary Platform Abraser](https://www.taberindustries.com/taber-rotary-abraser)
- Load:
  - Each arm applies 250 g as standard. Auxiliary weights raise this to 500 g or 1000 g total per wheel.
  - Taber says comparisons need the same wheel and load. [Taber Industries](https://www.taberindustries.com/taber-rotary-abraser)
  - For D3884, a lab explainer says 250, 500 or 1000 g are chosen by agreement between parties. [Testex: ASTM D3884](https://www.testextextile.com/?p=14883) (2020, updated 2022)
- Wheels:
  - Calibrase (CS-series) is resilient rubber with aluminium-oxide grit. CS-10 is rated "mild", for 500–1000 g; CS-17 is "harsh".
  - Calibrade (H-series) is non-resilient vitrified clay with silicon-carbide grit.
  [CCSI (Taber distributor): Taber media](https://www.ccsi-inc.com/product/p-abrader-taber-media-1/)
  - Qualitest cites H-18 for heavy-duty canvas or flexible membranes. [Qualitest/World of Test](https://www.worldoftest.com/articles/ultimate-guide-taber-abrasion-test/) (vendor article, 25 Mar 2026)
- ASTM D3389, the coated-fabric Taber method, uses H-18 Calibrade wheels at 1000 g per wheel. The end-point is usually first yarn exposure, or a set cycle count plus mass loss. [ICC-ES summary of ASTM D3389](https://icc-es.org/?p=78865) (May 2025)
  - The ASTM abstract confirms D3389 measures mass loss or cycles to wear through the coating. [ASTM D3389-21](https://store.astm.org/d3389-21.html)
- D3884 end-points are not fixed. Options include:
  - residual breaking strength (per D5034/D5035) and % strength loss;
  - cycles to a specified end-point (yarn breakage, coating loss, appearance change);
  - mass loss;
  - depth of wear.
  [Testex](https://www.testextextile.com/?p=14883); [ATS lab](https://atslab.com/standard/american-society-for-testing-and-materials/astm-d3884/)
- What ASTM itself says about D3884 results:
  - Results are expressed as cycles to a specified amount of abrasion with a specified machine and technique.
  - They are not reliable for predicting actual wear life unless tied to end-use data.
  - They are more reliable when differences between materials are large.
  - End-use trials are recommended.
  [ASTM D3884-22 abstract](https://store.astm.org/d3884-22.html) (active; updated 8 Jul 2022)
  - The older edition adds that D3884 "is accordingly not recommended" for contract acceptance testing. [ASTM D3884-09(2017)](https://store.astm.org/d3884-09r17.html)
- ISO equivalent for coated fabrics: ISO 5470-1:2016 (Taber abrader; confirmed 2021). [ISO 5470-1](https://www.iso.org/standard/68002.html)

**ASTM D4966 / ISO 12947: Martindale**
- A circular specimen is rubbed in a Lissajous pattern against a standard wool abradant over felt. [RISE](https://www.ri.se/en/expertise-areas/services/abrasion-of-textiles-according-to-ss-en-iso-12947-2); [FILK Freiberg](https://www.filkfreiberg.de/en/testing-certification/accredited-test-laboratory/standards-specifications/details/din-en-iso-12947-2)
  - Specimens are about 38 mm across, at least three per test. [RISE](https://www.ri.se/en/expertise-areas/services/abrasion-of-textiles-according-to-ss-en-iso-12947-2)
- Pressure is 9 kPa or 12 kPa depending on end use. [RISE](https://www.ri.se/en/expertise-areas/services/abrasion-of-textiles-according-to-ss-en-iso-12947-2)
- D4966 detail (Testex): [Testex: ASTM D4966](https://www.testextextile.com/astm-d4966-abrasion-resistance-american-standard-martindale-method/) (22 Aug 2025)
  - The abradant is crossbred worsted wool.
  - 9 kPa (395 g weight) is used for apparel, 12 kPa (595 g) for upholstery.
  - The Lissajous figure is 60 mm and made of 16 movements.
  - End-points: two or more broken yarns (woven) or a hole (knit); an appearance change; or mass loss.
- Results are counted in cycles or rubs to the end-point. [RISE](https://www.ri.se/en/expertise-areas/services/abrasion-of-textiles-according-to-ss-en-iso-12947-2)
- ASTM D4966 is "not considered satisfactory for acceptance testing", has poor between-lab precision, and lab results alone shouldn't be used to predict wear life. [ASTM D4966-22 abstract](https://store.astm.org/d4966-22.html) (active version D4966-22(2026))
- Important: ISO 12947-2 does not apply to coated or laminated fabrics. For those, BSI says the ISO 5470 series is recommended (ISO 5470-2 is the Martindale version for coated fabrics; part 2 not opened). [BSI: BS EN ISO 12947-2:2016](https://knowledge.bsigroup.com/products/textiles-determination-of-the-abrasion-resistance-of-fabrics-by-the-martindale-method-determination-of-specimen-breakdown) (current; published 31 Dec 2016)

**ASTM D4157: Wyzenbeek, oscillatory cylinder**
- For woven fabrics only. The specimen is held taut in a frame and rubbed back and forth over a cylinder covered with abradant. [ASTM D4157 abstract](https://store.astm.org/d4157-13r17.html) (active D4157-13(2022)); [FibreGuard](https://fibreguard.com/sell/blog/abrasion-testing-for-performance-fabrics-explaining-martindale-and-wyzenbeek)
- The abradant is #10 cotton duck (contract use) or wire screen (residential). [ACT 2019](https://csi.nebraska.gov/sites/default/files/ac_abrasion_040519_knit.pdf); [FibreGuard](https://fibreguard.com/sell/blog/abrasion-testing-for-performance-fabrics-explaining-martindale-and-wyzenbeek) (7 Feb 2023)
- The unit is the double rub (one forward and one back stroke). The end-point is two yarn breaks or noticeable wear. [ACT](https://csi.nebraska.gov/sites/default/files/ac_abrasion_040519_knit.pdf)
- ASTM says it is a comparative measurement that may not predict actual performance. [ASTM D4157](https://store.astm.org/d4157-13r17.html)

**Is there a conversion between Taber, Martindale and Wyzenbeek? No.**
- The Association for Contract Textiles states: "There is no correlation between Wyzenbeek and Martindale results." It adds that labs testing the same textiles often disagree. [ACT Voluntary Performance Guidelines: Abrasion (Mar 2019)](https://csi.nebraska.gov/sites/default/files/ac_abrasion_040519_knit.pdf)
- FibreGuard says results "aren't directly comparable or convertible". [FibreGuard](https://fibreguard.com/sell/blog/abrasion-testing-for-performance-fabrics-explaining-martindale-and-wyzenbeek)
- No source was found offering a Taber-to-Martindale conversion.
- Even within Taber, results depend on wheel and load, and Taber says parameters must match for a comparison. [Taber](https://www.taberindustries.com/taber-rotary-abraser)
- Unit traps when reading sheets:
  - Taber gives "cycles".
  - Martindale gives "rubs" or "cycles"; a Lissajous figure is 16 movements. [Testex D4966](https://www.testextextile.com/astm-d4966-abrasion-resistance-american-standard-martindale-method/)
  - Wyzenbeek gives "double rubs".
  - These count different motions and are never interchangeable.

#### Waterproofing

**AATCC TM127 (hydrostatic pressure)**
- Measures a fabric's resistance to water penetrating it under hydrostatic pressure. Applies to all fabric types, including water-repellent-finished ones.
- Results may not agree with AATCC rain or spray tests.
- The test is unrestrained; AATCC TM208 is the restrained version.
- Current version TM127-2017(2018)e. The full text is paywalled ($75 members, $100 list).
- [AATCC TM127 store page](https://members.aatcc.org/store/tm127/535/)

**ISO 811:2018**
- Specifies a hydrostatic pressure method for fabrics meant to be water resistant. [SIS: SS-EN ISO 811:2018](https://www.sis.se/en/produkter/textile-and-leather-technology/products-of-the-textile-industry/textile-fabrics/ss-en-iso-8112018)
- A planned revision (ISO/WD 811, edition 3) was deleted on 29 Sep 2025, so ISO 811:2018 remains current. [ISO 87853 project page](https://www.iso.org/standard/87853.html)

**How the hydrostatic test runs**
- The face is challenged with water and the back is watched. Pressure rises at a set rate until water comes through.
- Nelson Labs runs it at 60 mbar/min or 10 mbar/min; for ISO 811 the customer must specify which. [Nelson Labs: hydrostatic pressure](https://www.nelsonlabs.com/testing/hydrostatic-pressure/) (updated 2 Jun 2026)
- The end-point is the third drop (ISO 811, AATCC 127, GB/T 4744). [Testex: hydrostatic pressure test comparison](https://www.testextextile.com/hydrostatic-pressure-test-comparison-resistance-to-water-penetration-of-textiles/) (Dec 2021, updated Oct 2023)
- A typical instrument test head is 100 cm². [Testex](https://www.testextextile.com/hydrostatic-pressure-test-comparison-resistance-to-water-penetration-of-textiles/)

**"ISO 20811"**
- No ISO standard with this number was found. What exists is EN 20811 (1992), the old European hydrostatic standard.
- The Swedish edition, SS-EN 20811 (approved 30 Oct 1992), is withdrawn and replaced by SS-EN ISO 811:2018.
- [SIS: SS-EN 20811 (withdrawn)](https://www.sis.se/en/produkter/textile-and-leather-technology/products-of-the-textile-industry/textile-fabrics/ssen20811)
- So an "EN 20811" figure on a sheet is the older edition of the same test.

**ASTM D751 hydrostatic resistance (§41–49)**
- Procedure A uses a Mullen-type tester; Procedure B uses a rising water column. [ASTM D751-26](https://store.astm.org/d0751-26.html)
- Correction to the task wording: in D751, "burst strength" means ball burst or diaphragm burst. "Mullen" appears under hydrostatic resistance. [ASTM D751-26](https://store.astm.org/d0751-26.html)
- A 2001 comparison paper notes:
  - the Mullen-type test is criticised for the very high pressures it applies;
  - hydrostatic tests generally are criticised as unrealistic for rain.
  [Kwon & Nam, *Int. J. Costume Culture* 4(3), 2001](https://koreascience.kr/article/JAKO200111921100334.pdf)

**Units and conversions (NIST)**
- 1 bar = 100,000 Pa (exact). 1 mm H₂O (conventional) = 9.80665 Pa (exact). 1 psi = 6894.757 Pa (rounded). [NIST SP 811 B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
- Therefore (my arithmetic):
  - 1 bar = 10,197 mm H₂O (10.2 m) = 14.50 psi.
  - 13.8 bar = 140,700 mm H₂O (140.7 m) = 200.2 psi.
  - 2 bar = 20.4 m.
  - 3,000 mm = 0.294 bar = 4.27 psi.
  - 10,000 mm = 0.98 bar.

**What pressures a bag or garment actually sees**
- Kwon & Nam, citing a 2000 W. L. Gore brochure:
  - Kneeling in wet grass or sitting on a soaked seat has been estimated at 172–345 kPa (25–50 psi). That is 1.7–3.4 bar, or about 17.6–35.2 m H₂O.
  - Gore called fabrics above 25 psi "waterproof" and 2–25 psi "highly water resistant", resisting rain.
  - Rain, even wind-driven, does not exert hydrostatic-test pressures.
  [Kwon & Nam 2001](https://koreascience.kr/article/JAKO200111921100334.pdf)
- Alpinetrek (a retailer guide) gives, for an 80 kg person:
  - lying down: 1,000 mm;
  - sitting: 5,000 mm;
  - kneeling: 14,000 mm.
  It says EMPA treats 4,000 mm as waterproof and 1,500 mm is the German rule of thumb. No primary source is given. [Alpinetrek](https://www.alpinetrek.co.uk/base-camp/waterproof-vs-water-repellent/) (Oct 2022, updated Oct 2024)
- No bag-specific measurement was found (e.g. a loaded pack set on wet ground). Estimates are for people kneeling or sitting.

#### Others found on bag fabric sheets

| Standard | Measures | Notes | Source |
|---|---|---|---|
| **ASTM D1683/D1683M** | Sewn seam strength in wovens, with force perpendicular to the seam | Reports three failure modes: stitch failure, yarn slippage, and rupture (seam efficiency). Doesn't predict seam wear performance. Active D1683/D1683M-22. | [ASTM D1683 abstract](https://store.astm.org/d1683_d1683m-17r18.html) |
| **ASTM D737** | Air permeability of textiles, including coated fabrics | Used for breathability and filtration. The pressure differential and units were not stated on the abstract page. Active D737-18(2023). | [ASTM D737 abstract](https://store.astm.org/d0737-18.html) |
| **AATCC 16** | Colourfastness to light | UNCONFIRMED: no AATCC abstract page reached (search budget exhausted) | — |
| **AATCC 183** | UV transmission through fabrics, the basis of UPF | US method for sun-protective fabrics, developed in 1998 by AATCC Committee RA106. UPF is measured with a spectrophotometer or spectroradiometer weighted by the erythemal (sunburn) spectrum. AATCC's own page was not reached. | [Wikipedia: Ultraviolet Protection Factor](https://en.wikipedia.org/wiki/Ultraviolet_Protection_Factor) |

### 5. What spec sheets don't tell you

**Lab abrasion vs real wear**
- All three ASTM abrasion abstracts warn that lab results don't predict wear life unless linked to end-use data. [ASTM D3884-22](https://store.astm.org/d3884-22.html); [ASTM D4966](https://store.astm.org/d4966-22.html); [ASTM D4157](https://store.astm.org/d4157-13r17.html)
- D3884 adds that the test may miss differences seen in use, and that different kinds of wear correspond to different ratings. [ASTM D3884-22](https://store.astm.org/d3884-22.html)
- D3389 (coated fabrics) frames its result as a comparative ranking only. [ASTM D3389-21](https://store.astm.org/d3389-21.html)

**Hand**
- Hand is what's perceived by touching, squeezing or rubbing a fabric: drape, stiffness, crispness, texture, thickness and so on. [Threads Magazine](https://www.threadsmagazine.com/2021/04/21/get-a-handle-on-fabric-hand) (citing *Fairchild's Dictionary of Textiles*)
- The Kawabata system can measure parts of hand (bending, shear, compression, surface friction), but bag-fabric sheets don't report it. [Threads](https://www.threadsmagazine.com/2021/04/21/get-a-handle-on-fabric-hand)

**Noise and crinkle**
- No reviewer or industry source quantifying laminate noise was found in this session (see In use).

**Denier alone doesn't settle abrasion**
- Carryology says a higher-denier ballistic nylon can be less abrasion-resistant than textured nylon. [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)

**Field-test evidence is anecdotal**
- BackpackingLight says the long-term performance of fused (molecular-bonded) laminates is not yet established by independent testing or field studies. [BackpackingLight: Arc'teryx Alpha SL 30 technical](https://backpackinglight.com/advances-materials-manufacturing-ultralight-backpacks-arcteryx-alpha-sl-30-technical/) (Ryan Jordan, 10 May 2025)

### 6. A map of fabric classes

| Class | Construction | Example | Source |
|---|---|---|---|
| Woven + coating | Woven face with a PU, TPU or silicone coating on one or both sides; no separate film | Coated Cordura/Oxford; TPU nylon; silnylon | [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/); [Extremtextil TPU](https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710); [Extremtextil silnylon](https://www.extremtextil.de/en/know-how/silnylon-info) |
| Laminate (woven face + scrim + film ± backer) | Woven face, fibre scrim (X-PLY or cross-ply), PET film, and optional woven backer, bonded with adhesive | X-Pac X3/X4; Challenge ULTRA (woven UHMWPE/polyester face) | [ALPAKA/Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant); [Extremtextil X-Pac](https://www.extremtextil.de/en/x-pac); [RBTR: ULTRA 200](https://ripstopbytheroll.com/products/challenge-ultra-200); [Garage Grown Gear (ULTRA uses solvent-free glue)](https://www.garagegrowngear.com/en-au/blogs/trail-talk/ultra-fabric-ultralight-cottage-gear) |
| Non-woven composite | UHMWPE fibres laid at 0°/90° (not woven) between two PET films | Dyneema Composite Fabric (DCF). Hybrid adds a 50–150D woven face; Woven Composite (expected 2027) uses a woven Dyneema face. | [Extremtextil: Dyneema composites](https://www.extremtextil.de/en/know-how/infos-on-dyneema-composites) (updated 23 Jul 2026) |
| Fused UHMWPE | UHMWPE layers bonded by heat/fusion with no adhesive; ALUULA calls it mono-material polyethylene | ALUULA Graflyte | [ALUULA](https://aluula.com/graflyte/) ("adhesive free", delamination risk "near zero", maker claim); [Carryology: ALUULA](https://www.carryology.com/insights/carry-101/aluula-pioneering-the-future-of-technical-fabrics) (13 Aug 2025); [BackpackingLight](https://backpackinglight.com/advances-materials-manufacturing-ultralight-backpacks-arcteryx-alpha-sl-30-technical/) |

- Sources disagree on Graflyte's make-up:
  - CompositesWorld says it is woven from UHMWPE with no polyester film. [CompositesWorld](https://compositesworld.com/news/aluula-composites-develops-circular-outdoor-gear-) (22 Feb 2024)
  - BackpackingLight describes multiple UHMWPE-based film layers fused together. [BPL](https://backpackinglight.com/advances-materials-manufacturing-ultralight-backpacks-arcteryx-alpha-sl-30-technical/)
  - ALUULA's own page opened here (aluula.com/graflyte/) did not describe Graflyte specifically.
  - This is left for the UHMWPE researcher.
- No textile reference was found that classifies bag fabrics into exactly these four classes.
- Standards do split coated and laminated fabrics from plain wovens:
  - ASTM D751 covers coated fabrics. [ASTM D751](https://store.astm.org/d0751-26.html)
  - ISO 5470 covers abrasion of coated fabrics. [ISO 5470-1](https://www.iso.org/standard/68002.html)
  - ISO 12947-2 excludes coated and laminated fabrics. [BSI](https://knowledge.bsigroup.com/products/textiles-determination-of-the-abrasion-resistance-of-fabrics-by-the-martindale-method-determination-of-specimen-breakdown)
  - ISO 13934-1/-2 normally exclude coated fabrics. [ISO 13934-1](https://www.iso.org/standard/60676.html); [ISO 13934-2](https://www.iso.org/standard/60677.html)

### 7. Glossary (about 50 terms)

Each entry: one plain-language line, then the source where the term isn't self-evident.

**Weaving and yarn**
- **Warp**: yarns running lengthwise along the roll. [Pratt](https://textileresearchlab.pratt.edu/construction/wovens)
- **Weft / fill (filling)**: yarns running across the roll, interlacing with the warp. [Pratt](https://textileresearchlab.pratt.edu/construction/wovens)
- **Ends**: individual warp yarns; ends per inch or cm is the warp density. [CottonWorks](https://cottonworks.com/encyclopedia-item/ends-per-inch/)
- **Picks**: individual weft yarns; picks per inch or cm is the weft density. [CottonWorks](https://cottonworks.com/encyclopedia-item/construction-of-fabric)
- **Construction / thread count**: ends × picks per inch or cm, e.g. 115 × 56. [CottonWorks](https://cottonworks.com/encyclopedia-item/construction-of-fabric)
- **Crimp**: the waviness of a yarn as it goes over and under. Measured as extra yarn length relative to fabric length, in %. [Lam](https://studylib.net/doc/5714336/woven-fabric-calculation)
- **Float**: a length of yarn passing over several crossing yarns without interlacing. Long floats snag and abrade faster. [Azeem et al. 2018](https://yadda.icm.edu.pl/baztech/element/bwmeta1.element.baztech-9e99ccb7-490d-4601-a8b8-62a5d66c9f0a/c/6_azeem_i_inni_fibres_2018_1.pdf)
- **Hand (handle)**: how a fabric feels when touched, squeezed or rubbed. [Threads](https://www.threadsmagazine.com/2021/04/21/get-a-handle-on-fabric-hand)
- **Denier (D)**: grams per 9,000 m of yarn. [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
- **Tex / dtex**: grams per 1,000 m and per 10,000 m; dtex ≈ 1.111 × denier. [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
- **Tenacity**: breaking force per unit linear density (strength for a given yarn weight), in cN/dtex or g/den. [DSM SK75 brochure](https://pelicanrope.com/content/PDFs/DyneemaSK75_Tech_Sheet.pdf)
  - Example: SK75 is 35.1 cN/dtex = 39.8 g/den.
  - Conversion: cN/tex = g/den ÷ 0.11325. [MiniFIBERS](https://www.minifibers.com/fiber-measurement-conversions)
- **GSM (g/m²) / oz/yd²**: fabric weight per area; 1 oz/yd² = 33.906 g/m². [NIST](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
- **Plain weave**: one over, one under. [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)
- **Basket weave**: groups of two or more yarns weave as one (2×2, etc.). [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)
- **Oxford**: a 2×1 basket weave in textile terms; in bag fabrics, loosely any basket-look Oxford nylon or polyester. [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/); [Canvas ETC](https://www.canvasetc.com/denier-fabric-weave-types-plain-vs-oxford-vs-ripstop)
- **Twill**: a weave with a diagonal rib, made by offset floats. [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)
- **Ripstop**: a weave with a grid of reinforcement yarns, typically every 5–8 mm, that stops tears spreading. [Wikipedia: Ripstop](https://en.wikipedia.org/wiki/Ripstop)
- **Ballistic (nylon)**: heavy basket-weave nylon, originally 2×2 at 1050D for WWII flak jackets; now loosely 840–1680D. [Wikipedia](https://en.wikipedia.org/wiki/Ballistic_nylon); [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)
- **AJT (air-jet textured)**: yarn bulked by air jets to give a matte, textured surface. [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/) (says Cordura's matte texture comes from air-textured yarn)
  - The mechanism is UNCONFIRMED here; [Wikipedia: Texturizing](https://en.wikipedia.org/wiki/Texturizing) covers texturing generally but not air-jet.
- **Solution-dyed**: colour added to the polymer before the fibre is spun. UNCONFIRMED: no source opened (Wikipedia pages not found).

**Coatings and laminates**
- **Scrim**: an open grid of reinforcing fibres laminated into a fabric. [Wikipedia: Scrim](https://en.wikipedia.org/wiki/Scrim_(material))
- **X-PLY**: Dimension-Polyant's laminated fibre-reinforcement scrim in X-Pac, set at 22°. [ALPAKA/Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant)
- **Film**: a continuous plastic sheet (e.g. PET) that makes a laminate waterproof. [Extremtextil X-Pac](https://www.extremtextil.de/en/x-pac)
- **Mil**: one thousandth of an inch, 25.4 µm. [NIST](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
- **Backer**: a thin woven layer (e.g. taffeta) laminated inside to protect the film. [ALPAKA/Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant)
- **Lamination**: bonding two or more layers into one fabric. [ALPAKA/Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant)
- **Delamination**: layers separating as the bond fails. [MoMu](https://studycenter.momu.be/DAT/page/degradation_of_polyurethanes) (loss of adhesion, peeling); [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/) (lists long-term delamination as an X-Pac and DCF drawback)
- **DWR**: durable water repellent, a face finish that makes water bead and roll off. It does not make a fabric waterproof. [Patagonia](https://www.patagonia.com/dwr-durable-water-repellent.html)
- **PU**: polyurethane coating, common on Oxford and Cordura-type nylons. [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)
- **TPU**: thermoplastic polyurethane; can be heat-welded. The ether type resists hydrolysis. [Extremtextil](https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710)
- **Silicone / silnylon**: silicone-coated nylon; only silicone sticks to it. [Extremtextil](https://www.extremtextil.de/en/know-how/silnylon-info)
- **Hydrolysis**: chemical breakdown by water. In ester-based PU it causes tackiness and peeling. [MoMu](https://studycenter.momu.be/DAT/page/degradation_of_polyurethanes)
- **Hydrostatic head (HH)**: the water pressure, as a column height in mm, a fabric holds before leaking. [SectionHiker](https://sectionhiker.com/hydrostatic-head-explained-measuring-waterproofness/); [ISO 811 via SIS](https://www.sis.se/en/produkter/textile-and-leather-technology/products-of-the-textile-industry/textile-fabrics/ss-en-iso-8112018)
- **Mullen (hydrostatic) tester**: a high-pressure water-resistance tester used in ASTM D751 Procedure A. [ASTM D751-26](https://store.astm.org/d0751-26.html)

**Test terms**
- **CRE**: constant-rate-of-extension tensile tester, preferred in ASTM tear and tensile methods. [ASTM D2261](https://store.astm.org/d2261-13r17.html)
- **Taber (rotary platform)**: two abrasive wheels on a spinning specimen; results in cycles. [Taber](https://www.taberindustries.com/taber-rotary-abraser)
- **CS-10 / H-18**: Taber wheels. CS-10 is mild resilient rubber-abrasive; H-18 is vitrified (non-resilient) and used for coated fabrics at 1000 g. [CCSI](https://www.ccsi-inc.com/product/p-abrader-taber-media-1/); [ICC-ES D3389](https://icc-es.org/?p=78865)
- **Martindale**: a specimen rubbed in a Lissajous figure against wool under 9 or 12 kPa; results in cycles or rubs. [RISE](https://www.ri.se/en/expertise-areas/services/abrasion-of-textiles-according-to-ss-en-iso-12947-2)
- **Wyzenbeek**: back-and-forth rubbing over a cylinder; results in double rubs. [ACT](https://csi.nebraska.gov/sites/default/files/ac_abrasion_040519_knit.pdf)
- **Double rub**: one forward plus one return stroke (Wyzenbeek). [FibreGuard](https://fibreguard.com/sell/blog/abrasion-testing-for-performance-fabrics-explaining-martindale-and-wyzenbeek)
- **Elmendorf**: falling-pendulum tear test (ASTM D1424, ISO 13937-1). [ASTM D1424](https://store.astm.org/d1424-25.html)
- **Tongue tear**: a single-rip tear propagated from a slit on a CRE tester (ASTM D2261). [ASTM D2261](https://store.astm.org/d2261-13r17.html)
- **Trapezoid tear**: a tear propagated in a trapezoid-shaped specimen (ASTM D5587). [ASTM D5587](https://store.astm.org/d5587-15r19.html)
- **Grab tensile**: the specimen is gripped across only part of its width (ASTM D5034); it doesn't convert to strip. [ASTM D5034](https://store.astm.org/d5034-21.html)
- **Strip tensile**: a full-width strip is pulled (ASTM D5035, ISO 13934-1). [ASTM D5035](https://store.astm.org/d5035-11r19.html)
- **Warp/fill (in test results)**: the direction the specimen's long side or tear runs; values usually differ by direction. [ASTM D1683](https://store.astm.org/d1683_d1683m-17r18.html) (warp or filling seam axis)

**Fibres and materials**
- **UHMWPE**: ultra-high-molecular-weight polyethylene, typically 2–6 million daltons. [Wikipedia: UHMWPE](https://en.wikipedia.org/wiki/Ultra-high-molecular-weight_polyethylene) (citing Kurtz, *UHMWPE Handbook*)
- **Gel spinning**: UHMWPE dissolved at about 5% in solvent, extruded, then hot-drawn to align the chains. Pennings found the effect in 1968. [Wikipedia: UHMWPE](https://en.wikipedia.org/wiki/Ultra-high-molecular-weight_polyethylene)
- **Creep**: slow, permanent stretch under a sustained load; worse with higher load and temperature. [DSM SK75 brochure](https://pelicanrope.com/content/PDFs/DyneemaSK75_Tech_Sheet.pdf)
- **Monomaterial**: a fabric made from a single polymer family (e.g. all polyethylene), aiding recycling. [Carryology: ALUULA](https://www.carryology.com/insights/carry-101/aluula-pioneering-the-future-of-technical-fabrics)
- **MYOG**: "make your own gear", home sewing of packs and shelters. Common usage; no source opened.

## Data table

Only specs whose source page was opened this session. Hub-level examples only; the material pages' researchers hold the full tables.

| fabric | maker | construction | weight (as published) | tear (value, units, method) | tensile (value, method) | abrasion (value, units, method) | waterproof/HH (value, units, method) | source URL | page date |
|---|---|---|---|---|---|---|---|---|---|
| Nylon 210den TPU-coated one side, heat-sealable (art. 72710) | Extremtextil (retailer; mill not named) | Nylon 6.6 taffeta 210D + 0.13 mm TPU-ether film, one side | 310 g/m² | 80 N warp / 65 N weft, "ASTM D 5735-95" | 2500 N warp / 1400 N weft, 5 cm strip, ASTM D5035-95 | not given (flexing 20,000 cycles, DIN 53351) | "over 5000 mm", method not stated | https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710 | undated |
| X-Pac RX30 | Dimension-Polyant (figures as published by TOM BIHN) | 3-layer: 300D recycled polyester face, X-PLY, PET film | 262.0 g/m² / 7.7 oz/yd² | 90.3 N warp / 49.4 N fill, method not stated | not given | 2,000 cycles, "ASTM 3884" (wheel, load, end-point not stated) | 13.8+ bar / 200+ psi, method not stated | https://www.tombihn.com/blogs/main/what-is-x-pac-and-why-were-excited-for-it | 22 Nov 2022 |
| Challenge ULTRA 200X ("EPL 200X Ultra") | Challenge (via Ripstop by the Roll) | 200D UHMWPE/polyester plain weave, UHMWPE CrossPly at 45°, recycled PET film (0.75 mil in table vs 0.5 mil in header) | 3.5 oz/yd² (119 g/m²) in header vs ~4.6 oz/yd² (155 g/m²) in table: page contradicts itself | not given (qualitative only) | not given | not given | "waterproof", no value | https://ripstopbytheroll.com/products/challenge-ultra-200 | undated (© 2026) |
| ULTRA 100 | Challenge (reported) | — | 2.9 oz/yd² | — | — | — | — | https://www.backpacker.com/gear/is-ultra-the-new-dyneema/?scope=anon | 25 Apr 2022 |
| Graflyte (range) | ALUULA (reported by reviewer) | fused UHMWPE, no adhesive | 78–110 g/m² | ~180–220 N (estimate), method not stated per value | ~4000+ N (estimate), method not stated | Martindale ~1200–1500 cycles (estimate), method not stated per value | — | https://backpackinglight.com/advances-materials-manufacturing-ultralight-backpacks-arcteryx-alpha-sl-30-technical/ | 10 May 2025 |
| Graflyte (weights) | ALUULA (reported) | — | 52, 78, 98 g/m² (GGG); 52–125 g/m² (Carryology) | — | — | — | — | https://www.garagegrowngear.com/blogs/gear-gab/aluula-graflyte-weaving-a-new-future-for-ultralight-fabric ; https://www.carryology.com/insights/carry-101/aluula-pioneering-the-future-of-technical-fabrics | 18 Dec 2024; 13 Aug 2025 |
| Generic 70D nylon ripstop vs plain | Canvas ETC (retailer estimate) | ripstop vs plain | — | ~15–20 lbs/inch vs ~5–8 lbs/inch, "ASTM D2261" (retailer estimate; no data shown) | — | plain ~300–500, Oxford ~500–800, ripstop ~300–1000+ cycles, "ASTM D3884", mid-weight (estimates; wheel/load not stated) | — | https://www.canvasetc.com/denier-fabric-weave-types-plain-vs-oxford-vs-ripstop | updated 8 Apr 2025 |
| Ballistic nylon (original spec) | DuPont (historical) | 2×2 basket, 1050D high-tenacity nylon | 18 oz (area basis not stated) | — | — | — | — | https://en.wikipedia.org/wiki/Ballistic_nylon | undated |

## Deep-dive claims checked

**Nylon post**
1. Denier = grams per 9,000 m. **CONFIRMED.** [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/yarn-numbering-systems)
2. "Why 9000 m? ... medieval France." **PARTLY.**
   - The name comes from the French denier coin, which was medieval (8th century to 1794). [Dictionary.com](https://www.dictionary.com/browse/denier?s=t); [Etymonline](https://www.etymonline.com/word/denier)
   - The 9,000 m comes from the pre-metric French and Italian silk count: the weight in deniers of 9,600 aunes, which is about 1 g per 9,000 m in metric. [Metric Maven, citing Dale 1904](https://themetricmaven.com/the-nylon-curtain-made-elsewhere/)
   - No source dates the silk system itself to the medieval period.
3. Nylon 1.14, polyester 1.38, "Ultra" 0.97 g/cm³. **CONFIRMED with caveats.**
   - Nylon and PET: [Swicofil](https://www.swicofil.com/commerce/basic-information/yarn-manual/density-chart). Lenntech gives 1.04–1.14 for polyamide. [Lenntech](https://www.lenntech.com/chem-physical-resistance-data-fibres.htm)
   - UHMWPE fibre 0.97–0.975. [FIBER-LINE](https://careers.polyone.com/sites/default/files/2021-06/fl.us-.datasheet-uhmwpe.pdf); [MiniFIBERS/Dyneema](https://www.minifibers.com/files/TD/PI-TDS_Dyneema-SK-Crimped-Staple.pdf)
   - Caveat: 0.97 is the UHMWPE fibre density. ULTRA is a UHMWPE/polyester blend face plus PET film, so the fabric as a whole is not 0.97.
4. Denier doesn't translate into thickness across fibres. **CONFIRMED.** By the diameter formula, a 500D yarn's solid-equivalent diameter is 249 µm in nylon, 226 µm in PET and 270 µm in UHMWPE. [MiniFIBERS formula](https://www.minifibers.com/fiber-measurement-conversions)
5. Plain weave = one over, one under. **CONFIRMED.** [CottonWorks](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)
6. Basket weave gives abrasion resistance because rubbing spreads across several yarns. **UNCONFIRMED; evidence leans the other way.**
   - No textile-engineering source was found showing basket beats plain for abrasion.
   - In tests, plain weave, with more interlacings and short floats, abrades least. [Azeem et al. 2018](https://yadda.icm.edu.pl/baztech/element/bwmeta1.element.baztech-9e99ccb7-490d-4601-a8b8-62a5d66c9f0a/c/6_azeem_i_inni_fibres_2018_1.pdf)
   - Carryology says smooth ballistic is less abrasion-resistant than textured nylon. [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)
   - A retailer suggests Oxford "might" do slightly better than plain at 600D. [Canvas ETC](https://www.canvasetc.com/denier-fabric-weave-types-plain-vs-oxford-vs-ripstop)
7. "Basket weave is less tear resistant ... runs along multiple yarns grouped together." **WRONG.**
   - Textile engineering says grouped yarns share the load at the tear tip, so 2/2 matt (basket) and twill tear harder than plain weave. [UPTTI tear notes](https://uptti.ac.in/classroom-content/data/tear-1%2015-4-2020.pdf); [TUL abstract](https://dspace.tul.cz/handle/15240/172131)
   - WaterField likewise says a 2×2 basket maximises tear resistance (maker claim). [WaterField](https://www.sfbags.com/blogs/news/what-is-ballistic-nylon-and-why-does-waterfield-designs-use-it)
8. Ballistic nylon was developed in WWII as flak-jacket material, too weak to stop bullets, and usually comes in 1050D/1680D. **CONFIRMED / PARTLY.**
   - DuPont developed it for WWII airmen's flak jackets.
   - Flak jackets were meant to stop fragments, not bullets, so "too weak to stop bullets" misframes the original purpose.
   - Deniers 840/1050/1680. [Wikipedia: Ballistic nylon](https://en.wikipedia.org/wiki/Ballistic_nylon)
9. Ripstop reinforcement every 5–8 mm. **CONFIRMED.** [Wikipedia: Ripstop (Fairchild's)](https://en.wikipedia.org/wiki/Ripstop)
10. Reinforcement yarns are thicker. **PARTLY.** Often stronger or thicker, but ripstop can also be made by weaving two or three fine yarns together. [Wikipedia: Ripstop](https://en.wikipedia.org/wiki/Ripstop)
11. "Ripstop was developed for parachutes during WWII." **UNCONFIRMED.**
    - Nylon parachute cloth dates from WWII.
    - The ripstop patent found is a 1962 US Army parachute-fabric filing.
    - Carryology says ripstop "grew out of" WWII needs but cites only that patent.
    [Wikipedia: Ripstop](https://en.wikipedia.org/wiki/Ripstop); [Carryology](https://www.carryology.com/liking/industry/the-fascinating-history-and-science-behind-backpack-textiles/)
12. 500D, 12 × 12 yarns/cm gives about 134 g/m² before crimp. **CONFIRMED arithmetic.** The published formula gives 133.3 g/m². [Lam](https://studylib.net/doc/5714336/woven-fabric-calculation); [GATE formula](https://questions.collegedunia.com/exams/questions/a-plain-woven-fabric-with-20-ends-per-cm-and-30-pi-68b2a1cd70db182ade790b2e)
13. Crimp adds "about 10% in a typical plain weave", giving 147 g/m². **PARTLY.**
    - The arithmetic is right (146.7 g/m²).
    - Crimp isn't a fixed 10%: Lam's example uses 2.5% warp and 9% weft, and jacquards measured 11–28%. Crimp also usually differs between warp and weft. [Lam](https://studylib.net/doc/5714336/woven-fabric-calculation); [Kumpikaitė 2021](https://www.mdpi.com/1996-1944/14/18/5157)
14. PU coating adds "typically 30 to 50 grams per square meter". **UNCONFIRMED** (no source found).
15. DWR makes water bead and roll off. **CONFIRMED.** [Patagonia](https://www.patagonia.com/dwr-durable-water-repellent.html)
    - "Negligible weight": **UNCONFIRMED.**
16. "Real 500D Cordura is about 220–250 g/m²" and "about 230 g/m² all in". **Not checked here**: left for the nylon researcher.

**X-Pac post (hub-relevant parts)**
17. Laminate = two or more layers bonded. **CONFIRMED** in substance. [ALPAKA/Dimension-Polyant](https://alpakagear.com/blogs/news/interview-with-dimension-polyant)
18. Polyester absorbs about 0.4% vs nylon "up to 10%". **PARTLY.**
    - Lenntech gives 0.4% for PES and 4% for polyamide at 20 °C and 65% RH.
    - The "up to 10%" figure (presumably at saturation) was not found. [Lenntech](https://www.lenntech.com/chem-physical-resistance-data-fibres.htm)
19. Denser polyester gives a thinner yarn at the same denier. **CONFIRMED** (formula above).
20. Tear strength measures propagation, not initiation. **CONFIRMED.** [ASTM D2261](https://store.astm.org/d2261-13r17.html); [ASTM D5587](https://store.astm.org/d5587-15r19.html)
21. The standard tests are D2261 tongue or D1424 Elmendorf, in N or lbs. **CONFIRMED**, with the caveat that the two are not interchangeable. [ASTM D2261](https://store.astm.org/d2261-13r17.html); [ASTM D1424](https://store.astm.org/d1424-25.html)
22. Warp is lengthwise, fill is crosswise. **CONFIRMED.** [Pratt](https://textileresearchlab.pratt.edu/construction/wovens)
23. Taber D3884: rotating turntable with two abrasive wheels. **CONFIRMED.** [Taber](https://www.taberindustries.com/taber-rotary-abraser)
    - "Each rotation is one cycle": **not stated** on Taber's page.
    - "Runs until the fabric fails, typically a hole": **PARTLY.** D3884 allows several end-points (strength loss, yarn break, mass loss, appearance), and the sheet must say which. The X-Pac figure states neither end-point nor wheel nor load. [Testex](https://www.testextextile.com/?p=14883); [ATS](https://atslab.com/standard/american-society-for-testing-and-materials/astm-d3884/)
24. The waterproofness test is ISO 811 or AATCC 127, raising pressure until water pushes through. **CONFIRMED as a description of those tests** (third-drop end-point). [Testex](https://www.testextextile.com/hydrostatic-pressure-test-comparison-resistance-to-water-penetration-of-textiles/)
    - **UNCONFIRMED** that X-Pac's "13.8+ bar / 200+ psi" comes from either: no method is stated on [Extremtextil](https://www.extremtextil.de/en/x-pac) or [TOM BIHN](https://www.tombihn.com/blogs/main/what-is-x-pac-and-why-were-excited-for-it).
    - A pressure that high suggests a Mullen-type tester (ASTM D751 Procedure A), but that is unverified.
25. Numbers within Dimension-Polyant's lineup are comparable because they share a test setup. **UNCONFIRMED**: Dimension-Polyant publishes no setup.
    - Cross-brand caution: **CONFIRMED** in spirit (ASTM abstracts; ACT).

**Ultra post (hub-relevant parts)**
26. "2 bar = over 20 m of water; 13.8 bar = over 138 m." **PARTLY.** 1 bar = 10.197 m H₂O, so 2 bar ≈ 20.4 m and 13.8 bar ≈ 140.7 m. The post rounds 1 bar to 10 m. [NIST](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
27. "Both are far beyond what any bag would experience." **PARTLY.**
    - 13.8 bar is far beyond anything estimated.
    - 2 bar is inside the 1.7–3.4 bar Gore-cited estimate for kneeling or sitting on wet ground. [Kwon & Nam](https://koreascience.kr/article/JAKO200111921100334.pdf)
    - It is above Alpinetrek's 14,000 mm (1.37 bar) kneeling figure. [Alpinetrek](https://www.alpinetrek.co.uk/base-camp/waterproof-vs-water-repellent/)
    - Seams and zips, not fabric, usually limit a bag.
28. Taber cycle comparisons across brands (ULTRA 4,400/8,800 vs X-Pac 500/1,700). **Can't be validated at hub level.** Valid only if wheel, load and end-point match, and none are published in the post. [Taber](https://www.taberindustries.com/taber-rotary-abraser)
29. Graflyte: "no glue, no delamination". **PARTLY.** ALUULA claims an adhesive-free design with delamination risk reduced to "near zero" (maker claim), which is not zero. [ALUULA](https://aluula.com/graflyte/)
30. UHMWPE molecular weight is "millions of daltons". **CONFIRMED** (2–6 million). [Wikipedia: UHMWPE](https://en.wikipedia.org/wiki/Ultra-high-molecular-weight_polyethylene)

## In use

**Hand**
- **Maker/brand observation:** TOM BIHN calls X-Pac RX30 stiffer than its other fabrics, with "a bit more crispness" and little give, and harder to sew. It has a slick laminated backing. [TOM BIHN](https://www.tombihn.com/blogs/main/what-is-x-pac-and-why-were-excited-for-it)
- **Maker claim:** WaterField says its ballistic isn't stiff and has a slick finish. [WaterField](https://www.sfbags.com/blogs/news/what-is-ballistic-nylon-and-why-does-waterfield-designs-use-it)
- **Retailer reviewers:** ULTRA 200 described as light and pliable with a soft look, and very hard to cut. [RBTR ULTRA 200](https://ripstopbytheroll.com/products/challenge-ultra-200)

**Sound and crinkle**
- No reviewer or maker source quantifying or describing laminate crinkle was found this session.
- The deep-dive's "crinkly hand" for X-Pac remains **UNCONFIRMED** here.

**Ageing**
- **Conservation reference:** ester-based PU coatings hydrolyse in humidity and heat, going tacky, then cracking and peeling. [MoMu](https://studycenter.momu.be/DAT/page/degradation_of_polyurethanes)
- **Repair-guide / owner level:** tent-fly PU goes sticky with age and damp storage. [iFixit](https://www.ifixit.com/Wiki/Tent_Fly_Sticks)
- **Maker guidance:** TPU-ether film is hydrolysis-resistant. [Extremtextil](https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710)

**How it takes abrasion**
- **Standards bodies:** lab cycles don't predict wear life. [ASTM D3884-22](https://store.astm.org/d3884-22.html)
- **Reviewer observation:** DCF is prone to abrasion and pinholes. Older DCF packs struggled with bushwhacking and granite. A tent floor had a pinhole after months on the CDT. [Better Trail](https://bettertrail.com/outdoor-gear/dyneema-in-backpacking-gear) (13 Apr 2026)
- **Owner reports (reader comments on Garage Grown Gear, unverified):**
  - one cites a third-party drag test where ULTRA 800D was "clearly tougher" than other fabrics;
  - another reports a hole after a short tow test.
  [GGG](https://www.garagegrowngear.com/en-au/blogs/trail-talk/ultra-fabric-ultralight-cottage-gear)

**Repair**
- **Maker/retailer guidance:**
  - Silnylon can only be sealed or glued with silicone. [Extremtextil](https://www.extremtextil.de/en/know-how/silnylon-info)
  - DCF and Hybrid can be repaired with tape. [Extremtextil](https://www.extremtextil.de/en/know-how/infos-on-dyneema-composites)
- **Reviewer:** fusion-bonded Graflyte seams rule out needle-and-thread, patch or seam-tape repair; repair moves to Arc'teryx ReBIRD. [BPL](https://backpackinglight.com/advances-materials-manufacturing-ultralight-backpacks-arcteryx-alpha-sl-30-technical/)

**Heat and UV**
- **Maker data:** Dyneema melts at 144–152 °C. [DSM SK75](https://pelicanrope.com/content/PDFs/DyneemaSK75_Tech_Sheet.pdf)
- Long-term use limit: sources disagree.
  - fibrxl, a Dyneema distributor, gives cryogenic to 70 °C. [fibrxl](https://fibrxl.com/fibrxl-performance/fibers/dyneema/)
  - Wikipedia cites DSM advising against prolonged use above 90 °C. [Wikipedia](https://en.wikipedia.org/wiki/Ultra-high-molecular-weight_polyethylene)
- **Distributor/maker claim:** UHMWPE shows the smallest UV strength loss among high-tenacity fibres. [fibrxl](https://fibrxl.com/fibrxl-performance/fibers/dyneema/)

**Welding**
- **Maker guidance:** TPU is heat or HF weldable. [Extremtextil](https://www.extremtextil.de/en/nylon-210den-tpu-coated-one-side-heat-sealable-310g-sqm/72710)
- **Reviewer forum comment:** HF welding works only on polar polymers such as PU/TPU, not UHMWPE. [BPL](https://backpackinglight.com/advances-materials-manufacturing-ultralight-backpacks-arcteryx-alpha-sl-30-technical/) (Ryan Jordan, forum reply)

**Availability to home makers (MYOG)**
- X-Pac, DCF and TPU nylons are sold by the metre at Extremtextil. [Extremtextil X-Pac](https://www.extremtextil.de/en/x-pac); [Extremtextil DCF](https://www.extremtextil.de/en/know-how/infos-on-dyneema-composites)
- ULTRA is sold at Ripstop by the Roll. [RBTR](https://ripstopbytheroll.com/products/challenge-ultra-200)
- Graflyte is sold only to brand partners, not to small makers. [Garage Grown Gear](https://www.garagegrowngear.com/blogs/gear-gab/aluula-graflyte-weaving-a-new-future-for-ultralight-fabric)

## Open questions / unreachable

**Search budget**
- The shared WebSearch limit (200 per turn) was reached near the end. Items below marked "not located" were not searched for, rather than not found.

**Unreachable pages**
- Solstice Spectra fibre pages (404): https://www.solstice.com/us/en/products/spectra-fibers/industrial-grade-fiber/s-1000/spectra-75-denier-s-1000 and https://www.solstice.com/us/en/products/spectra-fibers/industrial-grade-fiber/s-900/spectra-5600-denier-s-900
- Honeywell Spectra physical-properties chart (redirects to the Solstice homepage): https://advancedmaterials.honeywell.com/content/dam/advancedmaterials/en/documents/document-lists/spectra/marketing/honeywell-SpectraFiber-PhysicalProperties-chart.pdf
- Taber wheels page (client error): https://www.taberindustries.com/taber-abrasive-wheels. Taber's own CS-10 vs H-18 guidance was not read; distributor and lab pages were used instead.
- ISO 13937-4 page (client error): https://www.iso.org/standard/23372.html
- ASTM D1683 2024 page (client error): https://store.astm.org/d1683_d1683m-17r24.html. The 17R18 page lists D1683/D1683M-22 as active.
- PMC article on PU-coated fabric ageing (captcha): https://pmc.ncbi.nlm.nih.gov/articles/PMC12527080
- PMC article (captcha): https://pmc.ncbi.nlm.nih.gov/articles/PMC8466966
- ScienceDirect topic page (robots-blocked): https://www.sciencedirect.com/topics/engineering/fabric-density
- Technium Science weave/tear paper (bot wall): https://techniumscience.com/index.php/technium/article/view/1409/468
- Wikipedia "Solution dyeing" / "Dope dyeing": page not found.

**Gaps**
- AATCC 16 (colourfastness to light) abstract: not located. The AATCC store URL is not predictable.
- AATCC 183: only a secondary source (Wikipedia) was read.
- Specimen sizes for D2261, D5034 (100 mm / 25 mm jaw) and D1424, and the D737 test pressure (125 Pa) and units, are not on the free abstracts. They are behind the ASTM paywall.
- Which method gives X-Pac's and ULTRA's "13.8+ bar / 200+ psi"? It may be the Mullen-type tester (ASTM D751 Proc. A); confirm on the maker sheets.
- Which Taber wheel, load and end-point X-Pac and ULTRA use for their "cycles": not published in anything I opened.
- Typical PU coating add-on (g/m²) for bag nylons: no source found.
- Sourced description of laminate noise or crinkle: none found.
- A textile reference that classifies bag fabrics as coated / laminate / non-woven composite / fused: none found. Standards scopes give only partial support.
- Graflyte construction (woven UHMWPE face vs fused film layers): sources disagree. For the UHMWPE researcher.
- The RBTR Venom data sheet in `/src` uses ASTM D1424 (lbF), D5034 ("lbF/in"), AATCC 127 (+3,000 mm) and D4966 (10,000+ rubs). Its live product page was not opened in this session, so its numbers are not in the data table. For the UHMWPE researcher.
- Extremtextil's "ASTM D 5735-95" tear method: title and status not verified.
- The ASTM pages' AI-use prohibition notice: the site owner may want to note that only public abstracts were read.
