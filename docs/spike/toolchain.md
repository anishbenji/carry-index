# Spike PR 4: the TypeScript 7 toolchain (question 7)

Branch `spike/04-scaffold`, 25 Nov 2026. Machine: Darwin arm64 (Apple silicon Mac).

## Question

Architecture question 7: does Solid 2 TSX type-check under TypeScript 7.0.2 with `jsxImportSource` set to
`@solidjs/web`, and do the Vite plugin, Zod 4's inferred types and Biome's type-aware rules all work with it?

## Answer

Yes, for everything this scaffold exercises. `tsc --build` (TypeScript 7.0.2, the native compiler) checks all
seven workspaces through project references, including Solid 2 TSX with `jsxImportSource: "@solidjs/web"`, Zod 4
inferred types and Cloudflare Workers types. It reports real JSX type errors, not just silence. The Vite build
with `@solidjs/vite-plugin` 3.0.1 works, and Biome 2.6.9's type-aware promise rules fire on this code.

Two things do not work as the architecture doc assumed:

1. **Biome cannot enforce "types only" imports.** `noRestrictedImports` flags `import type` as well as value
   imports, so configuring it for `zod` and `@cj/schema` under `apps/web` rejects the very imports we want.
   The ban is enforced instead by a checker in `packages/checks` that reads each file with TypeScript 7's own
   parser (run by `bun run lint` and by a test). It resolves relative and `file:` paths too, so a value import
   that reaches `packages/schema` or Zod's folder under `node_modules` by path is banned like one by name.
2. **No Node or Bun type package is approved.** The checks package uses `node:fs` and `Bun.spawnSync`, so it
   carries a hand-written declaration file (`packages/checks/src/runtime.d.ts`) for the dozen APIs it calls.
   That file goes away once `@types/bun` (or `@types/node`) is approved; see "For the user" below.

## Versions

| Tool | Version | Where |
|---|---|---|
| Bun | 1.4.2 | machine |
| Node | 26.13.0 | machine (Vitest and Vite run on it through their `node` shebangs) |
| typescript | 7.0.2 | root |
| @biomejs/biome | 2.6.9 | root |
| vitest | 5.1.1 | root |
| vite | 8.3.8 | apps/web, apps/kit |
| @solidjs/vite-plugin | 3.0.1 | apps/web, apps/kit |
| solid-js, @solidjs/web | 2.0.4 | apps/web, apps/kit |
| zod | 4.6.7 | packages/schema, packages/pipeline |

Every other approved package PRs 7 and 8 need is installed at its approved pin (see "Layout"); nothing outside
`approved-dependencies.md` was added, and none of the PR-9-only packages or hono.

## Layout

- `packages/schema`: a strict Zod 4 bag schema and its inferred `Bag` type.
- `packages/pipeline`: `readBags`, which parses YAML (`yaml` 2.9.1) and validates each entry.
- `packages/checks`: the privacy-wall check, the size and end-to-end gates and the import ban, all test-first.
- `apps/web`: a Solid 2 component that takes a `Bag` by `import type`; the Vite build emits a client bundle and
  no HTML, so the size and end-to-end gates stay in their "no pages yet" state until PR 7 emits pages.
- `apps/kit`: a placeholder Solid 2 entry for the private app.
- `workers/web`, `workers/kit`: placeholder Workers typed with `@cloudflare/workers-types`, no `wrangler.jsonc`.

Bun uses its isolated linker, so a package's peers resolve only from the workspace that declares it. The Vite
toolchain therefore sits in `apps/web` beside Solid: `vite`, `@solidjs/vite-plugin`, `@solidjs/prerender`,
`prerender-crawler`, `@cloudflare/vite-plugin`, `wrangler`, `@solidjs/testing-library` and `web-vitals`, plus
`@solidjs/meta` and `@solidjs/router`. The root holds the command-line tools: `typescript`, `@biomejs/biome`,
`vitest`, `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`, `size-limit`, `@size-limit/file`,
`browserslist`, `wrangler` and `@cloudflare/workers-types`.

