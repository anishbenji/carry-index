# Amendment to ADR-0015: static first, spike numbers

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0015](../0015-static-first.md) (N1). ADR-0015 itself is unchanged until the user decides.
- **Source:** spike PR 7, `docs/spike/deploy-hydrated.md` on `spike/07-deploy-hydrated` at `4c2c820`; spike
  PR 8 (pending)

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

## N1 numbers: from PR 8 (pending)

The static-first build's numbers, the same table for the same two pages, and whether start mode can leave the
client entry off a page. The director fills this in from PR 8.

## Proposed change

Proposed — for the user at the gate: confirm or reverse ADR-0015 once PR 8's numbers are here. PR 7's baseline
supports static first: full hydration cannot meet the N2 JavaScript budgets.

Known gaps to close either way: the size gate must count the inline scripts as well as the client entry (PR 7
review, P2), and nothing here is measured at the edge.
