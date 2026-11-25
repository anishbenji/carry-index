# Amendment to ADR-0015: static first, spike numbers

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0015](../0015-static-first.md) (N1). ADR-0015 itself is unchanged until the user decides.
- **Source:** spike PR 7, `docs/spike/deploy-hydrated.md` on `spike/07-deploy-hydrated` at `4c2c820`; spike
  PR 8, `docs/spike/static-csp.md` on `spike/08-static-csp` at `b0f40c4`

## What the spike asked

Build the listing and one bag page both ways, full hydration and static render with islands, and report
JavaScript size, total blocking time, LCP and INP. Choose static first unless it cannot be built cleanly on
Solid 2.0.x within the timebox.

## Full hydration: PR 7 (local)

All local: `wrangler dev` serving the built `dist/client` on this Mac, never Cloudflare. Measured at commit
`b5d4fd5`, served by `bunx wrangler dev --port 8799 --ip 127.0.0.1` in `apps/web`. Sizes are deterministic;
timings are the median of 5.

| Measure | Listing `/uhmwpe-backpacks` | Bag `/bags/ula-dragonfly-30l` | N2 budget (ADR-0017) |
|---|---|---|---|
| JS files loaded | 1 (client entry) | 1 (client entry) | |
| JS, brotli q11 | 35,275 B | 35,275 B | listing < 15 KB; content < 8 KB |
| JS, gzip -9 | 39,061 B | 39,061 B | |
| JS raw | 105,848 B | 105,848 B | |
| Inline scripts (4 per page), raw / brotli / gzip | 8,900 / 1,933 / 2,275 B | 2,474 / 952 / 1,129 B | counted in the 8 KB |
| HTML, raw / brotli / gzip | 22,553 / 3,343 / 4,112 B | 6,265 / 1,780 / 2,198 B | listing < 40 KB; content < 14 KB |
| CSS (whole site, one file), brotli | 867 B | (same file) | < 10 KB |
| Lighthouse mobile LCP | 788 ms (783–797) | 1,705 ms (1,552–1,708) | field target < 1.0 s |
| Lighthouse mobile TBT | 0 ms (0–4.5) | 0 ms (all 0) | listing < 50 ms; content 0 ms |
| Lighthouse mobile CLS | 0 | 0 | 0 in the lab |
| Lighthouse Performance / A11y / BP / SEO | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | |
| INP, sort control, 4x CPU (web-vitals attribution) | 16 ms (32, 24, 16, 16, 16) | n/a | < 50 ms |

Commands: `heavy-run.sh "ci-spike-hydrated measure" node scripts/measure-hydrated.mjs http://127.0.0.1:8799`
for sizes and INP; `lhci collect` with `--numberOfRuns=5` on both URLs (mobile, simulated throttling: 150 ms RTT,
1.6 Mbps, 4x CPU) for Lighthouse; `bunx size-limit` for the budgets.

Result: the hydrated build misses both JavaScript budgets. The client entry alone is 35.3 KB brotli, 4.4 times
the content-page budget and 2.4 times the listing budget, before any metrics beacon. HTML, CSS, TBT, lab CLS and
INP are inside their budgets. The page data is in the HTML twice. Lighthouse's LCP is a simulated slow-4G figure,
not comparable with the field target.

Also relevant (PR 4, local): Solid 2's runtime plus one `render` of one component is 9,540 bytes Brotli, already
over the 8 KB content-page budget.

## N1 numbers: PR 8 (local)

All local: `wrangler dev` on the same Mac, never Cloudflare. Measured at `b0f40c4` in one heavy-lock session,
interleaved, median of 5. "Hydrated" is PR 7's build plus the review fixes; "static" is the inline-CSS site.

| Measure | Hydrated, listing | Static, listing | Hydrated, bag | Static, bag | N2 budget (ADR-0017) |
|---|---|---|---|---|---|
| Page JS, brotli (files + inline) | 37,327 B: fail | 739 B: pass | 36,346 B: fail | 398 B: pass | listing < 15 KB; content < 8 KB |
| Page JS after the airline widget opens | n/a | n/a | 36,346 B | 915 B (+517 B island) | content < 8 KB |
| HTML, brotli | 3,348 B | 2,951 B (CSS inlined) | 1,788 B | 1,980 B (CSS inlined) | listing < 40 KB; content < 14 KB with CSS |
| Lighthouse mobile LCP (simulated) | 795 ms (776–830) | 634 ms (625–670) | 1,734 ms (1,549–1,783) | 1,233 ms (1,217–1,251) | field < 1.0 s (not comparable) |
| Lighthouse TBT | 5 ms (0–24) | 0 ms (0–37) | 0 ms (0–30) | 0 ms (0–13) | listing < 50 ms; content 0 ms |
| Lighthouse CLS | 0 | 0 | 0 | 0 | 0 in the lab |
| INP, sort control, 4x CPU | 32 ms (16–40) | 24 ms (8–48) | n/a | n/a | < 50 ms |

Command: `heavy-run.sh "ci-spike-static measure A/B" bash -c 'RUNS=1 bash scripts/measure-ab.sh smoke.json && RUNS=5
bash scripts/measure-ab.sh measure-ab.json'`; per-page budgets by `bun scripts/page-budget.ts`. The full table is
in [`docs/spike/results.md`](../../spike/results.md) (N1).

How it was built:

- **Start mode cannot leave the client entry off a page.** In `@solidjs/vite-plugin` 3.0.1 the generated server
  entry always injects the client entry script, and its URL cannot be blanked. An authored entry pair was not
  tried.
- **So the fallback was built.** `apps/web/build-static.ts`: a plain Vite build (the plugin's non-hydratable mode)
  and a short prerender script with `renderToString(..., { noScripts: true })`. No hydration keys, no Solid script.
  It renders a known route list from the pipeline, so `prerender-crawler`, `prerendered()` and `@solidjs/meta` are
  not used; the route-coverage gate checks the list.
- **Islands are plain TypeScript.** A Solid version of the airline island (a size probe, never shipped) costs
  12,928 B brotli on its own, because Solid 2's client runtime comes with it: over the 8 KB content budget alone.

## Proposed change

Proposed — for the user at the gate: **confirm ADR-0015, with the fallback as the build.**

- The public site is rendered by `apps/web/build-static.ts` (plain Vite build plus prerender script), not start
  mode and not `prerender-crawler`.
- Islands are plain TypeScript modules that attach to prerendered markup. A Solid island is allowed only where its
  runtime cost fits the page's budget; today it does not on content pages.
- **Page data never goes into an inline script.** Content pages carry only the shared inline snippet and the
  shared inline stylesheet. This keeps one CSP hash set for the whole site (see the
  [ADR-0018 amendment](0018-spike-results.md)).
- The private app is unaffected and can stay on start mode.

Not verified: anything at the edge, Firefox and WebKit, back/forward cache restore, and the metrics beacon (not
built; on the static build it has 7.6 KB of the bag page's 8 KB left).
