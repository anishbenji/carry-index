# Amendment to ADR-0026: the daily /performance rebuild is a scheduled deploy run

- **Status:** Accepted (user, 2026-11-26)
- **Amends:** [ADR-0026](../0026-performance-page.md), and the architecture doc's cron Worker step that "POSTs a
  Workers Builds deploy hook".
- **Source:** the director's `proposals/privacy-wall-design.md`, question 3, option A; see
  [ADR-0049](../0049-privacy-wall-seal.md)

## Decision

`/performance` is rebuilt by a daily `schedule:` trigger on the public deploy workflow, not by a deploy hook. The
rebuild goes through the same gate as every deploy. The cron Worker, when built, keeps uptime checks and email
only. No Worker ever holds a GitHub token.

## Consequences

ADR-0026's page is unchanged: public from day one, an "early data" note, no script. Only how its daily rebuild is
started changes.
