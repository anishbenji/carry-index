# Carry Journal data, v0.13

The 12 bag records from the published page (Rev AE, v20), in the data model agreed on 13 Nov 2026, with Anish's rulings of that day applied. Design notes and decisions are in the project doc `claude/data-model.md`.

Sits in `~/code/the-carry-index/`, beside the existing `data/airlines/` and `tools/airline-checker/`. Nothing here touches those folders. In the repo this file is `README-data.md`, so it does not replace the repo's own README.

## Layout

| Path | What it holds |
|---|---|
| `data/bags/<brand>/<model>.yaml` | One file per bag: the model (with its review list and sourcing line), its builds (specs, link out, check log), maker features, pros and cons, lines now computed, and the old page's strings under `legacy` |
| `data/brands.yaml` | Makers, with image-permission state |
| `data/materials.yaml` | Fabrics, with the UHMWPE-section decision per fabric |
| `data/sources.yaml` | Every page a fact points at |
| `data/sections/uhmwpe-backpacks.yaml` | The listing page: rule, exclusions, revision |
| `schema/carry-journal.schema.json` | JSON Schema for all of the above |
| `tools/validate.py` | Schema check, reference check, per-field provenance, lint rules, report |
| `tools/summary_lines.py` | Computed summary line per build, standouts at both ends, and weight against other builds of the same bag |
| `tools/applied_doc.py` | Writes `reports/cards.md` and `reports/other-build-review.md` |
| `tools/airline_fit.py` | Airline fit per build from `data/airlines/airlines.json`, with the page widget's rules; writes `reports/airline-fit.md` |
| `data/my-notes.yaml` | Anish's own notes, apart from sourced lines |
| `data/my-bags.yaml` | The bags he owns; the page marks those cards |
| `tools/review_list.py`, `tools/extra_reports.py` | Write `reports/claims-to-review.md`, `fabric-reasons.md` and `photos.md` |
| `tools/migrate/` | The old `BAGS` array as transcribed and the one-off scripts that built the data from it, ending with `apply_decisions.py` |
| `research/` | Raw results of the 13 Nov 2026 source search and the drafted rewrites; `research/reviews-2026-11-17/` holds the 17 Nov 2026 wider search (research files, checker files, merged results, the plan per bag and `applied.json`) |
| `tools/reviews_2026_11_17/` | The scripts that applied the 17 Nov 2026 search: `decisions_*.py` (the choices), `make_plans.py`, `apply_plans.py` (rewrites the data from `_backup-2026-11-17-data/` plus the plans), `make_report.py`, `check_v28.py`; `run_all.sh` runs the lot |
| `reports/` | Generated reports, plus `findings-2026-11-13.md` and `sources-search-2026-11-13.md` |

## Run

```
pip install pyyaml jsonschema
python3 tools/validate.py --today 2026-11-13
python3 tools/summary_lines.py > reports/summary-lines.md
python3 tools/applied_doc.py
python3 tools/review_list.py > reports/claims-to-review.md
python3 tools/extra_reports.py
python3 tools/airline_fit.py > reports/airline-fit.md
```

