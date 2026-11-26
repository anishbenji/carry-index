import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as catalogue from "@cj/schema";
import { scanBundle } from "./canary.ts";
import type { Fetch } from "./check3.ts";
import {
  activeDeployment,
  checkDryRun,
  checkLive,
  checkSubdomain,
  checkVersion,
  soleVersion,
  uploadedVersion,
  versionTag,
} from "./check3.ts";
import { checkModuleGraph } from "./graph-check.ts";
import { checkHeaders } from "./headers.ts";
import type { CheckResult, Problem, Rule } from "./problems.ts";
import type { RunOptions, Spawn, SpawnResult } from "./runner.ts";
import { runWrangler } from "./runner.ts";
import type { SealedBundle } from "./seal.ts";
import { manifestTag, seal } from "./seal.ts";
import {
  neverPublicFields,
  openShapes,
  publicSurface,
  rewriteProblems,
  schemaConversionProblems,
  strictnessProblems,
  unknownExports,
} from "./surface.ts";
import { PUBLIC_SITE } from "./workers.ts";

export type GateCommand = "check" | "deploy" | "triggers";

export type CliArgs = { ok: true; command: GateCommand; siteDir: string } | { ok: false; reason: string };

/**
 * Accepts exactly `check <siteDir>`, `deploy <siteDir>` or `triggers <siteDir>`. Every other argument, flag or extra
 * positional is refused: nothing reaches Wrangler's command line from outside the gate.
 */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  if (argv.length !== 2) return { ok: false, reason: "expected exactly a command and a site folder" };
  const [command, siteDir] = argv;
  if (command !== "check" && command !== "deploy" && command !== "triggers") {
    return { ok: false, reason: "the command must be check, deploy or triggers" };
  }
  if (siteDir === undefined || siteDir === "" || siteDir.startsWith("-")) {
    return { ok: false, reason: "the site folder must be a path, not a flag" };
  }
  return { ok: true, command, siteDir };
}

const USAGE = "usage: check <siteDir> | deploy <siteDir> | triggers <siteDir>";

const SNAPSHOT = fileURLToPath(new URL("../public-surface.json", import.meta.url));

/**
 * Check 1's schema half on the catalogue schemas the build reads: the readable surface must equal the committed
 * `public-surface.json` (each line added or removed is a `surface-changed` problem at its path), with no
 * never-public name, no open shape and no schema that rewrites its output after parsing. The import ban is the other half; it runs with the tests (T8).
 */
export function checkCatalogue(): Problem[] {
  const expected = new Set(JSON.parse(readFileSync(SNAPSHOT, "utf8")) as string[]);
  const actual = new Set(publicSurface(catalogue));
  const changed = [...expected, ...actual]
    .filter((line) => expected.has(line) !== actual.has(line))
    .map((line): Problem => ({ path: line.slice(0, line.lastIndexOf(": ")), rule: "surface-changed" }));
  return [
    ...unknownExports(catalogue),
    ...schemaConversionProblems(catalogue),
    ...changed,
    ...neverPublicFields(catalogue),
    ...openShapes(catalogue),
    ...strictnessProblems(catalogue),
    ...rewriteProblems(catalogue),
  ];
}

/**
 * After a failed Wrangler run, the Cloudflare error codes in its output (`[code: 10000]`), one line each. Nothing
 * else of the output is printed: its messages can hold paths, account details or file contents.
 */
const AUTH_WORDING = /Authentication error|not authenticated|Invalid (?:API|access) token|wrangler login/i;

function logWranglerCodes(io: CliIo, result: SpawnResult): void {
  if (result.exitCode === 0) return;
  const output = `${result.stdout}\n${result.stderr}`;
  const codes = new Set([...output.matchAll(/\[code: (\d{1,6})\]/g)].map((m) => m[1]));
  for (const code of codes) io.log(`wrangler-error: code ${code}`);
  // Matched, never printed: Cloudflare's authentication codes and Wrangler's own wording (cli.js:206430).
  if (codes.has("10000") || codes.has("9109") || AUTH_WORDING.test(output)) io.log("wrangler-auth-error");
}

/** One problem per line. The path is JSON-quoted, so a file name cannot add lines or terminal escapes to the log. */
function logProblems(io: CliIo, problems: readonly Problem[]): void {
  for (const problem of problems) {
    const status = problem.status === undefined ? "" : `${problem.status} `;
    io.log(`${problem.rule}: ${status}${JSON.stringify(problem.path)}`);
  }
}

