# ADR-0029: Source maps stay private

- **Status:** Accepted; the storage location depends on the spike's R2 finding
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A7: Source maps"

## Context

Readable stack traces are needed, but source maps should not be public.

## Decision

Keep source maps private. Store them in Cloudflare R2 if enabling R2 needs no payment card; otherwise keep them only as CI artifacts. The spike answers the card question.

## Consequences

Source maps are built, not deployed, and kept per release in R2 if enabling R2 needs no payment card, otherwise as CI artifacts. The spike answers the card question.

## Why

Accepted the recommendation.
