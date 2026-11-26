import type { CheckResult, Problem } from "./problems.ts";
import { VERSION_ID } from "./runner.ts";
import type { SetTimer } from "./timer.ts";
import { realTimer } from "./timer.ts";
import type { BeaconWorker, PublicWorker } from "./workers.ts";
import { isAssetsOnly } from "./workers.ts";

/** The part of `fetch` the live check uses, so tests can answer with recorded replies. */
/** A reply as the live check reads it: the platform `Response` fits, and test fakes may give `text()` only. */
export interface FetchReply {
  status: number;
  /** The decoded body as a stream, when there is one; read with a byte cap. */
  body?: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

export type Fetch = (
  url: string,
  init: { method: "GET"; headers: Readonly<Record<string, string>>; signal?: AbortSignal },
) => Promise<FetchReply>;

/** The most of a Cloudflare API reply the gate reads (sol security r3, S5-9); settings replies are a few KiB. */
export const MAX_API_REPLY_BYTES = 1024 * 1024;

/**
 * A reply's text, read with a cap on its decoded bytes (sol security r3, S5-9): from the body stream when there is
 * one, which is cancelled as soon as the count passes `maxBytes`, otherwise from `text()`, checked after. Rejects
 * over the cap; the caller turns that into a `live-api-error`.
 */
export async function readCapped(reply: Pick<FetchReply, "body" | "text">, maxBytes: number): Promise<string> {
  const tooLarge = (): Error => new Error(`API reply over the ${maxBytes}-byte cap`);
  if (!reply.body) {
    const text = await reply.text();
    if (new TextEncoder().encode(text).length > maxBytes) throw tooLarge();
    return text;
  }
  const reader = reply.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  return new TextDecoder().decode(all);
}

/** Rejects `promise` once `ms` pass on `setTimer`; the timer is cancelled when it settles first. */
function withDeadline<T>(promise: Promise<T>, ms: number, setTimer: SetTimer, onTimeout = (): void => {}): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false;
    const cancel = setTimer(() => {
      if (done) return;
      done = true;
      onTimeout();
      reject(new Error(`request timed out after ${ms} ms`));
    }, ms);
    promise.then(
      (value) => {
        if (done) return;
        done = true;
        cancel();
        resolve(value);
      },
      (error: unknown) => {
        if (done) return;
        done = true;
        cancel();
        reject(error);
      },
    );
  });
}

/**
 * Wraps a fetch so a request that has not answered within `ms` is aborted (through its signal) and rejected even
 * if the fetch ignores the signal; reading the body gets the same allowance. A rejection is a `live-api-error`.
 */
export function withTimeout(fetch: Fetch, ms: number, setTimer: SetTimer = realTimer): Fetch {
  return (url, init) => {
    const controller = new AbortController();
    const reply = withDeadline(fetch(url, { ...init, signal: controller.signal }), ms, setTimer, () =>
      controller.abort(),
    );
    return reply.then((r) => ({
      status: r.status,
      // The body is read here, under the same deadline and with the byte cap.
      text: () => withDeadline(readCapped(r, MAX_API_REPLY_BYTES), ms, setTimer, () => controller.abort()),
    }));
  };
}

/**
 * Check 3 before upload (privacy-wall design v2, section 4): `wrangler deploy --dry-run` output must show exactly
 * the worker's expected bindings: "No bindings found." for the site, the one Analytics Engine row for the beacon.
 * Any other bindings output fails, so a format change fails closed.
 */
export function checkDryRun(worker: PublicWorker, output: string): CheckResult {
  const ok = isAssetsOnly(worker) ? siteDryRunOk(output) : beaconDryRunOk(worker, output);
  return ok ? { ok: true, problems: [] } : { ok: false, problems: [{ path: worker.name, rule: "dry-run-output" }] };
}

const NO_BINDINGS = "No bindings found.";
const BINDINGS_HEADING = "Your Worker has access to the following bindings:";
const DRY_RUN_END = "--dry-run: exiting now.";

function lines(output: string): string[] {
  return output.split(/\r?\n/).map((line) => line.trimEnd());
}