/** Names the gate itself owns and checks: printed as they are, since they cannot carry anything private. */
const FIXED_NAMES: ReadonlySet<string> = new Set([".", "_headers", "_redirects"]);

/**
 * File problems (seal, bundle scan, build graph) without their names (security-sol r2, S2-10): a rejected file's name
 * can itself be private (a recipient's email, an order reference), and CI logs are public. Each public line is
 * `<rule>: #<n> <ref>`, where `<ref>` is the first 8 hex of HMAC-SHA-256 of the path under a random 32-byte key made
 * fresh for each run: an unkeyed hash of a guessable name could be confirmed by hashing guesses. The key is written
 * only to the diagnostics file and never printed. The full paths go only to `diagnostics.txt` in a fresh
 * owner-only folder inside the run temp folder (`io.tempDir`, else `RUNNER_TEMP`, else the system temp folder),
 * which is never inside the site, the sealed (uploaded) folder or the checkout, and which the gate leaves for the
 * operator. The fixed names in `FIXED_NAMES` are printed as they are.
 */
function logFileProblems(io: CliIo, problems: readonly Problem[]): void {
  const key = randomBytes(32);
  const diagnostics: string[] = [];
  for (const problem of problems) {
    if (FIXED_NAMES.has(problem.path)) {
      logProblems(io, [problem]);
      continue;
    }
    const ref = createHmac("sha256", key).update(problem.path).digest("hex").slice(0, 8);
    const index = diagnostics.length + 1;
    io.log(`${problem.rule}: #${index} ${ref}`);
    diagnostics.push(`#${index} ${ref} ${problem.rule} ${JSON.stringify(problem.path)}`);
  }
  if (diagnostics.length === 0) return;
  // An empty or blank setting counts as unset: resolve("") is the working folder, the checkout (Neon N6).
  const root = resolve(io.tempDir?.trim() || io.env.RUNNER_TEMP?.trim() || tmpdir());
  const dir = mkdtempSync(join(root, "cj-gate-diagnostics-"));
  const file = join(dir, "diagnostics.txt");
  writeFileSync(file, `key ${key.toString("hex")}\n${diagnostics.join("\n")}\n`, { flag: "wx", mode: 0o600 });
  io.log(`gate: full paths for the #references above are in ${file} (private: never upload it)`);
}

export interface CliIo {
  /** The gate's only output channel. Lines name paths and rules, never file contents or secrets. */
  log: (line: string) => void;
  env: Readonly<Record<string, string | undefined>>;
  spawn: Spawn;
  fetch: Fetch;
  wrangler: string;
  /** Waits between live-check retries; a real timer by default. */
  sleep?: (ms: number) => Promise<void>;
  /** The run temp folder, for the private diagnostics file; `RUNNER_TEMP` or the system temp folder by default. */
  tempDir?: string;
}

/** Live-check tries while the API only errors, and the wait before each retry. */
const LIVE_TRIES = 3;
const RETRY_WAIT_MS = 2_000;

/**
 * The public deploy gate. `check`: check 1 on the catalogue schemas, then seal, validate and scan the site folder
 * (check 2); nothing is spawned or fetched. `deploy`: the same, then the build-graph check (`graph-check.ts`), check
 * 3 before upload (the dry run), the
 * deploy, and the live check with rollback. Returns the exit code; never throws.
 */
export async function main(argv: readonly string[], io: CliIo): Promise<number> {
  try {
    return await run(argv, io);
  } catch (error) {
    // Only the error's class: a message can quote input (a file's contents, a reply body).
    io.log(`gate: stopped on an unexpected ${error instanceof Error ? error.name : "error"}`);
    return 1;
  }
}

