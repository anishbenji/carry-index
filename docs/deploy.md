# Deploying the public site

How the public site gets from `main` to Cloudflare, and the setup only the owner can do. The design is
privacy-wall design v2 (ADR-0049); the gate itself is `packages/deploy` (see `packages/deploy/test/README.md`).
`packages/deploy/test/t10-workflows.test.ts` (T10) checks the structure described here on every test run, so a
workflow change that breaks it fails `bun run test`.

## The two workflows

### `.github/workflows/ci.yml`: checks, no credentials

Runs on every pull request and every push to `main`. It has no secrets, no variables and no environment, so it
cannot deploy. Four jobs, each a check name; the first three are the ones to require in branch protection:

| Job | What it runs |
|---|---|
| `script contract` | `bun install --frozen-lockfile --ignore-scripts`, then `typecheck`, `lint`, `test`, `build`, `wall`, `size`, the gate's `check` on the build (`node packages/deploy/src/bin.ts check apps/web/dist/client`), Playwright Chromium and `test:e2e` |
| `data validator` | `tools/validate.py` and the `tools/test_validate_*.py` tests through `uv run --no-project --with pyyaml==6.0.4 --with jsonschema==4.26.0` (the versions uv resolved on 26 Nov 2026; their own dependencies are not pinned). The private `data/my-notes.yaml` is never in the repository, so the validator skips the `my_note` links, as it does on any machine without that file. The log shows only `data validator: N error(s), exit status S`: the validator's messages can quote a rejected value, which may be private, so they and its report stay in the runner's temp folder, which nothing uploads. To read them, run the same `uv run … python tools/validate.py` locally. **Needs PR #4 on `main` first:** the skip and the `tools/test_validate_*.py` tests arrive with it. Before that, the job fails on every clean checkout (two `my_note` errors, and discovery that finds no tests exits 5). That is intended: Python is pinned to 3.12 or later so "no tests" fails, and no step masks a failure (T10) |
| `secret scan` | gitleaks 8.30.1 over the whole history, downloaded from its GitHub release and checked against the release's SHA-256. Inline `gitleaks:allow` comments are ignored (`--ignore-gitleaks-allow`), and the job fails if the checkout holds a `.gitleaksignore` or `.gitleaks.toml`, so a change cannot quiet the scan. It reads every ref, merge commits against their first parent (so a key added while resolving a merge is seen), file type changes (a symlink replaced by a file) and files Git attributes mark as binary (`--log-opts="--full-history --all --diff-filter=uxdb --text --diff-merges=first-parent"`). gitleaks 8.30.1 logs a Git read error and carries on, so the job refuses an incomplete read: every reachable object must list without error first (`git rev-list --all --objects`), and afterwards the commits gitleaks reports scanned must equal the commits `git log` lists for the same options, or the job fails with `gitleaks scanned … commits, but the history has …`. Its rules come from `.github/gitleaks.toml`. On a pull request the job uses the base commit's copy of that file, not the pull request's, so a pull request cannot loosen the scan that checks it: a pull request that changes or deletes the policy fails with `policy changed: owner review` (merge such a change only after reading it; the next pull request is then scanned with it). Only the first pull request, whose base has no policy yet, uses its own, and the log says which policy ran. A pull request still runs its own `ci.yml`, so it could edit the job itself; every `.github/**` change is owner-reviewed and never auto-merged for that reason. The policy is gitleaks' own default config, copied unchanged except that the global allowlist no longer skips files by name: text formats (SVG, lockfiles, glTF and the like), document and binary extensions (`.pdf`, `.docx`, `.bin`, `.exe`, `.gem` and the like) and the `vendor/` and `bower_components/` folders are all scanned. Only images and fonts stay skipped (the scan reads Git history, where installed packages never appear, so skipping `node_modules` or Python library folders protected nothing); the header of that file says how to refresh it. Because images and fonts are skipped by extension, the job also fails if a tracked file with an image or font extension is text (it has no NUL byte; each blob is read as Git stores it, so `.gitattributes` cannot mark it binary), printing only how many and their blob ids, never a name. On a pull request it also reads every image- or font-named blob the pull request's own commits add, so a text file under such a name that a later commit removed still fails: gitleaks skips those names, and the email check looks only for addresses. The same job then fails if any tracked file holds an email address outside the noreply and example domains, in its content or in its name. It prints only how many files and their blob ids, never a path or an address, because a file's name can hold the address itself; find a file from its id with `git ls-files -s | grep <blob id>`, or any blob with `git log --all --find-object=<blob id>`. On a pull request it also reads every blob the pull request's own commits add (from the base commit to the head; for a merge commit, the files that differ from every parent, so a conflict resolution is read too), so an address committed and then removed in a later commit still fails, and so does an image- or font-named text file that a later commit removed; that can only be fixed by rewriting those commits before merging. History before the base is not read. It ignores case, reads every file as text whatever `.gitattributes` says, allows package versions (`name@1.2.3`) and image density suffixes (`logo@2x.png`), and reads images and fonts too, binary or not, because their metadata (a PNG `tEXt` chunk, XMP) can hold a creator's address; only `bun.lock`'s content is skipped, and every file's name is checked. **Needs PR #4 on `main` first:** until then it reports two files, `data/brands.yaml` and `tools/migrate/migrate.py` (blob ids `84d97096…` and `baa151df…` today), whose brand addresses PR #4 removes. The binary is used rather than `gitleaks/gitleaks-action`: the action's README (github.com/gitleaks/gitleaks-action) has it read the repository token on pull requests and asks organisation accounts for a licence key, and since v2 the action is not under an open-source licence. The binary needs no token and no key |
| `dependency audit` | `bun install --frozen-lockfile --ignore-scripts`, then `bun audit` with the pinned Bun 1.4.2: every locked package against the published advisories. **Deliberately not a required check.** An advisory published today for a package already in `bun.lock` turns it red on every pull request at once, so requiring it would block every merge, a release-day fix included, until the package is upgraded. It shows red instead; fix it in its own pull request (`bun audit` names the package and the advisory) |