function count(all: readonly string[], line: string): number {
  return all.filter((l) => l === line).length;
}

/** Lines shared by both checks: the run reached its end, no binding row and no extra module appears elsewhere. */
function commonOk(all: readonly string[], allowedRow?: number): boolean {
  if (count(all, DRY_RUN_END) !== 1) return false;
  if (all.some((l) => /additional modules/i.test(l))) return false;
  return all.every((l, i) => i === allowedRow || !/^\s*env\./.test(l));
}

/** The site: exactly one "No bindings found." line and no bindings table anywhere. */
function siteDryRunOk(output: string): boolean {
  const all = lines(output);
  return count(all, NO_BINDINGS) === 1 && count(all, BINDINGS_HEADING) === 0 && commonOk(all);
}

/** The beacon: the bindings table holds exactly its one Analytics Engine row, followed by a blank line. */
function beaconDryRunOk(worker: BeaconWorker, output: string): boolean {
  const all = lines(output);
  const [dataset] = worker.analytics_engine_datasets;
  if (count(all, NO_BINDINGS) !== 0 || count(all, BINDINGS_HEADING) !== 1) return false;
  const at = all.indexOf(BINDINGS_HEADING);
  const row = new RegExp(
    `^env\\.${escapeRegExp(dataset.binding)} \\(${escapeRegExp(dataset.dataset)}\\)\\s+Analytics Engine Dataset$`,
  );
  return (
    /^Binding\s+Resource$/.test(all[at + 1] ?? "") &&
    row.test(all[at + 2] ?? "") &&
    (all[at + 3] ?? "") === "" &&
    commonOk(all, at + 2)
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface LiveCheckOptions {
  accountId: string;
  apiToken: string;
  fetch: Fetch;
  /** Runs `wrangler rollback` for this worker. Called once when the live check fails. */
  rollback: () => Promise<void>;
}

/**
 * Check 3 after deploy, the second alarm: `GET /accounts/{id}/workers/scripts/{name}/settings` must show exactly the
 * expected `bindings` and `tail_consumers`. Any mismatch, non-200 reply, malformed body or request error fails closed
 * and triggers the rollback. Never throws.
 *
 * Kept for the T7 contract tests that specify it. The gate no longer calls it: after upload, verify, then promote it
 * runs `checkLive` and rolls back only to a verified previous version by id (`cli.ts`).
 */
export async function confirmLive(worker: PublicWorker, options: LiveCheckOptions): Promise<CheckResult> {
  const problems = await liveProblems(worker, options);
  if (problems.length === 0) return { ok: true, problems: [] };
  try {
    await options.rollback();
  } catch {
    // The rollback reports its own outcome; the live check has already failed either way.
  }
  return { ok: false, problems };
}

/**
 * The same live settings check without a rollback: used once more after a rollback, to confirm the Worker is
 * clean again. Never throws.
 */
export async function checkLive(
  worker: PublicWorker,
  options: Omit<LiveCheckOptions, "rollback">,
): Promise<CheckResult> {
  const problems = await liveProblems(worker, options);
  return { ok: problems.length === 0, problems };
}

/** The bindings the live Worker must show, in the settings API's shape. */
function expectedBindings(worker: PublicWorker): Array<{ type: string; name: string; dataset: string }> {
  if (isAssetsOnly(worker)) return [];
  return worker.analytics_engine_datasets.map((d) => ({
    type: "analytics_engine",
    name: d.binding,
    dataset: d.dataset,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bindingMatches(actual: unknown, expected: { type: string; name: string; dataset: string }): boolean {
  return (
    isRecord(actual) &&
    actual.type === expected.type &&
    actual.name === expected.name &&
    actual.dataset === expected.dataset
  );
}

/**
 * One Cloudflare API GET: the `result` of a 200 reply with `success: true`, and whether the reply said the script
 * does not exist (error code 10007 or 10090, as Wrangler's `isWorkerNotFoundError` reads it, cli.js:59814). Never
 * throws.
 */
async function apiReply(
  options: Omit<LiveCheckOptions, "rollback">,
  path: string,
): Promise<{ result: Record<string, unknown> | undefined; notFound: boolean; status: number | undefined }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}${path}`;
  try {
    const reply = await options.fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${options.apiToken}`, Accept: "application/json" },
    });
    const status = reply.status;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readCapped(reply, MAX_API_REPLY_BYTES));
    } catch {
      return { result: undefined, notFound: false, status };
    }
    if (!isRecord(parsed)) return { result: undefined, notFound: false, status };
    const codes = Array.isArray(parsed.errors) ? parsed.errors.map((e) => (isRecord(e) ? e.code : undefined)) : [];
    const notFound = reply.status === 404 && codes.some((c) => c === 10007 || c === 10090);
    const ok = reply.status === 200 && parsed.success === true && isRecord(parsed.result);
    return { result: ok && isRecord(parsed.result) ? parsed.result : undefined, notFound, status };
  } catch {
    return { result: undefined, notFound: false, status: undefined };
  }
}

