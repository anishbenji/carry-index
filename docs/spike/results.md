# Spike results, for the Thursday gate

Draft for the gate on Thursday 26 Nov 2026, 20:00 IST. This draft freezes at 18:00 IST. Nothing here is
accepted. Every ADR change below is **Proposed — for the user at the gate**.

Every number is copied from a spike doc, with its label and source. **All numbers are local.** Nothing was
deployed, so there are no edge numbers yet.

## Sources

| Spike PR | Branch | Doc | Commit read |
|---|---|---|---|
| PR 4, toolchain (Q7) | `spike/04-scaffold` | `docs/spike/toolchain.md` | `463dbf8` |
| PR 7, hydrated build (Q1, Q4, Q6, N1 baseline) | `spike/07-deploy-hydrated` | `docs/spike/deploy-hydrated.md` | `4c2c820` (numbers measured at `b5d4fd5`) |
| PR 8, static first and CSP (N1, N3, Q5) | `spike/08-static-csp` | `docs/spike/static-csp.md` | `b0f40c4` |
| PR 9, Kit Watch: Access, D1, MCP | `spike/09-kit-access-d1-mcp` | `docs/spike/kit-access-d1-mcp.md` | `0c7e568` (review round 2) |

Review findings for PR 7 and PR 9 are in the director's review folders (`reviews/07-hydrated/`,
`reviews/09-kit/`, outside this repo). The R2 card finding comes from the director's scout
(`proposals/r2-card-scout.md`, outside this repo).

## Q1. Does the build deploy to Workers Static Assets, and which Worker is `main`?

**Answer: yes, and no Worker is `main`.** (PR 7, local.) `vite build` in `apps/web` writes `dist/client`: pages,
static files, `_headers` and a generated `wrangler.json` with no `main`. The public site is an assets-only
Worker. No code runs for any request.

**Key numbers (local, `wrangler dev`, PR 7 at `b5d4fd5`).** The same `dist/client` was served twice, once
assets-only and once with a scratch `main` Worker that answers 418:

| Request for `/nope` | assets-only | with a `main` Worker |
|---|---|---|
| browser navigation (`Sec-Fetch-Mode: navigate`) | 404, `404.html` | 404, `404.html`, Worker not invoked |
| no `Sec-Fetch-Mode` (curl, most bots) | 404, `404.html` | 418 from the Worker |
| `Sec-Fetch-Mode: cors` (`fetch()`) | 404, `404.html` | 418 from the Worker |

Command: `bunx wrangler dev --port 8799 --ip 127.0.0.1` in `apps/web`, then `curl` and the Playwright tests.

So with a `main`, every unknown URL that is not a browser navigation runs the Worker. That counts against the
account's 100,000 daily requests. With no `main`, none does.

**Host-scoped `_headers` (ADR-0045's open point).** A rule on `https://:worker.:account.workers.dev/*` adds
`X-Robots-Tag: noindex` only for the workers.dev host. Verified only in `wrangler dev`'s asset server.

**Bug found and fixed.** The PR 7 review found a P1: a browser opening a missing bag URL (`/bags/no-such-bag`)
got the 404 status but then an error message instead of the "Page not found" page, because hydration rendered the
address bar's route. PR 8 fixed it in the hydrated build (commit `0370d31`: the route is written on
`<main data-route>`), with a browser test on both builds. The static build never had the problem.

**Not verified.** Edge behaviour of `not_found_handling` and of host-scoped `_headers` rules. Whether
`.assetsignore` keeps `wrangler.json` out of the upload at the edge (locally `/wrangler.json` answers 404).

**ADR change.** Proposed — for the user at the gate: new
[ADR-0046](../adr/0046-public-site-delivery.md), the public Worker is assets-only and the beacon is its own
Worker. Also an [ADR-0045 amendment](../adr/amendments/0045-spike-results.md): keep the host-scoped `noindex`
rule and confirm it at the edge on the first deploy.

