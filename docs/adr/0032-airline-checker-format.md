# ADR-0032: The airline checker keeps its own format

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A14: Airline checker format"

## Context

The checker runs daily on the owner's Mac and must not be disturbed during the build week.

## Decision

The airline checker keeps writing its own format for now. The pipeline converts it under a contract test that fails on format drift. The checker moves to the shared schema once the schema settles.

## Consequences

The pipeline decodes the checker's output under a contract test that fails on format drift. The checker is not moved, renamed or changed; it moves to the shared schema once the schema settles.

## Why

Accepted the recommendation; the daily job stays untouched during the build week.
