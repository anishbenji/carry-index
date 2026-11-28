# ADR-0039: Other people are stored as roles, never names

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B6: Other people in his records"

## Context

Records mention family and friends.

## Decision

Other people are stored as roles (for example "wife", "brother", "friend"), never by name. The import converts existing names to roles; any name it cannot map is listed for him to resolve, never guessed. Names are also on the never-public list.

## Consequences

People appear as roles (for example "wife", "brother", "friend"). The import converts names to roles and lists any it cannot map for the owner to resolve, never guessing. Names are on the never-public list.

## Why

Accepted the recommendation.
