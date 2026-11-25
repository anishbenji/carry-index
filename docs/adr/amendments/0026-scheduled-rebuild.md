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

### How the rebuild gets fresh metrics

The figures come from an authenticated Analytics Engine SQL query (the architecture doc's roll-up). ADR-0049
(lines 38–43) keeps the build job free of secrets and lets the deploy job's token run only the gate and Wrangler,
so neither job can run that query as they stand. Options:

- **A (recommended): a separate metrics job before the build job.** It runs in its own GitHub environment holding
  only a read-only Account Analytics token, runs the fixed query, validates the result against a strict schema of
  public aggregates (page, 75th-percentile metric values, view counts; no IPs, user agents or free text), and
  passes that JSON to the secret-free build job as an artifact. The build job then reads it like any other data
  file. The deploy job and its token are unchanged.
- B: the deploy job runs the query. It already holds an environment, but this widens ADR-0049's "only the gate
  and Wrangler" rule and puts a second credential beside the deploy token.
- C: the cron Worker, which already holds an Analytics API token in the architecture doc, publishes the aggregates
  as a public JSON file the build fetches. No token in GitHub, but it adds a runtime store and a network fetch to
  the build.

Until the figures leave the "early data" state, the scheduled run may redeploy without new figures; the page
says when its data was last updated.

## Consequences

ADR-0026's page is unchanged: public from day one, an "early data" note, no script. Only how its daily rebuild is
started changes.
