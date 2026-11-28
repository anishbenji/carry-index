# ADR-0037: Sign-in through Cloudflare Access

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B3: Sign-in"

## Context

No passwords or auth code should be written for a one-user app.

## Decision

Cloudflare Access with Google sign-in, and a one-time code by email as the fallback. The allowed address is entered by him in the Cloudflare dashboard (or supplied from a secret) and is never committed to the repo, written into docs or logs, or typed into chat.

## Consequences

Cloudflare Access with Google sign-in and a one-time email code as fallback; the Worker verifies the Access token. The allowed address is entered by the owner in the Cloudflare dashboard or supplied from a secret, and is never committed, written into docs or logs, or typed into chat.

## Why

Accepted the recommendation.