async function apiResult(
  options: Omit<LiveCheckOptions, "rollback">,
  path: string,
): Promise<{ result: Record<string, unknown> | undefined; status: number | undefined }> {
  const { result, status } = await apiReply(options, path);
  return { result, status };
}

/** A `live-api-error` problem, with the HTTP status when the reply had one other than 200. */
function apiError(worker: PublicWorker, status: number | undefined): Problem {
  return status === undefined || status === 200
    ? { path: worker.name, rule: "live-api-error" }
    : { path: worker.name, rule: "live-api-error", status };
}

const scriptPath = (worker: PublicWorker): string => `/workers/scripts/${encodeURIComponent(worker.name)}`;

function bindingsMatch(worker: PublicWorker, bindings: readonly unknown[]): boolean {
  const expected = expectedBindings(worker);
  return (
    bindings.length === expected.length &&
    expected.every((e) => bindings.filter((b) => bindingMatches(b, e)).length === 1)
  );
}

/**
 * `tail_consumers` is optional in the settings reply (absent or null means none); anything but a list is not
 * confirmed. Checked on its own, so a malformed field never hides a binding problem or the other way round.
 */
function tailProblem(worker: PublicWorker, tail: unknown): Problem | undefined {
  if (tail === undefined || tail === null) return undefined;
  if (!Array.isArray(tail)) return { path: worker.name, rule: "live-api-error" };
  return tail.length === 0 ? undefined : { path: worker.name, rule: "live-tail-consumers" };
}

/** Absent or null; otherwise must be a boolean. Undefined when it is neither (unconfirmed). */
function flag(value: unknown): boolean | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "boolean" ? value : undefined;
}

/**
 * External observability export (sol security r3, S5-8): `observability.logs.destinations` or
 * `observability.traces.destinations` non-empty sends invocation logs or traces to an outside destination
 * (`live-observability-export`), unless that section or `observability` itself is explicitly disabled. Field names
 * as Wrangler 4.168.0 reads the settings reply (cli.js:199880). Absent or null is off; the wrong type is
 * `live-api-error`.
 */
function observabilityProblems(worker: PublicWorker, observability: unknown): Problem[] {
  const unconfirmed: Problem[] = [{ path: worker.name, rule: "live-api-error" }];
  if (observability === undefined || observability === null) return [];
  if (!isRecord(observability)) return unconfirmed;
  const on = flag(observability.enabled);
  if (on === undefined) return unconfirmed;
  let exporting = false;
  for (const section of [observability.logs, observability.traces]) {
    if (section === undefined || section === null) continue;
    if (!isRecord(section)) return unconfirmed;
    const enabled = flag(section.enabled);
    const destinations = section.destinations;
    if (enabled === undefined) return unconfirmed;
    if (destinations === undefined || destinations === null) continue;
    if (!Array.isArray(destinations)) return unconfirmed;
    if (destinations.length > 0 && on !== false && enabled !== false) exporting = true;
  }
  return exporting ? [{ path: worker.name, rule: "live-observability-export" }] : [];
}

