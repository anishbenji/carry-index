# ADR-0040: Debrief answers start private

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B7: Debrief answers visibility"

## Context

Debrief answers are personal records but also the best source material for published pieces.

## Decision

Debrief answers start private. They are used as source material: Claude suggests content to publish from them over time (articles, reviews, comparisons, social and video ideas), drafts it, and he reviews every piece before it is published. Nothing becomes publishable without his review, and every publish remains a reviewed pull request.

## Consequences

Answers are private by default. Claude may suggest and draft content from them over time; nothing is published without the owner's review, and every publish is a reviewed pull request.

## Why

Keep personal records private by default while still mining them for Carry Journal content.