async function run(argv: readonly string[], io: CliIo): Promise<number> {
  const args = parseCliArgs(argv);
  if (!args.ok) {
    io.log(`gate: ${args.reason}; ${USAGE}`);
    return 2;
  }
  const accountId = io.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = io.env.CLOUDFLARE_API_TOKEN;
  if (args.command !== "check" && (!apiToken || !accountId || !/^[0-9a-f]{32}$/.test(accountId))) {
    io.log(`gate: ${args.command} needs CLOUDFLARE_API_TOKEN and a 32-character hex CLOUDFLARE_ACCOUNT_ID`);
    return 1;
  }

  const schemaProblems = checkCatalogue();
  if (schemaProblems.length > 0) {
    logProblems(io, schemaProblems);
    io.log(`gate: check 1 failed with ${schemaProblems.length} problem(s); nothing was uploaded`);
    return 1;
  }

  const sealed = await seal(args.siteDir, PUBLIC_SITE);
  if (!sealed.ok) {
    logFileProblems(io, sealed.problems);
    io.log(`gate: seal failed with ${sealed.problems.length} problem(s); nothing was uploaded`);
    return 1;
  }
  const { bundle } = sealed;
  try {
    const scanned = [...(await scanBundle(bundle.siteDir)), ...checkHeaders(bundle.siteDir, { requireFile: true })];
    if (scanned.length > 0) {
      logFileProblems(io, scanned);
      io.log(`gate: bundle scan failed with ${scanned.length} problem(s); nothing was uploaded`);
      return 1;
    }
    io.log(`gate: sealed and scanned ${bundle.manifest.length} file(s)`);
    if (args.command === "check" || !apiToken || !accountId) return 0;

    // The build-graph check: the bundled code must come from a build whose resolved modules were all public.
    const graph = checkModuleGraph(args.siteDir, bundle.manifest);
    if (graph.length > 0) {
      logFileProblems(io, graph);
      io.log(`gate: the build-graph check failed with ${graph.length} problem(s); nothing was uploaded`);
      return 1;
    }

    const options: RunOptions = { wrangler: io.wrangler, spawn: io.spawn, env: io.env };
    const dryRun = await runWrangler(bundle, "dry-run", options);
    logWranglerCodes(io, dryRun);
    const before =
      dryRun.exitCode === 0
        ? checkDryRun(PUBLIC_SITE, `${dryRun.stdout}\n${dryRun.stderr}`)
        : { ok: false, problems: [{ path: PUBLIC_SITE.name, rule: "dry-run-output" } as const] };
    if (!before.ok) {
      logProblems(io, before.problems);
      io.log("gate: check 3 failed before upload; nothing was uploaded");
      return 1;
    }

    const api = { accountId, apiToken, fetch: io.fetch };
    if (args.command === "triggers") return await applyTriggers(io, bundle, options, api);
    return await uploadVerifyPromote(io, bundle, options, api);
  } finally {
    rmSync(bundle.dir, { recursive: true, force: true });
  }
}

type ApiOptions = { accountId: string; apiToken: string; fetch: Fetch };

/**
 * The one-time `wrangler triggers deploy` before the first deploy (`versions deploy` applies no triggers): it sets
 * workers.dev on and preview URLs off, as the definition says, and uploads no code. Turning workers.dev on serves
 * whatever the Worker already runs, so the live Worker is checked first (security-sol r2, S2-1): the active deployment
 * must be readable (any lookup error but "Worker missing" stops the gate), and the script settings and every version
 * that deployment serves must show exactly the expected bindings and no tail consumer. A failing check leaves
 * workers.dev untouched. Afterwards the bindings and the subdomain settings are confirmed again; triggers cannot
 * change bindings, so a mismatch then is reported, not rolled back.
 */
