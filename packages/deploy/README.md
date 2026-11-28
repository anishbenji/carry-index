# packages/deploy

The privacy-wall deploy gate (design v2, ADR-0049): Worker definitions and the config emitter, the seal, the
Wrangler runner, and the three wall checks. `node packages/deploy/src/bin.ts check|deploy|triggers <siteDir>`;
the commands, their order and their tests are described in `test/README.md` and `docs/spike/toolchain.md`.

## Dependencies

- **zod 4.6.7**: allowed here by director decision (user-delegated, `auto-approved-decisions.md`, "Zod allowed in
  `packages/deploy`"; child rule 6 updated). The gate is a CI tool: Zod validates the Worker definitions
  (`workers.ts`) and walks the catalogue schemas (`surface.ts`). It never reaches the public bundle, which the
  import ban and the Zod-in-build check keep Zod-free.
- `@cj/schema` (workspace): the catalogue schemas check 1 walks.
- The pinned `wrangler` 4.168.0 at the repository root, run as `process.execPath <wrangler.js>`.

## First deploy (one time, by the owner)

`wrangler versions upload` cannot create a Worker, and `versions deploy` applies no triggers, so the first run of
`deploy` stops with `worker-missing` until the Worker exists. Turning workers.dev on first would serve the dashboard
placeholder, which never passed the seal, so the first deploy runs with both public hostnames off (sol security r3,
S5-5). In this order:

1. In the Cloudflare dashboard, create a Worker named `carry-journal`. In its Settings, under Domains & Routes, turn
   off workers.dev and Preview URLs: a Worker created in the dashboard starts with workers.dev on.
2. Run the `deploy-public` workflow. It runs `node packages/deploy/src/bin.ts deploy <siteDir>`: checks 1 and 2, the
   seal and the dry run, then `wrangler versions upload --tag <manifest tag>` (the first 12 hex characters of the
   sealed manifest's SHA-256), verify, and promote to 100%. With workers.dev and preview URLs both off, nothing is
   public yet. (`deploy` accepts workers.dev off or on; preview URLs on always fails, `live-subdomain`.)
3. Run `deploy-public` with `apply_triggers` on the same commit. It runs `node packages/deploy/src/bin.ts triggers
   <siteDir>`, which seals the same build again and turns workers.dev on only if the active deployment is one
   version at 100% (`live-version-not-sole`) that passes check 3 and whose `workers/tag` equals this build's manifest
   tag. A version with no tag (the placeholder) is `live-version-untagged`, another build's is
   `live-version-not-sealed`; there is no fallback. It re-reads the active deployment just before running
   `wrangler triggers deploy --config <sealed>/wrangler.json` (`deployment-changed` if it moved), then confirms
   workers.dev on, preview URLs off and the expected bindings.
4. Later deploys need only `deploy-public`.

Never upload a version by hand (`wrangler versions upload`, `wrangler deploy` or the dashboard): only the gate
uploads. `triggers` trusts a version's `workers/tag` only because the gate's own uploads are the only ones that carry
it; a hand upload could reuse a tag and be made public without having been sealed or scanned (sol security r4, S6-1).

## The build-graph report

The public build's Vite config runs `moduleGraph` (`src/graph-plugin.ts`): the build fails on any module it
resolved from a private folder, an installed private package or outside the repository, and writes
`<outDir>.module-graph.json` beside the output folder (never inside it), listing every module and every output
file's SHA-256. The plugin also checks every file the build watched and every emitted asset's original file, because files read
as assets (`new URL(..., import.meta.url)`, CSS `@import` and `url()`) never become modules, and it sets
`build.assetsInlineLimit: 0`. It refuses any worker import (`?worker`, `?sharedworker`, `&worker`: Vite builds those
where the check cannot see), records watched files from every hook's context, and walks the public folder with
`lstat`, refusing links, hard links and private paths (Vite's copy follows links). Private means the private app, Worker and schemas, `.gitignore`'s private data files
and never-public folders, installed private packages, and anything outside the repository (`src/private-roots.ts`).
`deploy` and `triggers` refuse a site with bundled code (`assets/`) unless that report is there for
the same build (`src/graph-check.ts`): `module-graph-missing`, `module-graph-mismatch`, `private-module`, `worker-import`, or
`graph-checks-disabled` when the build ran with a check turned off (a test-only switch) or the report does not say. `check`
does not need it.

## Reading a failed run

A problem with a file in the site is printed as `<rule>: #<n> <ref8>`, never by name: a file's name can itself be
private, and CI logs are public. `<ref8>` is an HMAC-SHA-256 of the path under a random key made for that run, so it
cannot be matched by hashing guessed names; the key is in the diagnostics file only. The gate then prints where the full paths are: `diagnostics.txt` in a fresh
`cj-gate-diagnostics-*` folder (owner-only) inside `RUNNER_TEMP` on CI, or the system temp folder locally. Never
upload that folder as an artifact.

Fit data (`data/fit/*.json`) must match `fitSchema` in `@cj/schema` (`fit-data-invalid`), and every `_redirects`
rule must stay on the site (`redirects-invalid`).

## Concurrent deployments

The gate re-reads the Worker's active deployment immediately before each write (`versions deploy` and `rollback`)
and compares its id with the one it read before verifying. If anyone else deployed in between, the gate writes
nothing and fails with `deployment-changed`; it never rolls back over someone else's deployment. The CI workflow's
`concurrency` group serialises the gate's own runs. The remaining gap is a promotion from the dashboard in the
moment (under a second) between the gate's last read and Wrangler's write; that is accepted for a single operator.
If you promote by hand, do not run `deploy-public` at the same time, and after a `deployment-changed` failure check
which version is live before running it again.

`node packages/deploy/src/bin.ts check <siteDir>` runs on any machine with no credentials and spawns nothing.

Changes to this package, `public-surface.json` and `never-public.ts` are never auto-merged.
