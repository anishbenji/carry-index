# Amendment to ADR-0045: no edge previews before merge on Saturday

- **Status:** Accepted (user, 2026-11-26)
- **Amends:** [ADR-0045](../0045-pre-launch-deploys.md). Supersedes its "The SEO merge gate always runs on the pull
  request's own preview build".
- **Source:** the director's `proposals/privacy-wall-design.md`, question 2, option A; see
  [ADR-0049](../0049-privacy-wall-seal.md)

## Decision

- **Release 1 (Saturday): no edge previews before merge.** Pull-request checks run against the sealed bundle under
  local workerd (`wrangler dev`). The robots checks still run there: the merge gate fails if a page carries a
  robots `noindex`/`nofollow` meta tag or `robots.txt` disallows a public path, and every other SEO audit must
  score 100.
- **After merge:** edge Lighthouse, header, SEO and `noindex` checks run against the deployed site and can fail
  only the deploy.
- **Release 1.1: previews return** on a separate `carry-journal-preview` Worker. A `workflow_run` job on `main`
  uploads the pull request's sealed bundle there, so the gate code is always `main`'s.

## Consequences

- Edge-only behaviour (host-scoped `noindex`, edge headers) is first seen after merge.
- ADR-0045's fallback of setting `preview_urls: true` when `workers_dev` is off no longer serves a merge gate on
  Saturday; the public site's definition sets `preview_urls: false` (ADR-0049).
- From go-live the post-deploy check still runs the full SEO audit, crawlability included, on carryjournal.com.