async function applyTriggers(io: CliIo, bundle: SealedBundle, options: RunOptions, api: ApiOptions): Promise<number> {
  const before = await activeDeployment(PUBLIC_SITE, api);
  if (!before.ok && before.missing) return workerMissing(io);
  if (!before.ok) {
    logProblems(io, [deploymentReadProblem(before.status)]);
    io.log("gate: could not read the active deployment; workers.dev was not changed");
    return 1;
  }
  const clean = await deploymentClean(io, api, before.versions);
  if (!clean.ok) {
    logProblems(io, clean.problems);
    io.log(
      onlyApiErrors(clean)
        ? "gate: could not confirm the live Worker; workers.dev was not changed. Check it by hand now"
        : "gate: the live Worker does not match its definition; workers.dev was not changed. Check it by hand now",
    );
    return 1;
  }
  // S5-5: workers.dev goes on only for the site this build sealed, deployed alone at 100% by the gate's deploy.
  const name = PUBLIC_SITE.name;
  const live = soleVersion(before);
  if (!live) {
    logProblems(io, [{ path: name, rule: "live-version-not-sole" }]);
    io.log(
      "gate: the active deployment is not one version at 100%; workers.dev was not changed. Run deploy-public " +
        "first, then apply_triggers",
    );
    return 1;
  }
  const tagged = await versionTag(PUBLIC_SITE, api, live);
  if (!tagged.ok) {
    if ("untagged" in tagged) {
      logProblems(io, [{ path: name, rule: "live-version-untagged" }]);
      io.log(
        `gate: version ${live} has no workers/tag, so it was not uploaded by deploy-public (a dashboard ` +
          "placeholder?); workers.dev was not changed. Run deploy-public first, then apply_triggers",
      );
    } else {
      logProblems(io, [deploymentReadProblem(tagged.status)]);
      io.log(`gate: could not read version ${live}'s tag; workers.dev was not changed`);
    }
    return 1;
  }
  const expected = manifestTag(bundle.manifest);
  if (tagged.tag !== expected) {
    logProblems(io, [{ path: name, rule: "live-version-not-sealed" }]);
    io.log(
      `gate: version ${live} is not the site this build sealed (tag ${JSON.stringify(tagged.tag)}, expected ` +
        `${expected}); workers.dev was not changed. Run deploy-public for this build first, then apply_triggers`,
    );
    return 1;
  }
  // Compare and swap: the deployment checked above must still be the active one immediately before the write.
  const still = await activeDeployment(PUBLIC_SITE, api);
  if (!still.ok) {
    logProblems(io, [deploymentReadProblem(still.status)]);
    io.log("gate: could not re-read the active deployment; workers.dev was not changed");
    return 1;
  }
  if (still.id !== before.id) {
    logProblems(io, [{ path: name, rule: "deployment-changed" }]);
    io.log("gate: the active deployment changed while it was checked; workers.dev was not changed");
    return 1;
  }
  const result = await runWrangler(bundle, "triggers", options);
  logWranglerCodes(io, result);
  io.log(`gate: wrangler triggers deploy exited with ${result.exitCode}`);
  const liveCheck = await confirmed(io, () => checkLive(PUBLIC_SITE, api));
  const subdomain = await confirmed(io, () => checkSubdomain(PUBLIC_SITE, api));
  if (!liveCheck.ok || !subdomain.ok) {
    logProblems(io, [...liveCheck.problems, ...subdomain.problems]);
    io.log("gate: the live Worker does not match its definition; nothing was rolled back. Check it by hand now");
    return 1;
  }
  io.log("gate: the live Worker shows the expected bindings, workers.dev and preview-URL settings");
  return result.exitCode === 0 ? 0 : 1;
}

/** The problem for an unreadable active deployment, with the HTTP status when the reply had one. */
function deploymentReadProblem(status: number | undefined): Problem {
  const name = PUBLIC_SITE.name;
  return status === undefined ? { path: name, rule: "live-api-error" } : { path: name, rule: "live-api-error", status };
}

/**
 * The script settings and every version in `versions` (one active deployment's) checked clean, each API error
 * retried. One problem per rule, sorted.
 */
async function deploymentClean(
  io: CliIo,
  api: ApiOptions,
  versions: ReadonlyArray<{ id: string }>,
): Promise<CheckResult> {
  const results = [await confirmed(io, () => checkLive(PUBLIC_SITE, api))];
  for (const { id } of versions) results.push(await confirmed(io, () => checkVersion(PUBLIC_SITE, api, id)));
  const problems = [...new Map(results.flatMap((r) => r.problems).map((p) => [p.rule, p])).values()].sort((a, b) =>
    a.rule < b.rule ? -1 : 1,
  );
  return { ok: results.every((r) => r.ok), problems };
}

/** The one-time owner steps when the Worker does not exist yet: `versions upload` cannot create it. */
function workerMissing(io: CliIo): number {
  logProblems(io, [{ path: PUBLIC_SITE.name, rule: "worker-missing" }]);
  io.log(
    `gate: the ${PUBLIC_SITE.name} Worker does not exist yet, and wrangler versions upload cannot create it. ` +
      `One-time owner steps: create a Worker named ${PUBLIC_SITE.name} in the Cloudflare dashboard and turn its ` +
      "workers.dev and Preview URLs off, run deploy-public, then run deploy-public with apply_triggers on the same " +
      "commit. Nothing was uploaded",
  );
  return 1;
}

/** Problems with a script-level setting, which a rollback to another version would not undo. */
const SCRIPT_SETTING_RULES: ReadonlySet<string> = new Set([
  "live-tail-consumers",
  "live-logpush",
  "live-observability-export",
  "live-api-error",
]);

