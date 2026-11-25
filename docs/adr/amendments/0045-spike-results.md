# Amendment to ADR-0045: host-scoped noindex works locally

- **Status:** Proposed (spike results, 2026-11-26)
- **Amends:** [ADR-0045](../0045-pre-launch-deploys.md). ADR-0045 itself is unchanged until the user decides.
- **Source:** spike PR 7, `docs/spike/deploy-hydrated.md` on `spike/07-deploy-hydrated` at `4c2c820`

## Result (local only)

A `_headers` rule written as `https://:worker.:account.workers.dev/*` applies only to requests for a matching
host. Under `wrangler dev`, a request with `Host: carry-journal.example.workers.dev` gets `X-Robots-Tag: noindex`;
one with `Host: carryjournal.com` does not. A plain path rule (`/*`) applies to both. An end-to-end test asserts
both hosts. This was verified only in `wrangler dev`'s asset server, not at the edge.

PR 7 tested only the production workers.dev host pattern. ADR-0045 also covers the preview hosts (for example
`https://:version.:subdomain.workers.dev/*`); no spike tested a preview-host rule.

## Proposed change

Proposed — for the user at the gate: keep ADR-0045 as written. The local result supports host-scoped `noindex`.
On the first deploy, confirm at the edge that the workers.dev host and a preview host send `noindex` and
carryjournal.com does not. ADR-0045's fallback (remove the header, turn `workers_dev` off and set
`preview_urls: true` explicitly) is needed only if the edge disagrees. The merge gate's SEO scope and robots
checks are unchanged by the spike.
