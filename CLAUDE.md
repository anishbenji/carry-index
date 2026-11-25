# The Carry Index — notes for Claude

One public repository (`anishbenji/carry-index`) for two apps: **Carry Journal**, the public site
(carryjournal.com), and **Kit Watch**, the private app (kit.carryjournal.com). "Carry Index" is the internal
name only; never use it on the public site.

## Start here

- `docs/brief/unified-brief.md`: the plan for both apps, the shared data model, the publish step and Release 1.
  Where it differs from `docs/brief/architecture.md`, it wins.
- `docs/brief/architecture.md`: the public site plan (rendering, pipeline, quality gates).
- `docs/brief/decisions.md` and `docs/adr/`: decisions already made. Do not reopen them; a change needs a new
  ADR the owner accepts.

## You are in the right folder

The main checkout is `~/code/the-carry-index`; worktrees for branches live under `~/code/carry-index-wt/`.
Both are correct checkouts. To check: `git remote get-url origin` names `anishbenji/carry-index`, and the path
is not under `~/Downloads`.

**A stale snapshot sits at `~/Downloads/the-carry-index`**, frozen 10 Nov 2026 (v20 / Rev AE).
It has the same shape as this repo — same README style, same `design/`, `drawings/`, `tools/` —
and on 18 Nov 2026 a session with no folder attached found it, took it for the repo, and wrote a
"v21" page, a build script and a README entry into it, reusing a Rev letter already spent in the
real lineage. Do not read it for current state and do not write to it.

The snapshot does hold one thing this repo does not: the ALPAKA Momentum drawing work
(`drawings/raw source images/_momentum-staging/`, `drawings/gemini-inputs/mmtm/`), which still
needs moving across. Do not delete the snapshot until it has been.

## The privacy wall

The repository is public. Private records never enter it.

- No real Kit Watch records, purchases, prices paid, order references, addresses, medicine, or email
  addresses (the owner's included) in code, tests, fixtures, docs, commit messages, PRs or screenshots.
- Other people appear as roles ("partner", "friend"), never by name.
- Fixtures are synthetic. Exports from the old Kit Watch page stay outside this folder.
- `.gitignore` is an allow-list: everything is ignored unless listed. The local folders `design/`,
  `research/`, `reports/`, `handoffs/`, `_backup-*/`, `drawings/raw source images/` and
  `drawings/gemini-inputs/` are reference only and are never committed (no `git add -f`). A new top-level
  path needs an allow-list entry in its own reviewed PR.

## Stack rules

- Solid 2.0.x at exact versions for both apps; never Solid 1 patterns or SolidStart. Check Solid 2 APIs
  against the v2 docs and the skills shipped in `node_modules/solid-js/skills/`.
- Zod 4 schemas live in `packages/schema` and are used only there and in `packages/pipeline`; `apps/web`
  imports types only. No Effect in v1.
- TypeScript 7 strict, Biome, Bun workspaces. Exact pins; no new dependency without the owner's OK.
- Measurements are whole millimetres and grams; every spec has a source link.
- Budgets (ADR-0017), accessibility checks, security headers and the three privacy-wall checks are never
  relaxed to meet a date. Cut scope instead.

## Things that must not move

- `tools/airline-checker` runs daily from the main checkout through launchd and writes into `data/airlines/`.
  Do not move or rename it or change its output format (ADR-0032). Its daily writes appear as working-tree
  changes in the main checkout; do not commit, stash or discard them there.
- The old Kit Watch page stays the working tool until milestone 7. Do not touch it without asking.

## Reference: the HTML mock workflow (retired)

Until 25 Nov 2026 the site was worked out as single-page HTML mocks in `design/` (`ultra-carry-index-v1…v20`,
then `carry-journal-vNN.html`), each built by a `design/build/build_vNN.py` script from the previous one, with
the Rev letter and "Updated" date in `data/sections/uhmwpe-backpacks.yaml`. That folder is local reference
material: its layouts, copy and the checks in `design/build/v23/` feed the new build, but no new mock pages
are made and nothing in `design/` is committed. If you are ever asked to make one anyway, the old rules hold:
a new iteration is a new file, never modify an earlier page or build script, never reuse a Rev letter, and
sketches in dark mode use the referenced SVG filter `url(#sk-ink)` (WebKit ignores CSS filter functions on an
SVG child).
