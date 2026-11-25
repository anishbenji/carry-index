# Carry Journal

Carry Journal (carryjournal.com) is Anish's hobby site about EDC and travel bags. It starts with one section, UHMWPE backpacks: backpacks whose shell is a high-UHMWPE performance fabric (Challenge ULTRA, ALUULA Graflyte, and more to come). The section was called the Ultra Carry Index until Rev AE. The fabric notes (`design/materials/`) explain those fabrics and compare them with nylon, polyester, X-Pac, ECOPAK and DCF.

**Current phase: design & content.** The single-page HTML mock is where layout, copy and data get worked out. A proper website/web app comes later; treat everything here as source material for it (the `BAGS` data array, the drawings, the copy).

## Layout

```
the-carry-index/
├── README.md
├── design/                      page iterations, newest = highest v
│   ├── ultra-carry-index-v1.html    11 Sep 2026 — Rev L, 12 packs incl. Max EDC
│   ├── ultra-carry-index-v2.html    Rev M — Max EDC removed (no verified ULTRA)
│   ├── ultra-carry-index-v3.html    21 Oct 2026 — Rev N: UHMWPE scope, Db Weigh Lighter Hugger, line-art sketches wired in
│   ├── ultra-carry-index-v4.html    21 Oct 2026 — Rev O: sketches for 11 of 12 packs, Ctactical moved to ctactical.com
│   ├── ultra-carry-index-v5.html    22 Oct 2026 — Rev P: current sketches after review round 1 (Ctactical side views and Hugger ¾ view mirrored); fixed sketches replace them as they land
│   ├── ultra-carry-index-v6.html    22 Oct 2026 — Rev Q: layout fix (a CSS block pasted inside the .draw rule since v3 broke photos, hero strip and cards), table fits on desktop, chart scrolls on phones.
│   ├── ultra-carry-index-v7.html    23 Oct 2026 — Rev R: corrected sketches for City Pack Pro 2, Travel Pack 4, CT15 Lite (new viewBoxes).
│   ├── ultra-carry-index-v8.html    23 Oct 2026 — Rev S: photo strip starts on the front view and fades to the three-quarter view on hover/focus (CTB26, Dragonfly, EDX, Superlite: three-quarter only; Cicada in Muse); each tile jumps to its card (or table row if filtered out); light backgrounds whitened in the browser; 15 g/L chart line below the Hugger.
│   ├── ultra-carry-index-v9.html    23 Oct 2026 — Rev T: CTB26 gets a front view in the strip (design/img/ctb26-front-ultra.jpg: Urban Cred NYC's shop photo, background removed, their add-on patch swapped for the plain hook-and-loop panel from u/Uci2ci's photo on r/EVERGOODS; Evergoods only publishes the three-quarter view).
│   ├── ultra-carry-index-v10.html   23 Oct 2026 — Rev U: every strip tile has a front + three-quarter photo. New: Cicada front (ULA eye-level shot, props removed), Dragonfly front (ULA 30L Dragonfly Pass Thru), EDX front (Anish's flat-lay) and three-quarter (Matador studio shot, background removed), Superlite front (studio shot from Anish, on white). Sources/scripts: design/build/v10/.
│   ├── ultra-carry-index-v11.html   23 Oct 2026 — Rev V: photo credits in the strip note (CTB26 front: Urban Cred NYC + u/Uci2ci; Superlite front: Tortuga's Kickstarter photo).
│   ├── ultra-carry-index-v12.html   23 Oct 2026 — Rev W: no text under the photo strip; photo credits moved to a "Photo credits" note at the bottom.
│   ├── ultra-carry-index-v13.html   23 Oct 2026 — Rev X: "Photo credits" note trimmed to just the credits.
│   ├── ultra-carry-index-v14.html   23 Oct 2026 — Rev Y: Notes section removed until it is rewritten (old text kept in design/build/v14/notes-removed.html); photo credits in the page footer.
│   ├── ultra-carry-index-v15.html   23 Oct 2026 — Rev Z: corrected sketches from the overnight Gemini pass: quick-access top pocket on CPP2 and TP4, CT21 Lite side view (level top, strap close, stray cord removed), CT21 Plus (level top, low handle, back mesh, strap), Superlite (photo-angle ¾ view, round patch, low handle).
│   ├── ultra-carry-index-v16.html   23 Oct 2026 — Rev AA: CT15 Lite, CT21 Lite, CT21 Plus and Cicada ¾ views turned to the product-photo angle (mirrored, then Gemini fixed the one-sided details); first line-art sketch for the CT15 Plus.
│   ├── ultra-carry-index-v17.html   23 Oct 2026 — Rev AB: nav row and fabric section link the fabric notes (materials/v1/); fabric section corrected: TX = X + 70d ripstop backer (same tear/abrasion), the 400X "20% lighter, 4× abrasion" line labelled as Challenge's own claim, "15× stronger than steel" reworded as the fibre makers' claim, 200X weight per Challenge (155 g/m²) with Extremtextil's 133, Dragonfly added to the TX card, Graflyte card quotes Db; tab title now "…in UHMWPE Fabrics".
│   ├── ultra-carry-index-v18.html   2 Nov 2026 — Rev AC: "Airline fit" in every card: carry-on, personal item and bag weight vs 168 airlines' cabin limits (fit / close / no, soft-goods margin), filter by any mix of regions and airlines, per-airline notes. Built by build/build_v18.py from data/airlines/airlines.json.
│   ├── ultra-carry-index-v19.html   3 Nov 2026 — Rev AD: light and dark themes ("night sheet": inverted sketches, photos stay on white tiles, fabric band stays dark), Theme button in the nav (Auto → Light → Dark), airline popover restyled as a drawing callout. Built by build/build_v19.py from v18. Publish with build/bundle_publish.py (bundles maker photos).
│   ├── ultra-carry-index-v20.html   10 Nov 2026 — Rev AE: data corrections from the 10 Nov review, re-checked on the makers' pages that day: both Aer packs sold out; EDX source is Matador's product page, with its name and its $260 price (was a reseller's $362); CT21 Plus - ULTRA400X headline weight 1 440 g. Built by build/build_v20.py from v19.
│   ├── carry-journal-v21.html       13 Nov 2026 — Rev AF: renamed Carry Journal, and every card rebuilt from the sourced, line-by-line reviewed data (one card per bag, every listed build with its own figures and link out, unverified fields marked), with stock and availability removed and a scope note added. Built by build/build_v21.py from v20 and data/.
│   ├── carry-journal-v22.html       13 Nov 2026 — Rev AG: one Metric / Imperial switch in the header for the whole page (the chart's g / lb buttons follow it; saved in the browser; imperial by default in US time zones). Weight per litre shows as L/lb in imperial; airline limits are converted from the metric figures on file. Built by build/build_v22.py, which runs build_v21.py and adds the units (checks and notes in build/v22/).
│   ├── carry-journal-v23.html       14 Nov 2026 — Rev AH: airline limits in imperial are the airline's own inches and pounds where it prints them; a converted limit is marked ≈ in both systems, with a key above each airline list. The EDX's opening comes from Anish's own bag and the card says so, with no link. Joint standouts read plain. Built by build/build_v23.py, which runs build_v22.py (and so build_v21.py) with checked swaps (checks and notes in build/v23/).
│   ├── carry-journal-v24.html       15 Nov 2026 — Rev AI: data only. 38 airlines re-read on their own sites (data/airlines/verified/zz-d-web-2026-11-15.json), release type checked on every listed build, 30L Dragonfly Pass Thru shell set to ULTRA 400TX, comparison prices for the 420D CTB26 and standard Hugger. Built by build/build_v24.py, which runs build_v23.py with only its output paths changed.
│   ├── carry-journal-v25.html       15 Nov 2026 — Rev AJ: in each airline list row, a limit the bag is close to is amber (dotted underline) and one it is over is red (solid underline); weight the same for medium and heavy; fitting sides stay plain; hidden words for screen readers; key above the list explains it. Built by build/build_v25.py (runs build_v23.py aimed at v25, then patches the page with exactly-once anchors).
│   ├── carry-journal-v26.html       15 Nov 2026 — Rev AK: data only. 14 more airlines checked on their own sites (191 of 198; uTair by WebFetch, 13 in Chrome on the Mac: verified/zz-d-web-2026-11-15b.json), Aer Ultra weights as the kg Aer's UK store prints (1 170 g, 1 480 g), Weigh Lighter Hugger release regular, ULA X-Pac Dragonfly comparison build removed. Built by build/build_v26.py (build_v25.py with its paths moved to v26).
│   ├── carry-journal-v27.html       15 Nov 2026 — Rev AL: a coloured weight limit in the airline list colours only its number; the unit stays plain, as for sizes. Built by build/build_v27.py (build_v25.py moved to v27, then three exactly-once swaps).
│   ├── carry-journal-v28.html       17 Nov 2026 — Rev AM: For and Against lines drawn from many more publishers (57 new sources on file: reviews, videos, owner posts), every source re-opened by a separate checker and every new or widened line checked against its quotes; 41 new lines shown that Anish has not read yet (status draft in the data, not marked on the page), 2 more held until he checks his own EDX, 13 kept lines with wider support; lines from another version of a bag name it (the EDX card draws on the first EDX); a note under the intro says what the pages are; rows of source links wrap between links. Built by build/build_v28.py (runs build_v27.py aimed at v28, serving build_v21.py's text with four checked swaps, then patches the page with exactly-once anchors). What changed and what to check: reports/review-sources-2026-11-17.md.
│   ├── carry-journal-v29.html       18 Nov 2026 — Rev AN: in dark mode the line-art sketches draw in light ink (#E3EAF1) in every browser. v19 lightened them with CSS filter functions on an SVG child element, which Blink honours and WebKit does not, so in Safari and in every browser on iOS they stayed #111 on a near-black sheet; they now go through a referenced SVG filter, url(#sk-ink), which WebKit does honour. #sk-ink is a per-channel linear transfer (an inversion scaled to the ink), so the CTB26 hook-and-loop patch stays a shaded box; the older --sk-filter rule is left in place and outranked by specificity. Built by build/build_v29.py (runs build_v28.py aimed at v29, swapping the three checks that pin it to Rev AM, then patches the page with exactly-once anchors). Checked in Chromium: all 48 sketch images compute filter url(#sk-ink) under both prefers-color-scheme: dark and data-theme="dark", and none in light. Known, not caused by this: the EDX sketch reads faint, its line weights being the outlier, pending the thickness-normalisation step. Use this one.
│   ├── materials/v1/                23 Oct 2026 — fabric notes, Rev A: 11 pages (index = how to read a fabric, nylon, polyester, x-pac, ecopak, uhmwpe, ultra, graflyte, dcf, compare, glossary), fact-checked against every cited source. Generated: edit build/materials/, rebuild into a new materials/vN/.
│   └── build/                       scripts that produced each iteration from the previous one (v8: build_v8.py + build/v8/, strip photos listed in v8/strip.json; build/materials/ generates the fabric notes, see its README)
│   (img/ holds photos we made ourselves; build/v9/ctb26-front/ has the sources and scripts for the CTB26 front)
├── data/airlines/               airline cabin-baggage limits: willmybagfit seed + checks on airline sites → airlines.json (see its README)
├── tools/airline-checker/       monthly rotating check of airline pages on the Mac (Playwright, no AI); run install.sh once
├── drawings/                    line-art pipeline (was ~/Downloads/carry-index-drawings)
│   ├── generator/                   vectorize.py, patches.py, split.py, render_png.js
│   ├── raw source images/           product photos + Gemini sheets, per bag
│   ├── _ref/                        style reference
│   └── <id>/sketch/                 <id>-sketch.svg/.png (sheet) + -front/-side/-back/-iso views
└── content/                     research & copy
    └── materials/                   fabric-notes research: one <page>.md per page (decisions, open questions, numbered sources), research/ (full notes), factcheck/ (the three fact-check reports)
```

