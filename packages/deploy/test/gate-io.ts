import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, relative, sep } from "node:path";
import { afterAll, expect, vi } from "vitest";
import type { Fetch } from "../src/check3.ts";
import type { CliIo } from "../src/cli.ts";
import type { Spawn, SpawnRequest, SpawnResult } from "../src/runner.ts";
import { REPO_ROOT } from "./helpers.ts";

export interface FakeIo {
  io: CliIo;
  /** Every line the gate logged through `io.log`. */
  lines: string[];
  spawned: SpawnRequest[];
  fetched: string[];
}

export interface FakeIoOptions {
  env?: Record<string, string | undefined>;
  spawn?: (request: SpawnRequest) => SpawnResult;
  fetch?: Fetch;
}

export const FAKE_WRANGLER = "/opt/cj-test/wrangler";

/**
 * The run temp folder every fake gate run uses (the gate writes its private diagnostics inside it), made on first use
 * and removed after the test file.
 */
let runTemp: string | undefined;
function runTempDir(): string {
  runTemp ??= mkdtempSync(`${tmpdir()}${sep}cj-test-run-`);
  return runTemp;
}
afterAll(() => {
  if (runTemp) rmSync(runTemp, { recursive: true, force: true });
  runTemp = undefined;
});

/** A gate IO whose spawner and fetch record every call. Both fail the test if called without an answer. */
export function fakeIo(options: FakeIoOptions = {}): FakeIo {
  const lines: string[] = [];
  const spawned: SpawnRequest[] = [];
  const fetched: string[] = [];
  const spawn: Spawn = async (request) => {
    spawned.push(request);
    if (!options.spawn) throw new Error(`unexpected spawn: ${request.argv.join(" ")}`);
    return options.spawn(request);
  };
  const fetch: Fetch = async (url, init) => {
    fetched.push(url);
    if (!options.fetch) throw new Error(`unexpected fetch: ${url}`);
    return options.fetch(url, init);
  };
  return {
    io: {
      log: (line) => lines.push(line),
      env: options.env ?? {},
      spawn,
      fetch,
      wrangler: FAKE_WRANGLER,
      tempDir: runTempDir(),
    },
    lines,
    spawned,
    fetched,
  };
}

/**
 * Captures everything written to the console or to stdout and stderr while `run` runs, so a gate that bypasses
 * `io.log` cannot hide output from a test.
 */
export async function captureConsole<T>(run: () => Promise<T>): Promise<{ value: T; output: string }> {
  const chunks: string[] = [];
  const record = (...data: unknown[]): void => {
    chunks.push(data.map(String).join(" "));
  };
  const spies = [
    vi.spyOn(console, "log").mockImplementation(record),
    vi.spyOn(console, "error").mockImplementation(record),
    vi.spyOn(console, "warn").mockImplementation(record),
    vi.spyOn(console, "info").mockImplementation(record),
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      record(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      record(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }),
  ];
  try {
    const value = await run();
    return { value, output: chunks.join("\n") };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/** The unkeyed SHA-256 prefix of a path: guessable from the name, so it must never be what the gate prints. */
export function unkeyedRef(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 8);
}

/** The reference for `path` under a run's key: the first 8 hex characters of HMAC-SHA-256(key, path). */
export function keyedRef(keyHex: string, path: string): string {
  return createHmac("sha256", Buffer.from(keyHex, "hex")).update(path).digest("hex").slice(0, 8);
}

const isInside = (path: string, dir: string): boolean => {
  const rel = relative(realpathSync(dir), path);
  return rel === "" || !(rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith(sep));
};

/** The diagnostics file a gate run named, its run key and its lines. */
export function diagnosticsOf(fake: FakeIo): { file: string; key: string; lines: string[] } {
  const named = fake.lines
    .map((l) => /^gate: full paths for the #references above are in (\S+) /.exec(l)?.[1])
    .find((p) => p !== undefined);
  expect(named, "the gate names its diagnostics file").toBeDefined();
  const file = realpathSync(named ?? "");
  const lines = readFileSync(file, "utf8").split("\n");
  const key = /^key ([0-9a-f]{64})$/.exec(lines[0] ?? "")?.[1];
  expect(key, "the diagnostics file starts with the run's 32-byte key").toBeDefined();
  return { file, key: key ?? "", lines };
}

/**
 * Security-sol r2, S2-10: a file problem is reported without its name. (a) One public line is exactly
 * `<rule>: #<index> <ref>`, where `<ref>` is the first 8 hex of HMAC-SHA-256 under the run's random key; (b) neither
 * the path, its file name, the key nor the path's unkeyed SHA-256 prefix appears anywhere in `output` (everything the
 * gate printed); (c) the diagnostics file the gate names holds the key and `#<index> <ref> <rule> "<path>"`, is
 * readable by its owner only, and lies inside the run temp folder and outside the site folder, the checkout and any
 * sealed (uploaded) folder.
 */
export function expectReportedPrivately(
  fake: FakeIo,
  output: string,
  path: string,
  rule: string,
  siteDir: string,
): void {
  const { file, key, lines } = diagnosticsOf(fake);
  const ref = keyedRef(key, path);
  const pattern = new RegExp(`^${rule}: #\\d+ ${ref}$`);
  const line = fake.lines.find((l) => pattern.test(l));
  expect(line, `a public line "${rule}: #<n> ${ref}"`).toBeDefined();
  const index = /#(\d+)/.exec(line ?? "")?.[1];
  expect(output).not.toContain(path);
  expect(output).not.toContain(basename(path));
  expect(output).not.toContain(key);
  expect(output).not.toContain(unkeyedRef(path));
  expect(isInside(file, fake.io.tempDir ?? "/nonexistent")).toBe(true);
  expect(isInside(file, siteDir)).toBe(false);
  expect(isInside(file, REPO_ROOT)).toBe(false);
  expect(basename(dirname(file))).toMatch(/^cj-gate-diagnostics-/);
  expect(statSync(file).mode & 0o077).toBe(0);
  expect(lines).toContain(`#${index} ${ref} ${rule} ${JSON.stringify(path)}`);
}
