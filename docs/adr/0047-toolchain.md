# ADR-0047: Toolchain: TypeScript 7, Biome, Vitest, Bun workspaces

- **Status:** Accepted (owner, spike gate, 2026-11-28)
- **Date:** 2026-11-26
- **Source:** spike PR 4, `docs/spike/toolchain.md` on branch `spike/04-scaffold`, read at `12e775a` (first draft from `463dbf8`); summary in
  [`docs/spike/results.md`](../spike/results.md) (Q7)

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
  `noMisusedPromises` as errors; `biome ci --error-on-warnings`, so any warning fails. Nursery rules may change between releases, so each Biome upgrade is its own pull
  request.
- **Tests.** Vitest 5.1.1.
- **Types-only imports in `apps/web`.** Enforced by a checker in `packages/checks` (run by `bun run lint` and by a
  test), not by Biome: Biome's `noRestrictedImports` cannot tell `import type` from a value import. Only
  `import type` counts as types-only; under `verbatimModuleSyntax`, `import { type X }` still emits an import.
- **What runs on Node.** The import check parses source with TypeScript 7's own parser, whose
  JavaScript API (`typescript/unstable/sync`) fails under Bun (`TypeError: undefined is not an object
  (evaluating 'stdout._handle.fd')`). So the import check needs `node` (26.13.0, declared in `.node-version`).
  Vitest and Vite also run on Node today, through their `node` shebangs (running them on Bun is not verified), and
  the interim wall CLI is launched with `node` for its built-in type stripping. The wall (ADR-0049) uses neither
  TypeScript's nor Wrangler's unstable APIs. CI needs Node as well as Bun. (Decision
  #14.1, director under the user's overnight instruction, 26 Nov.)
- **Exact pins.** Every dependency is pinned exactly (child rule 6). For `typescript` it matters more, because
  the import check uses its unstable API: upgrades are their own pull requests and re-run that check's tests.
  `wrangler` is the binary the deploy gate's fixed command runs (ADR-0049), so its upgrades also re-run the gate's
  decoy test (T6).
- **Development servers stay on loopback.** Vite and Wrangler's inspector bind to `localhost` / `127.0.0.1`;
  never `vite --host` or `--inspector-ip`. This mitigates GHSA-37g9-w4hg-h9qr in the `ws` releases Vite 8.3.8
  and Miniflare embed; the director accepted the mitigation on 25 Nov 2026. Upgrade once both ship `ws` 8.23.0
  or later.

### Privacy wall

The privacy wall and the deploy gate are decided in [ADR-0049](0049-privacy-wall-seal.md) (accepted by the user,
26 Nov 2026), not here.

## Consequences

- Local, PR 4 at `12e775a`: `tsc --build --force` took real 0.27 s for all seven projects; `biome ci
  --error-on-warnings .` took real 0.23 s for 50 files.
- CI installs Node 26 alongside Bun.
- A TypeScript upgrade can break the import check; the exact pin makes that visible.
- Dev dependencies approved by decision #13 (director under the user's overnight instruction, 26 Nov):
  `@types/bun` 1.4.2, so `packages/checks/src/runtime.d.ts` can go, and `happy-dom` 21.0.4 as the DOM environment
  for component tests. Both exact, dev only.
- Two Wrangler versions are installed: 4.168.0 (approved) and 4.164.0, an exact dependency of
  `@cloudflare/vite-plugin` 1.70.1. Their config schemas are identical today. The director decided overnight
  (under the user's instruction) to keep both, rather than downgrade the approved pin; revisit when the plugin
  updates.
- Not verified: watch mode, editor behaviour with TypeScript 7, and Vitest or Vite under Bun's runtime.

## Why

Proposed — for the user at the gate. It records what the scaffold proved, and the two places where it had to
depart from the architecture doc.
