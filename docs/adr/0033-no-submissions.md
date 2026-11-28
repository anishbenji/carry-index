# ADR-0033: No user submissions; corrections by issue or email alias

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** `docs/brief/decisions.md`, entry "A15: User submissions"

## Context

A static site with no runtime API has the smallest attack surface.

## Decision

The public site accepts no submissions and stays fully static, with no runtime API. Contact routes: each bag page has a "Suggest a correction" link that opens a pre-filled GitHub issue (template asks for the bag, the field and a source link), and the about page shows a dedicated email alias on carryjournal.com that forwards privately. The personal address is never published or committed; the forwarding target is set in the Cloudflare dashboard.

## Consequences

The public site accepts no submissions and its pages stay static, with no runtime API for content. This does not cover the first-party metrics and error beacons (ADR-0035), which post to their own small Worker on `/api/*`. Each bag page links 'Suggest a correction' to a pre-filled GitHub issue (bag, field, source link). The about page shows a dedicated alias on carryjournal.com that forwards privately; the personal address is never published or committed and the forwarding target is set in the Cloudflare dashboard.

## Why

Issue links suit structured, sourced corrections; the alias works for brands and readers without a GitHub account, and can be rotated if it draws spam.
