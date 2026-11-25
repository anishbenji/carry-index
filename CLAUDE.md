# The Carry Index — notes for Claude

## You are in the right folder

`~/code/the-carry-index` is the only working copy. Everything current lives here.

**A stale snapshot sits at `~/Downloads/the-carry-index`**, frozen 10 Nov 2026 (v20 / Rev AE).
It has the same shape as this repo — same README style, same `design/`, `drawings/`, `tools/` —
and on 18 Nov 2026 a session with no folder attached found it, took it for the repo, and wrote a
"v21" page, a build script and a README entry into it, reusing a Rev letter already spent in the
real lineage. Do not read it for current state and do not write to it.

Two checks that tell the folders apart:

| | this repo | the snapshot |
|---|---|---|
| pages | `design/carry-journal-vNN.html` (plus the older `ultra-carry-index-v1…v20`) | only `ultra-carry-index-v1…v20` |
| root | `data/`, `reports/`, `research/`, `schema/` | no `reports/`, `research/` or `schema/`; `data/` holds only `airlines/` |

If `design/carry-journal-*.html` and `data/sections/` are not both there, you are not in the repo —
say so rather than editing.

The snapshot does hold one thing this repo does not: the ALPAKA Momentum drawing work
(`drawings/raw source images/_momentum-staging/`, `drawings/gemini-inputs/mmtm/`), which still
needs moving across. Do not delete the snapshot until it has been.

## Building a new page

- The current page is the highest `design/carry-journal-vNN.html`; `README.md` marks it "Use this one".
- **New iteration = new file.** Never overwrite an earlier page, and never modify an earlier build script.
- Each iteration is a new `design/build/build_vNN.py` that reads the previous script's source, moves its
  paths to the new version, runs it, then patches the page it wrote — every anchor matching exactly once,
  or the build stops. Read the two most recent scripts before writing one.
- The Rev letter and the "Updated" date come from `data/sections/uhmwpe-backpacks.yaml` (`revision:` plus
  one `changelog:` entry for that letter), not from the page. Bump them there, and never reuse a letter —
  check `changelog:` for what is already spent.
- Add a line for the new page to `README.md` and move the "Use this one" marker.
- Check the built page in dark mode as well as light before calling it done. Sketches are external SVGs
  drawn through SVG `<image>`, lightened in dark mode by a referenced filter, `url(#sk-ink)` — WebKit
  ignores CSS filter *functions* on an SVG child, so never go back to those.

## Where the current state lives

`README.md` maps the repo. The project docs in the claude.ai project "The Carry Index" hold decisions,
open items and handoffs — read the relevant one rather than inferring from the tree.
