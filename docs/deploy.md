# Deploying the public site

How the public site gets from `main` to Cloudflare, and the setup only the owner can do. The design is
privacy-wall design v2 (ADR-0049); the gate itself is `packages/deploy` (see `packages/deploy/test/README.md`).
`packages/deploy/test/t10-workflows.test.ts` (T10) checks the structure described here on every test run, so a
workflow change that breaks it fails `bun run test`.

## The two workflows

### `.github/workflows/ci.yml`: checks, no credentials

Runs on every pull request and every push to `main`. It has no secrets, no variables and no environment, so it
cannot deploy. Three jobs, each a check name you can require in branch protection:

| Job | What it runs |
|---|---|
| `script contract` | `bun install --frozen-lockfile --ignore-scripts`, then `typecheck`, `lint`, `test`, `build`, `wall`, `size`, the gate's `check` on the build (`node packages/deploy/src/bin.ts check apps/web/dist/client`), Playwright Chromium and `test:e2e` |
| `data validator` | `tools/validate.py` and the `tools/test_validate_*.py` tests through `uv run --no-project --with pyyaml==6.0.4 --with jsonschema==4.26.0` (the versions uv resolved on 26 Nov 2026; their own dependencies are not pinned). The private `data/my-notes.yaml` is never in the repository, so the validator skips the `my_note` links, as it does on any machine without that file. **Needs PR #4 on `main` first:** the skip and the `tools/test_validate_*.py` tests arrive with it. Before that, the job fails on every clean checkout (two `my_note` errors, and discovery that finds no tests exits 5). That is intended: Python is pinned to 3.12 or later so "no tests" fails, and no step masks a failure (T10) |
| `secret scan` | gitleaks 8.30.1 over the whole history, downloaded from its GitHub release and checked against the release's SHA-256. Inline `gitleaks:allow` comments are ignored (`--ignore-gitleaks-allow`), and the job fails if the checkout holds a `.gitleaksignore` or `.gitleaks.toml`, so a change cannot quiet the scan. It reads every ref, merge commits against their first parent (so a key added while resolving a merge is seen) and files Git attributes mark as binary (`--log-opts="--full-history --all --diff-filter=tuxdb --text --diff-merges=first-parent"`). Its rules come from `.github/gitleaks.toml`: gitleaks' own default config, copied unchanged except that the global allowlist no longer skips text files (SVG, lockfiles, glTF and the like); the header of that file says how to refresh it. The same job then fails if any tracked file holds an email address outside the noreply and example domains, printing only the paths. **Needs PR #4 on `main` first:** until then it names `data/brands.yaml` and `tools/migrate/migrate.py`, whose brand addresses PR #4 removes. The binary is used rather than `gitleaks/gitleaks-action`: the action's README (github.com/gitleaks/gitleaks-action) has it read the repository token on pull requests and asks organisation accounts for a licence key, and since v2 the action is not under an open-source licence. The binary needs no token and no key |

Node comes from `.node-version`; Bun is pinned to 1.4.2.