Node comes from `.node-version`; Bun is pinned to 1.4.2.

`bun run test` includes the privacy wall's import ban (T8, `packages/deploy/src/imports.ts`): no public source may
import a private module. Private means the private folders and files, installed private packages, and anything that
resolves outside the repository (Neon N16). An import path starting with `/` is resolved as Vite resolves it: from
the public workspace's root, or, when no such file exists there, as a file-system path; both places are checked. For Vite's glob imports (`import.meta.glob`), every pattern, negated ones included, must
start with `./`, `../` or `/` (an unanchored `**` or a bare package name could match anywhere, Neon N2), and must
be a literal string. A pattern fails if its fixed folder (the path before the first wildcard) is a private folder
or resolves to the repository root or above it, if it has a `..` segment anywhere after the first wildcard (Vite
collapses `*/..`, so the fixed folder would not say where it lands), or if it has a `node_modules` segment
anywhere (Neon N10). An import's `?raw`, `?url` or `#…` suffix is stripped before these checks, so it names the
same file (N11). Its options
may only be `eager`, `import` and `query`, each a plain property with a literal string or boolean value: `base`
would move where patterns resolve, `exhaustive` would walk into `node_modules` and dot folders, and any other,
computed, shorthand or spread property is refused.

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
   uploaded), stops unless the run's commit is still the tip of `main` (`git ls-remote`, so a re-run of an older
   run cannot deploy an older commit), then runs one step. It never builds: no build tool runs in a job that holds
   the token.

   ```sh
   node packages/deploy/src/bin.ts deploy "$RUNNER_TEMP/public-site"
   ```

   with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in that step's `env:` only. The gate seals and scans
   the folder again, then checks the build-graph report beside it (`public-site.module-graph.json`): it must be
   there, list every bundled `assets/` file with the same SHA-256 as the sealed copy, and name no private module.
   It then runs the dry run (`wrangler deploy --dry-run` must print exactly "No bindings found."), then
   **uploads, verifies, then promotes**, so an unchecked version never serves traffic:
   1. reads the active deployment (the version to return to), and stops unless preview URLs are off
      (`live-subdomain`: they would serve even a version the gate then refuses). workers.dev may be off, as on the
      first deploy, or on;
   2. `wrangler versions upload --tag <manifest tag>`: a new version with no traffic. The tag is the first 12
      hexadecimal characters of the SHA-256 of the sealed manifest (every sealed file's hash, size and path), so
      the version records exactly which sealed build it is; `triggers` relies on it;
   3. checks that exact version's bindings, and the script's settings, through the API: no tail consumers
      (`tail_consumers` or `streaming_tail_consumers`), logpush off and no observability export (no
      `observability.logs` or `observability.traces` destinations);
   4. reads the active deployment again, immediately before the write, and stops with `deployment-changed` if
      anything else deployed in the meantime (compare and swap on the deployment id);
   5. `wrangler versions deploy <id>@100%`;
   6. confirms the new version is the active one, alone at 100%, and the live settings match. Cloudflare can take
      a moment to show a write, so while the deployments endpoint still shows the earlier deployment the gate reads
      again: up to 4 more reads while it has not converged, waiting 2, 4, 6 and 8 seconds, and, on a separate
      count, up to 2 more on an API error, waiting 2 and 4 seconds (Neon N5, N12). One confirmation is therefore at
      most 7 reads and 26 seconds of waits. If the new version is still not the active one after the 5th
      convergence read, the run fails with `deployment-changed` and **never rolls back** (N5a): a slow
      endpoint is not a check-3 failure, and the version may be live a moment later.

   Only if step 6 finds a definite mismatch (a check-3 failure of the promoted version) does the gate roll back by id to the previous version, only if that version
   itself checks clean and the new version is still the active one (one read), and only if the active deployment,
   read once more immediately before the rollback, has not changed; otherwise it stops with `deployment-changed`
   and never rolls back over someone else's deployment. After the rollback it confirms the previous version the
   same way (at most 7 reads), and fails with `live-after-rollback` if it is not the active one by then, after
   printing each problem it found with the reply's HTTP status where there was one.

   The reads that guard a write (step 1, step 4, and the two reads before a rollback) are single reads: if one
   fails, the gate changes nothing and stops, printing `live-api-error` with the reply's HTTP status when there
   was one. The confirmations (the preview-URL check, step 3, step 6, the rollback target and the check after a
   rollback) retry an API error up to 3 reads in all, waiting 2 and 4 seconds (step 6 and the check after a
   rollback also wait for convergence, as above), and an API error never triggers a change.
3. **`triggers`** runs only on a manual run on `main` with **apply_triggers** ticked, in `public-production`, and
   on that run it replaces `deploy` (which is skipped). It is needed once, **after** the first deploy, on the same
   commit: `wrangler versions deploy` applies none of the config's triggers, so the first deploy leaves workers.dev
   as it was (off, per setup step 1), and this job turns it on. After the same tip-of-`main` check as `deploy`, it
   runs `node packages/deploy/src/bin.ts triggers "$RUNNER_TEMP/public-site"`: the same check 1, seal, scan,
   build-graph check and dry run. Turning workers.dev on serves whatever the Worker already runs, so the gate then
   checks the live Worker first, and changes nothing if any check fails:
   - the active deployment must be readable, and the script settings and every version it serves must show
     exactly the expected bindings, no tail consumer, logpush off and no observability export;
   - it must be one version at 100% (`live-version-not-sole`);
   - that version's `workers/tag` must equal the manifest tag of the build this run sealed: a version with no tag,
     such as the dashboard placeholder, is `live-version-untagged`, and another build's is
     `live-version-not-sealed`. There is no fallback, so workers.dev only ever goes on for a build the gate
     sealed, checked and promoted;
   - the active deployment is read again just before the write (`deployment-changed` if it moved).

   Only then does it run `wrangler triggers deploy --config <sealed>/wrangler.json`, which sets them as the
   definition says:
   **workers.dev on** and **preview URLs off** (`workers.ts`). It uploads and promotes nothing, then checks the live Worker's bindings and its
   workers.dev and preview-URL settings. The config has
   no routes, so routes and custom domains attached in the dashboard are left as they are (Wrangler 4.168 publishes
   routes and domains only when the config lists some).

One deploy runs at a time and a running deploy is never cancelled (`concurrency: deploy-public-<ref>`,
`cancel-in-progress: false`). Both jobs that write to the Worker, `deploy` and `triggers`, run only on `main`, so
every gate run against `carry-journal` shares the one group `deploy-public-refs/heads/main`. If more runs arrive
while one is deploying, they wait in the order they arrived (`queue: max`, up to 100 waiting runs; GitHub's default
would keep only the newest waiting run, so a re-run of an old run could evict a newer one). Each runs in turn, and
the tip-of-`main` check stops every one whose commit is no longer `main`'s tip before the gate, so only the newest
`main` deploys. Runs on
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
   1. **Make `carry-journal` exist once, with both public hostnames off.** Dashboard → Workers & Pages → Create →
      start from the Hello World template, name it `carry-journal`, deploy. Then, in its Settings → Domains &
      Routes, turn **workers.dev off** and **Preview URLs off**: a Worker created in the dashboard starts with
      workers.dev on, which would serve the placeholder, a page the gate never sealed. `wrangler versions upload`
      cannot create a Worker, so without this step the gate stops with `worker-missing`. The placeholder has no
      bindings; the first gate deploy replaces it.
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
   `secret scan`). They appear in the list once `ci.yml` has run once. Do not require `dependency audit`: it is
   meant to show a new advisory, not to block merges (see the table above).

   In the same place, **require approval before any fork's workflow runs:** GitHub → the repository → Settings →
   Actions → General → "Approval for running fork pull request workflows from contributors" → **Require approval
   for all external contributors**, then Save. A pull request from a fork runs its own copy of the workflow files,
   and concurrency groups are shared across workflows, so a changed `ci.yml` could join `deploy-public`'s group
   and cancel a running deploy; after the promotion that would leave a version live without the gate's final
   check (Sol security re-run, C5-1). With the setting on, nothing from a fork runs until you approve it: read the
   pull request's `.github/` changes before you click **Approve and run**.
