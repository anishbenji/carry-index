# ADR-0002: Effect deferred for v1

- **Status:** Deferred (Effect not used in v1)
- **Date:** 2026-11-15 (re-checked 2026-11-25)
- **Source:** `docs/brief/decisions.md`, entry "A13: Effect deferred for v1"

## Context

ADR-02 (15 Nov) proposed Effect for the data pipeline. The v1 pipeline only reads, validates and writes, and on 25 Nov `effect/http-api`, `effect/sql` and `@effect/sql-d1` were still tagged unstable.

## Decision

No Effect in v1. Zod 4 for schemas and plain Bun scripts for the pipeline. Revisit when Effect's http-api and sql modules are stable or the pipeline grows into re-verification work.

## Consequences

Zod 4 in `packages/schema` is the data model; plain Bun scripts in `packages/pipeline` compile it. No Effect package in any app, Worker or the pipeline. Reviewers reject a new Effect dependency. Revisit when those modules are stable or the pipeline grows into re-verification with retries and provenance.

## Why

Re-checked 25 Nov; the modules needed are still tagged unstable.
