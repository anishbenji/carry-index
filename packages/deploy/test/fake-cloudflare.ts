import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Fetch } from "../src/check3.ts";
import type { SpawnRequest, SpawnResult } from "../src/runner.ts";
import { FIXTURES } from "./helpers.ts";

/**
 * A fake of the two things the gate talks to while deploying: Wrangler (through the injected spawner) and the
 * Cloudflare API (through the injected fetch). They share state, so `versions upload` adds a version the API then
 * shows, `versions deploy` and `rollback` add deployments, and the settings show the active version's bindings.
 * Replies follow the documented shapes; every value is synthetic.
 */

export const ACCOUNT = "0123456789abcdef0123456789abcdef";
export const TOKEN = "synthetic-token";
export const SCRIPT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/carry-journal`;
export const ENV = { PATH: "/usr/bin:/bin", CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
export const SITE_DRY_RUN = readFileSync(join(FIXTURES, "dry-run", "site.txt"), "utf8");
export const PREVIOUS = "66666666-7777-4888-9999-aaaaaaaaaaaa";
export const UPLOADED = "11111111-2222-4333-8444-555555555555";
export const D1 = { type: "d1", name: "DB", id: "00000000-0000-0000-0000-000000000000" };

export type Reply = { status: number; body: string } | Error;

export interface FakeCloudflareOptions {
  /** The version live before the deploy; none for a first deploy. */
  previous?:
    | { bindings: readonly unknown[] /** Its `workers/tag` annotation; none when absent. */; tag?: unknown }
    | undefined;
  /** The bindings the uploaded version gets. */
  uploadBindings?: readonly unknown[];
  /** The script-level tail consumers (`undefined` leaves the field out of the reply). */
  tailConsumers?: unknown;
  uploadExit?: number;
  /** What `versions upload` prints; the version id line by default. */
  uploadStdout?: string;
  promoteExit?: number;
  /** Bindings that appear on the live Worker after promotion (a change made after the gate's check). */
  bindingsAfterPromotion?: readonly unknown[];
  /** Tail consumers attached to the script after promotion (a script-level setting no rollback changes). */
  tailConsumersAfterPromotion?: unknown;
  /** Bindings the live Worker still shows after a rollback. */
  bindingsAfterRollback?: readonly unknown[];
  /** Runs before each API reply; return a reply to answer with it instead (an outage, a bad body). */
  intercept?: (url: string, call: number) => Reply | undefined;
  /**
   * No `carry-journal` script exists: every script API read is a 404 with code 10007 (Wrangler's
   * `isWorkerNotFoundError`, cli.js:59814), and `versions upload` refuses as Wrangler does (cli.js:70109).
   */
  missing?: boolean;
  /** The script's workers.dev and preview-URL settings; the definition's values by default. */
  subdomain?: { enabled?: boolean; previews_enabled?: boolean };
  /** Whether `triggers deploy` applies the definition's subdomain settings (default true). */
  triggersApply?: boolean;
  /** Every API call after a successful promotion fails (an outage right after it). */
  apiDownAfterPromotion?: boolean;
  /** Runs when the gate re-reads the deployments before promoting (to model a concurrent deploy). */
  beforePromoteCheck?: (state: FakeState) => void;
}

export interface FakeState {
  subdomain: { enabled?: boolean; previews_enabled?: boolean };
  deployments: Array<{ id: string; versions: Array<{ version_id: string; percentage: number }> }>;
  versions: Map<string, { bindings: readonly unknown[]; tag?: unknown }>;
  live: readonly unknown[] | undefined;
}

export interface FakeCloudflare {
  spawn: (request: SpawnRequest) => SpawnResult;
  fetch: Fetch;
  state: FakeState;
  commands: string[];
}

const ok = (result: unknown): string => JSON.stringify({ success: true, errors: [], messages: [], result });

export function fakeCloudflare(options: FakeCloudflareOptions = {}): FakeCloudflare {
  const state: FakeState = {
    deployments: [],
    versions: new Map(),
    live: undefined,
    subdomain: options.subdomain ?? { enabled: true, previews_enabled: false },
  };
  if (options.previous) {
    state.versions.set(PREVIOUS, { bindings: options.previous.bindings, tag: options.previous.tag });
    state.deployments.unshift({ id: "d-previous", versions: [{ version_id: PREVIOUS, percentage: 100 }] });
  }
  const commands: string[] = [];
  let deploymentsRead = 0;
  let calls = 0;
  let promoted = false;
  let tail: unknown = options.tailConsumers;
  const activeBindings = (): readonly unknown[] => {
    if (state.live) return state.live;
    const id = state.deployments[0]?.versions[0]?.version_id;
    return (id && state.versions.get(id)?.bindings) || [];
  };
  const spawn = (request: SpawnRequest): SpawnResult => {
    const [, first, second, third] = request.argv;
    if (first === "deploy" && request.argv.includes("--dry-run")) {
      commands.push("dry-run");
      return { exitCode: 0, stdout: SITE_DRY_RUN, stderr: "" };
    }
    if (first === "triggers" && second === "deploy") {
      commands.push("triggers");
      if (options.missing) return { exitCode: 1, stdout: "", stderr: "" };
      if (options.triggersApply !== false) state.subdomain = { enabled: true, previews_enabled: false };
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    if (first === "versions" && second === "upload") {
      commands.push("upload");
      if (options.missing) {
        const refusal =
          "You cannot upload a new version of a Worker that does not yet exist. Please run the `deploy` command first.";
        return { exitCode: 1, stdout: "", stderr: `✘ [ERROR] ${refusal}\n` };
      }
      const exitCode = options.uploadExit ?? 0;
      // `--tag <value>` is stored as the version's `workers/tag` annotation, as Wrangler sends it (cli.js:70726).
      const tagAt = request.argv.indexOf("--tag");
      const tag = tagAt === -1 ? undefined : request.argv[tagAt + 1];
      if (exitCode === 0) state.versions.set(UPLOADED, { bindings: options.uploadBindings ?? [], tag });
      return {
        exitCode,
        stdout: options.uploadStdout ?? `Uploaded carry-journal\nWorker Version ID: ${UPLOADED}\n`,
        stderr: "",
      };
    }
    if (first === "versions" && second === "deploy") {
      commands.push(`promote ${third}`);
      const exitCode = options.promoteExit ?? 0;
      if (exitCode === 0) {
        const id = String(third).replace(/@100%$/, "");
        state.deployments.unshift({ id: `d-${id}`, versions: [{ version_id: id, percentage: 100 }] });
        state.live = options.bindingsAfterPromotion;
        promoted = true;
        if (options.tailConsumersAfterPromotion !== undefined) tail = options.tailConsumersAfterPromotion;
      }
      return { exitCode, stdout: "", stderr: "" };
    }
    if (first === "rollback") {
      commands.push(`rollback ${second}`);
      state.deployments.unshift({
        id: `d-rollback-${second}`,
        versions: [{ version_id: String(second), percentage: 100 }],
      });
      state.live = options.bindingsAfterRollback;
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    throw new Error(`fake wrangler: unexpected ${request.argv.slice(1).join(" ")}`);
  };
  const fetch: Fetch = async (url) => {
    calls++;
    if (promoted && options.apiDownAfterPromotion) throw new Error("network down");
    const intercepted = options.intercept?.(url, calls);
    if (intercepted instanceof Error) throw intercepted;
    if (intercepted) return { status: intercepted.status, text: async () => intercepted.body };
    if (options.missing && url.startsWith(SCRIPT)) {
      const missing = { success: false, errors: [{ code: 10007, message: "workers.api.error.script_not_found" }] };
      return { status: 404, text: async () => JSON.stringify(missing) };
    }
    let body: string;
    if (url === `${SCRIPT}/subdomain`) {
      body = ok(state.subdomain);
    } else if (url === `${SCRIPT}/deployments`) {
      deploymentsRead++;
      if (deploymentsRead === 2) options.beforePromoteCheck?.(state);
      body = ok({ deployments: state.deployments });
    } else if (url.startsWith(`${SCRIPT}/versions/`)) {
      const id = decodeURIComponent(url.slice(`${SCRIPT}/versions/`.length));
      const version = state.versions.get(id);
      if (!version)
        return { status: 404, text: async () => JSON.stringify({ success: false, errors: [], result: null }) };
      const annotations = version.tag === undefined ? {} : { annotations: { "workers/tag": version.tag } };
      body = ok({
        id,
        number: 1,
        ...annotations,
        resources: { bindings: version.bindings, script: {}, script_runtime: {} },
      });
    } else if (url === `${SCRIPT}/settings`) {
      const result: Record<string, unknown> = { bindings: activeBindings(), compatibility_date: "2026-11-01" };
      if (tail !== undefined) result.tail_consumers = tail;
      body = ok(result);
    } else {
      return { status: 404, text: async () => "{}" };
    }
    return { status: 200, text: async () => body };
  };
  return { spawn, fetch, state, commands };
}
