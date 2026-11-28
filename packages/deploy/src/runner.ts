import { spawn } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SealedBundle } from "./seal.ts";
import { manifestTag } from "./seal.ts";
import type { SetTimer } from "./timer.ts";
import { realTimer } from "./timer.ts";

export interface SpawnRequest {
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
}

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs one process to completion. Injected so tests can see exactly what would run. */
export type Spawn = (request: SpawnRequest) => Promise<SpawnResult>;

/**
 * The Wrangler 4.168.0 commands the gate runs (wrangler-dist/cli.js: `versions upload` 213774, `versions deploy`
 * 213778 with its `<version-id>@<percentage>` specs and `--yes` at 208520-208575, `rollback` 213756, `triggers deploy`
 * 213807, which applies `workers_dev`, `preview_urls`, routes and crons from the config and uploads no code). There is
 * no plain `wrangler deploy`: it would serve the new version before the gate has checked it.
 */
export type WranglerCommand = "dry-run" | "upload" | "promote" | "rollback" | "triggers";

export interface RunOptions {
  /** Absolute path of the Wrangler executable (the pinned 4.168.0 install). */
  wrangler: string;
  spawn: Spawn;
  /** The ambient environment; only allow-listed variables are passed on. */
  env: Readonly<Record<string, string | undefined>>;
}

export interface SpawnOptions {
  /** Kill the child (and its process group) after this long. Ten minutes by default: an upload can be slow. */
  timeoutMs?: number;
  setTimer?: SetTimer;
}

/** The exit code reported for a child killed on timeout, as `timeout(1)` uses. */
export const TIMED_OUT = 124;

/**
 * The real spawner: a child process with exactly the request's argv, cwd and environment, no shell, in its own
 * process group. When `argv[0]` is (or links to) a `.js`, `.mjs` or `.cjs` file, it runs as
 * `process.execPath <real path> ...`. A child still running at the timeout is killed with its group and reported as exit `TIMED_OUT`.
 */
export function spawnProcess(request: SpawnRequest, options: SpawnOptions = {}): Promise<SpawnResult> {
  const [first, ...rest] = request.argv;
  if (first === undefined) return Promise.reject(new Error("spawnProcess: empty argv"));
  // A JavaScript entry (Wrangler's bin/wrangler.js, or a link to it) runs under this process's own Node, so its
  // `#!/usr/bin/env node` line never picks an interpreter from PATH.
  let entry = first;
  try {
    entry = realpathSync(first);
  } catch {
    // Not there: spawn reports it.
  }
  const isScript = /\.[cm]?js$/.test(entry);
  const file = isScript ? process.execPath : first;
  const args = isScript ? [entry, ...rest] : rest;
  const timeoutMs = options.timeoutMs ?? 600_000;
  const setTimer = options.setTimer ?? realTimer;
  return new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, {
      cwd: request.cwd,
      env: request.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: true,
    });
    const stdout: Uint8Array[] = [];
    const stderr: Uint8Array[] = [];
    let timedOut = false;
    let settled = false;
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      cancel();
      const err =
        decode(stderr) + (timedOut ? `\ngate: wrangler timed out after ${timeoutMs} ms and was killed\n` : "");
      resolvePromise({ exitCode: timedOut ? TIMED_OUT : (code ?? 1), stdout: decode(stdout), stderr: err });
    };
    const cancel = setTimer(() => {
      timedOut = true;
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.stdout?.on("data", (chunk: Uint8Array) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Uint8Array) => stderr.push(chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cancel();
      reject(error);
    });
    // After a kill, a grandchild could hold the pipes open, so the exit is enough.
    child.on("exit", (code) => {
      if (timedOut) finish(code);
    });
    child.on("close", (code) => finish(code));
  });
}

function decode(chunks: readonly Uint8Array[]): string {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  return new TextDecoder().decode(all);
}

/** The constant arguments after the Wrangler executable, per command. Nothing from outside the gate is added. */
function argsFor(command: WranglerCommand, bundle: SealedBundle, versionId: string | undefined): string[] {
  const configPath = bundle.configPath;
  switch (command) {
    case "dry-run":
      return ["deploy", "--config", configPath, "--dry-run"];
    case "upload":
      // A new version with no traffic; Wrangler prints "Worker Version ID: <id>". The tag is the sealed manifest's
      // (12 hex characters, derived from the sealed bytes only), so triggers can recognise this build's version.
      return ["versions", "upload", "--config", configPath, "--tag", manifestTag(bundle.manifest)];
    case "promote":
      return ["versions", "deploy", `${versionId}@100%`, "--config", configPath, "--yes"];
    case "rollback":
      return ["rollback", String(versionId), "--config", configPath, "--yes"];
    case "triggers":
      // `versions deploy` applies none of the config's triggers; this applies the definition's workers_dev and preview_urls.
      return ["triggers", "deploy", "--config", configPath];
  }
}

/** Passed on from the ambient environment when set. `HOME` and the two telemetry switches are always the gate's. */
const PASSED_ON = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"] as const;

/**
 * The child's PATH: this Node's own folder, then the system folders, never the ambient PATH (a planted tool earlier
 * on it would run with the token). `WRANGLER_OUTPUT_FILE_PATH` is not passed either: pointed into `site/`, it would
 * add a file after the scan.
 */
export const CHILD_PATH = `${dirname(process.execPath)}:/usr/bin:/bin`;

/**
 * The child's whole environment: the allow-listed ambient variables, telemetry off, and `HOME` set to a fresh
 * folder inside the sealed bundle (beside `site/`, never inside it), so no user-level Wrangler config or login is
 * read and the folder goes when the bundle does.
 */
function childEnv(bundle: SealedBundle, ambient: RunOptions["env"]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of PASSED_ON) {
    const value = ambient[key];
    if (value !== undefined) env[key] = value;
  }
  env.PATH = CHILD_PATH;
  env.HOME = mkdtempSync(join(bundle.dir, "home-"));
  env.WRANGLER_SEND_METRICS = "false";
  env.WRANGLER_SEND_ERROR_REPORTS = "false";
  return env;
}

/** A Workers version id: a lowercase UUID. The only value from outside the gate that may reach Wrangler's argv. */
export const VERSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Runs Wrangler in the sealed folder with a constant argv for `command` (privacy-wall design v2, section 3): always
 * `--config <bundle>/wrangler.json`, no pass-through arguments. The environment is rebuilt from an allow-list with a
 * fresh temporary `HOME`. `promote` and `rollback` need `versionId` (a `VERSION_ID`); the others refuse one, and
 * there is no untargeted rollback.
 */
export function runWrangler(
  bundle: SealedBundle,
  command: WranglerCommand,
  options: RunOptions,
  versionId?: string,
): Promise<SpawnResult> {
  const needsId = command === "promote" || command === "rollback";
  if (needsId !== (versionId !== undefined) || (versionId !== undefined && !VERSION_ID.test(versionId))) {
    return Promise.reject(new Error(`runWrangler: ${command} ${needsId ? "needs" : "takes no"} version id`));
  }
  return options.spawn({
    argv: [options.wrangler, ...argsFor(command, bundle, versionId)],
    cwd: bundle.dir,
    env: childEnv(bundle, options.env),
  });
}
