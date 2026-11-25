# ADR-0045: Merges deploy to workers.dev before go-live, not indexed

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** director setup interview, 2026-11-25 (not yet in `docs/brief/decisions.md`)

## Context

Lighthouse, security-header and back/forward-cache checks need the real edge. Go-live on carryjournal.com is
Saturday 28 Nov (ADR-0012).

## Decision

Once Workers Builds is connected, each merge to `main` deploys the public site to its workers.dev address.
Until go-live, `_headers` sends `X-Robots-Tag: noindex` on every page; a go-live pull request removes it.

## Consequences

Checks run against a deployed site all week. The go-live PR touches `_headers`, so it waits for the owner's
review. The private Worker is not deployed until Cloudflare Access protects its hostname, and it disables
its workers.dev and preview URLs so it is never reachable unprotected.