4. **First deploy, from GitHub, in two runs on the same commit** (sol security r3, S5-5). The token stays in the
   environment; nothing runs from the Mac. With step 1.1 done, nothing is public until the second run.
   1. **Deploy first:** merge to `main` (which starts `deploy-public`), or Actions → deploy-public → Run workflow
      → branch `main`, **apply_triggers** left off. This run does `build` then `deploy`: it uploads the site as a
      version tagged with its manifest tag, checks it and promotes it to 100%, replacing the placeholder. With
      workers.dev and Preview URLs off, the site is not reachable yet.
   2. **Then triggers, on the same commit:** Actions → deploy-public → Run workflow → branch `main`, tick
      **apply_triggers**, Run, before anything else is merged to `main`. This run does `build` then `triggers` and
      skips `deploy`. It rebuilds the same commit, which must seal to the same manifest tag, and turns workers.dev
      on (and keeps Preview URLs off) only if the live Worker is that build's version alone at 100%. Check
      afterwards: dashboard → Workers & Pages → `carry-journal` → Settings → Domains & Routes shows workers.dev
      **enabled** and Preview URLs **disabled**.
   3. Attach `carryjournal.com` and the `/api/*` route in the dashboard (design section 6).

   After that, only `deploy-public` is needed: later runs leave **apply_triggers** off. Tick it again only when the
   definition's `workers_dev`, `preview_urls` or routes change, and then on the commit that is live, right after
   its own deploy. If a merge lands between the two runs, run 4.1 again for the new `main`, then 4.2.