Open a page in a normal browser tab from `design/`: sketches load from `../drawings/<id>/sketch/`, product photos load live from the makers' sites.

## Conventions

- New iteration = new file (`-v4.html`, …); never overwrite an earlier one. Bump the title-block Rev letter and the "Updated" date.
- Bag titles match the maker's product page; every entry links the exact page its specs were checked against.
- Pros/cons reflect review consensus; sibling-model reviews are allowed when the build itself has none, and say so.
- Bag ids: ctb26, cpp2, tp4, cicada, dfly, ct15l, ct21l, ct15p, ct21p, edx, slite, wlh30.

## Drawing status

| id | sketch | notes |
|---|---|---|
| ctb26, edx, dfly, cicada, wlh30, cpp2, tp4, ct15l, ct21l, ct21p, slite | done | shown on the page, scaled so front height = published height |
| cpp2, tp4, ct15l | corrected 23 Oct | Gemini 3.1 Pro + small hand fixes; previous drawings in <id>/sketch/_prev-gemini-v2/ |
| cpp2, tp4 | pocket added 23 Oct (night) | quick-access top pocket from Gemini, pasted onto the approved sheets (generator/paste_regions.py); previous in <id>/sketch/_prev-v8-fixed/, _prev-v5-handfix/ |
| ct21l, ct21p, slite | corrected 23 Oct (night) | awaiting Anish's review; previous in <id>/sketch/_prev-gemini-v*/ |
| (all above) | review round 1 done 22 Oct | fix list in the project doc technical-drawings.md; three-quarter views to be redrawn at the product-photo angle |
| edx | pocket zip removed 23 Oct | the 13 Sep drawing kept; the extra zip on the back edge of the ¾ bottle pocket hidden with an SVG mask (generator/mask_edx_zip.py); previous in edx/sketch/_prev-with-pocket-zip/. Gemini's Oct redraws (raw source images/edx/edx-gemini-v2…v5) were rejected |
| ct15p | first sketch 23 Oct | Gemini adapted the approved CT15 Lite drawing from the CT15 Plus photos (drawing it from scratch failed 4 times) |

Gemini inputs per bag (style reference first) are kept in `drawings/gemini-inputs/<id>/`; each bag's Gemini sheets are `raw source images/<id>/<id>-gemini-vN.png`.
`drawings/generator/runbag.sh` runs the whole vectorise → split → render → diff step for one sheet (erase boxes for fabric-crease lines, optional quadrant rescale via xform.py).

Pipeline details: the project doc `technical-drawings.md` in the claude.ai project.
