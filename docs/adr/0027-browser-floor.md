# ADR-0027: Browser floor: Baseline Widely available

- **Status:** Accepted (revisit with traffic data)
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N9: Browser floor"

## Context

The site must work in every evergreen browser on desktop and phone.

## Decision

Anything a page depends on must be Baseline Widely available (worked across Chrome, Edge, Firefox and Safari for at least 30 months). Newer features are extras only, listed on an allow-list, and the page must be complete without them. Browserslist query `baseline widely available with downstream`; a Baseline lint fails the build. Revisit the floor once real traffic shows which browsers visitors actually use.

## Consequences

Anything a page depends on is Baseline Widely available; newer features are extras on an allow-list and the page is complete without them. Browserslist query `baseline widely available with downstream`; a Baseline lint fails the build. Revisit once real traffic shows which browsers visit.

## Why

Accepted for now; he wants the floor revisited against actual traffic.
