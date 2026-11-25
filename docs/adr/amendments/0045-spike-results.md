# Amendment to ADR-0045: host-scoped noindex works locally

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0045](../0045-pre-launch-deploys.md). ADR-0045 itself is unchanged until the user decides.
- **Source:** spike PR 7, `docs/spike/deploy-hydrated.md` on `spike/07-deploy-hydrated` at `4c2c820`

## Result (local only)

A `_headers` rule written as `https://:worker.:account.workers.dev/*` applies only to requests for a matching
host. Under `wrangler dev`, a request with `Host: carry-journal.example.workers.dev` gets `X-Robots-Tag: noindex`;
one with `Host: carryjournal.com` does not. A plain path rule (`/*`) applies to both. An end-to-end test asserts
both hosts. This was verified only in `wrangler dev`'s asset server, not at the edge.

## Proposed change

Proposed — for the user at the gate: keep `X-Robots-Tag: noindex` on `https://:worker.:account.workers.dev/*`
and confirm it at the edge on the first deploy. ADR-0045's go-live fallback (removing the header and turning
`workers_dev` off) is needed only if the edge disagrees.