## Q2. JS, HTML and LCP for the listing and one bag page, on the preview URL

**Answer: local numbers only.** No preview URL exists yet. The edge numbers wait for the Cloudflare API token
(user step U1). The local numbers for both builds are under N1 below.

**ADR change.** None of its own. The numbers feed N1 (ADR-0015) and N3 (ADR-0018).

## Q3. Document navigation with Speculation Rules against a client router

**Answer: not measured.** The unified brief cut the spike to one day and moved this question into the build.
ADR-0016 (document navigation only on the public site) already decides the shape.

**ADR change.** None.

## Q4. Zero hydration warnings, with theme and units set before first paint

**Answer: yes, on both pages.** (PR 7, local, production build, Chromium.) Playwright listens for console errors
and warnings, uncaught errors and failed subresources. The list is empty on both pages, after a sort on the
listing and after opening the airline widget.

**Key numbers (local, PR 7 at `b5d4fd5`).**

- The pre-paint snippet (`src/prepaint.ts`) is 228 bytes. It sets `data-theme` and `data-units` on `<html>`. An
  end-to-end test finds both set, with saved values `dark` and `in`, at the moment `<body>` is inserted.
- Both unit systems and both theme labels are in the markup, and CSS shows one. Server and client HTML match, so
  the switch never re-renders.

Command: `heavy-run.sh "ci-spike-hydrated build+e2e" bash -c 'bun run build && bun run test:e2e'` (16 end-to-end
tests pass, Chromium).

**Not verified.** Solid's dev-mode mismatch warnings: production builds strip them. They were checked once by hand
under `vite dev`, not by a test. Firefox and WebKit were not run.

**ADR change.** Proposed — for the user at the gate: part of new [ADR-0046](../adr/0046-public-site-delivery.md).

## Q5. Does a hash-based CSP hold with Solid's inline scripts?

**Answer: on the static build, yes; on the hydrated build, only until about 30 pages.** (PR 8, local, at
`b0f40c4`.)

- **Static build.** Every page carries one inline script (the shared snippet) and, with inlined CSS, one
  `<style>`, identical on all 14 pages. `build-static.ts` hashes every inline script and style, fails the build
  unless all pages give the same set, and writes `_headers` from it. The header line is 398 characters.
- **Hydrated build.** Each page has four inline scripts. Three are the same everywhere; the serialized page data
  differs on every page (13 more hashes). `_headers` cannot give the 404 page its own rule, so the `/*` rule holds
  the union: 16 hashes, a 1,155-character header line, growing by one 53-character hash per page. Cloudflare
  documents a 2,000-character limit per header for Pages; PR 8 assumed Workers Static Assets is the same and did
  not check. At that limit the hydrated policy stops fitting at about 30 pages.
- **Test.** `e2e/csp.spec.ts` (Playwright, Chromium) checks the policy on the listing, a bag page and the 404
  page, runs every interactive part, and fails on any violation. Result: zero violations, 6 of 6 pass (3 pages ×
  2 builds).

The policy (inline-CSS variant) is `default-src 'self'; script-src 'self' 'sha256-<snippet>'; style-src 'self'
'sha256-<stylesheet>'`, plus `'none'` for objects, frames, fonts, forms and the rest. No `'unsafe-inline'`. This
closes the PR 7 security review's P2 (no `script-src`), and an end-to-end test now asserts `script-src` is present
(commit `33072a1`).

**Proposed rule.** Content pages carry only the shared inline snippet and the shared inline stylesheet. Page data
never goes into an inline script. That rule is what keeps one hash set.

**Not verified.** The 2,000-character limit for Workers Static Assets. Whether the edge honours the generated
`_headers` exactly as `wrangler dev` does. Firefox and WebKit.

**ADR change.** Proposed — for the user at the gate: [ADR-0018 amendment](../adr/amendments/0018-spike-results.md)
(the CSP is generated at build time, one hash set) and [ADR-0015 amendment](../adr/amendments/0015-spike-results.md)
(page data never goes into an inline script).

