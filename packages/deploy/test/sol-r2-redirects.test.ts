/**
 * Security-sol round 2, S2-7, director decision 2: `_redirects` stays allow-listed, and its contents are validated.
 * Cloudflare applies redirects before `_headers` and before serving an asset, so one off-site rule sends every visitor
 * elsewhere. Every non-comment line must be `<from> <to> [status]`, where `<to>` is a same-site path (a single
 * leading `/`, no scheme, host, backslash, control character or encoded slash), the status is 301, 302, 303, 307,
 * 308 or 200, and splats and placeholders appear only in the path, never as its first segment (a splat holding
 * `/evil.example` would make `//evil.example`). Rules and line lengths are capped. Anything else is
 * `redirects-invalid`.
 */
import { rmSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { MAX_DYNAMIC_REDIRECTS, MAX_REDIRECT_LINE_LENGTH, MAX_STATIC_REDIRECTS } from "../src/redirects.ts";
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

const INVALID = [{ path: "_redirects", rule: "redirects-invalid" }];

describe("_redirects destinations stay on the site (S2-7)", () => {
  test.each([
    ["a plain redirect", "/old /new 301\n"],
    ["the default status", "/old /new\n"],
    ["every allowed status", "/a /b 301\n/c /d 302\n/e /f 303\n/g /h 307\n/i /j 308\n/k /l 200\n"],
    ["comments, blank lines and CRLF", "# moved pages\r\n\r\n/old /new 301\r\n"],
    ["a splat in a later segment", "/bags/* /catalogue/:splat 301\n"],
    ["a placeholder in a later segment", "/bags/:slug /catalogue/:slug 301\n"],
    ["a query on the destination", "/old /new?from=old 301\n"],
  ])("%s passes (positive control)", async (_name, text) => {
    expect(await problemsFor(text)).toEqual([]);
  });

  test.each([
    ["an off-site destination", "/* https://evil.example/:splat 302\n"],
    ["a protocol-relative destination", "/old //evil.example/ 301\n"],
    ["a scheme with no slashes", "/old javascript:alert(1) 301\n"],
    ["a data: destination", "/old data:text/html,x 301\n"],
    ["a backslash after the slash", "/old /\\evil.example 301\n"],
    ["a backslash later in the path", "/old /a\\b 301\n"],
    ["an encoded slash", "/old /%2F/evil.example 301\n"],
    ["an encoded slash in lower case", "/old /%2f%2fevil.example 301\n"],
    ["an encoded backslash", "/old /%5Cevil.example 301\n"],
    ["an encoded control character", "/old /%09/evil.example 301\n"],
    ["a control character inside the destination", "/old /\u0001/evil.example 301\n"],
    ["a tab splitting the destination", "/old /\t/evil.example 301\n"],
    ["a splat as the first segment", "/go/* /:splat 302\n"],
    ["a placeholder as the first segment", "/go/:to /:to 302\n"],
    ["a placeholder in the query", "/go/:to /out?to=:to 302\n"],
    ["a relative destination", "/old new 301\n"],
    ["a source that is not a path", "old /new 301\n"],
    ["a protocol-relative source", "//old /new 301\n"],
    ["an unknown status", "/old /new 404\n"],
    ["a status that is not a number", "/old /new permanent\n"],
    ["a fourth field", "/old /new 301 force\n"],
    ["one field", "/old\n"],
  ])("%s is redirects-invalid", async (_name, text) => {
    expect(await problemsFor(text)).toEqual(INVALID);
  });

  test("a line over the length cap is redirects-invalid; one at the cap passes", async () => {
    const at = `/old /${"a".repeat(MAX_REDIRECT_LINE_LENGTH - "/old /".length)}`;
    expect(at.length).toBe(MAX_REDIRECT_LINE_LENGTH);
    expect(await problemsFor(`${at}\n`)).toEqual([]);
    expect(await problemsFor(`${at}a\n`)).toEqual(INVALID);
  });

  test("more rules than Cloudflare's caps are redirects-invalid", async () => {
    const statics = Array.from({ length: MAX_STATIC_REDIRECTS + 1 }, (_, i) => `/s${i} /t${i} 301`).join("\n");
    expect(await problemsFor(statics)).toEqual(INVALID);
    const dynamics = Array.from({ length: MAX_DYNAMIC_REDIRECTS + 1 }, (_, i) => `/d${i}/* /t${i}/:splat 301`).join(
      "\n",
    );
    expect(await problemsFor(dynamics)).toEqual(INVALID);
  });

  test("the caps are Cloudflare's: 2,000 static and 100 dynamic rules, 1,000 characters a line", () => {
    expect([MAX_STATIC_REDIRECTS, MAX_DYNAMIC_REDIRECTS, MAX_REDIRECT_LINE_LENGTH]).toEqual([2000, 100, 1000]);
  });
});