const onlyApiErrors = (result: CheckResult): boolean => result.problems.every((p) => p.rule === "live-api-error");

/** A check result that may only be waiting for Cloudflare to show a write that was just made. */
type PendingResult = CheckResult & { pending?: true };

/** Reads, in all, while the active deployment has not yet converged to the version just written (Neon N5). */
const CONVERGE_TRIES = 5;

/**
 * Runs `check` until it passes or finds a definite problem. An API error alone is retried, LIVE_TRIES reads in all;
 * a `pending` result (the deployments endpoint still shows the earlier deployment just after a write) is retried
 * too, CONVERGE_TRIES reads in all. Waits grow by RETRY_WAIT_MS a try: at most 2 + 4 + 6 + 8 = 20 s.
 */
async function confirmed(io: CliIo, check: () => Promise<PendingResult>): Promise<PendingResult> {
  const sleep = io.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let result = await check();
  for (let tries = 1; !result.ok; tries++) {
    const retry = result.pending ? tries < CONVERGE_TRIES : onlyApiErrors(result) && tries < LIVE_TRIES;
    if (!retry) break;
    await sleep(RETRY_WAIT_MS * tries);
    result = await check();
  }
  return result;
}

/**
 * The active deployment must be `expected` alone at 100%, then the live settings must match. A deployment still
 * showing something else is pending (retried) and, when the retries run out, `unconverged`; an unreadable reply
 * keeps its HTTP status.
 */
function convergedLive(api: ApiOptions, expected: string, unconverged: Rule): () => Promise<PendingResult> {
  return async () => {
    const active = await activeDeployment(PUBLIC_SITE, api);
    if (!active.ok) return { ok: false, problems: [deploymentReadProblem(active.status)] };
    if (soleVersion(active) !== expected) {
      return { ok: false, pending: true, problems: [{ path: PUBLIC_SITE.name, rule: unconverged }] };
    }
    return checkLive(PUBLIC_SITE, api);
  };
}

/**
 * Check 3 around the upload, in the order that keeps an unchecked version from ever serving traffic:
 * 1. read the active deployment (the version to return to, and the compare-and-swap mark);
 * 2. `wrangler versions upload`: a new version with no traffic;
 * 3. confirm that exact version's bindings and the script's tail consumers through the API;
 * 4. re-read the active deployment: if anything else deployed meanwhile, stop with `deployment-changed`;
 * 5. `wrangler versions deploy <id>@100%`;
 * 6. confirm the new version is the active one and the live settings match.
 * A version that fails 3 is never promoted. Step 6 failing on a definite mismatch is a change after promotion: the
 * gate rolls back only to the previous version by id, only if that version itself checks clean, and only while the
 * new version's deployment is still the active one, re-read immediately before the rollback (compare and swap on
 * the deployment id, security-sol r2 S2-2). Every API error is retried, then fails without changing anything. The
 * remaining gap is a write by someone else between that last read and Wrangler's own write (under a second); the
 * CI workflow's concurrency group serialises the gate's own runs, and the owner promoting from the dashboard at that
 * moment is the accepted single-operator case (`README.md`, "Concurrent deployments").
 */
