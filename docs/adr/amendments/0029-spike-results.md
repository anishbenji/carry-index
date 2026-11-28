# Amendment to ADR-0029: where source maps are kept

- **Status:** Accepted (owner, spike gate, 2026-11-28)
- **Amends:** [ADR-0029](../0029-source-maps.md). Accepted at the spike gate, 2026-11-28; this amendment now applies to ADR-0029.
- **Source:** a read-only scout of Cloudflare's docs by the director, 25 Nov 2026; the user's dashboard look
  (pending). See the [ADR-0014 amendment](0014-spike-results.md).

## Result

The card question is not settled. The docs describe a checkout flow with "a valid payment method", so a card is
likely, but this is not confirmed. The user's look at the R2 page in the dashboard settles it.

## Proposed change

Accepted at the gate, 2026-11-28: source maps are built, not deployed, and kept local to the build, never
uploaded (CI artifacts are public on a public repo, see ADR-0029's note), until private storage is approved or R2
is shown to need no card. If it needs none, a later record moves them to R2.
