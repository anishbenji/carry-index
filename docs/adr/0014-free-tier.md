# ADR-0014: Stay on Cloudflare free tiers

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B10 / A8: Paid plan"

## Context

Everything planned fits Cloudflare's free tiers for one site and one private user.

## Decision

Stay on Cloudflare free tiers. Move to Workers Paid (US$5 a month) only if a daily free limit is actually hit.

## Consequences

No paid plan. Move to Workers Paid (US$5 a month) only if a daily free limit is actually hit, as a recorded decision. Whether enabling R2 asks for a payment card is a spike question.

## Why

Accepted the recommendation. Open spike item: whether enabling R2 asks for a payment card.
