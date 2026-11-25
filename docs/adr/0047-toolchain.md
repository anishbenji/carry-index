# ADR-0047: Toolchain: TypeScript 7, Biome, Vitest, Bun workspaces

- **Status:** Proposed (spike results, 2026-11-26)
- **Date:** 2026-11-26
- **Source:** spike PR 4, `docs/spike/toolchain.md` on `spike/04-scaffold` at `463dbf8`; summary in
  [`docs/spike/results.md`](../spike/results.md) (Q7, privacy wall)

## Context

No ADR covers the toolchain. The architecture doc's spike question 7 asks whether Solid 2 TSX type-checks under
TypeScript 7.0.2 with `jsxImportSource` set to `@solidjs/web`, and whether the Vite plugin, Zod 4's inferred types
and Biome's type-aware rules work with it. PR 4 found yes for everything the scaffold exercises (local, Darwin
arm64).

## Decision

- **Workspaces.** Bun 1.4.2 workspaces with Bun's isolated linker. A tool that needs Solid or Vite as a peer is
  declared in the workspace that uses it.
- **Type checking.** TypeScript 7.0.2 (the native compiler), `tsc --build` over per-workspace composite projects,
  settings in `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `module: preserve`, bundler resolution).
- **Lint and format.** Biome 2.6.9, pinned exactly, with the `types` domain on and `noFloatingPromises` and
  `noMisusedPromises` as errors. Nursery rules may change between releases, so each Biome upgrade is its own pull
  request.
- **Tests.** Vitest 5.1.1.
- **Types-only imports in `apps/web`.** Enforced by a checker in `packages/checks` (run by `bun run lint` and by a
  test), not by Biome: Biome's `noRestrictedImports` cannot tell `import type` from a value import. Only
  `import type` counts as types-only; under `verbatimModuleSyntax`, `import { type X }` still emits an import.
- **Node for two checks.** The wall check and the import check parse source with TypeScript 7's own parser.
  TypeScript 7's JavaScript API (`typescript/unstable/sync`) fails under Bun (`TypeError: undefined is not an
  object (evaluating 'stdout._handle.fd')`), so these two CLIs run with `node` (26.13.0). CI needs Node as well
  as Bun.
- **Exact pins for unstable APIs.** `typescript` is pinned exactly because the checks use its `unstable` API.
  `wrangler` is pinned exactly because the wall uses its `unstable_readConfig` and `experimental_readRawConfig`
  exports. Upgrades of either are their own pull requests and re-run the checks' tests.
- **Development servers stay on loopback.** Vite and Wrangler's inspector bind to `localhost` / `127.0.0.1`;
  never `vite --host` or `--inspector-ip`. This mitigates GHSA-37g9-w4hg-h9qr in the `ws` releases Vite 8.3.8
  and Miniflare embed; the director accepted the mitigation on 25 Nov 2026. Upgrade once both ship `ws` 8.23.0
  or later.

### Privacy wall: guard rail and enforcing check

`bun run wall` reads each Worker config with Wrangler's own readers and fails on any binding while a wall check
is pending. That static check is a **guard rail**: it cannot prove that a deploy uses the config it checked.

The **enforcing check** runs at deploy time on what is uploaded. The CI deploy job (PR 10) must build, run
`bun run wall` on the generated config in the same job immediately before `wrangler deploy`, and deploy with that
generated config: the plugin's `.wrangler/deploy/config.json` redirect, no `--config` override and no `--env`
the wall did not see. A deploy step that cannot meet this must not run. The full requirements are in
`docs/spike/toolchain.md`. The deploy-time gate is being redesigned (the director's
`proposals/privacy-wall-design.md`, outside this repo): redesign under review, decision at the gate.

## Consequences

- Local, PR 4: `tsc --build --force` took real 0.27 s for all seven projects; `biome ci .` took real 0.50 s
  for 50 files.
- CI installs Node 26 alongside Bun.
- A TypeScript or Wrangler upgrade can break the wall and import checks; the exact pins make that visible.
- Not settled here, and open for the user: a Node or Bun types package (so `packages/checks/src/runtime.d.ts`
  can go) and a DOM environment for component tests. Neither is approved yet.
- Not verified: watch mode, editor behaviour with TypeScript 7, and Vitest or Vite under Bun's runtime.

## Why

Proposed — for the user at the gate. It records what the scaffold proved, and the two places where it had to
depart from the architecture doc.
