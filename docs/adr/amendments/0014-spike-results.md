# Amendment to ADR-0014: does R2 ask for a payment card?

- **Status:** Accepted (owner, spike gate, 2026-11-28)
- **Amends:** [ADR-0014](../0014-free-tier.md). Accepted at the spike gate, 2026-11-28; this amendment now applies to ADR-0014.
- **Source:** a read-only scout of Cloudflare's docs by the director, 25 Nov 2026 (no account used, nothing
  enabled); the user's dashboard look (pending)

## Result

Not confirmed. Cloudflare's R2 get-started page says to "Complete the checkout flow to add an R2 subscription to
your account". The billing policy says to "Ensure that you are using a valid payment method before changing your
plan type or enabling subscriptions." Only non-staff community posts report a mandatory card dialog. A card is
likely, but no official page says so for the free tier. The user's own look at the dashboard settles it
(R2 Object Storage: does it ask for a card before enabling? Do not enable it).

Also from the scout: R2 overage is billed, not blocked. D1 and Workers KV free usage is capped daily and fails
with errors when exceeded; no official page says whether they need a card.

## Proposed change

Accepted at the gate, 2026-11-28: ADR-0014's open spike item stays open until the dashboard look. Nothing
needs R2 in Release 1: source maps stay local to the build and are never uploaded (ADR-0029's note: CI artifacts
are public on a public repo). If a card is required, R2 stays
off, because R2 overage is billed rather than capped.
