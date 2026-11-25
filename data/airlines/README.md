# Airline cabin-baggage data

`airlines.json` is generated. Edit the inputs, then run `python3 data/airlines/build_airlines.py`.

| File | What it is |
|---|---|
| `willmybagfit-seed.psv` | starting figures for every airline, read from willmybagfit.com/flightfit on 2 Nov 2026 (unverified) |
| `verified/verified-A/B/C.json` | 45 airlines checked on their own websites, 2 Nov 2026 (India/Gulf, Asia-Pacific, Europe/Americas) |
| `verified/zz-d-web-2026-11-15.json` | 38 airlines read on their own sites by Claude on 15 Nov 2026 (WebFetch, a few Firecrawl): the willmybagfit-only airlines, the checker's pending ones and the US/Mexico unit fixes. Built by `web-check-2026-11-15/make_verified_f.py` from the raw readings beside it. Sorts after zz-checker (so it wins over older checker readings) and before zz-manual (so your approvals still win) |
| `verified/zz-d-web-2026-11-15b.json` | 13 more airlines read in Chrome on the Mac, 15 Nov 2026 (sites that block automated reading; some figures only in images, read from screenshots). Raw readings in `web-check-2026-11-15/chrome-readings.json` |
| `verified/zz-checker.json` | written by the monthly checker (`tools/airline-checker`) |
| `verified/zz-manual.json` | changes you approved with `apply.mjs` |
| `notes.json` | other criteria and limitations per airline: carry-on, personal item, fares & cabins |
| `build_airlines.py` | merges the above; also holds the multi-region list, the "no limit" list and the airlines that no longer fly (`DEFUNCT`, left out) |

Later files win over earlier ones; anything verified wins over the seed.

## Record

```json
{"n": "IndiGo", "r": ["Asia"],
 "co": {"d": [55, 35, 25], "l": 115, "kg": 7},
 "pi": {"d": null, "l": null, "kg": 3, "us": false, "no": false},
 "ckg": null,
 "notes": {"co": ["…"], "pi": ["…"], "gen": ["…"]},
 "src": "https://…", "v": "2026-11-02", "seed": "August 28, 2025", "quote": "…"}
```

- `d` sizes in cm, always largest first; `l` linear total (L+W+D); `kg` weight
- `null` = not published · `"inf"` = the airline says there is no limit
- `pi.us` = personal item only has to fit under the seat · `pi.no` = no personal item allowed
- `ckg` = one weight allowance shared by both pieces
- `r` = one or more regions
- `v` = date checked on the airline's own page; `null` = willmybagfit figure not yet checked
- Basis: Economy, standard fare, international flights unless a note says otherwise

### Units

Where a check has read the airline's page (or its stored wording), `co` and `pi` also carry `units`, and the record
carries `cku` for the shared weight `ckg`. Records without them have none: the page converts the metric figures.

```json
"co": {"d": [56, 36, 26], "l": 118, "kg": 10,
       "units": {"printed": {"d": ["metric", "imperial"], "l": ["metric", "imperial"], "kg": ["metric", "imperial"]},
                 "d_in": [22, 14, 10], "l_in": 46, "lb": 22, "converted": [], "read": "2026-11-13", "from": "page"}}
```

- `printed` per quantity: which systems the airline prints it in; `null` = could not tell
- `d_in` (largest first, like `d`), `l_in`, `lb`: the airline's own imperial figure, or ours to 1 decimal
- `converted`: which fields are ours; `d`, `l` or `kg` here means the metric figure is converted from the airline's imperial
- `read` date read; `from` is `page` or `quote`. `cku` has only `printed.kg`, `lb`, `converted`, `read`, `from`
- In `verified/*.json` the same object sits at `carryOn.units`, `personal.units` and `combinedUnits`. `build_airlines.py`
  takes the latest reading from any file that still fits the figures on file, and leaves it out (with a message) if
  the figures have changed since it was read
- Fill from stored quotes: `node tools/airline-checker/units.mjs` (see that folder's README)
