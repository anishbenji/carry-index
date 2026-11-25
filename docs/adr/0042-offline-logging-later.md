# ADR-0042: Offline carry logging follows the first journal release

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B11: Offline logging"

## Context

Online logging ships the journal sooner.

## Decision

The offline carry-logging queue follows the first journal release (milestone 4); the first release logs online only.

## Consequences

The first journal release (milestone 4) logs online only; the offline queue and the private app's service worker follow.

## Why

Accepted the recommendation; ships the journal sooner.
