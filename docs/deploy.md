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
| `secret scan` | gitleaks 8.30.1 over the whole history, downloaded from its GitHub release and checked against the release's SHA-256. Inline `gitleaks:allow` comments are ignored (`--ignore-gitleaks-allow`), and the job fails if the checkout holds a `.gitleaksignore` or `.gitleaks.toml`, so a change cannot quiet the scan. It reads every ref, merge commits against their first parent (so a key added while resolving a merge is seen), file type changes (a symlink replaced by a file) and files Git attributes mark as binary (`--log-opts="--full-history --all --diff-filter=uxdb --text --diff-merges=first-parent"`). Its rules come from `.github/gitleaks.toml`: gitleaks' own default config, copied unchanged except that the global allowlist no longer skips files by name: text formats (SVG, lockfiles, glTF and the like), document and binary extensions (`.pdf`, `.docx`, `.bin`, `.exe`, `.gem` and the like) and the `vendor/` and `bower_components/` folders are all scanned. Only images, fonts, `node_modules` and Python library folders stay skipped; the header of that file says how to refresh it. Because images and fonts are skipped by extension, the job also fails if a tracked file with an image or font extension is text (it has no NUL byte; read from the checkout, so `.gitattributes` cannot mark it binary), printing only the paths. The same job then fails if any tracked file holds an email address outside the noreply and example domains, printing only the paths. It ignores case, reads binary-marked files as text, allows package versions (`name@1.2.3`) and image density suffixes (`logo@2x.png`), and skips images, fonts and `bun.lock`. **Needs PR #4 on `main` first:** until then it names `data/brands.yaml` and `tools/migrate/migrate.py`, whose brand addresses PR #4 removes. The binary is used rather than `gitleaks/gitleaks-action`: the action's README (github.com/gitleaks/gitleaks-action) has it read the repository token on pull requests and asks organisation accounts for a licence key, and since v2 the action is not under an open-source licence. The binary needs no token and no key |

Node comes from `.node-version`; Bun is pinned to 1.4.2.

