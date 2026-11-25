# Carry Journal web app: architecture and build plan

> Exported from the Claude project on 25 Nov 2026. The private Claude doc is the source; this copy is what the director reads.

Nov 15, 2026 · @Anish Benjamin

The plan: prerender every page with Solid 2 at build time and serve it as static files from Cloudflare's edge. The HTML arrives complete, so the first paint needs no JavaScript, and static asset requests on Cloudflare are free. A small Worker handles only the metrics and error beacons. Everything runs on Cloudflare's free tier; the $5 Workers Paid plan is only needed if traffic outgrows it.

## Goals and budgets

"Instant" means the page is readable before any script runs, and every number below is checked in CI and watched from real visitors. Field targets are at the 75th percentile on a mid-range phone over 4G.

| Measure | Budget | Checked by |
| --- | --- | --- |
| Time to first byte | under 0.8 s in the field (web.dev's guide figure; it includes DNS, connection and TLS). Server response under 100 ms in Lighthouse | Real-user beacon |
| Largest Contentful Paint | under 1.0 s | Lighthouse CI and real-user beacon |
| Interaction to Next Paint | under 100 ms | Real-user beacon |
| Cumulative Layout Shift | under 0.02 | Lighthouse CI and real-user beacon |
| JavaScript on first load | under 35 KB compressed | size-limit in CI |
| HTML, listing page | under 60 KB compressed | size-limit in CI |
| Airline data | 0 KB until "Check by airline" opens | Playwright network check |
| Lighthouse | 100 for Performance, Accessibility, Best Practices and SEO | Lighthouse CI |

**Showcase bar.** The repo, the build and the live site should each stand on their own as evidence. That means typed data end to end, measured budgets that fail the build when broken, a public performance page fed by real-user data, and clear architecture docs in the repo. Every budget here is a starting estimate, to be reset once the spike and the first weeks of field data are in. The field LCP of 1.0 s is the hardest: on 4G, connection setup alone uses a large part of it.

## Architecture at a glance

&#91;embedded content: architecture · repo to build to Cloudflare edge to browser\]

A push to the repo triggers Workers Builds, which validates the data, compiles it, and prerenders every page into static files on Cloudflare's edge. Visitors get complete HTML first; only the metrics and error beacons ever invoke a Worker. The cron Worker reads the metrics, triggers the daily rebuild that refreshes `/performance`, and emails you when something breaks.

## Stack

Solid 2's own start mode replaces SolidStart: it is a mode of `@solidjs/vite-plugin` that owns entries, dev serving, the build and SSR ([RC announcement](https://github.com/solidjs/solid/releases/tag/v2.0.0-rc.0)). Solid 2 is in release candidate with the API frozen (rc.21 on 4 Nov 2026), so we install from npm `@next` until 2.0 final, as you prefer. That tag moves with every RC, so pin exact versions and upgrade in a dedicated pull request.

| Layer | Choice | Why | Cost |
| --- | --- | --- | --- |
| UI | Solid 2 (`solid-js@next`, `@solidjs/web@next`) | Fine-grained updates, no virtual DOM, small runtime | Free |
| Build and SSR | Vite with `@solidjs/vite-plugin` in start mode: `start: true`, `ssr: true`, `serverFunctions: true` (the prerender integration needs it); Rust/OXC compiler (the default) | One plugin covers dev, SSR and the build; no meta-framework | Free |
| Static generation | `prerender-crawler` with `mode: "static"` and the `@solidjs/prerender` integration; `prerendered()` for build-time data | Crawls from `/` and writes HTML for every linked page into `dist/client` | Free |
| Routing | Solid Router 2.0 (`@solidjs/router`) with typed paths from the `filesystem-routing` Vite plugin | Typed params and links; ships with the RC | Free |
| Head and SEO | `@solidjs/meta` components (`Title`, `Meta`, `Link`) over Solid 2's built-in head registry (`useHead` in `@solidjs/web`) | Titles, Open Graph and canonical tags rendered into the HTML | Free |
| Hosting | Cloudflare Workers with Static Assets, through `@cloudflare/vite-plugin` | Static asset requests are free and unlimited; custom headers via `_headers` (100 rules at most; they do not apply to Worker responses) | Free |
| Builds and previews | Cloudflare Workers Builds from the GitHub repo | Build on push, preview URL per branch | Free: 3,000 build minutes a month, 1 build at a time |
| CI gates | GitHub Actions, as required checks on pull requests | The Workers Builds image lists Python, Bun and Node but no browser, so Playwright, axe and Lighthouse run here | No Cloudflare cost |
| Beacons | One small Worker on `/api/*` only | Everything else is served without invoking it | Free tier: 100,000 requests a day, shared by every Worker on the account |
| Metrics store | Workers Analytics Engine | Time-series writes from the Worker, queried with SQL | Free: 100,000 data points written and 10,000 queries a day; data kept 3 months |
| Uptime and roll-ups | A Cron Trigger Worker | Free plan allows 5 cron triggers per account | Free |
| Alerts | `send_email` binding through Email Routing (already set up on carryjournal.com) | Mail from the cron Worker to your verified address; sending to verified addresses is free | Free |
| Tooling | Bun workspaces (packages/schema, packages/pipeline, apps/web) for installs and scripts; TypeScript 7.0.2 strict; Biome | Bun is on your learning list; Biome is already on your Mac | Free |
| Data model and pipeline | Zod 4 in packages/schema as the canonical data model; plain Bun scripts in packages/pipeline parse the data and write the site's JSON at build time. The web app and every Worker import types only. Effect is deferred (ADR-02, decided 15 Nov) | Validation runs only at build time, so no validator code reaches the page. Zod reads plainly, exports JSON Schema itself, and is the validator coding agents know best | Free |

Not used: SolidStart (retired by start mode), Pages (Workers Static Assets is Cloudflare's current path), Sentry (the free plan is 5,000 errors a month for one user, and it isn't Cloudflare).

Not used in v1: Effect. ADR-02 proposed it for the data pipeline, but the v1 pipeline only reads, validates and writes, so Zod and plain Bun scripts cover it (decided 15 Nov). Revisit Effect if the pipeline grows into re-checking many source pages with retries and a provenance log, or if the site gains a real API such as search, submissions or admin. ADR-02's findings stand for that day: no Effect in the client bundle or a Worker, and on 15 Nov `effect/http-api`, `@effect/platform-cloudflare`, `@effect/sql-d1` and `@effect/atom-solid` were each unstable, experimental or Solid 1 only.

## Rendering and caching

Every public page is prerendered, because the content only changes when the data changes and a rebuild follows every data change. Solid's own guidance is the same: if content doesn't change between deploys, prerender; if it does, stream SSR ([rendering modes](https://v2-rebuild--solid-docs-v2.netlify.app/guides/choose-a-rendering-mode.md)). The site keeps `ssr: true` on, so a page that later needs live data can switch to streaming SSR on the Worker without a rewrite.

- **Build:** the prerender crawler starts at `/`, renders each page through the server build and follows same-origin links. So every bag and fabric page must be linked from somewhere; a sitemap page guarantees it, and a CI check compares the built files with the route list.
- **Hydration:** the browser hydrates onto the existing HTML instead of re-rendering it. Code that touches the browser (theme, units, `localStorage`) stays behind `isServer` checks, in effects or in `clientOnly`, so server and client render the same markup.
- **Hashed assets** (JS, CSS, fonts, images): `Cache-Control: public, max-age=31536000, immutable`, set in `_headers`.
- **HTML and data JSON:** `Cache-Control: public, max-age=0, must-revalidate`. Cloudflare still serves them from its edge cache, and each deploy uploads a new asset version, so no manual purge is needed. A deploy takes time to reach every location, so an open tab can ask for a hashed file the new version no longer has; a failed lazy import reloads the page once.
- **Faster next pages:** this depends on question 10. With document navigations (`explicitLinks: true` on the router), Speculation Rules can prefetch or prerender the next page in Chromium browsers; the API is not Baseline, and other browsers just load the static page. Serve the rules as a JSON file named in a `Speculation-Rules` header in `_headers`. That avoids an inline script and replaces Speed Brain, Cloudflare's default on the Free plan, which only prefetches. With router navigations, the router's link preloading does this job and Speculation Rules add nothing. Early Hints is available on the Free plan, but it needs `Link` preload headers on the HTML and is sent less often for cached responses, so measure it before relying on it.
- **Theme and units without a flash:** a tiny inline script in the head reads the saved theme and unit choice before first paint.
- **Images:** resized at build time (AVIF and WebP, `srcset` and fixed dimensions), never at request time. That keeps Cloudflare Images and its quotas out of the picture. The LCP image loads eagerly with high fetch priority; every other image is lazy.
- **Fonts:** a system font stack, or one self-hosted subset WOFF2 that is preloaded and paired with a size-matched fallback so text does not shift. No third-party font host.
- **Security headers:** a Content Security Policy with no `unsafe-inline`, plus HSTS, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`, all in `_headers`. The inline theme script and Solid's hydration script need hashes; the spike checks that those hashes are the same on every page. The beacon Worker sets its own headers, because `_headers` does not reach Worker responses.
- **Search and sharing:** `sitemap.xml`, `robots.txt`, canonical URLs, JSON-LD (`BreadcrumbList`, `ItemList`) and one Open Graph image per bag, all generated at build.

## Data pipeline

The data stays where it is today (`data/` YAML, `data/airlines/airlines.json`, `drawings/`), and the app reads it only at build time. No database, no runtime API.

1. **Model.** Zod 4 schemas in `packages/schema` become the canonical data model: `Model`, `Variant`, `SourceCheck` (source URL, `checkedAt`, fields verified, outcome) and `AirlineCabinLimit`, with branded IDs, and lengths and weights as whole millimetres and grams (`z.int()`, never a bare `z.number()`). `schema/carry-journal.schema.json` is generated from it with `z.toJSONSchema`, so `tools/validate.py` and the airline checker keep working unchanged. Keep the maker's printed figure and unit next to the integer value, so the page can still show the maker's own number; fit maths runs on the integers.
2. **Compile.** Plain Bun scripts in `packages/pipeline` parse every input with the Zod schemas: the hand-entered YAML and the checker's `airlines.json`. They write pre-validated JSON: one file per model, a compact listing index, and the airline table. A file that fails to parse stops the build and names the field and the reason. `apps/web` uses `import type` from `@cj/schema` only, so a renamed field breaks the type check, not the page, and no validator code ships. `tools/validate.py` keeps running first in CI until the pipeline's checks cover all of its rules.
3. **Source checks.** V1 has no automated re-reading of spec figures: with 12 models, a re-read by hand or by a subagent every few months is cheaper than writing a reader per maker site. Two small pieces cover the rest. A weekly Bun script on your Mac, next to the airline checker, opens each source link (117 today), updates `last_ok` in `data/sources.yaml` and reports dead links; it never blocks a deploy. And the build flags any spec or airline limit whose last check is older than a set age (90 days to start; your call), so the page can show it as due for a re-check.
4. **Precompute.** Everything the current page works out in the browser moves to the build, as pure TypeScript functions with unit tests: computed summary lines, standouts and airline fit per build and airline. The browser only filters what's already worked out.
5. **Split.** The listing HTML carries what the cards show. The airline fit table for each bag is a separate prerendered JSON file, fetched only when "Check by airline" opens.
6. **Assets.** The line drawings go through SVGO and are inlined or sprited. Photos are resized at build, and a photo is published only once its brand's permission in `data/brands.yaml` is `granted`, so an unlicensed photo can't reach the live site.
7. **Freshness.** When the airline checker on your Mac updates `airlines.json` and the change is pushed, Workers Builds rebuilds and redeploys. Each page shows the date of its data.

## Page and route architecture

The current single page becomes a listing plus one page per bag and fabric, so each bag has its own URL to share and to rank in search. Airline fit stays a widget, on the listing and on each bag page, as it is on today's page; there are no per-airline pages. All routes are prerendered.

| Route | What it is | Pages | JavaScript |
| --- | --- | --- | --- |
| `/` | Carry Journal home: intro, sections, latest changes | 1 | Theme and units only |
| `/uhmwpe-backpacks` | Today's page: hero strip, cards, table, chart, airline fit | 1 | Sort and filter, chart, airline widget (lazy) |
| `/bags/[model]` | One bag: builds, specs with sources, drawings, reviews, airline fit | 12 | Airline widget (lazy) |
| `/fabrics/[id]` | One note per fabric (ULTRA, Graflyte, UHMWPE, DCF, X-Pac, EcoPak, nylon, polyester), ported from `materials/v1` | 8 | None |
| /fabrics, /fabrics/compare, /glossary | Today's Fabric notes index, Compare fabrics and Glossary pages from materials/v1, linked from the top nav as now | 3 | Theme and units only |
| `/compare` | New: two or three builds side by side (today's page has no bag compare; drop it if you don't want one) | 1 | Picker (client) |
| `/about`, `/sources` | About, references and thanks, per your note | 2 | None |
| `/performance` | Live real-user metrics for the site itself | 1 | None (rebuilt daily after the roll-up) |
| `/sitemap` | Every page, so the crawler and search engines find them | 1 | None |
| /404.html, /sitemap.xml, /robots.txt | Static not-found page and crawler files, written at build | 3 files | None |

**Components, by how much script they need:**

- **Static** (rendered once, never updated): card text, spec tables, sources, drawings, fabric pages. These are most of each page.
- **Small interactive pieces:** theme switch, metric/imperial switch, sort and filter, photo hover between views.
- **Heavy and lazy:** the airline fit widget and the weight chart. Their code and data load on first open or when they scroll near the viewport.

Solid 2's docs describe no islands mode (reactive server components are an experimental preview), so a prerendered page hydrates as a whole. The budget therefore relies on Solid's small runtime, static-only components that do no reactive work, and route-level code splitting. `NoHydration` is for client-only widgets, not for shrinking the bundle. The 35 KB budget is unproven: it has to cover Solid's runtime, the router and hydration of the whole listing page, and I found no published size for the RC. The spike measures the listing page for that reason.

## Metrics, error reporting and uptime

All of it runs on Cloudflare's free tier, through one beacon Worker and one cron Worker. No third-party script loads on the page.

- **Real-user metrics.** Google's `web-vitals` library (attribution build, loaded after first paint) reports LCP, INP, CLS, FCP and TTFB with the element or interaction behind each. The page sends them with `navigator.sendBeacon` to `/api/rum`, and the Worker writes one data point per page view to Workers Analytics Engine: page, the five metric values, device class, connection type and country. No cookies and no IP stored; country comes from Cloudflare's request metadata. That should avoid a consent banner, but it is a legal call, so list what is collected on the about page.
- **Beacon hygiene.** One beacon per page view, sent on `visibilitychange`, with a sample rate held in one constant. The Worker accepts same-origin POSTs only and caps the body size. Errors are deduplicated by a hash of message and stack, and capped per page view. Cloudflare's one free rate limiting rule (per IP, 10 s window) goes on `/api/*`. If the account's 100,000 daily requests run out, beacons fail but pages still load, because pages never invoke the Worker.
- **Second opinion.** Cloudflare Web Analytics is free, but on a proxied site it works by injecting its own beacon script into the HTML, and that automatic setup is on by default. It breaks the no-third-party-script rule and the CSP, so set it to Disable. Turn it on only for a short calibration run if our numbers need checking (question 12).
- **Error reporting.** `window.onerror`, `unhandledrejection`, Solid's `configureClientErrors` and an `<Errored>` boundary around each interactive piece all report to `/api/err`: message, stack (trimmed to fit Analytics Engine's 16 KB blob limit per data point), release, page and browser. The Solid hook reports only errors a boundary caught; the two window handlers cover the rest. A boundary shows a quiet fallback, so a broken widget never blanks the page.
- **Readable stack traces.** Source maps are built but not deployed. They are kept per release (in R2, or as build artifacts), so the cron Worker or a local script can map a minified stack back to source.
- **Uptime and roll-up.** A cron Worker runs every few minutes: it fetches the key pages and the beacon endpoint, checks status and that the expected content is there, and writes the result to Analytics Engine. Once a day it queries Analytics Engine through the SQL API (an API token stored as a secret), emails you through the `send_email` binding if a budget or the uptime check fails, and POSTs a Workers Builds deploy hook. The rebuild runs the same query and prerenders `/performance` with the new 75th-percentile figures, so that page needs no script and no extra storage. Two limits: the free plan gives a cron run 10 ms of CPU, so the percentile maths stays in SQL; and a check that runs on Cloudflare cannot report a Cloudflare or account outage (question 11).
- **Server logs.** Workers Logs covers the beacon Worker itself: 200,000 events a day and 3 days of retention on the free plan. It moves to Cloudflare Observability pricing on 1 December 2026, so recheck then.

## Quality gates

These run in GitHub Actions as required checks, so a pull request can't merge unless all pass. Workers Builds deploys whatever reaches main and does not wait for them, so main must be a protected branch. Lighthouse and the header check run against the branch preview URL, which is the real edge. Each budget in the first table is a failing check, not a dashboard.

| Gate | Tool | Fails when |
| --- | --- | --- |
| Data | `tools/validate.py` | Any data error (same rules as today) |
| Schema | Round-trip tests (encode, then decode, gives the same value) and a contract test that decodes a real airline-checker output file | A schema change breaks existing data or the checker's output |
| Types and lint | TypeScript 7 strict, Biome; noRestrictedImports bans value imports from zod and @cj/schema under apps/web (types only). Biome's type-aware promise rules (noFloatingPromises, noMisusedPromises and the rest of its types domain) are set to error. They are still in Biome's nursery group, so pin the Biome version and expect some churn | Any error |
| Unit and component tests | Vitest with Solid Testing Library | Any failure; precompute logic (fit, standouts, units) fully covered |
| End to end | Playwright | Key flows break: units switch, theme, sort, airline widget, compare |
| Accessibility | axe in Playwright, plus keyboard runs | Any serious or critical issue |
| Hydration | Playwright with the console watched | Any hydration mismatch warning |
| Bundle size | size-limit | JavaScript or HTML over budget; a sudden jump in the client entry chunk also means validator code leaked in |
| Performance | Lighthouse CI, mobile profile, 3 runs | On the median run: Accessibility, Best Practices or SEO under 100; Performance under 95 (100 stays the target, but the score varies between runs); or LCP, CLS or total blocking time over budget |
| Visual | Playwright screenshots, light and dark | Unreviewed change to a page |
| Links | A link checker over the built site | A broken internal link. Dead source links are reported by the weekly source check instead, so one maker's site being down can't block a release |
| Routes | A script that compares dist/client with the route list from the data | A bag or fabric has no HTML file (the crawler skips pages nothing links to) |
| Security headers | Playwright against the preview URL | A header from \_headers is missing, or the console shows a CSP violation |

The checks you already run on the HTML mock (the a11y, interaction and units scripts in `design/build/v23/`) become the first Playwright tests, so nothing the mock already proves is lost.

## Build plan

&#91;embedded content: build plan · 6 phases, 2 gates, in rough weeks\]

The weeks are a rough order, not dates; the director sets dates once the spike is measured. Phase 0 exists to prove the riskiest assumptions on a release-candidate framework before anything else is built: prerendering through start mode, hydration on Workers, and the JavaScript budget. The launch gate is not technical: it's the items already in your open-items doc.

The data work fits into these phases. **Scaffold** (Phase 1): Bun workspaces `packages/schema`, `packages/pipeline` and `apps/web`; exact pins for `zod@4.6.7`, `typescript@7.0.2` and Solid `2.0.0-rc.21`; the import ban, Biome's promise rules and the client budget in CI. **Data model and pipeline** (first half of Phase 2): Zod schemas, fixtures, round-trip tests and the checker contract test, then the Bun scripts that write the site's JSON, the weekly source-link check and the staleness flag. **From there to launch:** the site reads the emitted data and imports types only.

The spike is timeboxed to 3 working days and ends with an answer to each of these seven questions:

1. Do `prerender-crawler` and `@cloudflare/vite-plugin` together produce a deployable `dist/client`? Which Worker is `main`: Solid's `virtual:solid-ssr-handler`, or a hand-written beacon Worker with the Solid handler used only at build? The aim is that an unknown URL gets the static 404 page without invoking a Worker.
2. JS, HTML and LCP for the real listing page (18 builds) and one bag page, measured on the preview URL.
3. Document navigations with Speculation Rules against router navigations with link preloading: which is faster, and which ships less JS (question 10)?
4. Zero hydration warnings with the theme and units set before first paint.
5. Does a hash-based CSP hold with Solid's inline hydration script?
6. Does the lazy airline widget load its `prerendered()` data from a static JSON file, with no Worker call?
7. Does Solid 2 RC TSX type-check under TypeScript 7.0.2 with jsxImportSource set to @solidjs/web, and do the Vite plugin, Zod 4's inferred types and Biome's type-aware rules all work with it? ADR-02 reports that Solid 2 TSX passed a first check under effect-tsgo, a fork of the TypeScript 7 compiler; confirm it in the real scaffold.

If prerendering is blocked on the RC, the stopgap is to render in the Worker and cache the HTML with the Cache API. That puts every page view under the 100,000 daily request limit, so it is not the end state.

## Working in T3 Code

Run it the way the tscache director runs: one director thread holds the plan and splits it into small pull requests for worker threads, with cross-model review before merge. One phase per brief, so each lands green on its own.

- **Before code: grill.** The director's first task is a grilling session against this doc and the Solid 2 docs (`v2.solidjs.com/llms-full.txt`, plus the `solid-2.0` skill shipped in `node_modules/solid-js/skills/`). It asks you the open questions one at a time and writes the answers into an ADR file in the repo. Use your grill-me skill if it's in agent-config.
- **Model roles.** Fable for the director and for review; Opus or Codex for implementation tasks, per your model roster.
- **Data rules.** These go into AGENTS.md and CLAUDE.md. Zod lives only in `packages/schema` and `packages/pipeline`; `apps/web` may only `import type` from `@cj/schema`. Every external input (hand-entered specs, checker output) is parsed with the schema before use. Measurements are whole millimetres and grams. A failed source check is recorded, never dropped. Reviewers reject a value import from `zod` or `@cj/schema` in `apps/web`, and any new dependency on Effect.
- **Never auto-merge:** `wrangler.jsonc`, `_headers`, the CI workflow, packages/schema, and anything touching `data/`.
- **Notify after merge:** any budget change, any new dependency.

**First prompt for the director thread:**

```markdown
You are the director for the Carry Journal web app. Read the plan doc (pasted below or linked), ADR-02 (Effect; deferred for v1, so save it as docs/adr/0002-effect-pipeline.md with status Deferred), README.md, README-data.md and the Solid 2 docs at v2.solidjs.com/llms-full.txt. Solid 2 only, installed from @next; use start mode in @solidjs/vite-plugin, never SolidStart.

Step 1: grill me. Ask the open questions from the plan one at a time, recommend an answer for each, and record the decisions in docs/adr/0001-architecture.md.
Step 2: Phase 0 spike. A throwaway branch that prerenders the listing page and one bag page from data/ with start mode and prerender-crawler, deploys to a Workers preview URL, and answers the seven spike questions in the plan with measured LCP, JS and HTML sizes. Timebox: 3 working days. Stop and show me the numbers before Phase 1.

Rules: one PR per task, budgets enforced in CI from Phase 1, cross-model review before merge, never auto-merge wrangler.jsonc, _headers, CI or data/. Pin exact Solid RC versions and upgrade them only in a dedicated PR. Check every Solid 2 API against the docs before using it; do not rely on memory of Solid 1 or SolidStart. The data model is Zod 4 in packages/schema, used only there and in packages/pipeline; apps/web imports types only. Do not add Effect without my approval.
```

## Questions for you

I've put my recommendation after each one; the director will grill you on them before writing code.

1. **Repo:** a new public repo for the app, with `the-carry-index` folded in as `data/`? For a showcase, public is better. I'd rename it `carry-journal` at the same time.
2. **Router:** Solid Router 2.0 or TanStack Router? I'd use Solid Router 2.0: typed routes, first-party, and the default the Solid docs recommend.
3. **URLs:** are `/bags/…` and `/fabrics/…` the names you want? These are hard to change once they rank in search.
4. **Airline pages:** decided 15 Nov: no page per airline. Airline fit stays a lazy widget on the listing and on each bag page, as on today's page. Unchecked airlines stay in the widget, marked unchecked.
5. **Performance page:** public from day one? I'd say yes; it's the strongest showcase piece.
6. **Photos at launch:** if some brands haven't answered, launch with drawings only for those bags? I'd say yes.
7. **Source maps:** keep them in R2 (free up to 10 GB) or only as CI artifacts? I'd use R2. Check first whether turning R2 on asks for a payment card; if it does, CI artifacts are enough.
8. **Paid plan:** go to Workers Paid ($5 a month) only if the beacon Worker hits the free daily limit. The limit is shared with every other Worker on your account. One beacon per page view, plus sampling, keeps it well under.
9. **Launch order:** the UHMWPE section first, with the Carry Journal home page as a short intro? I'd say yes, to ship sooner.
10. **Navigation:** full document loads between pages, or client-side router navigations? I'd use document loads (`explicitLinks: true`): every page is already complete HTML, Speculation Rules cover Chromium, and no page depends on fetched route data. The spike measures both before this is fixed.
11. **Outside uptime check:** add one free external monitor as a backstop? It would be the only piece not on Cloudflare. I'd say yes, because the cron Worker cannot see a Cloudflare or account outage.
12. **Cloudflare Web Analytics:** keep it off, since it injects a script? I'd keep it off and rely on our own beacon.
13. **Effect (ADR-02):** decided 15 Nov: deferred. V1 uses Zod 4 and plain Bun scripts, because automated re-verification is not in v1: there are 117 source links and 12 models, the airline checker already re-reads every airline about once a month, and re-reading spec figures from maker pages needs a reader per site. Revisit Effect when the pipeline grows into that work.
14. **Airline checker format:** should the checker on your Mac write @cj/schema's format, or keep its own with a decoder in the pipeline? I'd keep its format for now, decode it in the pipeline under a contract test, and move it over once the schema settles.
15. **User submissions:** will the site ever take them? If so, that is the point to revisit Effect HttpApi on a Worker. Until then the site has no runtime API.

## Sources

- [Solid 2.0 RC announcement](https://github.com/solidjs/solid/releases/tag/v2.0.0-rc.0) and [rc.21 release](https://github.com/solidjs/solid/releases/tag/solid-js%402.0.0-rc.21)
- [Solid 2 docs: choose a rendering mode](https://v2-rebuild--solid-docs-v2.netlify.app/guides/choose-a-rendering-mode.md) and [NoHydration](https://v2-rebuild--solid-docs-v2.netlify.app/reference/solid-js/advanced/manual-hydration/no-hydration.md)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [limits](https://developers.cloudflare.com/workers/platform/limits)
- [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations) and [Vite plugin static assets](https://docs.cloudflare.com/workers/vite-plugin/reference/static-assets/)
- [Cloudflare RUM beacon](https://developers.cloudflare.com/speed/observatory/rum-beacon/)
- Solid 2 docs: [deployment](https://v2-rebuild--solid-docs-v2.netlify.app/building-apps/deployment.md), [start mode options](https://v2-rebuild--solid-docs-v2.netlify.app/reference/vite-plugin-solid/start.md), [router navigation](https://v2-rebuild--solid-docs-v2.netlify.app/routing/solid-router/navigation.md), [routing overview](https://v2-rebuild--solid-docs-v2.netlify.app/routing/overview.md), [head and metadata](https://v2-rebuild--solid-docs-v2.netlify.app/building-apps/head-and-metadata.md), [configureClientErrors](https://v2-rebuild--solid-docs-v2.netlify.app/reference/solid-js/advanced/diagnostics-dev-hooks/configure-client-errors.md) and [solid-js on npm](https://registry.npmjs.org/solid-js) for the `next` tag
- Cloudflare hosting: [static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/), [static assets caching and versions](https://developers.cloudflare.com/workers/static-assets/), [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [Workers Builds limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/), [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) and [deploy hooks](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/)
- Cloudflare data and alerts: [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) and [limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [sending email from Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/), [rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Cloudflare speed: [Web Analytics setup](https://developers.cloudflare.com/web-analytics/get-started/), [Early Hints](https://developers.cloudflare.com/cache/advanced-configuration/early-hints/) and [Speed Brain](https://developers.cloudflare.com/speed/optimization/content/speed-brain/)
- [MDN: Speculation Rules API](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API), [web.dev: Time to First Byte](https://web.dev/articles/ttfb) and [Sentry pricing](https://sentry.io/pricing/)
- [zod on npm](https://www.npmjs.com/package/zod) (4.6.7 is latest; it exports `z.toJSONSchema`, `z.int` and `.brand`), and the comparisons behind the choice: [Schema Benchmarks](https://deploy-preview-105--schemabenchmarks.netlify.app/blog/welcome), [InfoQ on Zod schema compilation](https://infoq.com/news/2026/10/zod-schema-compliation) and [Typia's TypeScript-Go setup](https://typia.io/docs/setup/tsgo/)
- [@effect/atom-solid on npm](https://www.npmjs.com/package/@effect/atom-solid) (peer `solid-js` below 2) and [@effect/platform-cloudflare on npm](https://www.npmjs.com/package/@effect/platform-cloudflare) (peers on a beta `@alchemy.run/cloudflare`)
- [typescript on npm](https://www.npmjs.com/package/typescript) (7.0.2 is latest), [Biome's noFloatingPromises rule](https://biomejs.dev/linter/rules/noFloatingPromises) (nursery group) and [Effect 4.1 release](https://effect.website/blog/releases/effect/41) (for ADR-02)

## Review notes (Fable, 15 Nov 2026)

Changed:

- **TTFB budget.** 100 ms in the field cannot be met on 4G, because TTFB includes DNS, connection and TLS. It is now 0.8 s in the field and 100 ms server response in the lab.
- **Navigation model.** The plan had a hydrated router and Speculation Rules together. The router turns link clicks into client navigations, so the rules would never fire. Added `explicitLinks: true` as the recommended option and made it question 10.
- **`/performance` data path.** A cron Worker cannot write into static assets. It now triggers a deploy hook and the rebuild prerenders the figures.
- **CI and deploy.** Workers Builds does not gate on tests and its image lists no browser. Gates moved to GitHub Actions as required checks; Workers Builds deploys and makes preview URLs.
- **Lighthouse gate.** A hard 100 on Performance fails at random. The gate is now the median run, 95 or above, plus the metric budgets.
- **Web Analytics.** It injects a script on proxied sites, which contradicted the no-third-party-script rule. Now off by default (question 12).
- **Beacon limits.** Added one beacon per page view, dedup, a size cap and the free rate limiting rule. The 100,000 daily requests are per account, not per Worker.
- **Added what was missing:** CSP and security headers, fonts, `sitemap.xml`, `robots.txt`, JSON-LD, Open Graph images, a 404 page, a route-coverage gate, version pinning and a version-skew note.
- **Spike.** It now has six exit questions, a 3-day timebox and a stated stopgap. It measures the listing page, not only a bag page.
- **Solid facts.** Checked rc.21 (4 Nov) and the `next` tag. Corrected the config (`serverFunctions: true`), the head packages and the router package names.

Flagged, not changed:

- **35 KB of JS and 1.0 s field LCP** are both unproven. Treat them as hypotheses until the spike reports.
- **Which Worker is `main`.** Solid's Cloudflare recipe makes its SSR handler the Worker. Then every unknown URL (bots included) invokes it and counts against the daily limit. I could not confirm from the docs how `not_found_handling` behaves when a Worker is present, so this is spike question 1.
- **Self-fetch.** Confirm in Phase 4 that the cron Worker can fetch its own hostname through the public edge. If not, the external monitor does the page check.
- **Early Hints** with Workers Static Assets is undocumented. Do not count on it.
- **Not verified:** whether R2 needs a payment card, what the `solid-js` package's `skills/` folder contains (it exists in rc.21), the Lighthouse run count, and `mycarryjournal.com` in the diagram.
- **Order.** I would move the RUM beacon from Phase 4 to Phase 2 so field data builds up before launch. Left as is; your call.

## ADR-02 update (15 Nov 2026)

Folded in ADR-02, Effect in the data pipeline, not on the page. Changed: the stack (a data model and pipeline row; TypeScript 7 with @effect/tsgo; what Effect is not used for), the data pipeline (Effect Schema as the canonical model, with the JSON Schema generated from it; a provenance step), the quality gates (an import ban, schema round-trip and contract tests, a budget jump that flags leaked Effect), the build plan (M0 to M2 mapped onto Phases 1 and 2; a seventh spike question on TypeScript 7), the T3 Code rules and the director prompt, and three new questions. I checked every version the ADR pins against npm on 15 Nov; all are current. ADR-02's other open questions are already answered here: runtime data is static JSON in assets, and errors go to our own beacon and Workers Logs, with no third-party service. Later on 15 Nov: scoped @effect/tsgo to packages/\*, added Biome's type-aware promise rules to the lint gate, and recorded the re-verification analysis under the Effect question. Decision, later still on 15 Nov: Effect is deferred. V1 uses Zod 4 and plain Bun scripts; the provenance step became a weekly source-link check and a build-time staleness flag; dead source links no longer block deploys; @effect/tsgo is dropped. ADR-02 stays on file for when the pipeline grows.
