# ADR-0031: Cloudflare Web Analytics stays off

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A12: Cloudflare Web Analytics"

## Context

On a proxied site it injects a third-party script, which breaks the no-third-party rule and the CSP.

## Decision

Keep Cloudflare Web Analytics off. Visitor and speed figures come only from the site's own first-party beacon.

## Consequences

Visitor and speed figures come only from the site's own first-party beacon.

## Why

Accepted the recommendation; it injects a third-party script.