## Q6. Does the airline widget load its data from a static file, with no Worker call?

**Answer: yes.** (PR 7, local.) The pipeline precomputes each model's fit against every airline and the build
writes `dist/client/data/fit/<model>.json`. The widget is a `<details>`: nothing loads until it opens, then one
same-origin static JSON request.

**Key numbers (local, PR 7 at `b5d4fd5`).** `data/fit/<model>.json` for the Dragonfly: 14,626 B raw, 198 airlines ×
3 builds. An end-to-end test asserts no `/data/` request before opening, one `200 application/json` after, and no
`/_server` request at all.

`prerendered()` was not used for the widget. The crawler captures only calls made while rendering, and a closed
widget makes none. A plain static file is simpler and works in either build.

**Fixed since.** The PR 7 review (P3) found the widget's loading and error text were not announced and the error
stayed up during a retry. PR 8 put them in a persistent `role="status"` paragraph and resets it on retry, in both
builds (commit `8d6e2b4`). How screen readers announce it was not tested.

**ADR change.** Proposed — for the user at the gate: part of new [ADR-0046](../adr/0046-public-site-delivery.md).

## Q7. Does the TypeScript 7 toolchain work with Solid 2, Vite, Zod 4 and Biome?

**Answer: yes, for everything the scaffold exercises.** (PR 4, local, Darwin arm64.) `tsc --build` with
TypeScript 7.0.2 checks all seven workspaces, including Solid 2 TSX with `jsxImportSource: "@solidjs/web"`, Zod 4
inferred types and Workers types. It reports real JSX type errors. The Vite build with `@solidjs/vite-plugin`
3.0.1 works. Biome 2.6.9's type-aware promise rules fire.

Two things differ from the architecture doc:

1. Biome's `noRestrictedImports` flags `import type` as well as value imports. So the "types only" ban for `zod`
   and `@cj/schema` in `apps/web` is a checker in `packages/checks`, using TypeScript 7's own parser.
2. That parser runs only under Node. TypeScript 7's JavaScript API (`typescript/unstable/sync`) fails under Bun
   with `TypeError: undefined is not an object (evaluating 'stdout._handle.fd')`. The wall and import checks run
   with `node` (26.13.0). The API is unstable, so `typescript` is pinned exactly. The wall uses Wrangler's
   `unstable_` and `experimental_` readers, so `wrangler` is pinned exactly too.

**Key numbers (local, PR 4, doc at `463dbf8`).**

| Command | Result |
|---|---|
| `/usr/bin/time -p tsc --build --force` | real 0.27 s (all seven projects, cold) |
| `/usr/bin/time -p tsc --build` | real 0.09 s (nothing changed) |
| `/usr/bin/time -p biome ci .` | real 0.50 s, 50 files |
| `bun run test` | checks 56, schema 6, pipeline 3, web 2: all pass |
| `heavy-run.sh … bun run build` | apps/web `main-*.js` 25.06 kB (10.54 kB gzip), apps/kit 24.58 kB (10.32 kB gzip) |
| `heavy-run.sh … bun run size` | "Size limit: 15 kB / Size: 9.54 kB brotlied" |
| `brotli -c -q 11 … \| wc -c` on each bundle | apps/web 9,540 B Brotli; apps/kit 9,353 B Brotli |

Solid 2's runtime plus one `render` of one component is already 9,540 bytes Brotli. That is over the 8 KB
content-page budget before any hydration, router, island or beacon. Content pages can meet 8 KB only by shipping
no Solid runtime, which is what N1 plans.

**Not verified.** Watch mode and editor behaviour with TypeScript 7. Vitest and Vite under Bun's runtime (both
ran on Node 26.13.0). Component tests: no DOM environment is approved.

**ADR change.** Proposed — for the user at the gate: new [ADR-0047](../adr/0047-toolchain.md), "Toolchain:
TypeScript 7, Biome, Vitest, Bun workspaces".

## N1. Static first against full hydration

