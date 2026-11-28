/**
 * Sol security r4, on `_headers`.
 * - S6-2: a header name with a tab passed both the gate and Wrangler's parser, then made Cloudflare's `Headers.set`
 *   throw on every asset the rule matched. Every set and removed header name must be an RFC 9110 token, and every
 *   value only visible ASCII, spaces and tabs (no CR, LF or other control character): `headers-invalid`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { checkHeaders } from "../src/headers.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function headersIn(content: string): ReturnType<typeof checkHeaders> {
  const dir = tempDir("cj-headers-");
  temps.push(dir);
  writeTree(dir.root, { _headers: content });
  return checkHeaders(dir.root, { requireFile: true });
}

const INVALID = { path: "_headers", rule: "headers-invalid" };
const withExtra = (line: string): string => MINIMAL_HEADERS.replace("/assets/*\n", `/assets/*\n${line}\n`);

describe("every header name is a token and every value plain text (S6-2)", () => {
  test.each([
    [
      "a tab inside a catch-all header name",
      MINIMAL_HEADERS.replace("  Referrer-Policy:", "  X-Extra\tName: v\n  Referrer-Policy:"),
    ],
    ["a tab inside a header name on another rule", withExtra("  X-Extra\tName: v")],
    ["a separator character in a header name", withExtra("  X/Bad: v")],
    ["a non-ASCII letter in a header name", withExtra("  X-Caf\u00e9: v")],
    ["a tab inside a removed header name", withExtra("  ! X-Extra\tName")],
    ["a control character in a value", withExtra("  X-Note: a\u0001b")],
    ["a carriage return inside a value", withExtra("  X-Note: a\rb")],
    ["a non-ASCII letter in a value", withExtra("  X-Note: caf\u00e9")],
  ])("%s is headers-invalid", (_name, content) => {
    expect(headersIn(content)).toContainEqual(INVALID);
  });

  test("token names and plain values pass (positive control)", () => {
    expect(headersIn(withExtra("  X-Robots-Tag: noindex, nofollow\n  ! X-Powered-By"))).toEqual([]);
  });
});

/**
 * S6-5: the CSP check refused wildcards and bare schemes but accepted an explicit third-party origin as a script
 * source, so a CDN could serve the site any script. The directives that govern scripts (`script-src`, or
 * `default-src` when there is none; `script-src-elem` and `script-src-attr` too) may hold only `'self'`, `'none'` and
 * `'sha256-'`, `'sha384-'` or `'sha512-'` hashes.
 */
describe("script sources are same-origin or hashes only (S6-5)", () => {
  const WEAK = [{ path: "_headers", rule: "headers-weak" }];
  const CSP_LINE = MINIMAL_HEADERS.split("\n").find((l) => l.includes("Content-Security-Policy:")) ?? "";
  const withCsp = (csp: string): string => MINIMAL_HEADERS.replace(CSP_LINE, `  Content-Security-Policy: ${csp}`);

  test.each([
    [
      "a third-party origin in script-src",
      "default-src 'self'; script-src 'self' https://cdn.example.com; frame-ancestors 'none'",
    ],
    [
      "a third-party origin in default-src with no script-src",
      "default-src 'self' https://cdn.example.com; frame-ancestors 'none'",
    ],
    [
      "a third-party origin in script-src-elem",
      "default-src 'self'; script-src 'self'; script-src-elem https://cdn.example.com; frame-ancestors 'none'",
    ],
    ["'strict-dynamic'", "default-src 'self'; script-src 'self' 'strict-dynamic'; frame-ancestors 'none'"],
    ["'report-sample'", "default-src 'self'; script-src 'self' 'report-sample'; frame-ancestors 'none'"],
    ["a malformed hash", "default-src 'self'; script-src 'self' 'sha1-AAAA'; frame-ancestors 'none'"],
  ])("%s is headers-weak", (_name, csp) => {
    expect(headersIn(withCsp(csp))).toEqual(WEAK);
  });

  test.each([
    [
      "'self' and a sha256 hash",
      "default-src 'self'; script-src 'self' 'sha256-8CUbeTkNF81cttU2jYUxGhau4N96/fwsZtRPn7Bz1Nc='; frame-ancestors 'none'",
    ],
    [
      "sha384 and sha512 hashes",
      "default-src 'self'; script-src 'sha384-AbCd+/9=' 'sha512-XyZ0'; frame-ancestors 'none'",
    ],
    ["'none' for scripts", "default-src 'self'; script-src 'none'; frame-ancestors 'none'"],
    [
      "a third-party origin outside the script directives",
      "default-src 'self'; script-src 'self'; img-src 'self' https://img.example.com; frame-ancestors 'none'",
    ],
  ])("%s passes (positive control)", (_name, csp) => {
    expect(headersIn(withCsp(csp))).toEqual([]);
  });
});
