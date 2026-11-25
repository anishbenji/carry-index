# ADR-0017: Performance budgets are failing CI checks

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N2: Budgets"

## Context

The site's claim is speed, so the budgets must fail the build, not sit on a dashboard.

## Decision

Adopt the brief's proposed budget table as failing CI checks: field LCP under 1.0 s (75th percentile), INP under 50 ms, CLS 0 in the lab and under 0.01 in the field, content-page JavaScript under 8 KB compressed (beacon included), listing under 15 KB before a widget opens, whole-site CSS under 10 KB, content-page HTML with inlined CSS under 14 KB, listing HTML under 40 KB, system fonts, no third-party requests, every page restores from the back/forward cache. Starting estimates: reset after the spike only by an explicit, recorded decision.

## Consequences

Field LCP under 1.0 s (p75); INP under 50 ms; CLS 0 in the lab and under 0.01 in the field; content-page JavaScript under 8 KB compressed (beacon included); listing under 15 KB before a widget opens; whole-site CSS under 10 KB; content-page HTML with inlined CSS under 14 KB; listing HTML under 40 KB; system fonts; no third-party requests; every page restores from the back/forward cache. Starting estimates: reset after the spike only by an explicit, recorded decision, never relaxed to meet a date.

## Why

Accepted the recommendation.
