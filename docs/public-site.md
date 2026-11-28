# The public site build (milestone 2, first slice)

`apps/web` builds Carry Journal as static HTML with no script (ADR-0015, static first), using the approach spike
PR 8 measured (`docs/spike/static-csp.md` on branch `spike/08-static-csp`): a plain Vite build plus a prerender
step, no Solid start mode, the stylesheet inlined (ADR-0018), one CSP hash set for every page.

## Pages

| Route | File in `apps/web/dist/client` | Shows |
| --- | --- | --- |
| `/uhmwpe-backpacks` | `uhmwpe-backpacks.html` | Every listed build of every bag, lightest first: name (linking to its bag page), maker, weight, capacity, fabric |
| `/` | `_redirects`: `/ /uhmwpe-backpacks 302` | A temporary redirect to the listing until there is a home page |
| `/bags/<slug>` | `bags/<slug>.html` | One bag: maker, name, and a table of its builds (weight, capacity, fabric) |
| any other path | `404.html` | "Page not found", with a link to the listing |

The deployed Worker serves assets with `html_handling: "drop-trailing-slash"` and `not_found_handling: "404-page"`
(`packages/deploy/src/workers.ts`), so `uhmwpe-backpacks.html` and `bags/<slug>.html` are served at
`/uhmwpe-backpacks` and `/bags/<slug>` (ADR-0023), the forms with a trailing slash redirect there, and an unknown path
gets `404.html` with status 404. These are the only page names the gate's allow-list
accepts (`packages/deploy/src/allow-list.ts`).

## Data

Pages show only the public surface (`packages/deploy/public-surface.json`): a build is a `Bag` (`slug`, `name`,
`brand`, `weightGrams`, `capacityLitres`, `fabric`), and a bag page is a model's slug, name and maker plus its
builds.

1. `packages/pipeline/src/cli/export.ts` reads `data/brands.yaml`, `data/materials.yaml` and every
   `data/bags/<maker>/*.yaml` (`readCatalogue` in `src/catalogue.ts`). Stripping shapes read only the keys a `Bag`
   is made from; every build is then checked against the strict `bagSchema`, and the build stops on the first file
   that fails, naming it. A build's fabric is the listed fabric its shell materials belong to (a UHMWPE fibre is
   `uhmwpe`; otherwise the material's family). Builds marked `record: comparison` are left out, as README-data
   says they are listed nowhere.
2. It writes the export atomically beside the build's output folder, `<outDir>.catalogue.json`
   (`apps/web/dist/client.catalogue.json` for the normal build), which the build reads once and removes (types
   `CatalogueExport` and `CatalogueModel` in `packages/schema`).
   `apps/web` reads that file; it imports schema and pipeline types only (the import ban, `bun run lint`).

## Build

`bun run build` runs `vite build` in `apps/web`, whose `staticSite` plugin first runs the export with Bun, so every
build makes its pages from a fresh export:

- The build's only input is `src/styles.css`. The `staticSite` plugin (`apps/web/build/static-site.ts`) loads
  `src/render.tsx` through a Vite module runner it sets up itself (`createRunnableDevEnvironment`, with nothing
  external), compiled by the Solid plugin for the server in its non-hydratable mode, and renders each page with
  `renderToString(..., { noScripts: true })`: no hydration keys, no Solid script.
- Every file the renderer loaded is passed to `addWatchFile`, so `moduleGraph` (`packages/deploy`) fails the build if
  the page code reached anything private, and lists those files in `dist/client.module-graph.json`. A module the
  runner loads outside the graph (a specifier built at run time, or a `data:` URL) fails the build unless
  `isBuiltin` from `node:module` accepts it as a Node built-in.
- The plugin takes the processed CSS out of the bundle, inlines it into every page, and emits the pages,
  `_redirects` and `_headers` through the bundle, so the graph report lists each with its SHA-256. A chunk with code fails the build:
  the site ships no script.
- `build/site.ts` hashes every inline `<script>` and `<style>` of every page, fails unless all pages share one set,
  and writes `_headers` from `public/_headers` with the CSP line replaced. It also fails if the stylesheet is over
  the whole-site CSS budget: 10 KB at Cloudflare's edge compression levels, the larger of Brotli 4 and gzip 8.

The policy (today one style hash, no script):

```
default-src 'none'; script-src 'none'; style-src 'sha256-…'; img-src 'self'; base-uri 'none';
form-action 'none'; frame-ancestors 'none'
```

## Checks

- `bun run size`: two size-limit targets per built page, one gzip and one Brotli (the listing under 40 kB, each bag
  page and the 404 page under 14 kB, CSS included), measured again at Cloudflare's edge levels. The gate fails on a
  built page with no target, and `packages/checks/test/repo.test.ts` fails unless every page has both rows, so a new
  bag needs two rows in the root `package.json`. The JavaScript budgets have no file to measure: the build refuses
  any script chunk (`apps/web/test/static-site.test.ts`) and the e2e test asserts no page has a `<script>`.
- `node packages/deploy/src/bin.ts check apps/web/dist/client`: the deploy gate's schema check, seal and allow-list,
  canary and email scans, and headers. It does not run the build-graph check: `deploy` and `triggers` do, and since
  N2 they require `apps/web/dist/client.module-graph.json` for any site with pages or `assets/` files, with every
  page and asset listed at the sealed file's SHA-256.
- `bun run test:e2e` (`playwright.config.ts`, `e2e/site.spec.ts`): `e2e/serve.ts` seals the build with the gate's own
  `seal` and `PUBLIC_SITE` config into the system temp folder and serves it with `wrangler dev` on 127.0.0.1:8818.
  In light and dark, at desktop and phone sizes (Chromium): every page loads with no script, one `h1` and headings
  in order, with no console error or CSP violation; the 404 status and page; the `/` redirect (302) and the trailing-slash redirects; the
  security headers and a hash-only CSP; axe (WCAG 2.2 AA and best practices) on each template; the keyboard reaches
  every link in order with a visible focus ring; no sideways scroll at 320 px, also with the text size at 200%; both
  templates restore from the back/forward cache (in full Chromium launched without Playwright's
  `--disable-back-forward-cache`); the theme follows the system setting; pages are complete with scripts off.

## Not in this slice

The theme and units switches, the sort island, the airline widget, line drawings, the metrics beacon, a home page,
fabric pages, about, sources, sitemap and robots.txt. Theme follows the system setting only.
