# ADR-0036: Kit Watch at kit.carryjournal.com behind Access

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "B2: Private app hostname"

## Context

The private app needs its own hostname and Worker so the public Worker never holds private bindings.

## Decision

Kit Watch lives at `kit.carryjournal.com`, behind Cloudflare Access, on its own Worker.

## Consequences

`kit.carryjournal.com`, behind Cloudflare Access, on its own Worker. The hostname is visible in DNS and certificate logs but reveals only that a private app exists.

## Why

Accepted the recommendation; the hostname is visible in DNS and certificate logs, but it reveals only that a private app exists.
