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
   The ban is enforced instead by a small checker in `packages/checks` (run by `bun run lint` and by a test).
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
| `lint` | `biome ci .`, then the import ban | passes |
| `test` | `vitest run` in every workspace that has tests | 42 tests pass |
| `build` | `vite build` in apps/web and apps/kit | passes, no HTML emitted |
| `wall` | lists the three privacy-wall checks as `pending: <milestone>`; fails if any `wrangler.json(c)` declares a binding while one is pending, and on any `wrangler.toml` or unreadable config | passes, 0 configs |
| `size` | "no pages yet" until `apps/web/dist` holds HTML; then fails without `size-limit` targets, else runs size-limit | passes, no pages |
| `test:e2e` | "no pages yet" until `apps/web/dist` holds HTML; then fails without `playwright.config.ts`, else runs Playwright | passes, no pages |

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
| `bun run test` | checks 31, schema 6, pipeline 3, web 2: all pass |
| `heavy-run.sh … bun run build` | exit 0; apps/web `main-*.js` 25.06 kB (10.54 kB gzip), apps/kit 24.58 kB (10.32 kB gzip) |
| `grep -ril zod apps/web/dist` | no match: no Zod code in the web bundle |
| `bun run wall` / `size` / `test:e2e` | each exit 0 with the lines shown above |
| same three with a scratch `apps/web/dist/client/index.html`, then a scratch `workers/kit/wrangler.jsonc` declaring `d1_databases` | `size` and `test:e2e` exit 1 with their "add targets/config" lines; `wall` exits 1 naming the file and binding (scratch files removed) |

Test-first: the checks tests were seen failing with "Cannot find module '../src/…'" before `src/` existed; the
schema, pipeline and web tests likewise; and the repository test "apps/web uses at least one schema type" failed
with "expected 0 to be greater than 0" before `apps/web/src` existed.

## Not verified here

- Solid start mode, `@solidjs/prerender`, `prerender-crawler`, `@cloudflare/vite-plugin` and a Worker deploy:
  installed, not exercised. That is spike PR 7.
- Size-limit, Playwright, axe, Lighthouse CI and web-vitals: installed, not run (no pages yet). Playwright's
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
