# ADR-0020: Test JPEG XL against AVIF

- **Status:** Accepted, provisional: confirmed or reversed with the build's JPEG XL measurement (the owner moved the test after the Thursday gate on 25 Nov; review photos are not needed before milestone 5)
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N5: JPEG XL"

## Context

Chrome and Firefox announced JPEG XL decoding in 2026; Safari support is partial.

## Decision

Test JPEG XL against AVIF on three sample photos in the build, after the Thursday gate (the owner moved it out of
the spike on 25 Nov; this supersedes the timing in N5). Offer it for large review photos only if it is smaller at matched quality; AVIF and WebP remain the automatic fallbacks.

## Consequences

The build encodes three sample photos as AVIF and JPEG XL at matched quality, after the Thursday gate (the
owner moved this test out of the spike). JPEG XL is offered for large review photos only if smaller; AVIF and WebP remain the automatic fallbacks.

## Why

Accepted the recommendation.
