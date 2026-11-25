# Amendment to ADR-0011: Kit Watch's real import waits for the Kit minimum

- **Status:** Accepted (user, 2026-11-26)
- **Amends:** [ADR-0011](../0011-release-1.md) (N10), "the import (dry run, then real)".
- **Source:** the director's `proposals/privacy-wall-design.md`, question 5, option A; see
  [ADR-0049](../0049-privacy-wall-seal.md)

## Decision

The real import into Kit Watch's D1 waits until the Kit minimum of ADR-0049 is in place: the Kit definition and
gate, the seed-completeness and no-export-route tests, the live check and probe, and `deploy-kit.yml`. If that is
not ready on Saturday, the dry run still runs on Saturday and the real import moves to Release 1.1.

## Consequences

Release 1 may ship Kit Watch with the dry run only. The rest of ADR-0011 is unchanged. The real import should go
through Kit Watch's own signed-in API; failing that, a D1-only token that expires within a day.