Scheduled workflows run only from the default branch, and GitHub turns them off in a public repository after 60
days with no activity; re-enable it on the Actions tab if that happens.

## When a deploy fails

The gate prints one line per problem, naming a rule and where it applies (never a file's contents or a
secret), then a summary line. A `live-api-error` line carries the reply's HTTP status when the reply had one other
than 200 (`live-api-error: 403 "carry-journal"`): 401 or 403 means the token, whichever row it appears in. A line
with no status means there was no usable reply: a timeout, a network error, or a 200 reply whose body was
malformed or said `success: false` (Neon N13). GitHub emails you when the job fails.

A problem with a file in the site (from the seal, the bundle scan or the build-graph check) is printed without its
name, as `<rule>: #<n> <ref8>` (for example `no-matching-row: #1 3f9a02c1`): a file's name can itself be private,
and Actions logs of a public repository are public. `<ref8>` is a keyed hash under a key made fresh for each run,
so it cannot be matched by hashing guessed names. The next line says where the full paths are: `diagnostics.txt`
in a new `cj-gate-diagnostics-*` folder inside the runner's temp folder. That folder stays on the runner and is
deleted with it at the end of the job: no workflow uploads, caches or prints it (T10 checks this). To see the
paths, build and run the same `check` on your own machine (`bun run build`, then
`node packages/deploy/src/bin.ts check apps/web/dist/client`); there the file is in the system temp folder.
Only `_headers`, `_redirects` and the site folder itself (`.`) are printed by name.

**Re-running.** Where a row below says re-run: re-run only the newest `deploy-public` run; otherwise run the
workflow again from `main` (**Actions → deploy-public → Run workflow**, on `main`). A re-run keeps its run's
commit, so re-running an older run would put an older commit back live. The `deploy` and `triggers` jobs
therefore stop before the gate unless the run's commit is still the tip of `main` (the row just below).

