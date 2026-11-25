# Amendment to ADR-0017: the size gate counts inline scripts

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0017](../0017-budgets.md) (N2). ADR-0017 itself is unchanged until the user decides. No budget
  changes.
- **Source:** PR 7 review (P2, budgets must count inline scripts); spike PR 8, `docs/spike/static-csp.md` on
  `spike/08-static-csp` at `b0f40c4`

## Result

ADR-0017 counts all JavaScript on a page against the budget, including ADR-0015's inline theme and units snippet
(under 1 KB, counted in the 8 KB). `size-limit` measures files only, so it misses inline scripts. PR 7's hydrated
pages carried 4 inline scripts each: 1,933 B brotli on the listing and 952 B on the bag page, outside the gate.

PR 8 added `scripts/page-budget.ts` (commit `436ec67`): per page, the loaded script files plus every inline script,
brotli, against N2, exiting 1 on a miss, reading 1 KB as 1,000 B (the stricter reading). Its results (local, at
`b0f40c4`, command `bun scripts/page-budget.ts`): hydrated listing 37,327 B and bag 36,346 B fail; static listing
739 B and bag 398 B pass; all HTML passes.

## Proposed change

Proposed — for the user at the gate: the JavaScript size gate measures **per page**, script files plus all inline
scripts, brotli, against the N2 budgets. `size-limit` stays for the file budgets. The budgets themselves are
unchanged.
