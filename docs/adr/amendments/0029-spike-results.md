# Amendment to ADR-0029: where source maps are kept

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0029](../0029-source-maps.md). ADR-0029 itself is unchanged until the user decides.
- **Source:** a read-only scout of Cloudflare's docs by the director, 25 Nov 2026; the user's dashboard look
  (pending). See the [ADR-0014 amendment](0014-spike-results.md).

## Result

The card question is not settled. The docs describe a checkout flow with "a valid payment method", so a card is
likely, but this is not confirmed. The user's look at the R2 page in the dashboard settles it.

## Proposed change

Proposed — for the user at the gate: source maps are built, not deployed, and kept local to the build, never
uploaded (CI artifacts are public on a public repo, see ADR-0029's note), until private storage is approved or R2
is shown to need no card. If it needs none, a later record moves them to R2.