`validate.py` exits with 1 on any error. Errors block publishing: a broken reference, a listed build with no link out, a launch-critical field (name, price, volume, weight, dimensions) with no check, a pro or con with no source, a maker statement filed as a pro or con, a line from another build that does not name the build, text that names another bag, or text that says a review was not found. Warnings cover stale checks (price after 30 days, other fields after 180). `my_note` links are checked only where
`data/my-notes.yaml` exists (the owner's checkout); elsewhere the validator prints that it skipped them.

`tools/migrate/run_all.sh` rebuilds `data/` from the old page. Do not run it once the YAML has been edited by hand: it overwrites edits.

## What the records hold

- **Builds.** `variants` holds the builds a maker sells. `record: comparison` marks another build of the same bag, kept only so builds can be compared from data; it is not listed in a section.
- **No stock.** Availability is not recorded. Each listed build has a `link` (`url`, `kind`, `affiliate_url`). The EDX links to Carryology's page.
- **Three voices.** Maker statements are `features` ("Maker says"). `claims` are pros and cons from reviewers and owners, each with `voice`, `support` and sources. Anish's own notes will be separate records.
- **Other builds.** A point reported on another build carries `from_build` (label, generation, size, fabric) and `status: to-assign` until Anish decides whether it applies.
- **Review list.** `model.reviews` lists the reviews and owner reports on file with the build each covers; `model.sourcing` is one plain line. Nothing on a card says a review was not found.
- **Computed, not typed.** `computed` records old-page comparisons that are now worked out from data, and whether the rule is built yet.
- **Units.** Each build has `units`: the weight and dimensions in metric and imperial, each marked `maker` (the maker prints it) or `converted` (worked out by us). Converted grams are whole, pounds 2 decimals, centimetres and inches 1 decimal. The page's unit switch reads this; fit and sort orders always use the metric figures. The table of what each maker prints is `UNITS` in `tools/migrate/apply_decisions.py`.
- **Own-bag checks.** A check can have `basis: own` with `source: anish-own-bag` (a source of kind `own`, which has no url). First use: how the EDX opens. The page says "from my own bag" and gives no link.
- **Old page.** `legacy.claims` keeps every old line, what the source search found, and what happened to it.
- **Lines added by a later search.** A line can carry `added_in`, the name of the research pass that added it (first use: `reviews-2026-11-17`). Such a line is `status: draft` until Anish has read it. The page shows a draft only when the build script names its pass (`build_v28.py` shows `reviews-2026-11-17`), and never marks it as a draft. A line whose sources cover more than the listed build names the other builds in `from_build.label` ("Also from ...", "Mostly from ...").
- **Support.** `support` is the count of independent publishers with confirmed evidence, in words: "one review", "one owner review", "two reviews", "one review and one owner review", "three reviews agree", "four reviewers and owners agree". A maker's page cited only as a spec check is not counted; owner reviews on one store count once.
- **What the pages are.** The section file has `approach_note`, one or two plain sentences shown under the intro.

## How provenance works

Values are stored plainly. Each build has a `checks` list; a check is a date, a source, the fields confirmed there and a basis (`page`, `sibling` or `own`). A field no check lists is unverified. The validator resolves this to a source and date per field.

## State on 13 Nov 2026

12 models, 18 listed builds, 6 comparison builds, 39 lines on the cards (23 pros, 15 cons, 1 "Good to know" note; 10 of them from another build, each with its build named), 22 maker features, 10 computed lines, 2 of Anish's own notes, 3 bags marked as his, 113 sources. 0 errors, 0 warnings. 238 field values checked, 15 unverified. Nothing from the old page was lost.

Anish read every line on 13 Nov 2026, one question at a time. All lines and maker features are `status: approved`. The checks behind the data were made by Claude and search subagents reading each page through WebFetch, a few through Firecrawl or the browser (see `opened_by` in `data/sources.yaml` and the notes on each line); none has been checked by hand.

## State on 17 Nov 2026

A wider source search added reviews, videos and owner posts for all 12 bags; a separate checker re-opened every source and confirmed each quote, and a second check compared every new or widened line with its quotes (`research/reviews-2026-11-17/`, applied by `tools/reviews_2026_11_17/`). 80 lines on the cards now (49 pros, 29 cons, 2 notes; 42 of them name another build): the 39 lines Anish kept on 13 Nov 2026, 13 of them with wider support, plus 41 new lines with `status: draft` that he has not read. Two more new lines are `held` (EDX, waiting on a check of his own bag). A kept line gained sources only where their quotes back the whole line as worded; nine kept lines the new sources back in part were left untouched. 174 sources. 0 errors, 0 warnings. What changed, line by line, is in `reports/review-sources-2026-11-17.md`; the data before this pass is in `_backup-2026-11-17-data/`.

The page built from this data is `design/carry-journal-v28.html` (Rev AM, 17 Nov 2026), made by `design/build/build_v28.py` (build_v27.py aimed at v28, plus the Rev AM changes: draft lines from the 17 Nov pass shown, the note under the intro, source links that wrap between links); that runs `build_v27.py`, `build_v25.py`, `build_v23.py`, `build_v22.py` (the unit switch) and `build_v21.py` underneath it.
