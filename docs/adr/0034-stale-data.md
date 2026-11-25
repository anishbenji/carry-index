# ADR-0034: Stale-data flags: 60 days for airlines, 180 for bag specs

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "Stale-data flag"

## Context

Airline limits change more often than maker specs, and the checker refreshes them about monthly.

## Decision

Two ages. An airline cabin limit not re-checked within 60 days, or a bag spec not re-checked within 180 days, gets a "last checked" note on the page and a CI warning. Stale data never blocks a deploy.

## Consequences

An airline limit not re-checked within 60 days, or a bag spec within 180 days, gets a 'last checked' note on the page and a CI warning. Stale data never blocks a deploy.

## Why

Airline limits change more often and the checker refreshes them about monthly, so 60 days only fires if the checker has been failing; maker specs rarely change and are re-read by hand, so 180 days keeps the recurring work reasonable.
