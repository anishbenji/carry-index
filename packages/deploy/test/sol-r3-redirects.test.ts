/**
 * Security round 3, S3-3 (independent review): two bypasses of the S2-7 `_redirects` check. Wrangler normalises a
 * destination through `new URL` (wrangler-dist/cli.js:68738), so dot segments collapse into `//evil.example`; and it
 * strips `\s+#.*$` and splits on `\s+`, which includes U+00A0, so a line the gate read as two site paths is to
 * Wrangler `/a https://evil.example/`. The reviewer's five lines are the first five cases.
 */
import { rmSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite } from "./helpers.ts";

const temps: TempDir[] = [];
const sealedDirs: string[] = [];
afterEach(() => {
  for (const dir of sealedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

async function problemsFor(redirects: string) {
  const site = minimalSite({ _redirects: redirects });
  temps.push(site);
  const result = await seal(site.root, PUBLIC_SITE);
  if (result.ok) sealedDirs.push(result.bundle.dir);
  return result.ok ? [] : result.problems;
}

const NBSP = "\u00a0";

describe("_redirects as Wrangler normalises and tokenises it (S3-3)", () => {
  test.each([
    ["a dot segment before a double slash (catch-all)", "/* /.//evil.example 301\n"],
    ["a dot-dot segment", "/old /a/..//evil.example 301\n"],
    ["an encoded dot-dot segment", "/old /a/%2e%2e//evil.example 301\n"],
    ["a dot-dot segment before a splat", "/go/* /x/../:splat 302\n"],
    ["NBSP separators and an inline comment", `/a${NBSP}https://evil.example/${NBSP}#x /b\n`],
    ["an upper-case encoded dot segment", "/old /%2E/%2E%2E//evil.example 301\n"],
    ["a single dot segment", "/old /a/./b 301\n"],
    ["a dot segment in the source", "/a/../b /c 301\n"],
    ["a non-ASCII letter", "/old /caf\u00e9 301\n"],
    ["a character the URL parser would re-encode", '/old /a"b 301\n'],
  ])("%s is redirects-invalid", async (_name, text) => {
    expect(await problemsFor(text)).toEqual([{ path: "_redirects", rule: "redirects-invalid" }]);
  });

  test.each([
    ["an inline comment after a valid rule", "/old /new 301 # moved\n"],
    ["tabs between fields", "/old\t/new\t301\n"],
    ["dots inside a segment name", "/old /a.b/..c/v1.2 301\n"],
  ])("%s passes, as Wrangler reads it (positive control)", async (_name, text) => {
    expect(await problemsFor(text)).toEqual([]);
  });
});
