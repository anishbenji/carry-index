# ADR-0018: Inline the site stylesheet while it stays small

- **Status:** Accepted, provisional: confirmed or reversed with the spike's numbers at the Thursday gate (2026-11-26)
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N3: Inline the stylesheet"

## Context

A small stylesheet inlined saves a request on a cold load, at the cost of HTML size, and must work under a CSP with no inline allowance.

## Decision

Inline the site stylesheet into each page while it stays under about 10 KB compressed, if the spike shows a cold-load gain over an external file under the hash-based CSP.

## Consequences

The stylesheet is inlined into each page while it stays under about 10 KB compressed, if the spike shows a cold-load gain over an external file under a hash-based CSP. Provisional until the Thursday gate.

## Why

Accepted the recommendation.
