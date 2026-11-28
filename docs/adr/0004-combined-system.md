# ADR-0004: One system: private side, public side, one reviewed publish step

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "Combined system"

## Context

Kit Watch holds private records; Carry Journal is public. They share products and observations, and private notes are the source of public reviews.

## Decision

Kit Watch and Carry Journal are one system with a private side and a public side, joined only by a reviewed publish step.

## Consequences

One repository and one data model. The public site builds only from files in the repo; a private record reaches it only through the publish step, which writes `data/published/` through `Published*` schemas and opens a pull request the owner reviews. Three wall checks guard it (unified brief, 'The privacy wall').
