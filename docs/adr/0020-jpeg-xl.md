# ADR-0020: Test JPEG XL against AVIF

- **Status:** Accepted, provisional: confirmed or reversed with the spike's numbers at the Thursday gate (2026-11-26)
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N5: JPEG XL"

## Context

Chrome and Firefox announced JPEG XL decoding in 2026; Safari support is partial.

## Decision

Test JPEG XL against AVIF on three sample photos in the spike. Offer it for large review photos only if it is smaller at matched quality; AVIF and WebP remain the automatic fallbacks.

## Consequences

The spike encodes three sample photos as AVIF and JPEG XL at matched quality. JPEG XL is offered for large review photos only if smaller; AVIF and WebP remain the automatic fallbacks.

## Why

Accepted the recommendation.
