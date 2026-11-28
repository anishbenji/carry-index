# ADR-0001: No page per airline

- **Status:** Accepted
- **Date:** 2026-11-15
- **Source:** `docs/brief/decisions.md`, entry "A4: No page per airline"

## Context

Airline cabin limits for about 200 airlines are on file. A page per airline would multiply thin pages and the routes to keep checked.

## Decision

No page per airline. Airline fit stays a widget on the listing and each bag page; unchecked airlines are shown as unchecked.

## Consequences

Airline fit is a lazy widget on the listing and each bag page, loading its JSON only when opened. Airlines not yet checked appear and are labelled unchecked. No `/airlines/*` routes exist.

## Why

Decided in the architecture doc review.
