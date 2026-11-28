# ADR-0043: Only chosen photos and videos are uploaded

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B12: Photos and video"

## Context

Originals live in the owner's phone library; uploading everything would use storage for no gain.

## Decision

Originals stay in his phone's photo library. Only the photos and videos he chooses are uploaded to the private R2 bucket.

## Consequences

Only media the owner chooses goes to the private R2 bucket. Published copies are re-encoded with location and device metadata removed.

## Why

Accepted the recommendation; stays well inside free storage.
