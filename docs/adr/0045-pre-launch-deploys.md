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
hostname and its preview hosts (Cloudflare documents host-scoped `_headers` rules for this, e.g.
`https://:version.:subdomain.workers.dev/*`), before and after go-live, and never on carryjournal.com. If the
rule ever fails at the edge, that reverses the owner's decision of 25 Nov (noindex on workers.dev hosts) and goes
back to the owner; the Playwright header test then follows whatever the owner chooses instead.

## Consequences

Checks run against a deployed site all week. Lighthouse's crawlability audit cannot pass on a host that sends
`noindex`, and the merge gates run on workers.dev preview hosts, so **the merge gate never runs that one audit,
before or after go-live** (the owner chose this on 25 Nov: noindex on workers.dev only). To keep what the audit
protects, the merge gate also fails if a page carries a robots `noindex`/`nofollow` meta tag or `robots.txt`
disallows a public path, ignoring only the workers.dev `X-Robots-Tag` header; every other SEO audit must score
100; and a Playwright test asserts that workers.dev sends `noindex` and the carryjournal.com build does not. From
go-live a post-deploy check also runs the full SEO audit, crawlability included, on carryjournal.com. Any `_headers` change waits for the owner's
review. The private Worker is not deployed until Cloudflare Access protects its hostname, and it disables
its workers.dev and preview URLs so it is never reachable unprotected.
