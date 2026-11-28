# What each licence covers

This repository holds code, data, drawings and writing under different terms (ADR-0044, in `docs/adr/` once
the ADR pull request merges). Each file falls under one row below; where two rows could match, the more specific
path wins, and the third-party row wins over every path row.

| Paths | Licence |
|---|---|
| Code: `apps/`, `packages/`, `workers/`, `scripts/`, `tests/`, `e2e/`, `tools/`; source code in `drawings/generator/` (`*.py`, `*.js`, `*.sh`); build and CI configuration; project documentation in `docs/` and the root-level `*.md` files (other than this notice's licence texts) | MIT, see [`LICENSE`](LICENSE) |
| Catalogue data the owner compiled: `data/bags/`, `data/brands.yaml`, `data/materials.yaml`, `data/sources.yaml`, `data/sections/`, `schema/` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with credit to Carry Journal (carryjournal.com), for the rights Carry Journal holds in the compilation and its own contributions only |
| Third-party material anywhere in this repository: quoted review text, maker descriptions and other quotations | Not licensed by this repository; it belongs to its authors and is quoted with attribution |
| Airline cabin-limit data: the data files in `data/airlines/` (`*.json`, `*.md` notes); its scripts (`*.py`) are code and fall under MIT | Not licensed for reuse. Part of this data derives from a third-party dataset whose terms have not been checked; this carve-out stays until they are |
| Line drawings: `drawings/*/sketch/`; artwork inputs in `drawings/generator/` (images, masks, contour arrays and other non-code files) | All rights reserved |
| Written content for the site: everything under `content/` (its README files included), and published reviews and articles under `data/published/` | All rights reserved |

Facts themselves (a bag's weight, an airline's published limit) are not owned by anyone; the terms above cover
this repository's compilation and expression of them. Product names and trademarks belong to their owners.
Ask before reusing anything marked all rights reserved.