| Summary line | What happened | What to do |
|---|---|---|
| `deploy-public: this run is for …, but main is now at …; run the workflow again from main` (the step before the gate) | This run, or a re-run of it, is for a commit that is no longer the tip of `main`. `main is now at nothing` means the repository showed no `main`; if `git ls-remote` itself failed, its own error line shows instead. Nothing ran through the gate and nothing changed | Nothing to undo. If a newer run exists, it deploys `main`; otherwise run the workflow again from `main` |
| `check 1 failed`, `seal failed` or `bundle scan failed` | The build broke a wall rule. Nothing was uploaded | Fix the cause the problem lines name, in a pull request |
| `schema-rewrite` lines, with `check 1 failed` | A public catalogue schema can change a value after parsing, so the published JSON Schema would not describe the output: `.overwrite()` (such as `.trim()`), `.transform()`, `z.preprocess()`, a pipe into a transform, a codec, `z.custom()`, a `refine`, `superRefine` or `.check()` callback (any check kind that is not validation only), a function-valued `.catch()`, or **any `.default()` or `.prefault()`**, constant or function: Zod returns a default without validating it, and a function default can return one value when inspected and another later. Nothing was uploaded | Remove the rewrite, default or prefault from the schema in `packages/schema`, in a pull request; supply missing values where the data is written instead |
| `hard-link`, `file-changed`, `fit-data-invalid` or `redirects-invalid` lines (as `#<n> <ref8>`, or `"_redirects"` by name), with `seal failed` | `hard-link`: a file in the build has more than one link, so it may be a private file under another name. `file-changed`: a file's size changed between the seal's walk and its read. `fit-data-invalid`: a `data/fit/*.json` file does not match the closed `fitSchema` in `@cj/schema`. `redirects-invalid`: a `_redirects` rule leaves the site or breaks the rule limits. Nothing was uploaded | Reproduce locally with `check` to see the paths (above), then fix the build or the data in a pull request. `file-changed` alone on CI with no change: re-run |
| `module-graph-missing: "."`, `module-graph-mismatch` or `private-module` lines, then `the build-graph check failed` | `deploy` or `triggers` found no valid build-graph report beside the site (`missing`), a bundled file the report does not vouch for with the same SHA-256 (`mismatch`), or a private module in the report (`private-module`). Nothing was uploaded | `missing` or `mismatch` on CI means the artifact no longer carries `public-site.module-graph.json` from the same build: check the build job's rename and upload steps. `private-module`: the public build reached Kit Watch, the private Worker or private data; remove the import, in a pull request |
| `worker-import` lines (as `#<n> <ref8>`), or `graph-checks-disabled: "."`, then `the build-graph check failed` | `worker-import`: the report lists a `?worker` or `?sharedworker` import. Vite builds a worker in a separate run the build-graph check cannot see, so the public build may not have one. `graph-checks-disabled`: the report says the build ran with one of its checks turned off (a switch that only tests use), or it does not record them. Nothing was uploaded | `worker-import`: remove the worker import from the public app, in a pull request. `graph-checks-disabled` on CI means the report did not come from the normal `bun run build`: check the build job, and never deploy a report made by a test |
| The **Build** step fails with `cj-module-graph: worker-import: the public build imports …` or `cj-module-graph: the public build reached … private file(s): …` | The build itself refused: a worker import, or a private file reached as a module, as a watched file (CSS `@import` or `url()`, or `new URL(…, import.meta.url)`) or as an emitted asset. No report was written and nothing was uploaded. These lines name repository paths | Remove the import or the reference, in a pull request |
| The **Build** step fails with `cj-module-graph: the public folder holds … problem(s): …` | `apps/web/public` (copied into the site as it is) holds a symbolic link (`symlink`), a file with more than one hard link (`hard-link`), a device, socket or pipe (`special-file`), a path under a private root (`private`), or more than 10,000 entries (`too-many-files`). Vite's copy would follow a link and deploy its target as an ordinary file. Nothing was uploaded | Replace the link with a real file, or remove the entry, in a pull request. No workflow step writes into `apps/web/public` or makes links (T10 checks this) |
| `headers-missing: "_headers"` or `headers-weak: "_headers"` (with `bundle scan failed`) | The build has no `_headers` file or lacks a required security header (`headers-missing`), or a block weakens one: `'unsafe-inline'` in the CSP, a script source other than `'self'`, `'none'` or a `'sha256-…'`, `'sha384-…'` or `'sha512-…'` hash in the directives that govern scripts (`script-src`, or `default-src` when there is none, plus `script-src-elem` and `script-src-attr`; an origin could serve any script, sol security r4 S6-5), Strict-Transport-Security under a year or without exactly one valid `max-age`, COOP or CORP looser than same-origin, or a `! Name` line removing a required header (`headers-weak`). Nothing was uploaded | Fix `_headers` in `apps/web`, in a pull request. The required list is `REQUIRED_HEADERS` in `packages/deploy/src/headers.ts` |
| `headers-invalid: "_headers"` (with `bundle scan failed`) | A line in `_headers` that Cloudflare would not apply as written (sol security r4 S6-2, Neon N14 and N17): a header name that is not an RFC 9110 token (letters, digits and ``!#$%&'*+.^_`|~-``, no spaces); an empty value, or one with a character outside printable ASCII and tab; a `! Name` removal line whose name is not a token, including any extra whitespace after `! ` (Wrangler keeps it as part of the name); a header line before any path; a Content-Security-Policy that is repeated in one block, lists policies with a comma, or names one directive twice (browsers keep the first, so the policy would say two things); or a required header whose value holds a placeholder Cloudflare would fill in (`:name`, `:splat`). Nothing was uploaded | Fix the line in `apps/web/public/_headers`, in a pull request |
| `canary` or `email` lines (as `#<n> <ref8>`), with `bundle scan failed` | A file in the site holds the private canary marker or an email address. The scan reads each file's content, each HTML page also with its tags removed and the text around them joined (so `<wbr>` or `<span>` inside an address cannot hide it, sol security r4 S6-6), and each file's path, which is its public URL (S6-7). Nothing was uploaded | Reproduce locally with `check` to see the paths (above), then remove the marker or address from the content or the file name, in a pull request |
| `check 3 failed before upload; nothing was uploaded` | The dry run printed something other than "No bindings found." (a binding appeared, or Wrangler's output changed) | Nothing is live from this run. Find what changed; a Wrangler upgrade needs T6 and the recorded dry-run fixture re-checked |
| `worker-missing: "carry-journal"`, then `the carry-journal Worker does not exist yet …` | The Worker has not been created; `wrangler versions upload` cannot create one. Nothing was uploaded | Do setup step 1.1 (create it in the dashboard, with workers.dev and Preview URLs off), then step 4: a normal run, then a run with **apply_triggers** on the same commit |
| `live-api-error: 403 "carry-journal"` (or 401), then `could not read the active deployment; nothing was uploaded` | The deployments API refused or failed before the upload. The number is the reply's HTTP status; with no number there was no usable reply (a timeout, a network error or a malformed body) | **401 or 403:** the token is wrong, expired or lacks access to `carry-journal`; fix it in the environment (setup step 1, then the fallback token only if the scoped one is refused). **Other statuses or none:** re-run once Cloudflare answers again |
| `wrangler-error: code …` lines, with `wrangler-auth-error` after them | A Wrangler run failed. The codes are Cloudflare's error codes from its output (nothing else of it is printed); `wrangler-auth-error` means one of them, or Wrangler's wording, is an authentication error (codes 10000 or 9109) | As 401 or 403 above: fix the token, then re-run. Without `wrangler-auth-error`, look the code up in Cloudflare's API error list |
| `live-subdomain: "carry-journal"`, then `preview URLs are on (they must be off); turn them off in the dashboard, or, once this build is live, run deploy-public with apply_triggers` (deploy job) | Preview URLs are on (a new Worker has them on, or the setting was changed in the dashboard); they would serve even a version the gate then refuses. workers.dev may be on or off here. Nothing was uploaded | Turn Preview URLs off in the dashboard (Settings → Domains & Routes), then re-run. `apply_triggers` does not help here: it acts only when the live version is this build's, and this run uploaded nothing |
| `could not read the workers.dev and preview-URL settings; nothing was uploaded` | The subdomain API failed three times before the upload | Re-run once Cloudflare answers again |
| `wrangler versions upload exited with …`, then `no uploaded version to check; nothing was promoted` | The upload failed, or printed no version id (exit 124 means it timed out after 10 minutes) | Nothing changed live. A version may exist with no traffic; it is harmless. Re-run |
| `could not confirm version … ; it was not promoted` | The uploaded version could not be read through the API, three times | Nothing changed live; the version has no traffic. Re-run |
| `version … failed check 3; it was not promoted` | The uploaded version has a binding, or the script has a tail consumer, logpush or an observability export, that the definition does not allow | Nothing changed live. Find the cause (a tail consumer, logpush or observability destination added in the dashboard, or a changed definition or Wrangler) and fix it before re-running |
| `live-tail-consumers: "carry-journal"` | The Worker's script settings list a tail consumer, in `tail_consumers` or `streaming_tail_consumers`. Either would send every request's logs to another Worker. Seen before promotion, nothing was promoted; seen after it, see the row below | Remove the tail consumer from `carry-journal`'s settings (dashboard → Workers & Pages → `carry-journal` → Settings), then re-run |
| `live-logpush: "carry-journal"` | Logpush is on for the Worker. No log destination is approved for Release 1, so the gate refuses it; an absent setting counts as off | Turn Logpush off in `carry-journal`'s settings (dashboard → Workers & Pages → `carry-journal` → Settings), then re-run |
| `live-observability-export: "carry-journal"` | The Worker's observability settings send invocation logs or traces to an outside destination (`observability.logs.destinations` or `observability.traces.destinations` not empty, and that export not turned off). A section's own `enabled` flag always decides; when `observability.logs.enabled` is not set, the top-level `observability.enabled` decides for logs only (it is shorthand for logs), and traces export unless `observability.traces.enabled` is false (sol security r4 S6-4, Neon N15). No log destination is approved for Release 1. Seen before promotion, nothing was promoted; seen after it, see the no-rollback row below | Remove the destination, or turn that export off, in `carry-journal`'s settings (dashboard → Workers & Pages → `carry-journal` → Settings), then re-run |
| `a tail consumer, logpush or an observability export is set on the live Worker; not rolling back (it would not remove it). Remove it now` | After promotion, the only problems are script settings (`live-tail-consumers`, `live-logpush` or `live-observability-export`). They belong to the script, not to a version, so a rollback would revert good content and leave them in place | The new version is live and its content is fine. Remove the tail consumer, turn Logpush off or remove the observability destination now, then re-run to confirm |
| `deployment-changed: "carry-journal"`, then `the active deployment changed while version … was checked; it was not promoted` | Something else deployed `carry-journal` between the gate's first read and its write (the dashboard, or another tool; never another `deploy-public` run, which waits for this one) | Nothing was promoted. Find out what deployed and check which version is live, then re-run |
| `could not re-read the active deployment; version … was not promoted` | The single compare-and-swap read just before the promotion failed (`live-api-error`, with the reply's HTTP status when there was one) | Nothing was promoted; the new version has no traffic. Re-run once Cloudflare answers again |
| `version … is live and shows the expected bindings` but the job failed | `wrangler versions deploy` exited non-zero, yet the new version is live and correct | Nothing to undo. Read the Wrangler exit line; re-run if needed |
| `could not confirm the live Worker after promotion; not rolling back. Check it by hand now` | After promotion the API failed on every confirmation read (up to 3 reads on errors); the `live-api-error` line before it carries the last reply's HTTP status. The gate cannot tell whether the live Worker is right | Check now: dashboard → Workers & Pages → `carry-journal` → Settings → Bindings must be empty, and the active version must be the one in the log. If not, roll back by hand (Deployments → the last good version) |
| `deployment-changed: "carry-journal"`, then `the active deployment did not show version … within 5 reads; not rolling back. Check the live Worker now` | After promotion, the deployments endpoint still did not show the new version alone at 100% after 5 convergence reads (20 seconds of waits, plus up to two retries of API errors): Cloudflare was slow to show the write, the promotion did not take, or something else deployed. The gate does not roll back (N5a) | Check in the dashboard (Workers & Pages → `carry-journal` → Deployments) which version is active and whether its bindings are empty. If it is the version in the log, nothing is wrong; otherwise find out what deployed, then re-run |
| `deployment-changed: "carry-journal"`, then `version … is not the active one; not rolling back. Check the live Worker now` | After promotion, check 3 found a definite problem on the live Worker, and the single read before rolling back showed another version active: something else deployed in the meantime. Nothing was rolled back | Check what is active in the dashboard and whether it is clean, then re-run |
| `deployment-changed: "carry-journal"`, then `another deployment was made while the rollback target was checked; not rolling back over it` | The gate was about to roll back, but someone deployed in the meantime; their deployment wins | Check what is active in the dashboard and whether it is clean, then re-run |
| `could not read the active deployment; not rolling back` or `could not re-read the active deployment; not rolling back` | One of the two single reads before a rollback failed (`live-api-error`, with the reply's HTTP status when there was one); nothing was rolled back | Check the live Worker in the dashboard now, as in the row above |
| `wrangler rollback to … exited with 0`, then `rollback confirmed: version … is live and shows the expected bindings` | The promoted version showed a binding that its checked version did not (a change after promotion). The gate went back to the verified previous version | Nothing is wrong live. Remove the extra binding in the dashboard, then re-run |
| `live-after-rollback`, with `no verified previous version to return to` or `the live Worker still does not match after the rollback` | The live Worker is wrong and the gate could not fix it: there was no previous version (the first deploy), the previous one is not clean itself, or the rollback did not take: after the rollback, the previous version was not the active one alone at 100% with clean settings within the confirmation's reads (5 while converging, at most 7 in all). The lines before `live-after-rollback` give each problem found, `live-api-error` ones with the reply's HTTP status (N5b) | Act now: roll back by hand to the last good version in the dashboard, or remove the extra binding; then re-run |
| `could not read the active deployment; workers.dev was not changed` (triggers job) | The deployments API failed before the triggers deploy (`live-api-error`, with its status) | As `live-api-error` above. Nothing changed |
| `live-version-not-sole: "carry-journal"`, then `the active deployment is not one version at 100%; workers.dev was not changed. Run deploy-public first, then apply_triggers` (triggers job) | The active deployment splits traffic between versions (a gradual deployment made in the dashboard), so there is no single sealed build to turn workers.dev on for. Nothing changed | Run `deploy-public` (it promotes this build to 100%), then **apply_triggers** on the same commit |
| `live-version-untagged: "carry-journal"`, then `version … has no workers/tag, so it was not uploaded by deploy-public (a dashboard placeholder?); workers.dev was not changed` (triggers job) | The live version carries no tag, so the gate did not upload it: usually the dashboard placeholder, because **apply_triggers** ran before the first deploy, or a version uploaded by hand. Never upload a version by hand: only `deploy-public` uploads, so that every live version passed the gate. Nothing changed | Run `deploy-public` first, then **apply_triggers** on the same commit (setup step 4) |
| `live-version-not-sealed: "carry-journal"`, then `version … is not the site this build sealed (its tag is not …); workers.dev was not changed` (triggers job) | The live version's tag is not this build's manifest tag, which is printed; the live tag itself never is, since anyone with access can set it to anything, and a tag that is not 12 lower-case hexadecimal characters is treated the same way (sol security r4, S6-3). The version was uploaded for a different build: **apply_triggers** ran on another commit than the last deploy, `main` moved in between, or the build is not reproducible (the same commit sealed to a different manifest tag). Nothing changed | Run `deploy-public` for the current `main`, then **apply_triggers** right after, before anything else merges. If it fails again on the same commit, the build is not reproducible: report it |
| `could not read version …'s tag; workers.dev was not changed` (triggers job) | The versions API failed reading the live version's tag (`live-api-error`, with its status) | As `live-api-error` above. Nothing changed |
| `deployment-changed: "carry-journal"`, then `the active deployment changed while it was checked; workers.dev was not changed` (triggers job) | Something deployed `carry-journal` between the gate's checks and its write | Nothing changed. Check what is live, then run `deploy-public` and **apply_triggers** again in order |
| `could not confirm the live Worker; workers.dev was not changed` or `the live Worker does not match its definition; workers.dev was not changed` (triggers job) | Before turning workers.dev on, the gate could not read the live Worker, or it found a binding, tail consumer or logpush the definition does not allow, in the script settings or in a version the active deployment serves (also `live-observability-export`) | Nothing changed. Re-run once Cloudflare answers, or remove the binding, tail consumer or observability destination, or turn Logpush off, in the dashboard first |
| `wrangler triggers deploy exited with …` non-zero (triggers job) | Wrangler could not apply the workers.dev or preview-URL settings. With `wrangler-auth-error` beside it, the token's scope is the cause | Nothing else changed. Fix the token (or set workers.dev **on** and Preview URLs **off** in the dashboard by hand), then re-run with **apply_triggers** |
| `the live Worker does not match its definition; nothing was rolled back. Check it by hand now` (triggers job) | After `triggers deploy`, the live Worker shows a binding (`live-bindings`, which triggers cannot change, so it was already wrong), or workers.dev or preview URLs differ from the definition (`live-subdomain`) | Fix what the rule names in the dashboard (remove the binding, or set workers.dev **on** and Preview URLs **off**), then run with **apply_triggers** again |
| `the carry-journal Worker does not exist yet …` (triggers job) | As `worker-missing` above | Do setup step 1.1, then step 4 in order: a normal run first, then **apply_triggers** |
| any `wrangler … exited with 124` | That Wrangler run was still going after 10 minutes and was killed with its process group | Read the next line as in the rows above. If it recurs, check Cloudflare's status page before re-running |

The gate changes the live Worker only by promoting a version it has just checked, or by rolling back to a
previous version it has checked; an API error never leads to a change. Every API read stops after 60 seconds
(30 for the reply, 30 for its body) and every Wrangler run after 10 minutes. The deploy job's 90-minute limit
covers its worst case, the rollback path: four Wrangler runs (dry run, upload, promote, rollback), the single
reads, the confirmations with their retries, and up to 7 reads after each of the two writes (626 seconds each at
worst), about 4,810 seconds (80 minutes), plus five minutes for setup. The triggers job's 45-minute limit covers its worst case with one active
version: about 1,584 seconds of reads and `wrangler triggers deploy`, two more single reads for S5-5 (the live
version's tag and the compare-and-swap read, 120 seconds) and the 10-minute dry run, about 2,304 seconds
(38 minutes), plus five minutes for setup. T10 computes both sums from the gate's limits and fails if a job's
limit does not cover them.

## Not yet covered

- The beacon Worker (`carry-journal-beacon`) is defined in `packages/deploy` but the gate's command line deploys
  only the site; it joins this workflow when the gate supports it.
- T13, the edge smoke test after each deploy, is not written yet.
- The Kit Watch workflow (`deploy-kit.yml`, environment `kit-production`) is separate and not part of Release 1's
  public pipeline. T10 already fails if any other workflow names `kit-production`.
