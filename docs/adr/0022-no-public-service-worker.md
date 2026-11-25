# ADR-0022: No service worker on the public site

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N7: Service worker on the public site"

## Context

The HTTP cache, the edge and prerendering cover repeat visits; a service worker adds start-up cost and stale-page risk.

## Decision

No service worker on the public site. The HTTP cache, the edge and prerendering cover repeat visits. The private app gets one for offline logging.

## Consequences

No service worker on Carry Journal. The private app gets one for offline logging (see ADR on offline logging).

## Why

Accepted the recommendation.
