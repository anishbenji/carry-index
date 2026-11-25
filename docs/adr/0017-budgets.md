# ADR-0017: Performance budgets are failing CI checks

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N2: Budgets"

## Context

The site's claim is speed, so the budgets must fail the build, not sit on a dashboard.

## Decision

Adopt the brief's proposed budget table as failing CI checks: field LCP under 1.0 s (75th percentile), INP under 50 ms, CLS 0 in the lab and under 0.01 in the field, content-page JavaScript under 8 KB compressed (beacon included), listing under 15 KB before a widget opens, whole-site CSS under 10 KB, content-page HTML with inlined CSS under 14 KB, listing HTML under 40 KB, system fonts, no third-party requests, every page restores from the back/forward cache. Starting estimates: reset after the spike only by an explicit, recorded decision.

## Consequences

The budget table in `docs/brief/unified-brief.md` ("Performance plan", "Budgets", proposed column) is the
authoritative checklist, and each row is a failing check: field LCP (p75) under 1.0 s; LCP minus TTFB under
100 ms on text-led and 300 ms on image-led pages; LCP when moving between pages in Chromium under 200 ms; INP
(p75) under 50 ms; CLS 0 in the lab on every template and under 0.01 in the field; total blocking time at 4x CPU
0 ms on content pages and under 50 ms on the listing; JavaScript under 8 KB compressed on content pages
(beacon included; the one script before first paint is ADR-0015's inline theme and units snippet, under 1 KB and counted in the 8 KB) and under 15 KB compressed on the listing before a widget opens;
whole-site CSS under 10 KB compressed; content-page HTML with inlined CSS under 14 KB compressed; listing HTML
under 40 KB compressed with everything above the fold in the first 14 KB; 1 request before LCP on text-led and
2 on image-led pages; 0 KB of web fonts; 0 third-party requests; every page restores from the back/forward
cache. Budgets are never relaxed to meet a date, and reset only by an explicit, recorded decision.

## Why

Accepted the recommendation.