TypeScript settings live in `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `module: preserve`, bundler resolution). Each workspace is a
composite project that emits declarations only, into its own ignored `.tsbuild/`.

## Root scripts

| Script | What it runs | Today |
|---|---|---|
| `typecheck` | `tsc --build` | passes |
| `lint` | `biome ci .`, then the import ban (`node`, TypeScript 7 parser) | passes |
| `test` | `vitest run` in every workspace that has tests | 89 tests pass |
| `build` | `vite build` in apps/web and apps/kit | passes, no HTML emitted |
| `wall` | lists the three privacy-wall checks as `pending: <milestone>`; fails if any Wrangler config declares a binding while one is pending (see below) | passes, 0 Wrangler configs, 2 Vite configs |
| `size` | runs size-limit whenever the root `size-limit` list has targets; without targets, "no pages yet" until `apps/web/dist` holds HTML or JavaScript, then fails; once pages exist, a target must measure HTML | passes: 9.54 kB Brotli of 15 kB |
| `test:e2e` | "no pages yet" until `apps/web/dist` holds HTML; then fails without `playwright.config.ts`, else runs Playwright | passes, no pages |

## Privacy wall: what it reads, and what the deploy must do

`bun run wall` judges what Wrangler itself would load, using Wrangler 4.168's own exported readers rather than
a parser of ours:

- **Fixed locations.** A Worker config may exist only as `wrangler.jsonc` in `apps/web`, `apps/kit`,
  `workers/web` or `workers/kit`. The only other config files allowed are what `@cloudflare/vite-plugin` writes
  in those folders: `dist/<worker>/wrangler.json` and the `.wrangler/deploy/config.json` redirect. Any other file
  Wrangler could pick up fails, wherever it is outside node_modules: any name starting `wrangler`, any
  `cloudflare.config.*`, any other `.wrangler/deploy/config.json`, and (to be safe) any other `.jsonc` except
  `biome.jsonc`/`tsconfig*.jsonc` and any `.toml` except `bunfig.toml`. A symlink at a config path, or on the
  way to one, fails too, because Wrangler would follow it.
- **Read by Wrangler.** Each allowed config is read with `experimental_readRawConfig` (Wrangler's own JSONC/TOML
  reader, so a `//` comment ended by a bare carriage return means what it means to Wrangler) and with
  `unstable_readConfig` for the top level and for each `env.<name>`, as Wrangler normalises and validates them.
  A config Wrangler rejects fails closed. Both are exports of the `wrangler` package (`wrangler-dist/cli.js`).
- **Bindings.** A key counts as a binding unless it is on an allow-list of non-binding keys built from wrangler
  4.168's config schema; empty values (recursively, so the plugin's `durable_objects: { bindings: [] }` default)
  are not bindings. The top level, `previews`, every `env.<name>` and each environment's `previews` are checked.
- **Discovery and redirects.** For each of the four Worker folders the wall asks Wrangler which config it would
  load when run there (`experimental_readRawConfig({ script }, { useRedirectIfAvailable: true })`: Wrangler's own
  find-up and redirect rules, `path.resolve` included), takes the real path, and requires it to be inside the
  checkout and one of the configs it checked. The redirect's `auxiliaryWorkers` must meet the same rule. A folder's
  redirect may target only that folder's own `dist/`, never another Worker's config. Once the paths pass, Wrangler's
  validating reader also reads the config in redirect mode (`unstable_readConfig({ script },
  { useRedirectIfAvailable: true })`), as a flagless `wrangler deploy` would, and a rejection fails.
- **Vite.** Any `vite.config.*` that passes the Cloudflare plugin anything beyond `viteEnvironment`,
  `persistState`, `inspectorPort`, `remoteBindings` and `assetsOnly` fails: `config`, `configPath`,
  `auxiliaryWorkers`, `experimental` (its prerender Worker carries a config), `tunnel` and any option added
  later, as do options it cannot read. The plugin call must stay in `vite.config.*` itself: a Vite config may
  import only `node:` built-ins and bare names of installed packages, so local paths, `@cj/` workspaces, URL
  schemes, `#` imports, `node:module`/`createRequire` and loaders with a non-literal name all fail.
