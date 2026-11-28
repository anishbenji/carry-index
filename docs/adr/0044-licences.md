# ADR-0044: Licences for code, data, drawings and writing

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** director setup interview, 2026-11-25 (not yet in `docs/brief/decisions.md`)

## Context

The repository is public. It holds code, catalogue data the owner compiled, line drawings traced from brand
product photos, and written content that is part of the owner's portfolio. Some airline cabin limits were
seeded from a third-party dataset that is kept out of the repository.

## Decision

Code is MIT. Catalogue data the owner compiled is CC BY 4.0. Line drawings and written content are all rights
reserved. Airline limits derived from the third-party seed are excluded from the data licence until their
origin is checked.

## Consequences

A licence PR adds `LICENSE` (MIT) and a notice that names which paths each licence covers. The data licence
text names the airline-limit carve-out. Drawings and writing stay reusable only with permission.
