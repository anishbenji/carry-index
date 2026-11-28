# Amendment to ADR-0045: deploys run in GitHub Actions

- **Status:** Accepted (user, 2026-11-26)
- **Amends:** [ADR-0045](../0045-pre-launch-deploys.md). Supersedes its "Once Workers Builds is connected", and the
  Workers Builds mechanism of the director's "merges deploy" rule (25 Nov).
- **Source:** the director's `proposals/privacy-wall-design.md`, question 1, option A; see
  [ADR-0049](../0049-privacy-wall-seal.md)

## Decision

Merges still deploy, but through GitHub Actions, not Workers Builds. On each merge to `main`, `deploy-public.yml`
runs two jobs: a build job with no secrets on a clean checkout, then a deploy job that holds the token and runs
only the gate and Wrangler. The gate and every required check run first. First deploys run the same workflow by
`workflow_dispatch` on `main`, never from the Mac.

## Consequences

- Workers Builds is not connected. The deploy waits for the checks on the merge commit, and the token lives in a
  GitHub environment, not in Cloudflare.
- The rest of ADR-0045 stands as amended: the workers.dev copy carries `noindex`, never carryjournal.com.
