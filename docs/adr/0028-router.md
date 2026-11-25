# ADR-0028: Solid Router 2.0 for the private app

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A2: Router"

## Context

The private app is a client-rendered single-page app; the public site has no client router.

## Decision

The private app uses Solid Router 2.0. The public site has no client router (see A10).

## Consequences

Kit Watch uses Solid Router 2.0 (first-party, typed routes).

## Why

Accepted the recommendation (first-party, typed routes, the Solid docs' default).
