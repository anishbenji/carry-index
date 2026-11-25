# ADR-0045: Merges deploy to workers.dev before go-live, not indexed

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** director setup interview, 2026-11-25 (not yet in `docs/brief/decisions.md`)

## Context

Lighthouse, security-header and back/forward-cache checks need the real edge. Go-live on carryjournal.com is
Saturday 28 Nov (ADR-0012).

## Decision

Once Workers Builds is connected, each merge to `main` deploys the public site to its workers.dev address.
The workers.dev copy is never indexed: `_headers` sends `X-Robots-Tag: noindex` only for the workers.dev
hostname, before and after go-live, and never on carryjournal.com. (Host-scoped rules in `_headers` for
Workers Static Assets are to be confirmed in spike PR 7; if they are not supported, the go-live PR removes the
header and turns `workers_dev` off for the public Worker instead.)

## Consequences

Checks run against a deployed site all week. Lighthouse's crawlability audit cannot pass on a host that sends
`noindex`, so until go-live the SEO gate on workers.dev runs every other SEO audit at 100, and a Playwright
test asserts that workers.dev sends `noindex` and that the carryjournal.com build does not. From go-live the
full SEO gate, crawlability included, runs against carryjournal.com. This is an open point for the owner to
confirm, because it narrows one Lighthouse audit on preview hosts. Any `_headers` change waits for the owner's
review. The private Worker is not deployed until Cloudflare Access protects its hostname, and it disables
its workers.dev and preview URLs so it is never reachable unprotected.
