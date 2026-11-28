# ADR-0038: Medicine data stays out of the new app

- **Status:** Accepted (blocks milestone 7 until its new home is decided)
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B5: Medicine data"

## Context

Medicine records are the most sensitive data and the new app has a publish step.

## Decision

Medicine data stays out of the new app. It remains on the old Kit Watch page, untouched. The new app has no medicine tables. Before the old page is retired (milestone 7), a decision on where medicine data goes is required.

## Consequences

No medicine tables in Kit Watch. Medicine stays on the old page, untouched. Retiring the old page (milestone 7) is blocked until a home for medicine data is decided.

## Why

Accepted the recommendation; keeps the most sensitive data out of the system that has a publish step.