**Answer: static first meets every N2 budget measured; full hydration misses both JavaScript budgets.** (PR 8,
local, at `b0f40c4`.)

**How static first was built.** With N1's fallback: a plain Vite build and a short prerender script
(`bun apps/web/build-static.ts`), not start mode. In `@solidjs/vite-plugin` 3.0.1 the generated server entry always
injects the client entry script, and its URL cannot be blanked. An authored entry pair was not tried. The script
renders a known route list from the pipeline, so `prerender-crawler`, `prerendered()` and `@solidjs/meta` are not
used. The private app can stay on start mode.

**Islands are plain TypeScript, not Solid.** A Solid version of the airline island, built as a size probe only,
costs 12,928 B brotli (34,903 B raw) on its own, because Solid 2's client runtime comes with it. That alone is over
the 8 KB content-page budget.

**Key numbers: both builds (local, PR 8 at `b0f40c4`).** All three sites (hydrated, static inline CSS, static
external CSS) were measured in one heavy-lock session, interleaved, same machine and Chromium, median of 5.
"Hydrated" is PR 7's build plus the review fixes; "static" is the inline-CSS site.

| Measure | Hydrated, listing | Static, listing | Hydrated, bag | Static, bag | N2 budget (ADR-0017) |
|---|---|---|---|---|---|
| Script files loaded before a widget opens | 1 (client entry) | 1 (sort island) | 1 (client entry) | 0 | |
| Script files, brotli / gzip / raw | 35,394 / 39,136 / 105,993 B | 341 / 413 / 693 B | 35,394 / 39,136 / 105,993 B | 0 | |
| Inline scripts: count, brotli / gzip / raw | 4: 1,933 / 2,275 / 8,900 B | 1: 398 / 487 / 1,032 B | 4: 952 / 1,129 / 2,474 B | 1: 398 / 487 / 1,032 B | |
| Page JS, brotli (files + inline) | 37,327 B: fail | 739 B: pass | 36,346 B: fail | 398 B: pass | listing < 15 KB; content < 8 KB |
| Page JS after the airline widget opens | n/a | n/a | 36,346 B (no extra script) | 915 B (+517 B island) | content < 8 KB |
| HTML, brotli / gzip / raw | 3,348 / 4,125 / 22,574 B | 2,951 / 3,570 / 16,788 B (CSS inlined) | 1,788 / 2,216 / 6,278 B | 1,980 / 2,443 / 6,814 B (CSS inlined) | listing < 40 KB; content < 14 KB with CSS |
| CSS, brotli | 867 B (file) | 866 B (inline) | 867 B (file) | 866 B (inline) | < 10 KB |
| Lighthouse mobile LCP (simulated) | 795 ms (776–830) | 634 ms (625–670) | 1,734 ms (1,549–1,783) | 1,233 ms (1,217–1,251) | field < 1.0 s (not comparable) |
| LCP observed (unthrottled, local) | 53 ms | 54 ms | 95 ms | 80 ms | |
| Lighthouse TBT | 5 ms (0–24) | 0 ms (0–37) | 0 ms (0–30) | 0 ms (0–13) | listing < 50 ms; content 0 ms |
| Lighthouse CLS | 0 | 0 | 0 | 0 | 0 in the lab |
| Lighthouse Performance | 100 | 100 | 100 | 100 | |
| INP, sort control, 4x CPU | 32 ms (16–40) | 24 ms (8–48) | n/a | n/a | < 50 ms |

Commands (from the PR 8 doc):

```sh
heavy-run.sh "ci-spike-static measure A/B" bash -c \
  'RUNS=1 bash scripts/measure-ab.sh smoke.json && RUNS=5 bash scripts/measure-ab.sh measure-ab.json'
bun scripts/page-budget.ts   # per page, script files plus inline scripts; exits 1 on the hydrated misses
bunx size-limit
```

