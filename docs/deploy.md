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
| `data validator` | `tools/validate.py` and the `tools/test_validate_*.py` tests through `uv run --no-project --with pyyaml --with jsonschema`. The private `data/my-notes.yaml` is never in the repository, so the validator skips the `my_note` links, as it does on any machine without that file |
| `secret scan` | gitleaks 8.30.1 over the whole history, downloaded from its GitHub release and checked against the release's SHA-256. The binary is used rather than `gitleaks/gitleaks-action`: the action's README (github.com/gitleaks/gitleaks-action) has it read the repository token on pull requests and asks organisation accounts for a licence key, and since v2 the action is not under an open-source licence. The binary needs no token and no key |

Node comes from `.node-version`; Bun is pinned to 1.4.2.

### `.github/workflows/deploy-public.yml`: build, then deploy

Runs on every push to `main`, once a day at 04:17 UTC (so `/performance` stays current, decision #17), and by hand
(**Actions → deploy-public → Run workflow**, on `main`). Two jobs:

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
   the folder again, runs check 3 (`wrangler deploy --dry-run` must print exactly "No bindings found."), deploys,
   then reads the live Worker's settings and rolls back if they are not what the definition says.

One deploy runs at a time and a running deploy is never cancelled. If more runs arrive while one is deploying,
GitHub keeps only the newest waiting run, which is the newest `main`.

Every action in both files is pinned by its full commit SHA with the version in a comment, and only the approved
actions are used (`actions/checkout`, `actions/setup-node`, `oven-sh/setup-bun`, `astral-sh/setup-uv`,
`actions/upload-artifact`, `actions/download-artifact`). Every job's permissions are `contents: read`. Checkout never
keeps the repository token in the working copy. To update an action, change the SHA and the comment together.

## Setup only the owner can do

About 20 minutes, once, before the first deploy.

1. **Create the Cloudflare API token.** Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom
   token. Permission: Account → **Workers Scripts → Edit**, on this account only. Nothing else (no zone, DNS, D1,
   KV or R2 permissions). This account-wide token is the Release 1 token; Release 1.1 replaces it with one scoped
   to the public Workers (design section 7).
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
4. **First deploy:** Actions → deploy-public → Run workflow on `main`. After it succeeds, attach
   `carryjournal.com` and the `/api/*` route in the dashboard (design section 6).

Scheduled workflows run only from the default branch, and GitHub turns them off in a public repository after 60
days with no activity; re-enable it on the Actions tab if that happens.

## When a deploy fails

The gate prints one line per problem, naming a path and a rule (never a file's contents or a secret), then a
summary line. GitHub emails you when the job fails.

| Summary line | What happened | What to do |
|---|---|---|
| `check 1 failed`, `seal failed` or `bundle scan failed` | The build broke a wall rule. Nothing was uploaded | Fix the cause the problem lines name, in a pull request |
| `check 3 failed before upload; nothing was uploaded` | The dry run printed something other than "No bindings found." (a binding appeared, or Wrangler's output changed) | Nothing is live from this run. Find what changed; a Wrangler upgrade needs T6 and the recorded dry-run fixture re-checked |
| `check 3 failed on the live Worker; rolled back` | The upload happened, but the live Worker's bindings or tail consumers differ from the definition (for example a binding added in the dashboard) | The gate has already run `wrangler rollback`; check the `wrangler rollback exited with` line. If it is not 0, roll back by hand: dashboard → Workers & Pages → `carry-journal` → Deployments → roll back to the last good version. Then remove the extra binding in the dashboard and re-run the workflow |
| `wrangler deploy exited with` a non-zero code, then `the live Worker shows the expected bindings` | The upload failed part way, but what is live is still correct | Re-run the workflow once the cause (often a Cloudflare outage or an expired token) is fixed |

A failed or missing API reply in the live check counts as a failure, so it also rolls back.

## Not yet covered

- The beacon Worker (`carry-journal-beacon`) is defined in `packages/deploy` but the gate's command line deploys
  only the site; it joins this workflow when the gate supports it.
- T13, the edge smoke test after each deploy, is not written yet.
- The Kit Watch workflow (`deploy-kit.yml`, environment `kit-production`) is separate and not part of Release 1's
  public pipeline. T10 already fails if any other workflow names `kit-production`.
