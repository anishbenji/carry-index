# ADR-0030: One free external uptime monitor

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A11: Outside uptime check"

## Context

A check running on Cloudflare cannot report a Cloudflare or account outage.

## Decision

Add one free external uptime monitor on the home page as a backstop for Cloudflare or account outages. It is the only piece outside Cloudflare. Its alert address is set in that service's dashboard and never committed.

## Consequences

One free external monitor on the home page, the only piece outside Cloudflare. Its alert address is set in that service's dashboard and never committed.

## Why

Accepted the recommendation.