Reading it: static first ships 0.7 KB of JavaScript on the listing and 0.4 KB on a bag page (0.9 KB once the
airline widget opens), leaving 7.1–7.6 KB of the content budget for the metrics beacon. The static bag page's
simulated LCP is about 0.5 s lower. Nothing a visitor sees changes: same markup, same sort, same widget, zero
console problems, zero CSP violations, axe clean in both themes. The hydrated entry is 35,394 B here against
PR 7's 35,275 B, because of the review fixes; builds of the same source varied by up to 48 B.

**Proposed rule.** Page data never goes into an inline script (see Q5).

**Baseline: full hydration alone (local, PR 7 at `b5d4fd5`, served by `bunx wrangler dev --port 8799 --ip
127.0.0.1`; sizes deterministic, timings the median of 5).** Kept for the record; PR 8's table above supersedes it
for the comparison.

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

Commands (from the PR 7 doc):

```sh
heavy-run.sh "ci-spike-hydrated measure" node scripts/measure-hydrated.mjs http://127.0.0.1:8799
CHROME_PATH="<Playwright's Chromium>" heavy-run.sh "ci-spike-hydrated lighthouse" \
  lhci collect --url=http://127.0.0.1:8799/uhmwpe-backpacks \
  --url=http://127.0.0.1:8799/bags/ula-dragonfly-30l --numberOfRuns=5
bunx size-limit
```

**Budget result: the hydrated build misses both JavaScript budgets.** The client entry alone is 35.3 KB brotli:
4.4 times the content-page budget and 2.4 times the listing budget, before any beacon. HTML, CSS, TBT, lab CLS
and INP are inside their budgets. The page data is in the HTML twice: once as markup, once for hydration.

Lighthouse's LCP is a simulated slow-4G figure, not comparable with the field target.

**Size gate.** `size-limit` measures files only, so it missed the inline scripts that N2 counts (PR 7 review, P2).
PR 8 added `scripts/page-budget.ts` (commit `436ec67`): per page, loaded script files plus all inline scripts,
brotli, against N2, exiting 1 on a miss. Budgets unchanged.