async function uploadVerifyPromote(
  io: CliIo,
  bundle: SealedBundle,
  options: RunOptions,
  api: ApiOptions,
): Promise<number> {
  const name = PUBLIC_SITE.name;
  const before = await activeDeployment(PUBLIC_SITE, api);
  if (!before.ok && before.missing) return workerMissing(io);
  if (!before.ok) {
    logProblems(io, [deploymentReadProblem(before.status)]);
    io.log("gate: could not read the active deployment; nothing was uploaded");
    return 1;
  }
  // Preview URLs on would serve even a version the gate then refuses, so they must be off before any upload.
  // Workers.dev may be off (the first deploy, S5-5) or on; preview URLs must be off either way.
  const subdomain = await confirmed(io, () => checkSubdomain(PUBLIC_SITE, api, true));
  if (!subdomain.ok) {
    logProblems(io, subdomain.problems);
    io.log(
      onlyApiErrors(subdomain)
        ? "gate: could not read the workers.dev and preview-URL settings; nothing was uploaded"
        : "gate: preview URLs are on (they must be off); turn them off in the dashboard, or, once this build is " +
            "live, run deploy-public with apply_triggers. Nothing was uploaded",
    );
    return 1;
  }
  const previous = soleVersion(before);

  const upload = await runWrangler(bundle, "upload", options);

  logWranglerCodes(io, upload);
  const version = uploadedVersion(`${upload.stdout}\n${upload.stderr}`);
  io.log(`gate: wrangler versions upload exited with ${upload.exitCode}${version ? `, version ${version}` : ""}`);
  if (upload.exitCode !== 0 || !version) {
    io.log("gate: no uploaded version to check; nothing was promoted");
    return 1;
  }

  const checked = await confirmed(io, () => checkVersion(PUBLIC_SITE, api, version));
  if (!checked.ok) {
    logProblems(io, checked.problems);
    io.log(
      onlyApiErrors(checked)
        ? `gate: could not confirm version ${version}; it was not promoted`
        : `gate: version ${version} failed check 3; it was not promoted`,
    );
    return 1;
  }

  // Compare and swap: the active deployment is re-read immediately before the write, and must be the one read first.
  const still = await activeDeployment(PUBLIC_SITE, api);
  if (!still.ok) {
    logProblems(io, [deploymentReadProblem(still.status)]);
    io.log(`gate: could not re-read the active deployment; version ${version} was not promoted`);
    return 1;
  }
  if (still.id !== before.id) {
    logProblems(io, [{ path: name, rule: "deployment-changed" }]);
    io.log(`gate: the active deployment changed while version ${version} was checked; it was not promoted`);
    return 1;
  }

  const promote = await runWrangler(bundle, "promote", options, version);

  logWranglerCodes(io, promote);
  io.log(`gate: wrangler versions deploy ${version}@100% exited with ${promote.exitCode}`);

  const live = await confirmed(io, convergedLive(api, version, "deployment-changed"));
  if (live.ok) {
    io.log(`gate: version ${version} is live and shows the expected bindings`);
    return promote.exitCode === 0 ? 0 : 1;
  }
  logProblems(io, live.problems);
  if (onlyApiErrors(live)) {
    io.log("gate: could not confirm the live Worker after promotion; not rolling back. Check it by hand now");
    return 1;
  }
  if (live.problems.every((p) => SCRIPT_SETTING_RULES.has(p.rule))) {
    // A tail consumer or logpush is a script setting, not part of a version: a rollback would revert good content
    // and leave it.
    io.log(
      "gate: a tail consumer, logpush or an observability export is set on the live Worker; not rolling back " +
        "(it would not remove it). " +
        "Remove it now",
    );
    return 1;
  }
  const active = await activeDeployment(PUBLIC_SITE, api);
  if (!active.ok) {
    logProblems(io, [deploymentReadProblem(active.status)]);
    io.log("gate: could not read the active deployment; not rolling back. Check the live Worker now");
    return 1;
  }
  if (soleVersion(active) !== version) {
    logProblems(io, [{ path: name, rule: "deployment-changed" }]);
    io.log(`gate: version ${version} is not the active one; not rolling back. Check the live Worker now`);
    return 1;
  }
  const target =
    previous && (await confirmed(io, () => checkVersion(PUBLIC_SITE, api, previous))).ok ? previous : undefined;
  if (!target) {
    logProblems(io, [{ path: name, rule: "live-after-rollback" }]);
    io.log("gate: no verified previous version to return to; the live Worker needs attention now");
    return 1;
  }
  // Compare and swap again: someone may have deployed while the target was verified; their deployment wins.
  const current = await activeDeployment(PUBLIC_SITE, api);
  if (!current.ok) {
    logProblems(io, [deploymentReadProblem(current.status)]);
    io.log("gate: could not re-read the active deployment; not rolling back. Check the live Worker now");
    return 1;
  }
  if (current.id !== active.id) {
    logProblems(io, [{ path: name, rule: "deployment-changed" }]);
    io.log("gate: another deployment was made while the rollback target was checked; not rolling back over it");
    return 1;
  }
  const rollback = await runWrangler(bundle, "rollback", options, target);
  logWranglerCodes(io, rollback);
  io.log(`gate: wrangler rollback to ${target} exited with ${rollback.exitCode}`);
  const after = await confirmed(io, convergedLive(api, target, "live-after-rollback"));
  if (after.ok) io.log(`gate: rollback confirmed: version ${target} is live and shows the expected bindings`);
  else {
    // Only the rule: the reply's problems and body are not printed.
    logProblems(io, [{ path: name, rule: "live-after-rollback" }]);
    io.log("gate: the live Worker still does not match after the rollback; it needs attention now");
  }
  return 1;
}