`bun run test` also builds the app: `packages/deploy/test/web-build.slow.test.ts` runs the real `apps/web` Vite
build into a temp folder and puts it through the gate's `check`. On this machine, run the suite under the
heavy-job lock (`bin/heavy-run.sh` in the director's reports folder), like any other whole-app build.

### `.github/workflows/deploy-public.yml`: build, then deploy

Runs on every push to `main`, once a day at 04:17 UTC (so `/performance` stays current, decision #17), and by hand
(**Actions → deploy-public → Run workflow**, on `main`). Three jobs:

1. **`build`** has no environment and no credentials. It installs with `--ignore-scripts` and runs
   `bun run build`. The build's Vite config writes a build-graph report beside the output folder
   (`apps/web/dist/client.module-graph.json`: every module the build resolved, and every output file's SHA-256;
   the build itself fails on a private module). The job renames the folder and its report together to
   `apps/web/dist/public-site` and `apps/web/dist/public-site.module-graph.json`, runs the gate's `check` on the
   folder (check 1 on the schemas, then seal and scan; it spawns nothing), and uploads exactly those two paths as
   the artifact `public-site`. It never uploads the run temp folder, where a failing gate writes its private
   diagnostics (T10 checks this).
2. **`deploy`** needs `build` and runs only when the ref is `main`, in the environment `public-production`. It
   checks out the same commit, installs with `--ignore-scripts`, downloads `public-site` into the run temp folder
   (the folder and its report side by side; the download fails if the artifact's digest does not match what was
   uploaded), then runs one step. It never builds: no build tool runs in a job that holds the token.

   ```sh
   node packages/deploy/src/bin.ts deploy "$RUNNER_TEMP/public-site"
   ```

   with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in that step's `env:` only. The gate seals and scans
   the folder again, then checks the build-graph report beside it (`public-site.module-graph.json`): it must be
   there, list every bundled `assets/` file with the same SHA-256 as the sealed copy, and name no private module.
   It then runs the dry run (`wrangler deploy --dry-run` must print exactly "No bindings found."), then
   **uploads, verifies, then promotes**, so an unchecked version never serves traffic:
   1. reads the active deployment (the version to return to);
   2. `wrangler versions upload`: a new version with no traffic;
   3. checks that exact version's bindings, and the script's settings, through the API: no tail consumers
      (`tail_consumers` or `streaming_tail_consumers`) and logpush off;
   4. reads the active deployment again, immediately before the write, and stops with `deployment-changed` if
      anything else deployed in the meantime (compare and swap on the deployment id);
   5. `wrangler versions deploy <id>@100%`;
   6. confirms the new version is the active one and the live settings match.

   If step 6 finds a definite mismatch, the gate rolls back by id to the previous version, only if that version
   itself checks clean and the new version's deployment is still the active one, re-read immediately before the
   rollback; otherwise it stops with `deployment-changed` and never rolls back over someone else's deployment. It
   then checks again. An API error is retried (three tries, a few seconds apart) and never triggers a change.
3. **`triggers`** runs only on a manual run on `main` with **apply_triggers** ticked, in `public-production`, and
   on that run it replaces `deploy` (which is skipped). `wrangler versions deploy` applies none of the config's
   triggers, and the gate refuses an upload while workers.dev or preview URLs differ from the definition (rule
   `live-subdomain`; preview URLs would serve even a version the gate then refuses). So this job runs
   `node packages/deploy/src/bin.ts triggers "$RUNNER_TEMP/public-site"`: the same check 1, seal, scan,
   build-graph check and dry run. Turning workers.dev on serves whatever the Worker already runs, so the gate then
   checks the live Worker first: the active deployment must be readable, and the script settings and every
   version that deployment serves must show exactly the expected bindings, no tail consumer and logpush off. If any of that
   fails, workers.dev is left as it is. Only then does it run
   `wrangler triggers deploy --config <sealed>/wrangler.json`, which sets them as the definition says:
   **workers.dev on** and **preview URLs off** (`workers.ts`). It uploads and promotes nothing, then checks the live Worker's bindings and its
   workers.dev and preview-URL settings. The config has
   no routes, so routes and custom domains attached in the dashboard are left as they are (Wrangler 4.168 publishes
   routes and domains only when the config lists some).

One deploy runs at a time and a running deploy is never cancelled (`concurrency: deploy-public-<ref>`,
`cancel-in-progress: false`). Both jobs that write to the Worker, `deploy` and `triggers`, run only on `main`, so
every gate run against `carry-journal` shares the one group `deploy-public-refs/heads/main`. If more runs arrive
while one is deploying, GitHub keeps only the newest waiting run for that ref, which is the newest `main`. Runs on
other branches have their own group, so a manual run there cannot displace a waiting `main` deploy. The group
serialises the gate's own runs only: a promotion from the dashboard while a run is checking makes that run stop
with `deployment-changed` (see `packages/deploy/README.md`, "Concurrent deployments"). Do not promote by hand
while `deploy-public` runs.

Every action in both files is pinned by its full commit SHA with the version in a comment, and only the approved
actions are used (`actions/checkout`, `actions/setup-node`, `oven-sh/setup-bun`, `astral-sh/setup-uv`,
`actions/upload-artifact`, `actions/download-artifact`). Every job's permissions are `contents: read`. Checkout never
keeps the repository token in the working copy. To update an action, change the SHA and the comment together.

## Setup only the owner can do

About 20 minutes, once, before the first deploy. **Create and restrict the `public-production` environment
(step 2) before merging the PR that adds these workflows.** Otherwise every push to `main` and the daily run
start `deploy` and fail for lack of a token, emailing you each time, and GitHub creates `public-production` on
first use with no branch rule.

1. **Create the Cloudflare API token, scoped to the one Worker.** Since 15 Sep 2026 an account-owned API token
   can be limited to individual Workers ([changelog](https://developers.cloudflare.com/changelog/post/2026-09-15-granular-worker-permissions/),
   [roles and permissions](https://developers.cloudflare.com/workers/authorization/)). "Editor" on one Worker
   can update and deploy it, but cannot create or delete Workers or touch any other Worker. It also cannot
   create the Worker, so do this in two steps:
   1. **Make `carry-journal` exist once.** Dashboard → Workers & Pages → Create → start from the Hello World
      template, name it `carry-journal`, deploy. `wrangler versions upload` cannot create a Worker, so without
      this the gate stops with `worker-missing`. The placeholder has no bindings; the first gate deploy replaces
      it.
   2. **Create the CI token:** dashboard → Manage Account → Account API Tokens → Create. Permission: Workers,
      role **Editor**, scope **Specified Workers** → `carry-journal`. Nothing else (no zone, DNS, D1, KV or R2
      permissions, and no route permissions: routes are attached by hand in step 4).

   The gate itself calls only that Worker's `settings`, `subdomain`, `deployments` and `versions` endpoints. Whether
   Wrangler 4.168 needs anything more for an assets-only deploy is proven only by the first deploy. An
   authorisation failure shows in the log as `live-api-error: 401 "carry-journal"` (or 403), or as a
   `wrangler-auth-error` line after a Wrangler run
   (see "When a deploy fails"). **Fallback, only then:** a user token with Account → **Workers Scripts → Edit** on this
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
4. **First deploy, from GitHub, in two runs.** The token stays in the environment; nothing runs from the Mac.
   1. **Triggers first:** Actions → deploy-public → Run workflow → branch `main`, tick **apply_triggers**, Run.
      This run does `build` then `triggers` and skips `deploy`: the gate applies `workers_dev: true` and
      `preview_urls: false`. Check afterwards: dashboard → Workers & Pages → `carry-journal` → Settings → Domains
      & Routes shows workers.dev **enabled** and Preview URLs **disabled**.
   2. **Then deploy:** Run workflow again on `main` with **apply_triggers** left off (or merge to `main`). This
      run does `build` then `deploy`, and replaces the placeholder with the site.
   3. Attach `carryjournal.com` and the `/api/*` route in the dashboard (design section 6).

   Later runs leave **apply_triggers** off. Tick it again only when the definition's `workers_dev`,
   `preview_urls` or routes change, or when a deploy stops with `live-subdomain`.

Scheduled workflows run only from the default branch, and GitHub turns them off in a public repository after 60
days with no activity; re-enable it on the Actions tab if that happens.

## When a deploy fails

The gate prints one line per problem, naming a rule and where it applies (never a file's contents or a
secret), then a summary line. Every `live-api-error` line carries the reply's HTTP status when there was one
(`live-api-error: 403 "carry-journal"`): 401 or 403 means the token, whichever row it appears in. GitHub emails you when the job fails.

A problem with a file in the site (from the seal, the bundle scan or the build-graph check) is printed without its
name, as `<rule>: #<n> <ref8>` (for example `no-matching-row: #1 3f9a02c1`): a file's name can itself be private,
and Actions logs of a public repository are public. `<ref8>` is a keyed hash under a key made fresh for each run,
so it cannot be matched by hashing guessed names. The next line says where the full paths are: `diagnostics.txt`
in a new `cj-gate-diagnostics-*` folder inside the runner's temp folder. That folder stays on the runner and is
deleted with it at the end of the job: no workflow uploads, caches or prints it (T10 checks this). To see the
paths, build and run the same `check` on your own machine (`bun run build`, then
`node packages/deploy/src/bin.ts check apps/web/dist/client`); there the file is in the system temp folder.
Only `_headers`, `_redirects` and the site folder itself (`.`) are printed by name.

| Summary line | What happened | What to do |
|---|---|---|
| `check 1 failed`, `seal failed` or `bundle scan failed` | The build broke a wall rule. Nothing was uploaded | Fix the cause the problem lines name, in a pull request |
| `schema-rewrite` lines, with `check 1 failed` | A public catalogue schema can change a value after parsing (`.overwrite()`, `.transform()`, a pipe into a transform, or a check kind that is not validation only), so the published JSON Schema would not describe the output. Nothing was uploaded | Remove the rewrite from the schema in `packages/schema`, in a pull request |
| `hard-link`, `file-changed`, `fit-data-invalid` or `redirects-invalid` lines (as `#<n> <ref8>`, or `"_redirects"` by name), with `seal failed` | `hard-link`: a file in the build has more than one link, so it may be a private file under another name. `file-changed`: a file's size changed between the seal's walk and its read. `fit-data-invalid`: a `data/fit/*.json` file does not match the closed `fitSchema` in `@cj/schema`. `redirects-invalid`: a `_redirects` rule leaves the site or breaks the rule limits. Nothing was uploaded | Reproduce locally with `check` to see the paths (above), then fix the build or the data in a pull request. `file-changed` alone on CI with no change: re-run |
| `module-graph-missing: "."`, `module-graph-mismatch` or `private-module` lines, then `the build-graph check failed` | `deploy` or `triggers` found no valid build-graph report beside the site (`missing`), a bundled file the report does not vouch for with the same SHA-256 (`mismatch`), or a private module in the report (`private-module`). Nothing was uploaded | `missing` or `mismatch` on CI means the artifact no longer carries `public-site.module-graph.json` from the same build: check the build job's rename and upload steps. `private-module`: the public build reached Kit Watch, the private Worker or private data; remove the import, in a pull request |
| `worker-import` lines (as `#<n> <ref8>`), or `graph-checks-disabled: "."`, then `the build-graph check failed` | `worker-import`: the report lists a `?worker` or `?sharedworker` import. Vite builds a worker in a separate run the build-graph check cannot see, so the public build may not have one. `graph-checks-disabled`: the report says the build ran with one of its checks turned off (a switch that only tests use), or it does not record them. Nothing was uploaded | `worker-import`: remove the worker import from the public app, in a pull request. `graph-checks-disabled` on CI means the report did not come from the normal `bun run build`: check the build job, and never deploy a report made by a test |
| The **Build** step fails with `cj-module-graph: worker-import: the public build imports …` or `cj-module-graph: the public build reached … private file(s): …` | The build itself refused: a worker import, or a private file reached as a module, as a watched file (CSS `@import` or `url()`, or `new URL(…, import.meta.url)`) or as an emitted asset. No report was written and nothing was uploaded. These lines name repository paths | Remove the import or the reference, in a pull request |
| The **Build** step fails with `cj-module-graph: the public folder holds … problem(s): …` | `apps/web/public` (copied into the site as it is) holds a symbolic link (`symlink`), a file with more than one hard link (`hard-link`), a device, socket or pipe (`special-file`), a path under a private root (`private`), or more than 10,000 entries (`too-many-files`). Vite's copy would follow a link and deploy its target as an ordinary file. Nothing was uploaded | Replace the link with a real file, or remove the entry, in a pull request. No workflow step writes into `apps/web/public` or makes links (T10 checks this) |
| `headers-missing: "_headers"` or `headers-weak: "_headers"` (with `bundle scan failed`) | The build has no `_headers` file or lacks a required security header (`headers-missing`), or a block weakens one: `'unsafe-inline'` in the CSP, COOP or CORP looser than same-origin, or a `! Name` line removing a required header (`headers-weak`). Nothing was uploaded | Fix `_headers` in `apps/web`, in a pull request. The required list is `REQUIRED_HEADERS` in `packages/deploy/src/headers.ts` |
| `check 3 failed before upload; nothing was uploaded` | The dry run printed something other than "No bindings found." (a binding appeared, or Wrangler's output changed) | Nothing is live from this run. Find what changed; a Wrangler upgrade needs T6 and the recorded dry-run fixture re-checked |
| `worker-missing: "carry-journal"`, then `the carry-journal Worker does not exist yet …` | The Worker has not been created; `wrangler versions upload` cannot create one. Nothing was uploaded | Do setup step 1.1 (create it in the dashboard), then step 4: a run with **apply_triggers**, then a normal run |
| `live-api-error: 403 "carry-journal"` (or 401), then `could not read the active deployment; nothing was uploaded` | The deployments API refused or failed before the upload. The number is the reply's HTTP status; with no number there was no usable reply (a timeout, a network error or a malformed body) | **401 or 403:** the token is wrong, expired or lacks access to `carry-journal`; fix it in the environment (setup step 1, then the fallback token only if the scoped one is refused). **Other statuses or none:** re-run once Cloudflare answers again |
| `wrangler-error: code …` lines, with `wrangler-auth-error` after them | A Wrangler run failed. The codes are Cloudflare's error codes from its output (nothing else of it is printed); `wrangler-auth-error` means one of them, or Wrangler's wording, is an authentication error (codes 10000 or 9109) | As 401 or 403 above: fix the token, then re-run. Without `wrangler-auth-error`, look the code up in Cloudflare's API error list |
| `live-subdomain: "carry-journal"`, then `the workers.dev or preview-URL setting differs from the definition; run deploy-public with apply_triggers first` | workers.dev or preview URLs are on (a new Worker, or turned on in the dashboard). Nothing was uploaded | Run deploy-public with **apply_triggers**, check the settings in the dashboard, then run a normal deploy |
| `could not read the workers.dev and preview-URL settings; nothing was uploaded` | The subdomain API failed three times before the upload | Re-run once Cloudflare answers again |
| `wrangler versions upload exited with …`, then `no uploaded version to check; nothing was promoted` | The upload failed, or printed no version id (exit 124 means it timed out after 10 minutes) | Nothing changed live. A version may exist with no traffic; it is harmless. Re-run |
| `could not confirm version … ; it was not promoted` | The uploaded version could not be read through the API, three times | Nothing changed live; the version has no traffic. Re-run |
| `version … failed check 3; it was not promoted` | The uploaded version has a binding, or the script has a tail consumer or logpush, that the definition does not allow | Nothing changed live. Find the cause (a tail consumer or logpush added in the dashboard, or a changed definition or Wrangler) and fix it before re-running |
| `live-tail-consumers: "carry-journal"` | The Worker's script settings list a tail consumer, in `tail_consumers` or `streaming_tail_consumers`. Either would send every request's logs to another Worker. Seen before promotion, nothing was promoted; seen after it, see the row below | Remove the tail consumer from `carry-journal`'s settings (dashboard → Workers & Pages → `carry-journal` → Settings), then re-run |
| `live-logpush: "carry-journal"` | Logpush is on for the Worker. No log destination is approved for Release 1, so the gate refuses it; an absent setting counts as off | Turn Logpush off in `carry-journal`'s settings (dashboard → Workers & Pages → `carry-journal` → Settings), then re-run |
| `a tail consumer or logpush is set on the live Worker; not rolling back (it would not remove it). Remove it now` | After promotion, the only problems are script settings (`live-tail-consumers` or `live-logpush`). They belong to the script, not to a version, so a rollback would revert good content and leave them in place | The new version is live and its content is fine. Remove the tail consumer or turn Logpush off now, then re-run to confirm |
| `deployment-changed: "carry-journal"`, then `the active deployment changed while version … was checked; it was not promoted` | Something else deployed `carry-journal` between the gate's first read and its write (the dashboard, or another tool; never another `deploy-public` run, which waits for this one) | Nothing was promoted. Find out what deployed and check which version is live, then re-run |
| `could not re-read the active deployment; version … was not promoted` | The last read before the promotion failed three times | Nothing was promoted; the new version has no traffic. Re-run once Cloudflare answers again |
| `version … is live and shows the expected bindings` but the job failed | `wrangler versions deploy` exited non-zero, yet the new version is live and correct | Nothing to undo. Read the Wrangler exit line; re-run if needed |
| `could not confirm the live Worker after promotion; not rolling back. Check it by hand now` | After promotion the API failed three times; the gate cannot tell whether the live Worker is right | Check now: dashboard → Workers & Pages → `carry-journal` → Settings → Bindings must be empty, and the active version must be the one in the log. If not, roll back by hand (Deployments → the last good version) |
| `deployment-changed: "carry-journal"`, then `version … is not the active one; not rolling back. Check the live Worker now` | After promotion, another version is active (the promotion did not take, or something else deployed) | Check what is active in the dashboard and whether it is clean, then re-run |
| `deployment-changed: "carry-journal"`, then `another deployment was made while the rollback target was checked; not rolling back over it` | The gate was about to roll back, but someone deployed in the meantime; their deployment wins | Check what is active in the dashboard and whether it is clean, then re-run |
| `could not read the active deployment; not rolling back` or `could not re-read the active deployment; not rolling back` | The reads before a rollback failed three times; nothing was rolled back | Check the live Worker in the dashboard now, as in the row above |
| `wrangler rollback to … exited with 0`, then `rollback confirmed: version … is live and shows the expected bindings` | The promoted version showed a binding that its checked version did not (a change after promotion). The gate went back to the verified previous version | Nothing is wrong live. Remove the extra binding in the dashboard, then re-run |
| `live-after-rollback`, with `no verified previous version to return to` or `the live Worker still does not match after the rollback` | The live Worker is wrong and the gate could not fix it: there was no previous version (the first deploy), the previous one is not clean itself, or the rollback did not take | Act now: roll back by hand to the last good version in the dashboard, or remove the extra binding; then re-run |
| `could not read the active deployment; workers.dev was not changed` (triggers job) | The deployments API failed before the triggers deploy (`live-api-error`, with its status) | As `live-api-error` above. Nothing changed |
| `could not confirm the live Worker; workers.dev was not changed` or `the live Worker does not match its definition; workers.dev was not changed` (triggers job) | Before turning workers.dev on, the gate could not read the live Worker, or it found a binding, tail consumer or logpush the definition does not allow, in the script settings or in a version the active deployment serves | Nothing changed. Re-run once Cloudflare answers, or remove the binding or tail consumer, or turn Logpush off, in the dashboard first |
| `wrangler triggers deploy exited with …` non-zero (triggers job) | Wrangler could not apply the workers.dev or preview-URL settings. With `wrangler-auth-error` beside it, the token's scope is the cause | Nothing else changed. Fix the token (or set workers.dev **on** and Preview URLs **off** in the dashboard by hand), then re-run with **apply_triggers** |
| `the live Worker does not match its definition; nothing was rolled back. Check it by hand now` (triggers job) | After `triggers deploy`, the live Worker shows a binding (`live-bindings`, which triggers cannot change, so it was already wrong), or workers.dev or preview URLs differ from the definition (`live-subdomain`) | Fix what the rule names in the dashboard (remove the binding, or set workers.dev **on** and Preview URLs **off**), then run with **apply_triggers** again |
| `the carry-journal Worker does not exist yet …` (triggers job) | As `worker-missing` above | Create the Worker in the dashboard, then re-run with **apply_triggers** |
| any `wrangler … exited with 124` | That Wrangler run was still going after 10 minutes and was killed with its process group | Read the next line as in the rows above. If it recurs, check Cloudflare's status page before re-running |

The gate changes the live Worker only by promoting a version it has just checked, or by rolling back to a
previous version it has checked; an API error never leads to a change. The deploy job's 75-minute limit leaves
room for its four Wrangler runs (dry run, upload, promote, rollback) at their 10-minute limit each, plus API reads
of up to 60 seconds with three tries each on the rollback path.

## Not yet covered

- The beacon Worker (`carry-journal-beacon`) is defined in `packages/deploy` but the gate's command line deploys
  only the site; it joins this workflow when the gate supports it.
- T13, the edge smoke test after each deploy, is not written yet.
- The Kit Watch workflow (`deploy-kit.yml`, environment `kit-production`) is separate and not part of Release 1's
  public pipeline. T10 already fails if any other workflow names `kit-production`.