**Not verified.** Anything at the edge, including real TTFB and field LCP and INP. Firefox and WebKit. Back/forward
cache restore (not re-tested in PR 8). The metrics beacon (not built, so in neither build's figures). Start mode
with an authored entry pair. Dev mode for the static build (there is no `vite dev` path for it).

**ADR change.** Proposed — for the user at the gate: [ADR-0015 amendment](../adr/amendments/0015-spike-results.md)
(confirm static first, built with the fallback) and [ADR-0017 amendment](../adr/amendments/0017-spike-results.md)
(the size gate counts inline scripts per page).

## N3. Inlined CSS under a hash-based CSP

**Answer: inlining wins on the text-led listing and makes no difference on the image-led bag page.** (PR 8, local,
at `b0f40c4`; same session, interleaved, median of 5, both under the hash CSP.)

| Measure | Listing, inline | Listing, external | Bag, inline | Bag, external |
|---|---|---|---|---|
| Lighthouse LCP (simulated, cold) | 634 ms (625–670) | 791 ms (783–959) | 1,233 ms (1,217–1,251) | 1,222 ms (1,133–1,231) |
| FCP | 634 ms | 791 ms | 626 ms | 778 ms |
| LCP observed (unthrottled, local) | 54 ms | 56 ms | 80 ms | 94 ms |
| HTML, brotli | 2,951 B | 2,120 B + 867 B CSS file | 1,980 B | 1,169 B + 867 B CSS file |

Inlining removes the one render-blocking request: about 150 ms earlier first paint on both pages under simulated
4G. On the listing LCP is text, so LCP moves with it (−157 ms). On the bag page LCP is the first drawing, so it
does not move. The cost is about 830 B brotli more HTML per page, re-sent on every navigation. Inlining adds one
`style-src` hash, the same on every page.

**Compression (local only).** `wrangler dev` serves `br` when offered, else `gzip`, never `zstd`. Sizes in this
document are brotli q11 and gzip -9 computed from the files. Cloudflare's own compression was not measured.

**Not verified.** A warm second page with the external stylesheet already cached: only cold loads were measured.
Edge compression, zstd and Early Hints.

**ADR change.** Proposed — for the user at the gate: [ADR-0018 amendment](../adr/amendments/0018-spike-results.md)
(confirm inlining, keep the "under about 10 KB" condition).

## N5. JPEG XL against AVIF

**Answer: not run in the spike.** The user moved the test to after the gate (USER #3). N5 concerns review photos,
which are not needed before milestone 5. ADR-0020 now says it is confirmed or reversed with the build's JPEG XL
measurement, not at the gate.

**ADR change.** Proposed — for the user at the gate: [ADR-0020 amendment](../adr/amendments/0020-spike-results.md),
a note only; nothing to decide at the gate.

## R2. Does enabling R2 ask for a payment card?

**Answer: not confirmed.** A read-only scout of Cloudflare's docs (25 Nov 2026) found that R2's get-started page
describes a checkout flow, and the billing policy asks for "a valid payment method before changing your plan type
or enabling subscriptions". A card is likely. Only non-staff community posts say a card dialog appears. The
user's own look at the dashboard settles it (user step U3). Nothing was enabled.

**ADR change.** Proposed — for the user at the gate: [ADR-0014](../adr/amendments/0014-spike-results.md) and
[ADR-0029](../adr/amendments/0029-spike-results.md) amendments. CI artifacts stay the fallback for source maps.

## Kit Watch: Access and D1

**Answer: locally, yes. The edge is not proven.** (PR 9, local, workerd through Wrangler 4.168.0.)

- One private Worker, `kit-watch`, serves two hostnames and routes by hostname. `kit.carryjournal.com` serves the
  Solid 2 SPA and its API. Any other hostname, and any plain-http request, gets 404.
- On the app host the Worker verifies the Access JWT on every request: RS256 only, against the team JWKS, with
  `iss`, `aud`, `exp` and `nbf` (60 s leeway). Web Crypto, no JWT library.
- D1 holds one synthetic table. `GET /api/items` reads; `POST /api/items` writes JSON only, exact fields, body at
  most 4 KB, `Origin` must be `https://kit.carryjournal.com`.

**Key numbers (local, PR 9, doc at `2f052c4`).**

| Command | Result |
|---|---|
| `bun run test` in `workers/kit` (`/usr/bin/time -p`) | 2 files, 32 tests pass; real 1.23 s (round 1: 4 files, 51 tests) |
| `heavy-run.sh … bun run build` | `apps/kit` `index-*.js` 43.29 kB (17.74 kB gzip), CSS 0.86 kB, `index.html` 0.50 kB, no inline script |
| `Bun.build` of `workers/kit/src/index.ts`, minified | before the Ajv alias 425.8 kB (121.0 kB gzip); after 291.3 kB (79.7 kB gzip), no Ajv |
| `wrangler dev --local --local-upstream kit.carryjournal.com` | `/api/items` 401 without a JWT, 200 with three synthetic rows; `/` 200 with the CSP |
| `wrangler d1 migrations apply kit-watch-spike --local` | `0001_items.sql` applied, 3 commands |

**Not verified.** Access in front of the real hostname, the real team JWKS and AUD, key rotation. Remote D1 and
its free-plan limits; the D1 daily-limit error path is only a generic 500 today. The deployed bundle size and
startup time.

**ADR change.** Proposed — for the user at the gate: [ADR-0036](../adr/amendments/0036-spike-results.md) and
[ADR-0037](../adr/amendments/0037-spike-results.md) amendments.

## Kit Watch: can Claude connect to an MCP server on that Worker?

**Answer: locally, yes, with a real OAuth flow. No real MCP client has connected.** (PR 9, local.)

The MCP endpoint is on its own hostname, `mcp.kit.carryjournal.com`, which the user chose (USER #5). That host is
outside the Access self-hosted application. It is guarded by OAuth tokens from
`@cloudflare/workers-oauth-provider` 1.3.0, with an Access for SaaS (OIDC) application as the sign-in step. Grants
store only the Access `sub`. One read-only tool, `list_items`, needs scope `mcp:read`. The Access JWT is not
accepted as an MCP token (tested).

**Risk: the free KV write quota.** `/register` and `/authorize` must be open, and each call writes to KV. The
free plan allows about 1,000 KV writes a day. Once they are spent, the owner's own sign-ins and token refreshes
fail until the daily reset. The Worker now rate-limits both routes to 10 calls per 60 s per IP (Rate Limiting
binding), which answers 429 before any KV write. That does not cap the daily total.

**Not verified.** Access for SaaS at the edge (its real endpoints, claims and PKCE). A real MCP client (Claude)
connecting. The Rate Limiting binding and the WAF rule at the edge.

**ADR change.** Proposed — for the user at the gate: new [ADR-0048](../adr/0048-mcp-authorization.md), "MCP
authorization for Kit Watch".

## Privacy wall: guard rail and enforcing check

`bun run wall` reads every Worker config with Wrangler's own readers and fails on any binding while a wall check
is pending. PR 9 drafts wall check 3: the public Worker may never declare a D1, R2 or KV binding.

The static wall is a **guard rail**. It cannot prove that a deploy uses the config it checked. The **enforcing
check** runs at deploy time on what is uploaded: in the CI deploy job (PR 10), build, run `bun run wall` on the
generated config in the same job, immediately before `wrangler deploy`, and deploy with that generated config (no
`--config` override, no `--env` the wall did not see). A deploy step that cannot meet this must not run. The full
requirements are in `docs/spike/toolchain.md` on `spike/04-scaffold`.

Today `bun run wall` fails on PR 7 (empty binding blocks in the generated config; fix on `spike/04-scaffold`) and
on PR 9 (bindings declared while checks are pending, as expected).

**ADR change.** Proposed — for the user at the gate: recorded in new [ADR-0047](../adr/0047-toolchain.md).

## For the user at the gate

One line each. Each item is Proposed until you decide it. "USER #n" and "pending #n" are entries in the director's
decision list, outside this repo.

1. N1: confirm or reverse static first (ADR-0015) with PR 8's numbers against PR 7's full-hydration baseline.
2. N3: inline the stylesheet or keep an external file (ADR-0018), with PR 8's numbers.
3. Q5: accept PR 8's hash-based CSP, and require `script-src` without `'unsafe-inline'` before any production deploy.
4. Accept ADR-0046: the public Worker is assets-only, and the beacon is its own Worker on `carryjournal.com/api/*`.
5. Accept ADR-0045's amendment: keep host-scoped `noindex` on workers.dev and confirm it at the edge.
6. Accept ADR-0047, the toolchain, including Node 26 for the wall and import checks (pending #14.1).
7. Zod in the private Worker through the MCP SDK: amend child rule 6, or write a JSON-RPC handler (pending #14.2).
8. Accept ADR-0048, MCP authorization, and pick how to cap the daily KV writes.
9. Add the free WAF rate-limiting rule for `/register` and `/authorize` (pending #11).
10. Accept the ADR-0036 and ADR-0037 amendments, and do the Access and D1 steps for PR 9's edge test (U4/U5, pending #11).
11. R2: look at the dashboard and report whether it asks for a card (U3, pending #4); until then CI artifacts.
12. Give the Cloudflare API token so the spike can measure at the edge (U1, pending #2).
13. Approve `@types/bun` and a DOM test environment (pending #13).
14. Round the two fractional Cicada weights, or allow one decimal place for grams (pending #15).
15. Size gate: count the inline scripts in the JS budget, and let the gate read `.size-limit.json` or the root `package.json`.
16. Accept that Q2's edge numbers and Q3 (navigation) move into the build.
17. N5 needs nothing now: you deferred it to after the gate (USER #3).
