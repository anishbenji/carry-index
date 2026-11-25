# Airline checker

Keeps `data/airlines/airlines.json` honest without spending AI tokens. Runs on the Mac with
Node + Playwright, once a day, checking about 1/30 of the airlines each time, so every airline
is re-read from its own website roughly once a month.

## Setup (once)

```sh
zsh ~/Downloads/the-carry-index/tools/airline-checker/install.sh
```

Installs Playwright's Chromium, runs the tests, schedules the job with launchd (11:23 daily;
runs on wake if the Mac was asleep, and at login if it was off and the day's run was missed),
then runs the first batch.

## What a run does

| Result | Meaning | What happens |
|---|---|---|
| CONFIRMED | every figure on file was found on the airline's page | record stamped "checked" today (seed-only airlines become checked this way) |
| CHANGED | a figure on file is gone from the page | goes to `reports/pending.json` for you to approve; the site keeps the old figure until then |
| FAILED | page didn't load, or has no sizes | auto-repair and retry (below) |

A confirmed check also records which unit systems the airline prints, from the same page text (see Units below).

Changes are not applied automatically: pages list many sizes (checked bags, other cabins, infants),
and a wrong guess would publish a false limit. Approving takes one command.

## Units

Each confirmed record gets `units` on `carryOn` and `personal`, and `combinedUnits` for a shared weight
(`lib/units.mjs`). The metric fields are not changed. For each quantity (size `d`, linear size `l`, weight `kg`):

- `printed`: `["metric", "imperial"]`, `["metric"]` or `["imperial"]`, as the page shows it; `null` = could not tell
- `d_in`, `l_in`, `lb`: the airline's own imperial figure as printed, or ours converted from the metric figure,
  inches and pounds to 1 decimal
- `converted`: the fields that are ours. `d_in`, `l_in`, `lb` when the airline does not print imperial (or we could
  not tell); `d`, `l`, `kg` when it prints imperial only, or when the metric on file is a conversion of its inches
  rather than its own metric figure (United: 55.9 on file, 56 cm on the page)
- `read`: the date; `from`: `page` (the checker read the whole page) or `quote` (only the stored wording)

An imperial figure is taken only if it corresponds to the metric figure on file: each side within 1 in, linear
within 1 in, weight within 1.5 lb. If several different figures would do (checked bags, other cabins), only one
printed right beside the metric figure is taken. When unsure, nothing is recorded for that quantity.
If the units code fails, the check still completes, the run log says `units not read`, and the last reading is kept.

`node apply.mjs accept` adds `units` from the quote it stores; anything the quote does not show is marked converted.
`node units.mjs` fills `units` for records that already have the airline's wording in `quote`, without opening
any page. It reports how many it filled (both, metric only, imperial only, mixed) and how many it could not tell,
leaves those and records that already have units alone, so it is safe to run again, and then rebuilds airlines.json.

## Failures: automatic repair and re-run

Each failure is sorted by what it needs (see `reports/repair-queue.md`), with a snapshot of what the
site served in `reports/snapshots/<slug>/` (text, plus a screenshot for browser loads):

- **Blocks automated visits**: an "Access Denied"-type page or a refused connection. The checker does not try
  to get around this; the airline goes straight to the manual-check list.
- **Sizes not recognised**: the page loaded but the wording is new. Add a pattern to `lib/extract.mjs` or an adapter.
- **PDF**: not readable yet. **Domain gone**: confirm whether the airline still flies.


1. Load-method ladder: plain fetch → headless browser → browser with accordions/tabs opened and the page
   scrolled → mobile browser. The method that works is remembered per airline.
2. If the page moved: follow the redirect, else rediscover it from the airline's sitemap
   (URLs containing cabin/carry-on/hand-baggage words).
3. Retry with back-off: 1, 2, 4 days.
4. If still not found: search for the airline's own baggage page (`lib/search.mjs`), as done by hand with a
   Google `site:` search. Uses an official search API only (Google Programmable Search, or Brave Search):
   put `{"googleKey": "...", "googleCx": "..."}` or `{"braveKey": "..."}` in `search.config.json`. Results
   off the airline's own site are ignored, sites that block automated visits are skipped, at most 20 searches
   per run. Without a key it is off, and each row in `repair-queue.md` carries a ready Google link instead.
   It never loads google.com itself: Google answers automated queries with a CAPTCHA.
5. After 3 failed days the airline goes to `reports/repair-queue.md` and you get a macOS notification.
   Fix it with a small per-site adapter (`adapters/README.md`), then `node check.mjs --only "<name>"`.

Cookie banners are dismissed with the reject/necessary-only button, never "accept all".

## Commands

```sh
node check.mjs                     # today's batch (what launchd runs)
node check.mjs --only "IndiGo"     # one airline now (repeatable flag)
node check.mjs --all               # everything (slow, ~170 pages)
node check.mjs --redo              # re-check every failing, stopped or pending airline now
node apply.mjs                     # list pending changes with page text
node apply.mjs accept "IndiGo" co=55x35x25 cokg=7 pikg=3     # keys: co pi col pil cokg pikg ckg pius pino
node apply.mjs dismiss "IndiGo"    # checker misread the page
node units.mjs --dry               # what the units backfill would fill from stored quotes (--list: per airline)
node units.mjs                     # fill units from stored quotes, then rebuild airlines.json
npm test                           # extraction, units and search-helper tests, offline
```

Then rebuild the page: `python3 design/build/build_v18.py` (or the next version's build script).

## Files

- `check.mjs` the job · `lib/extract.mjs` number finding and comparison · `apply.mjs` approvals
- `lib/units.mjs` which unit systems a page prints · `units.mjs` units backfill from stored quotes
- `adapters/` per-site loaders for awkward pages
- `state/state.json` last check, working method and URL, failures per airline
- `reports/` monthly run logs, `pending.json`, `repair-queue.md`, `launchd.log`
- Writes `data/airlines/verified/zz-checker.json` and re-runs `data/airlines/build_airlines.py`

Uninstall: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.carryindex.airline-checker.plist`

## Adding an airline

Find its baggage page with a Google `site:<airline domain> carry-on baggage size` search, read the figures on
the airline's own page (never a search snippet or a third-party guide), then add a record to a
`data/airlines/verified/verified-*.json` file (see `add_airlines_2026-11-13*.py`) and run `build_airlines.py`.
The checker picks new airlines up on its own.