`bun run test` also builds the app: `packages/deploy/test/web-build.slow.test.ts` runs the real `apps/web` Vite
build into a temp folder and puts it through the gate's `check`. On this machine, run the suite under the
heavy-job lock (`bin/heavy-run.sh` in the director's reports folder), like any other whole-app build.

### `.github/workflows/deploy-public.yml`: build, then deploy

Runs on every push to `main`, once a day at 04:17 UTC (so `/performance` stays current, decision #17), and by hand
(**Actions → deploy-public → Run workflow**, on `main`). Three jobs:

1. **`build`** has no environment and no credentials. It installs with `--ignore-scripts`, runs `bun run build`,
   runs the gate's `check` on `apps/web/dist/client` (check 1 on the schemas, then seal and scan; it spawns
   nothing), and uploads that folder as the artifact `public-site`.
2. **`deploy`** needs `build` and runs only when the ref is `main`, in the environment `public-production`. It
   checks out the same commit, installs with `--ignore-scripts`, downloads `public-site` (the download fails if
   the artifact's digest does not match what was uploaded), then runs one step:

   ```sh
   node packages/deploy/src/bin.ts deploy "$RUNNER_TEMP/public-site"
   ```

   with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in that step's `env:` only. The gate seals and scans
   the folder again, runs the dry run (`wrangler deploy --dry-run` must print exactly "No bindings found."), then
   **uploads, verifies, then promotes**, so an unchecked version never serves traffic:
   1. reads the active deployment (the version to return to);
   2. `wrangler versions upload`: a new version with no traffic;
   3. checks that exact version's bindings, and the script's tail consumers, through the API;
   4. reads the active deployment again, and stops if anything else deployed in the meantime;
   5. `wrangler versions deploy <id>@100%`;
   6. confirms the new version is the active one and the live settings match.

   If step 6 finds a definite mismatch, the gate rolls back by id to the previous version, only if that version
   itself checks clean and the new version is still the active one, then checks again. An API error is retried
   (three tries, a few seconds apart) and never triggers a change.
3. **`triggers`** runs only on a manual run on `main` with **apply_triggers** ticked, after `deploy` succeeds, in
   `public-production`. `wrangler versions deploy` applies none of the config's triggers, so this job runs
   `node packages/deploy/src/bin.ts triggers "$RUNNER_TEMP/public-site"`: the same check 1, seal, scan and dry
   run, then `wrangler triggers deploy --config <sealed>/wrangler.json`, which turns workers.dev and preview URLs
   off as the definition says. It uploads and promotes nothing, and then checks the live Worker. The config has
   no routes, so routes and custom domains attached in the dashboard are left as they are (Wrangler 4.168 publishes
   routes and domains only when the config lists some).

One deploy runs at a time and a running deploy is never cancelled. If more runs arrive while one is deploying,
GitHub keeps only the newest waiting run, which is the newest `main`.

Every action in both files is pinned by its full commit SHA with the version in a comment, and only the approved
actions are used (`actions/checkout`, `actions/setup-node`, `oven-sh/setup-bun`, `astral-sh/setup-uv`,
`actions/upload-artifact`, `actions/download-artifact`). Every job's permissions are `contents: read`. Checkout never
keeps the repository token in the working copy. To update an action, change the SHA and the comment together.

## Setup only the owner can do

About 20 minutes, once, before the first deploy.

1. **Create the Cloudflare API token, scoped to the one Worker.** Since 15 Sep 2026 an account-owned API token
   can be limited to individual Workers ([changelog](https://developers.cloudflare.com/changelog/post/2026-09-15-granular-worker-permissions/),
   [roles and permissions](https://developers.cloudflare.com/workers/authorization/)). "Editor" on one Worker
   can update and deploy it, but cannot create or delete Workers or touch any other Worker. It also cannot
   create the Worker, so do this in two steps:
   1. **Make `carry-journal` exist once.** The simplest way: dashboard → Workers & Pages → Create → start from
      the Hello World template, name it `carry-journal`, deploy. Its placeholder has no bindings, and the first
      gate deploy replaces it. (Alternatively, make the first deploy with a short-lived token that has Workers
      Admin on the account, then delete that token at once.)
   2. **Create the CI token:** dashboard → Manage Account → Account API Tokens → Create. Permission: Workers,
      role **Editor**, scope **Specified Workers** → `carry-journal`. Nothing else (no zone, DNS, D1, KV or R2
      permissions, and no route permissions: routes are attached by hand in step 4).

   The gate itself calls only that Worker's `settings` and `deployments` endpoints. Whether Wrangler 4.168
   needs anything more for an assets-only deploy is proven only by the first deploy. **Fallback, only if that
   deploy fails with an authorisation error:** a user token with Account → **Workers Scripts → Edit** on this
   account only (design section 7, the Release 1 token). It can change any Worker in the account, Kit Watch
   included, so replace it with the scoped token as soon as the cause is fixed, and record the error.
2. **Create the environment `public-production`.** GitHub → the repository → Settings → Environments → New
   environment → `public-production`.
   - **Deployment branches and tags:** Selected branches and tags → add the branch rule `main`.
   - **Allow administrators to bypass configured protection rules:** off.
   - **Required reviewers:** optional. With it on, each deploy waits for your approval; with it off, a merge to
     `main` deploys on its own.
   - **Environment secret** `CLOUDFLARE_API_TOKEN`: the token from step 1.
   - **Environment variable** `CLOUDFLARE_ACCOUNT_ID`: the account id, 32 lowercase hexadecimal characters
     (dashboard → Workers & Pages → Account details). It is not secret, so it is a variable; the gate refuses
     anything else.

   Do not add either as a repository secret or variable. No repository-level secrets should exist.
3. **Protect `main`** (U6): require pull requests and the three `ci` checks (`script contract`, `data validator`,
   `secret scan`). They appear in the list once `ci.yml` has run once.
4. **First deploy, from GitHub:** Actions → deploy-public → Run workflow → branch `main`, tick
   **apply_triggers**, Run. `deploy` replaces the placeholder from step 1 with the site, then `triggers` applies
   `workers_dev: false` and `preview_urls: false` once (the Hello World placeholder has workers.dev on). The token
   stays in the environment; nothing runs from the Mac. Check afterwards: dashboard → Workers & Pages →
   `carry-journal` → Settings → Domains & Routes shows workers.dev and Preview URLs disabled. Then attach
   `carryjournal.com` and the `/api/*` route in the dashboard (design section 6). Later runs leave
   **apply_triggers** off; tick it again only when the definition's `workers_dev`, `preview_urls` or routes
   change.

Scheduled workflows run only from the default branch, and GitHub turns them off in a public repository after 60
days with no activity; re-enable it on the Actions tab if that happens.

## When a deploy fails

The gate prints one line per problem, naming a path and a rule (never a file's contents or a secret), then a
summary line. GitHub emails you when the job fails.

| Summary line | What happened | What to do |
|---|---|---|
| `check 1 failed`, `seal failed` or `bundle scan failed` | The build broke a wall rule. Nothing was uploaded | Fix the cause the problem lines name, in a pull request |
| `headers-missing: "_headers"` or `headers-weak: "_headers"` (with `bundle scan failed`) | The build has no `_headers` file or lacks a required security header (`headers-missing`), or a block weakens one: `'unsafe-inline'` in the CSP, COOP or CORP looser than same-origin, or a `! Name` line removing a required header (`headers-weak`). Nothing was uploaded | Fix `_headers` in `apps/web`, in a pull request. The required list is `REQUIRED_HEADERS` in `packages/deploy/src/headers.ts` |
| `check 3 failed before upload; nothing was uploaded` | The dry run printed something other than "No bindings found." (a binding appeared, or Wrangler's output changed) | Nothing is live from this run. Find what changed; a Wrangler upgrade needs T6 and the recorded dry-run fixture re-checked |
| `could not read the active deployment; nothing was uploaded` | The deployments API failed before the upload | Re-run once Cloudflare answers again |
| `wrangler versions upload exited with …`, then `no uploaded version to check; nothing was promoted` | The upload failed, or printed no version id (exit 124 means it timed out after 10 minutes) | Nothing changed live. A version may exist with no traffic; it is harmless. Re-run |
| `could not confirm version … ; it was not promoted` | The uploaded version could not be read through the API, three times | Nothing changed live; the version has no traffic. Re-run |
| `version … failed check 3; it was not promoted` | The uploaded version has a binding, or the script has a tail consumer, that the definition does not allow | Nothing changed live. Find the cause (a tail consumer added in the dashboard, or a changed definition or Wrangler) and fix it before re-running |
| `the active deployment changed while version … was checked; it was not promoted` | Something else deployed `carry-journal` between the gate's two reads (the dashboard, or another tool) | Nothing was promoted. Find out what deployed, then re-run |
| `version … is live and shows the expected bindings` but the job failed | `wrangler versions deploy` exited non-zero, yet the new version is live and correct | Nothing to undo. Read the Wrangler exit line; re-run if needed |
| `could not confirm the live Worker after promotion; not rolling back. Check it by hand now` | After promotion the API failed three times; the gate cannot tell whether the live Worker is right | Check now: dashboard → Workers & Pages → `carry-journal` → Settings → Bindings must be empty, and the active version must be the one in the log. If not, roll back by hand (Deployments → the last good version) |
| `version … is not the active one; not rolling back. Check the live Worker now` | After promotion, another version is active (the promotion did not take, or something else deployed) | Check what is active in the dashboard and whether it is clean, then re-run |
| `wrangler rollback to … exited with 0`, then `rollback confirmed: version … is live and shows the expected bindings` | The promoted version showed a binding or tail consumer that its checked version did not (a change after promotion). The gate went back to the verified previous version | Nothing is wrong live. Remove the extra binding or tail consumer in the dashboard, then re-run |
| `live-after-rollback`, with `no verified previous version to return to` or `the live Worker still does not match after the rollback` | The live Worker is wrong and the gate could not fix it: there was no previous version (the first deploy), the previous one is not clean itself, or the rollback did not take | Act now: roll back by hand to the last good version in the dashboard, or remove the extra binding; then re-run |
| `wrangler triggers deploy exited with …` non-zero (triggers job) | Wrangler could not apply workers.dev or preview URL settings (often the token's scope) | Nothing else changed. Read the error, fix the token or set workers.dev and Preview URLs off in the dashboard by hand, then re-run with **apply_triggers** |
| `the live Worker does not show the expected bindings; nothing was rolled back. Check it by hand now` (triggers job) | Triggers cannot change bindings, so the live Worker was already wrong | Check the bindings in the dashboard and remove the extra one, then run a normal deploy |
| any `wrangler … exited with 124` | That Wrangler run was still going after 10 minutes and was killed with its process group | Read the next line as in the rows above. If it recurs, check Cloudflare's status page before re-running |

The gate changes the live Worker only by promoting a version it has just checked, or by rolling back to a
previous version it has checked; an API error never leads to a change. The deploy job's 50-minute limit leaves
room for its four Wrangler runs (dry run, upload, promote, rollback) at their 10-minute limit each.

## Not yet covered

- The beacon Worker (`carry-journal-beacon`) is defined in `packages/deploy` but the gate's command line deploys
  only the site; it joins this workflow when the gate supports it.
- T13, the edge smoke test after each deploy, is not written yet.
- The Kit Watch workflow (`deploy-kit.yml`, environment `kit-production`) is separate and not part of Release 1's
  public pipeline. T10 already fails if any other workflow names `kit-production`.
