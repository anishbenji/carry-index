# ADR-0016: Document navigation only on the public site

- **Status:** Accepted (follows N1; revisit only if N1 is reversed at the Thursday gate)
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A10: Navigation on the public site"

## Context

Follows from static first: there is no client app on content pages to route.

## Decision

Document loads only; no client router on the public site. Speculation Rules prerender the next page on hover or touch in Chromium browsers, as an extra.

## Consequences

No client router on the public site. Speculation Rules prerender the next page on hover or touch in Chromium as an extra. Revisit only if static first is reversed.

## Why

Follows from N1.