/**
 * The script-level settings that link the public Worker to anything else (security r3, S3-6): `tail_consumers` and
 * `streaming_tail_consumers` must be none (`live-tail-consumers`), and `logpush` must be off (`live-logpush`: no log
 * destination is approved for Release 1). Each is checked on its own; absent or null reads as none or off, and a
 * value of the wrong type is unconfirmed (`live-api-error`).
 */
function scriptSettingProblems(worker: PublicWorker, settings: Record<string, unknown>): Problem[] {
  const problems: Problem[] = [];
  for (const field of [settings.tail_consumers, settings.streaming_tail_consumers]) {
    const problem = tailProblem(worker, field);
    if (problem) problems.push(problem);
  }
  problems.push(...observabilityProblems(worker, settings.observability));
  const logpush = settings.logpush;
  if (logpush === true) problems.push({ path: worker.name, rule: "live-logpush" });
  else if (logpush !== undefined && logpush !== null && logpush !== false) {
    problems.push({ path: worker.name, rule: "live-api-error" });
  }
  return problems;
}

/** The live settings: the active version's `bindings` (which must be a list) and the script's tail consumers. */
async function liveProblems(worker: PublicWorker, options: Omit<LiveCheckOptions, "rollback">): Promise<Problem[]> {
  const { result, status } = await apiResult(options, `${scriptPath(worker)}/settings`);
  if (!result) return [apiError(worker, status)];
  const problems: Problem[] = [];
  if (!Array.isArray(result.bindings)) problems.push({ path: worker.name, rule: "live-api-error" });
  else if (!bindingsMatch(worker, result.bindings)) problems.push({ path: worker.name, rule: "live-bindings" });
  problems.push(...scriptSettingProblems(worker, result));
  return sortedUnique(problems);
}

/**
 * Check 3 on an uploaded version before it gets traffic: `GET .../versions/{id}` must be that version and list
 * exactly the expected `resources.bindings` (Wrangler itself reads them there), and the script-level
 * `tail_consumers` from the settings must be none. Anything unconfirmed is `live-api-error`. Never throws.
 */
export async function checkVersion(
  worker: PublicWorker,
  options: Omit<LiveCheckOptions, "rollback">,
  versionId: string,
): Promise<CheckResult> {
  const problems: Problem[] = [];
  const versionReply = await apiResult(options, `${scriptPath(worker)}/versions/${encodeURIComponent(versionId)}`);
  const version = versionReply.result;
  const resources = version && version.id === versionId && isRecord(version.resources) ? version.resources : undefined;
  if (!resources || !Array.isArray(resources.bindings)) problems.push(apiError(worker, versionReply.status));
  else if (!bindingsMatch(worker, resources.bindings)) problems.push({ path: worker.name, rule: "live-bindings" });
  const { result: settings, status: settingsStatus } = await apiResult(options, `${scriptPath(worker)}/settings`);
  if (!settings) problems.push(apiError(worker, settingsStatus));
  else problems.push(...scriptSettingProblems(worker, settings));
  return { ok: problems.length === 0, problems: sortedUnique(problems) };
}

function sortedUnique(problems: readonly Problem[]): Problem[] {
  return [...new Map(problems.map((p) => [p.rule, p])).values()].sort((a, b) => (a.rule < b.rule ? -1 : 1));
}

/** The Worker's active deployment, newest first as Wrangler reads it (cli.js:62071, `.at(0)`). */
export type ActiveDeployment =
  | { ok: false; missing?: true; status?: number }
  | { ok: true; id: string | undefined; versions: ReadonlyArray<{ id: string; percentage: number }> };

export async function activeDeployment(
  worker: PublicWorker,
  options: Omit<LiveCheckOptions, "rollback">,
): Promise<ActiveDeployment> {
  const { result, notFound, status } = await apiReply(options, `${scriptPath(worker)}/deployments`);
  if (notFound) return { ok: false, missing: true };
  if (!result || !Array.isArray(result.deployments))
    return status === undefined ? { ok: false } : { ok: false, status };
  const [latest] = result.deployments;
  if (latest === undefined) return { ok: true, id: undefined, versions: [] };
  if (!isRecord(latest) || typeof latest.id !== "string" || !Array.isArray(latest.versions)) return { ok: false };
  const versions: Array<{ id: string; percentage: number }> = [];
  for (const v of latest.versions) {
    if (!isRecord(v) || typeof v.version_id !== "string" || typeof v.percentage !== "number") return { ok: false };
    versions.push({ id: v.version_id, percentage: v.percentage });
  }
  return { ok: true, id: latest.id, versions };
}

