# Amendment to ADR-0018: inlined CSS and the hash-based CSP, spike numbers

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0018](../0018-inline-css.md) (N3). ADR-0018 itself is unchanged until the user decides.
- **Source:** spike PR 7, `docs/spike/deploy-hydrated.md` on `spike/07-deploy-hydrated` at `4c2c820`; spike
  PR 8 (pending)

## What the spike asked

Compare inlined CSS under a hash-based Content Security Policy with an external file. Report cold-load LCP for
each, and whether one hash holds for every page. Separately, the architecture doc's question 5: does a hash-based
CSP hold with Solid's inline hydration script?

## What PR 7 shows (local)

- The whole-site stylesheet is one file of 867 B brotli, far under the 10 KB limit.
- Each hydrated page carries 4 inline scripts, and the data script differs per page, so a hash-based policy needs
  per-page hashes.
- PR 7's shipped policy sets no `default-src`, `script-src` or `style-src`, and no `'unsafe-inline'`. Its security
  review rated the missing script restriction P2: no live exploit, but a missing layer of defence.

## CSP hash and N3 numbers: from PR 8 (pending)

Cold-load LCP inlined against external, whether one style hash holds for every page, and the script hashes. The
director fills this in from PR 8.

## Proposed change

Proposed — for the user at the gate: confirm or reverse ADR-0018 with PR 8's numbers. Either way, a `script-src`
without `'unsafe-inline'` must be in place before any production deploy, with an end-to-end test that asserts it.
