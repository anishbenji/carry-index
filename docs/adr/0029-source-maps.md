# ADR-0029: Source maps stay private

- **Status:** Accepted; the storage location depends on the spike's R2 finding
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A7: Source maps"

## Context

Readable stack traces are needed, but source maps should not be public.

## Decision

Keep source maps private. Store them in Cloudflare R2 if enabling R2 needs no payment card; otherwise keep them only as CI artifacts. The spike answers the card question.

Note (review, 2026-11-26): the repository is public, and GitHub lets any signed-in reader download workflow
artifacts, so CI artifacts are not private. Until access-controlled storage is approved, source maps are not
uploaded anywhere: they are kept local to the build and never deployed. This reconciles the decision's intent
(private maps) with that fact and is listed for the owner at the Thursday gate.

## Consequences

Source maps are built, not deployed, and kept per release in R2 if enabling R2 needs no payment card, otherwise as CI artifacts. The spike answers the card question.

## Why

Accepted the recommendation.
