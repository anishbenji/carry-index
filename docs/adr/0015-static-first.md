# ADR-0015: Static first: no framework script on content pages

- **Status:** Accepted, provisional: confirmed or reversed with the spike's numbers at the Thursday gate (2026-11-26)
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "N1: Static first"

## Context

Hydrating a page that has no interactive parts downloads and runs code for markup the browser already has.

## Decision

Content pages (bag, fabric, article, about) ship no framework script; only an inline theme and units snippet under 1 KB. Interactive parts (sort and filter, airline widget, weight chart, compare picker) are small islands that load when idle or on first use. Solid 2 still renders every page at build and runs the private app. Subject to the spike: the listing and one bag page are built both ways and he confirms at the Thursday gate with the numbers. Fallback if Solid's start mode cannot omit the client entry: a plain Vite server build and a short prerender script.

## Consequences

Content pages ship only an inline theme and units snippet under 1 KB. Interactive parts (sort and filter, airline widget, weight chart, compare picker) are islands loaded when idle or on first use. Solid 2 still renders every page at build and runs the private app. Fallback if start mode cannot omit the client entry: a plain Vite server build plus a short prerender script. Provisional: the spike builds the listing and one bag page both ways and the owner confirms at the Thursday gate.

## Why

Accepted the recommendation (least possible script).