/** The one version a deployment serves at 100%, if it is exactly that. */
export function soleVersion(deployment: ActiveDeployment): string | undefined {
  if (!deployment.ok || deployment.versions.length !== 1) return undefined;
  const [only] = deployment.versions;
  return only && only.percentage === 100 && VERSION_ID.test(only.id) ? only.id : undefined;
}

/** The shape of a tag the gate writes: `manifestTag`'s 12 lower-case hex characters. */
const MANIFEST_TAG = /^[0-9a-f]{12}$/;

/**
 * A version's `workers/tag` annotation (`GET .../versions/{id}`, `annotations["workers/tag"]`, as Wrangler reads it,
 * cli.js:62173). `untagged` when the reply has no such annotation, or one that is not a non-empty string; an
 * unreadable reply is an API error. Never throws.
 */
export async function versionTag(
  worker: PublicWorker,
  options: Omit<LiveCheckOptions, "rollback">,
  versionId: string,
): Promise<
  | { ok: true; tag: string }
  | { ok: false; untagged: true }
  | { ok: false; foreign: true }
  | { ok: false; status: number | undefined }
> {
  const { result, status } = await apiResult(
    options,
    `${scriptPath(worker)}/versions/${encodeURIComponent(versionId)}`,
  );
  if (!result || result.id !== versionId) return { ok: false, status };
  const annotations = result.annotations;
  const tag = isRecord(annotations) ? annotations["workers/tag"] : undefined;
  if (typeof tag !== "string" || tag === "") return { ok: false, untagged: true };
  // Validated at the boundary (sol security r4, S6-3): only the gate's own shape, 12 lower-case hex characters, is
  // passed on; any other tag is foreign and its value is dropped, so it can never reach a log.
  return MANIFEST_TAG.test(tag) ? { ok: true, tag } : { ok: false, foreign: true };
}

/** The id `wrangler versions upload` prints (`Worker Version ID: <id>`, cli.js:70849), if any. */
export function uploadedVersion(output: string): string | undefined {
  const id = /^Worker Version ID: (\S+)$/m.exec(output)?.[1];
  return id !== undefined && VERSION_ID.test(id) ? id : undefined;
}

/**
 * The script's workers.dev and preview-URL settings (`GET .../workers/scripts/{name}/subdomain`, the read Wrangler
 * falls back to at cli.js:60556) must equal the definition's `workers_dev` and `preview_urls`; an absent field reads
 * as false, as Wrangler reads it (cli.js:60558-60562). `versions upload` and `versions deploy` apply neither, so a
 * mismatch means `wrangler triggers deploy` has not run or was undone. Never throws.
 */
export async function checkSubdomain(
  worker: PublicWorker,
  options: Omit<LiveCheckOptions, "rollback">,
  /** Also accept workers.dev off (the first deploy runs with both public hostnames off, S5-5). */
  allowWorkersDevOff = false,
): Promise<CheckResult> {
  const { result, status } = await apiResult(options, `${scriptPath(worker)}/subdomain`);
  if (!result) return { ok: false, problems: [apiError(worker, status)] };
  const enabled = result.enabled ?? false;
  const previews = result.previews_enabled ?? false;
  if (typeof enabled !== "boolean" || typeof previews !== "boolean") {
    return { ok: false, problems: [{ path: worker.name, rule: "live-api-error" }] };
  }
  return (enabled === worker.workers_dev || (allowWorkersDevOff && !enabled)) && previews === worker.preview_urls
    ? { ok: true, problems: [] }
    : { ok: false, problems: [{ path: worker.name, rule: "live-subdomain" }] };
}
