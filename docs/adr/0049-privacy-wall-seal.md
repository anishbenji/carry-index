# ADR-0049: Privacy wall: seal, not scan

- **Status:** Accepted (user, 2026-11-26)
- **Date:** 2026-11-26
- **Source:** the director's design `proposals/privacy-wall-design.md` (v2, 26 Nov 2026, outside this repo), which
  is the full text; the user accepted all eight recommended options in its "Questions for the user" on 26 Nov
  (USER #17 in the director's decision log)

## Context

The spike's wall scanned the working tree for every config Wrangler might load and every binding it might
declare. Review rounds kept finding new ways round it (config discovery, redirects, symlinks, `env`, `previews`,
generated configs), because "what would Wrangler load?" has no finite answer. The real question is where private
data can cross to the public side. The design names seven crossings and a guard for each.

## Decision

**Seal, not scan.** The deploy gate writes everything Wrangler sees, so it never has to predict Wrangler.

- **Definitions are code.** Each Worker is a typed constant in `packages/deploy` (`workers.ts`). Public Workers use
  closed types: the site's `AssetsOnlyWorker` has no `main`, `env`, `previews`, binding key or `unsafe`, and
  sets `workers_dev: true` and `preview_urls: false`. An emitter
  writes the config with `JSON.stringify` and throws on any key outside the type. No `wrangler.*` file is tracked.
- **Sealed, allow-listed bundle.** `seal(siteDir)` creates a folder outside the checkout holding only the emitted
  `wrangler.json` and an allow-listed copy of the site. Its own walker fails on any non-regular file. A file that
  matches no allow-list row fails the gate; nothing is skipped quietly. A manifest (path, size, SHA-256) is the
  deploy log.
- **Fixed deploy command.** argv is the constant `wrangler deploy --config <sealed>/wrangler.json`, cwd is the
  sealed folder, and the environment is rebuilt from an allow-list. The gate prints paths and rule names only.
- **Check 3, before upload and live.** Before upload, each emitted config must equal an exact expected object, and
  `wrangler deploy --dry-run` must report exactly the expected bindings (none for the site). After deploy, the gate
  reads the Worker's live settings; any unexpected binding or tail consumer runs `wrangler rollback` and fails the
  job.
- **Check 1.** A walk of the catalogue schemas' JSON Schema output must match a committed `public-surface.json`;
  never-public names (`never-public.ts`) must be absent; open shapes fail.
- **Check 2.** The canary: `CJ-PUBLIC-` must appear and `CJ-CANARY-` must not, in five encodings, after the real
  build runs on a fixture data root. The same scan runs on every sealed bundle.
- **CI-only deploys.** Deploys run only in GitHub Actions: a build job with no secrets, and a deploy job that holds
  the token and runs only the gate and Wrangler. No deploy credential is on the developer machine; `bun run wall`
  there is a guard rail that cannot deploy.
- **Credentials.** One Cloudflare account. Saturday uses an account-level "Workers Scripts: Edit" token, usable
  only in GitHub environment `public-production` (`main` only, bypass off), on the gate step only. A Worker-scoped
  token is tried in Release 1.1, with a scope probe.
- **Kit Watch's separate workflow.** `deploy-kit.yml`, environment `kit-production` and its own token. The Kit gate
  runs checks 1 and 2 first and stops if either fails or is missing. Its definition fixes `workers_dev: false`,
  `preview_urls: false` and its two hostnames, checked live after deploy.

## Accepted risk

**One account means process guards.** Cloudflare lets any Worker-edit token attach any binding, so no token scope
is the wall. Until a second account exists, nothing at Cloudflare stops code that runs with the public token from
binding the private D1 or replacing `kit-watch`. The guards are who can run that code (one environment, `main`,
one step, owner-reviewed workflows and deploy package) and the alarms (the exact-config check before upload, the
live check after). The user accepted this on 26 Nov (option 4A).

## Build plan

- **Saturday minimum (public go-live; all three checks enforcing):** `packages/deploy` definitions, emitter,
  `seal`, allow-list, manifest and runner; check 3 before upload and live with rollback; check 1; check 2 with the
  fixture canary; `ci.yml` and `deploy-public.yml`; the owner's checklist (token, `public-production`, protect
  `main`, attach the domain and `/api/*` route).
- **Kit minimum (blocks Kit Watch's real import, not the public go-live):** the Kit definition and gate, the
  seed-completeness and no-export-route tests, the live check and the outside-in probe, `deploy-kit.yml` and
  `kit-production`.
- **Release 1.1:** the daily drift check, the Worker-scoped token and scope probe, the workflow and repo-policy
  tests, edge previews on a separate preview Worker, and the emitted-JSON key walk.

## Consequences

- The spike's static wall code (config discovery, Wrangler readers, the "pending" rule) and its tests are deleted
  from PR #5 before it merges, replaced by the design's tests T1 to T13 (user's explicit OK, option 6A).
- Never-auto-merge gains `packages/deploy/**`, `public-surface.json`, `never-public.ts` and the wall tests, and
  loses "either Worker's `wrangler.jsonc`" (option 8A).
- No standing Cloudflare login on the developer machine after the spike token expires. In Release 1.1 the ignored
  private files move out of the repository folder.
- Related records: deploys via GitHub Actions and no edge previews before merge
  ([ADR-0045 amendments](amendments/0045-github-actions-deploys.md), [and](amendments/0045-no-edge-previews.md)),
  the scheduled `/performance` rebuild ([ADR-0026 amendment](amendments/0026-scheduled-rebuild.md)), the real
  import's timing ([ADR-0011 amendment](amendments/0011-kit-import.md)) and publish review
  ([ADR-0004 amendment](amendments/0004-publish-review.md)).

## Why

Accepted by the user on 26 Nov 2026. Of the wall's 27 findings and notes, the design makes 20 impossible, catches
4 and accepts 3 as reduced developer-machine risk.
