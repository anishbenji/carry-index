/**
 * Security-sol round 2, S2-6 and S2-8, on `_headers`:
 * - S2-6: browsers split a `Content-Security-Policy` value on commas into separate policies before parsing each
 *   (CSP3, "parse a serialized CSP list"), so `script-src 'unsafe-inline' 'self', frame-ancestors 'none'` reads to
 *   the gate as one policy whose sources end in a comma, and to a browser as two. Any comma in a CSP value, and a CSP
 *   set twice in one rule (which Cloudflare joins with a comma), is `headers-invalid`.
 * - S2-8: an HSTS value must parse in full (RFC 6797 section 6.1): exactly one `max-age` with a valid value of at
 *   least a year, and no directive twice; otherwise browsers ignore the header (`headers-weak`).
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

const HSTS = "max-age=31536000; includeSubDomains";
const withHsts = (value: string): string => MINIMAL_HEADERS.replace(HSTS, value);
const CSP_LINE = MINIMAL_HEADERS.split("\n").find((l) => l.includes("Content-Security-Policy:")) ?? "";

describe("CSP policy lists (S2-6)", () => {
  test("the minimal headers pass (positive control)", () => {
    expect(MINIMAL_HEADERS).toContain(HSTS);
    expect(headersIn(MINIMAL_HEADERS)).toEqual([]);
  });

  test("a comma-separated CSP whose first policy allows inline script is headers-invalid", () => {
    const csp =
      "  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline', frame-ancestors 'none'";
    const problems = headersIn(MINIMAL_HEADERS.replace(CSP_LINE, csp));
    expect(problems.map((p) => p.rule)).toContain("headers-invalid");
  });

  test("a comma anywhere in a CSP value is headers-invalid, even when both policies look strict", () => {
    const csp = `${CSP_LINE}, default-src 'self'; frame-ancestors 'none'`;
    expect(headersIn(MINIMAL_HEADERS.replace(CSP_LINE, csp))).toEqual([{ path: "_headers", rule: "headers-invalid" }]);
  });

  test("a CSP set twice in one rule is headers-invalid", () => {
    const twice = MINIMAL_HEADERS.replace(CSP_LINE, `${CSP_LINE}\n${CSP_LINE}`);
    expect(headersIn(twice)).toEqual([{ path: "_headers", rule: "headers-invalid" }]);
  });

  test("a strict CSP in another rule is still allowed: several policies are all enforced (positive control)", () => {
    const more = `${MINIMAL_HEADERS}\n/bags/*\n  Content-Security-Policy: default-src 'self'; frame-ancestors 'none'\n`;
    expect(headersIn(more)).toEqual([]);
  });
});

describe("HSTS is parsed in full (S2-8)", () => {
  test.each([
    ["a repeated max-age after a valid one", "max-age=31536000; max-age=0"],
    ["a repeated max-age before a valid one", "max-age=0; max-age=31536000"],
    ["a repeated includeSubDomains", "max-age=31536000; includeSubDomains; includeSubDomains"],
    ["a repeated directive in another case", "max-age=31536000; includeSubDomains; INCLUDESUBDOMAINS"],
    ["a non-numeric max-age", "max-age=31536000s"],
    ["an empty max-age", "max-age=; includeSubDomains"],
    ["no max-age at all", "includeSubDomains"],
    ["a max-age only as part of another name", "x-max-age=31536000"],
    ["a malformed directive", "max-age=31536000; include Sub Domains"],
    ["a short max-age", "max-age=60"],
  ])("%s is headers-weak", (_name, value) => {
    expect(headersIn(withHsts(value))).toEqual([{ path: "_headers", rule: "headers-weak" }]);
  });

  test.each([
    ["the usual form", "max-age=31536000; includeSubDomains"],
    ["preload and two years", "max-age=63072000; includeSubDomains; preload"],
    ["a quoted max-age", 'max-age="31536000"'],
    ["spaces around the parts", "max-age = 31536000 ;includeSubDomains"],
    ["a trailing semicolon", "max-age=31536000;"],
  ])("%s passes (positive control)", (_name, value) => {
    expect(headersIn(withHsts(value))).toEqual([]);
  });
});