- **Assets.** Every `assets.directory` (top level, `previews`, each environment) must resolve, from the config's
  folder, to that folder's own `dist/client`, with no symlink on the way; `pages_build_output_dir` fails.
- **What gets uploaded.** `apps/web/public` (copied into the build past `server.fs.deny`) may hold only
  `_headers`, `favicon.ico` and `favicon.svg`: no other file, no folder, no symlink; each Worker folder's `dist/client` may hold no symlink and no `.dev.vars*` (the plugin's `.assetsignore` is
  allowed). `apps/kit` sets `publicDir: false`.
- **No contents in output.** Messages name a path and the rule broken, never Wrangler's diagnostics (which quote
  the file). A deploy redirect and every path it names are checked without Wrangler first (plain JSON, no symlink,
  inside the checkout, among the checked configs), and Wrangler's own discovery runs only when every path check
  has passed.

The wall is a guard rail over the working tree, not the enforcement point; see "Deploy-time privacy checks".

## Deploy-time privacy checks (PR 10 / milestone 3)

The real enforcement is a check of the exact artifact being deployed, in the CI deploy job. Requirements:

1. **Scan the upload artifact: assets and Worker bundle.** After the build and immediately before
   `wrangler deploy`, in the same job, scan everything Wrangler will upload: the static assets in `dist/client`
   (after applying `.assetsignore`) **and** the Worker bundle, its `main` entry and every module beside it in
   `dist/<worker>/` (what `wrangler deploy --dry-run --outdir` lists is the authority). Fail on: any dotfile or
   dot-folder other than the plugin's `.assetsignore`; any symlink; `.dev.vars*`, `.env*`, key and certificate
   files; any file not produced by the build from tracked sources (compare against the build's file list); and
   the canary record's marker string anywhere in any asset or module, since a marker inlined into the server
   bundle could reach a response just as an asset could.
2. **Deploy only the config the wall checked.** Run `bun run wall` in the same job on the generated config, then
   deploy with that config: the plugin's `.wrangler/deploy/config.json` redirect, no `--config`, no `--env` the
   wall did not judge, no `--assets` or other flag that changes what is uploaded or bound. A deploy step that
   cannot meet this must not run.
3. **Check the result.** After deploy, compare the deployed Worker's bindings (`wrangler deployments` or the API)
   with the checked config, and fail the job on any difference.

Limits of the static wall that the deploy-time check has to cover:

- It reads the working tree at one moment; a later build step, a CI cache or a plugin can change files after it.
- It cannot see `wrangler` command-line flags (`--config`, `--env`, `--assets`, `--var`), environment variables
  that change Wrangler's behaviour, or bindings added through the Cloudflare dashboard or API.
- It judges `dist/client` by name and type only, never by contents, and only the files present when it ran.
- Wrangler's find-up continues above the checkout; the wall reports such a file only as "outside the checkout".
- It relies on `unstable_`/`experimental_` Wrangler exports and an unstable TypeScript API, both of which can
  change on upgrade.
- Vite config checks see only literal options; a config built by code the wall cannot read fails closed, which
  can block legitimate changes until the wall learns them.

The wall and import checks parse source with TypeScript 7's own parser. TypeScript 7 has no in-process
`createSourceFile`; its JavaScript API (`typescript/unstable/sync`) drives the native compiler over a pipe and
reads Node's stream internals, so it fails under Bun (`TypeError: undefined is not an object (evaluating
'stdout._handle.fd')`). Those two CLIs therefore run with `node` (26.13.0 strips the TypeScript types). The API
is marked unstable: pin `typescript` exactly and expect changes on upgrade. Wrangler's readers are `unstable_`
and `experimental_` exports too, so the same applies to `wrangler`.

Importing `wrangler` brings its type declarations, which load `@types/node` 22.15.17 (a dependency of wrangler,
not of ours) into the checks project. The hand-written `runtime.d.ts` still covers what the checks call, minus
its `URL` class, which clashed with Node's.

## Development servers stay on loopback

Vite 8.3.8 embeds a `ws` release affected by GHSA-37g9-w4hg-h9qr (a peer that floods the socket can make Node run
out of memory), and Miniflare pins an affected `ws` for wrangler's inspector. No fixed Vite 8 release exists, so
versions are unchanged. Both Vite configs set `server.host: "localhost"` (a test in `packages/checks` holds it), so
the dev server and its WebSocket are reachable only from this machine; do not run `vite --host`. Wrangler 4.168
binds the dev inspector to `127.0.0.1` unless told otherwise (`config.dev.inspector_ip ?? "127.0.0.1"` in
`wrangler-dist/cli.js`); do not set `dev.inspector_ip` or pass `--inspector-ip`.

The WebSocket stays on, still reachable from other processes on this machine. The director accepted the
loopback mitigation on 25 Nov 2026: a local process can already stop a dev server, so turning off `server.ws` (and
hot reload with it) buys nothing that matters. Upgrade once Vite and wrangler ship `ws` 8.23.0 or later.

Both Vite configs also add `.dev.vars` and `.dev.vars.*` (Wrangler's local secrets) to `server.fs.deny`, so a page
on another local port cannot read them through the dev server. A configured list replaces Vite's own, so each
config repeats Vite 8.3.8's defaults (`.env`, `.env.*`, `*.{crt,pem,key,p12,pfx,cer,der}`, `.npmrc`,
`.yarnrc.yml`, `**/.git/**`) first; a test in `packages/checks` holds the exact list. Re-check that list when
Vite is upgraded.

Each dev server may read only its own app folder, `packages/schema` and `node_modules` (`server.fs.allow`), and
`server.cors` is `false`. Checked by hand with `vite --port 5199` in apps/web: `/src/main.tsx`, `/@vite/client`
and the optimised Solid module returned 200; `/@fs/<checkout>/README.md` and `/@fs/<checkout>/package.json`
returned 403; a request with `Origin: http://localhost:3000` got no `Access-Control-Allow-Origin` header.

## Commands and results

All run in the branch checkout. Build and end-to-end runs went through `heavy-run.sh`.

| Command | Result |
|---|---|
| `bun install --frozen-lockfile` | "Checked 469 installs across 602 packages (no changes)" |
| `bun run typecheck` | exit 0 |
| `/usr/bin/time -p tsc --build --force` | real 0.27 s (all seven projects, cold) |
| `/usr/bin/time -p tsc --build` | real 0.09 s (nothing changed) |
| `tsc --build apps/web` with a scratch file passing `{ slug: 1 }` as a `Bag` and reading `e.currentTarget.nope` in an `onClick` | two errors: TS2322 "Type 'number' is not assignable to type 'string'" and TS2339 "Property 'nope' does not exist on type 'EventTarget & HTMLDivElement'" (file removed afterwards) |
| `bun run lint` | exit 0; "imports: apps/web checked for value imports of zod, @cj/schema: 0 found" |
| `/usr/bin/time -p biome ci .` | real 0.50 s, 50 files |
| `biome lint` on a scratch file with an unawaited promise, an async `forEach` callback and a promise in an `if` | `noFloatingPromises` (1), `noMisusedPromises` (2) and `noUnnecessaryConditions` (1) reported (file removed afterwards) |
| `biome ci` with `noRestrictedImports` on `zod` and `@cj/schema` under `apps/web` | errors on `import type { Bag } from "@cj/schema"` in both files that use it; override removed |
| `bun run test` | checks 78, schema 6, pipeline 3, web 2: all pass |
| `heavy-run.sh … bun run build` | exit 0; Vite reports apps/web `main-*.js` 25.06 kB (10.54 kB gzip), apps/kit 24.58 kB (10.32 kB gzip) |
| `heavy-run.sh … bun run size` (after the build) | exit 0; "Size limit: 15 kB / Size: 9.54 kB brotlied" |
| `wc -c`, `brotli -c -q 11 … \| wc -c`, `gzip -9 -c … \| wc -c` on each bundle | apps/web: 25,069 B raw, 9,540 B Brotli, 10,439 B gzip; apps/kit: 24,586 B raw, 9,353 B Brotli, 10,220 B gzip |
| `grep -ril zod apps/web/dist` | no match: no Zod code in the web bundle |
| `bun run wall` / `size` / `test:e2e` | each exit 0 with the lines shown above |
| same three with a scratch `apps/web/dist/client/index.html`, then a scratch `workers/kit/wrangler.jsonc` declaring `d1_databases` | `size` and `test:e2e` exit 1 with their "add targets/config" lines; `wall` exits 1 naming the file and binding (scratch files removed) |

Test-first: the checks tests were seen failing with "Cannot find module '../src/…'" before `src/` existed; the
schema, pipeline and web tests likewise; and the repository test "apps/web uses at least one schema type" failed
with "expected 0 to be greater than 0" before `apps/web/src` existed.

## Size against the N2 budgets

Cloudflare serves Brotli, so the size gate measures Brotli (size-limit's `brotli: true`, quality 11). The root
`size-limit` list holds `apps/web/dist/client/assets/*.js` to 15 kB, the N2 listing limit in ADR-0017
(15,000 bytes: size-limit reads kB as 1,000 bytes). That limit is never raised.

**Solid 2's runtime plus one `render` of one component is already 9,540 bytes Brotli, over the 8 KB content-page
budget**, before hydration, a router, any island or the metrics beacon (which N2 counts). It also takes 64% of the
15 kB listing limit. This is input for N1 (static first, ADR-0015) and PR 8: content pages can only meet 8 KB by
shipping no Solid runtime at all, which is what N1 plans; the listing's islands have about 5.4 kB left.

## Not verified here

- Solid start mode, `@solidjs/prerender`, `prerender-crawler`, `@cloudflare/vite-plugin` and a Worker deploy:
  installed, not exercised. That is spike PR 7.
- Playwright, axe, Lighthouse CI and web-vitals: installed, not run (no pages yet). Playwright's
  browsers are not downloaded. That is PR 8.
- Component tests with `@solidjs/testing-library`: it needs a DOM environment (jsdom, happy-dom or Vitest browser
  mode), and none of those is approved.
- `tsc --build` in watch mode and editor (language server) behaviour with TypeScript 7.
- Running Vitest or Vite under Bun's runtime (`--bun`); both ran on Node 26.13.0.

## Recommended ADR change

No ADR covers the toolchain. Add one (next free number), "Toolchain: TypeScript 7, Biome, Vitest, Bun
workspaces", recording:

- TypeScript 7.0.2 with `tsc --build` over per-workspace composite projects, settings as in `tsconfig.base.json`.
- Biome 2.6.9 pinned exactly, with the `types` domain on and `noFloatingPromises` and `noMisusedPromises` as
  errors; nursery rules may change between Biome releases, so upgrades are their own pull requests.
- The `apps/web` types-only rule is enforced by `packages/checks` (lint and test), not by Biome, because
  Biome's `noRestrictedImports` cannot tell `import type` from a value import. Only `import type` counts as
  types-only: under `verbatimModuleSyntax`, `import { type X }` still emits a side-effect import.
- Bun's isolated linker: tools that need Solid or Vite as peers are declared in the workspace that uses them.

## For the user

- Approve a Node/Bun types package (recommended: `@types/bun`, exact pin) so `runtime.d.ts` can be deleted.
- Approve a DOM environment for component tests before any Solid component test is written (recommended:
  `happy-dom` or Vitest browser mode with Playwright, exact pin).
