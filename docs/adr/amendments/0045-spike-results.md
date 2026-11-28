# Amendment to ADR-0045: host-scoped noindex works locally

- **Status:** Accepted (owner, spike gate, 2026-11-28)
- **Amends:** [ADR-0045](../0045-pre-launch-deploys.md). Accepted at the spike gate, 2026-11-28; this amendment now applies to ADR-0045.
- **Source:** spike PR 7, `docs/spike/deploy-hydrated.md` on `spike/07-deploy-hydrated` at `4c2c820`

## Result (local only)

A `_headers` rule written as `https://:worker.:account.workers.dev/*` applies only to requests for a matching
host. Under `wrangler dev`, a request with `Host: carry-journal.example.workers.dev` gets `X-Robots-Tag: noindex`;
one with `Host: carryjournal.com` does not. A plain path rule (`/*`) applies to both. An end-to-end test asserts
both hosts. This was verified only in `wrangler dev`'s asset server, not at the edge.

PR 7 tested only the production workers.dev host pattern. ADR-0045 also covers the preview hosts (for example
`https://:version.:subdomain.workers.dev/*`); no spike tested a preview-host rule.

## Proposed change

Accepted at the gate, 2026-11-28: keep host-scoped `noindex`. The local result supports it. Since the user's
26 Nov decision there are no edge previews before merge on Saturday
([amendment](0045-no-edge-previews.md)), so the first check at the edge runs after the first merge: the
workers.dev host sends `noindex` and carryjournal.com does not. Preview hosts are checked once previews return in
Release 1.1. If the edge disagrees, it goes back to the owner, as ADR-0045 says.
