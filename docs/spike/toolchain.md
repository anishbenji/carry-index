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
2. **`@solidjs/testing-library` 0.8.10 does not work with Solid 2.** It imports `solid-js/web`, which Solid 2 no
   longer exports (`Error: "./web" is not exported … from package solid-js`). Component tests therefore render with
   Solid 2's own `render` from `@solidjs/web` into happy-dom 21.0.4 (`apps/web/vitest.config.ts`); see
   `apps/web/test/BagSummary.test.tsx`. `@types/bun` 1.4.2 (decision #13) replaced the hand-written
   `runtime.d.ts` the checks package used to carry.

## Versions

| Tool | Version | Where |
|---|---|---|
| Bun | 1.4.2 | machine |
| Node | 26.13.0 | declared in `.node-version` and `engines.node: ">=26.13.0"`; `lint` and `wall` run `.ts` files with `node` (built-in type stripping), and Vitest and Vite run on it through their `node` shebangs |
| typescript | 7.0.2 | root |
| @biomejs/biome | 2.6.9 | root |
| vitest | 5.1.1 | root |
| vite | 8.3.8 | apps/web, apps/kit |
| @solidjs/vite-plugin | 3.0.1 | apps/web, apps/kit |
| solid-js, @solidjs/web | 2.0.4 | apps/web, apps/kit |
| zod | 4.6.7 | packages/schema, packages/pipeline, packages/deploy (director decision: a CI tool, never bundled) |
| @types/bun | 1.4.2 | root (decision #13) |
| happy-dom | 21.0.4 | apps/web, Vitest environment (decision #13) |

Every other approved package PRs 7 and 8 need is installed at its approved pin (see "Layout"); nothing outside
`approved-dependencies.md` was added, and none of the PR-9-only packages or hono.

## Layout

- `packages/schema`: a strict Zod 4 bag schema and its inferred `Bag` type.
- `packages/pipeline`: `readBags`, which parses YAML (`yaml` 2.9.1) and validates each entry.
- `packages/checks`: the interim wall guard, the size and end-to-end gates and the import ban, all test-first.
- `packages/deploy`: the privacy-wall deploy gate (design v2): Worker definitions and the config emitter, `seal`
  (its own walker, the allow-list in `allow-list.ts`, the SHA-256 manifest), the Wrangler runner, check 3 (dry run,
  upload, version check, promotion and live check), check 1 (`public-surface.json`, `never-public.ts`, open
  shapes, the private import ban) and check 2 (canary, bundle scan, `_headers`). `node packages/deploy/src/bin.ts
  check <siteDir>` runs check 1's schema half, the seal and check 2, and spawns nothing; `deploy <siteDir>` adds
  the build-graph check (the `moduleGraph` Vite plugin's report for the same build) and check 3: it uploads a version
  with no traffic, tagged with the sealed manifest's tag, checks that version, promotes it and confirms it live (the
  first deploy runs with workers.dev and preview URLs off); `triggers <siteDir>` runs once after the first deploy, on
  the same commit: the same checks and dry run, then, only if the active deployment is that build's tagged version
  alone at 100% and clean, `wrangler triggers deploy` (workers.dev on, preview URLs off, as the definition says),
  and it confirms those settings. Both are for the deploy workflow only; the first-deploy steps are in
  `packages/deploy/README.md`. Its contract tests T1 to T9 are
  described in `packages/deploy/test/README.md`.
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

**Two Wrangler versions are installed.** The approved pin, `wrangler` 4.168.0, is declared at the root and in
`apps/web`; it is what `wrangler` commands (and a deploy) run. `@cloudflare/vite-plugin` 1.70.1 lists `wrangler`
4.164.0 and `miniflare` 5.20261117.0-beta as exact dependencies of its own (with `wrangler ^4.164.0` as a peer), so
Bun installs 4.164.0 beside it (`node_modules/.bun/wrangler@4.164.0…`) and the plugin reads the Worker config with
that copy when it builds. They cannot be deduplicated without changing an approved pin. Their config schemas have
the same top-level keys but are not identical: in 4.168.0 `images` gains `url_transformations` (checked by diffing
the two `config-schema.json` files). That key is unused here, so there is no behavioural gap today; the user can
align the pair later (wrangler 4.164.0, or a plugin release that pins 4.168.0).

TypeScript settings live in `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `module: preserve`, bundler resolution). Each workspace is a
composite project that emits declarations only, into its own ignored `.tsbuild/`. Each app has two: `tsconfig.json`
for `src` alone (DOM libraries, no ambient types, so `process` or `Buffer` in browser code fails), and
`tsconfig.node.json` for its Vite and Vitest configs and tests. `tsconfig.e2e.json` covers `playwright.config.ts`
and `e2e/`.

## Root scripts

| Script | What it runs | Today |
|---|---|---|
| `typecheck` | `tsc --build` | passes |
| `lint` | `biome ci --error-on-warnings .` (any warning fails, so the whole types domain gates, not only the two promise rules), then the import ban (`node`, TypeScript 7 parser) | passes |
| `test` | `vitest run` in every workspace that has tests | 59 tests pass |
| `build` | `vite build` in apps/web and apps/kit | passes, no HTML emitted |
| `wall` | lists the three privacy-wall checks as implemented, each with the gate command that runs it (`check` for the schema and canary checks, `deploy` for the bindings check); fails if any file git does not ignore is a Wrangler-style config, or if the built apps/web contains Zod | passes, 272 files, none a Wrangler config; no Zod in the build |
| `size` | runs size-limit whenever the root `size-limit` list has targets; without targets, "no pages yet" until `apps/web/dist` holds HTML or JavaScript, then fails; once pages exist, a target must measure HTML | passes: 10.45 kB gzip and 9.54 kB Brotli, each of 15 kB |
| `test:e2e` | "no pages yet" while there is neither a page nor `playwright.config.ts`; fails if one exists without the other (a config with no built pages means the build was skipped); else runs Playwright | passes, no pages and no config |

## Privacy wall: replaced by design v2

On 2026-11-26 the user chose privacy-wall design v2 (ADR-0049, question 6): the three wall checks are built in a new `packages/deploy` (tasks T1 to T13), which seals the deploy
artifact and generates every Worker config from code. This spike's static config scan, which tried to predict
what Wrangler would load, was removed from this PR before merge, with its tests.

`packages/deploy` implements the checks; the workflows that run its gate are a separate task. `bun run wall` lists
the three checks as implemented, each with the gate command that runs it (`<id>: implemented: <command>`), and
fails if any file git does not ignore (tracked, or untracked
and not covered by a .gitignore) is a Wrangler-style config: a JSON, JSONC or TOML file whose name starts
`wrangler`, any `cloudflare.config.*`, or a `.wrangler/deploy/config.json`. The new design keeps none in the repo.

**What the guard cannot see**, so PR 7 and PR 9 must be checked by hand until `packages/deploy` replaces it:

- Ignored files: the Cloudflare plugin's generated `dist/<worker>/wrangler.json` and `.wrangler/deploy/config.json`
  are ignored, so a binding that reaches them through a build is invisible.
- A config under any other name: `cloudflare({ configPath: "cf/public.json" })`, an inline `cloudflare({ config })`
  in a Vite config, or `wrangler --config <file>` on the command line.
- Bindings, routes or settings added through the Cloudflare dashboard or API.

A PR that needs a Worker config cannot get a green wall today (any `wrangler.jsonc` fails), which is intended: the
config comes from `packages/deploy`. Brief 07's instruction to "use exactly `wrangler.jsonc`" conflicts with this.

## TypeScript 7's parser from Node

The import ban reads source with TypeScript 7's own parser. TypeScript 7 has no in-process `createSourceFile`;
its JavaScript API (`typescript/unstable/sync`) drives the native compiler over a pipe and reads Node's stream
internals, so it fails under Bun (`TypeError: undefined is not an object (evaluating 'stdout._handle.fd')`). The
import CLI therefore runs with `node` (26.13.0 strips the TypeScript types), and so does the wall CLI. The API is
marked unstable: pin `typescript` exactly and expect changes on upgrade.

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
| `bun run lint` | exit 0; "imports: apps/web, workers/web checked for value imports of zod, @cj/schema, @cj/pipeline: 0 found" |
| `/usr/bin/time -p biome ci --error-on-warnings .` | real 0.23 s, 50 files |
| `biome lint` on a scratch file with an unawaited promise, an async `forEach` callback and a promise in an `if` | `noFloatingPromises` (1), `noMisusedPromises` (2) and `noUnnecessaryConditions` (1) reported (file removed afterwards) |
| `biome ci` with `noRestrictedImports` on `zod` and `@cj/schema` under `apps/web` | errors on `import type { Bag } from "@cj/schema"` in both files that use it; override removed |
| `bun run test` | checks 46, schema 6, pipeline 3, web 4: all pass |
| `heavy-run.sh … bun run build` | exit 0; Vite reports apps/web `main-*.js` 25.06 kB (10.54 kB gzip), apps/kit 24.58 kB (10.32 kB gzip) |
| `heavy-run.sh … bun run size` (after the build) | exit 0; "Size limit: 15 kB / Size: 9.54 kB brotlied" |
| `wc -c`, `brotli -c -q 11 … \| wc -c`, `gzip -9 -c … \| wc -c` on each bundle | apps/web: 25,069 B raw, 9,540 B Brotli, 10,439 B gzip; apps/kit: 24,586 B raw, 9,353 B Brotli, 10,220 B gzip |
| `grep -ril zod apps/web/dist` | no match: no Zod code in the web bundle |
| `bun run wall` / `size` / `test:e2e` | each exit 0 with the lines shown above |
| `size` and `test:e2e` with a scratch `apps/web/dist/client/index.html` | each exits 1 with its "add targets/config" line (scratch file removed) |
| `bun run wall` with a scratch `workers/web/wrangler.jsonc` added with `git add -N` | exit 1: "FAIL workers/web/wrangler.jsonc: Worker configs are generated by packages/deploy; do not track a Wrangler config"; exit 0 after `git rm --cached` and removing it |

Test-first: the checks tests were seen failing with "Cannot find module '../src/…'" before `src/` existed; the
schema, pipeline and web tests likewise; and the repository test "apps/web uses at least one schema type" failed
with "expected 0 to be greater than 0" before `apps/web/src` existed.

## Size against the N2 budgets

What Cloudflare actually serves for a static asset is **not verified** here. Cloudflare's own account is that it
recompresses at **Brotli level 4 or gzip level 8**, depending on the visitor's `Accept-Encoding`
([blog.cloudflare.com/this-is-brotli-from-origin](https://blog.cloudflare.com/this-is-brotli-from-origin/)).
size-limit can measure gzip (level 9) and Brotli (quality 11), not Brotli level 4, so the root `size-limit` list
measures `apps/web/dist/client/assets/*.js` both ways, each against 15 kB (the N2 listing limit, ADR-0017;
15,000 bytes, since size-limit reads kB as 1,000 bytes), and the larger one gates. That limit is never raised.

Measured on the current bundle (`gzip -N -c … | wc -c`, `brotli -c -q N … | wc -c`): 25,069 B raw, gzip level
8 or 9 10,439 B, Brotli quality 11 9,540 B, **Brotli level 4 10,804 B**. Level 4 is the largest plausible
served size and is 365 B (3.5%) above what the gate measures, so treat the gate as slightly optimistic until
PR 7 records the encoding and transfer size the preview URL actually serves.

**Solid 2's runtime plus one `render` of one component is already 10.4 to 10.8 kB compressed, over the 8 KB
content-page budget**, before hydration, a router, any island or the metrics beacon (which N2 counts). It also
takes about 70% of the 15 kB listing limit. This is input for N1 (static first, ADR-0015) and PR 8: content pages
can only meet 8 KB by shipping no Solid runtime at all, which is what N1 plans; the listing's islands have about
4.2 to 4.5 kB left.

## Not verified here

- Solid start mode, `@solidjs/prerender`, `prerender-crawler`, `@cloudflare/vite-plugin` and a Worker deploy:
  installed, not exercised. That is spike PR 7.
- Playwright, axe, Lighthouse CI and web-vitals: installed, not run (no pages yet). Playwright's
  browsers are not downloaded. That is PR 8.
- Component tests beyond the one `BagSummary` render: `@solidjs/testing-library` 0.8.10 cannot run on Solid 2 (see
  "Answer"), so a Solid 2 testing library is still needed for interaction tests.
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

- Decide whether to align `wrangler` with `@cloudflare/vite-plugin`'s own copy: two versions are installed today
  (4.168.0 approved, 4.164.0 pulled by the plugin); see "Layout".
- Replace `@solidjs/testing-library` 0.8.10 on the approved list: it imports Solid 1's `solid-js/web` and cannot
  run on Solid 2. A release that supports Solid 2 (or none, keeping Solid 2's `render` plus happy-dom) is the
  choice.
