/**
 * Independent review (Neon) r3, on `_headers`.
 * - N14: a browser keeps the first of two directives with the same name in one policy (CSP3, "parse a serialized
 *   CSP") while the check kept the last, so `script-src 'self' https://evil.example; script-src 'self'` hid the
 *   third-party source. A directive named twice in one policy is now `headers-invalid`, and the check reads the first.
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

const CSP_LINE = MINIMAL_HEADERS.split("\n").find((l) => l.includes("Content-Security-Policy:")) ?? "";
const withCsp = (csp: string): string => MINIMAL_HEADERS.replace(CSP_LINE, `  Content-Security-Policy: ${csp}`);

describe("a CSP directive named twice (N14)", () => {
  test.each([
    [
      "script-src",
      "default-src 'self'; script-src 'self' https://evil.example; script-src 'self'; frame-ancestors 'none'",
    ],
    ["default-src", "default-src 'self' https://evil.example; default-src 'self'; frame-ancestors 'none'"],
    [
      "script-src-elem",
      "default-src 'self'; script-src 'self'; script-src-elem 'strict-dynamic'; script-src-elem 'self'; frame-ancestors 'none'",
    ],
    [
      "frame-ancestors, in another case",
      "default-src 'self'; script-src 'self'; frame-ancestors 'none'; FRAME-ANCESTORS *",
    ],
  ])("a repeated %s is headers-invalid", (_name, csp) => {
    expect(headersIn(withCsp(csp))).toContainEqual({ path: "_headers", rule: "headers-invalid" });
  });

  test("the first occurrence is the one checked: a weak first script-src is headers-weak", () => {
    const csp = "default-src 'self'; script-src 'self' https://evil.example; script-src 'self'; frame-ancestors 'none'";
    expect(headersIn(withCsp(csp))).toContainEqual({ path: "_headers", rule: "headers-weak" });
  });
});

/**
 * N17: the check trimmed whatever followed `! ` before testing the name, but Wrangler keeps it as written
 * (`line.trim().replace("! ", "")`, cli.js:68833), so `!  X-Powered-By` reached `Headers.delete` as " X-Powered-By"
 * and threw on every matching asset. Anything but a token after `! ` is now `headers-invalid`.
 */
describe("removed header names exactly as Wrangler keeps them (N17)", () => {
  const withExtra = (line: string): string => MINIMAL_HEADERS.replace("/assets/*\n", `/assets/*\n${line}\n`);

  test.each([
    ["two spaces", "  !  X-Powered-By"],
    ["a space and a tab", "  ! \tX-Powered-By"],
  ])("%s after the ! is headers-invalid", (_name, line) => {
    expect(headersIn(withExtra(line))).toContainEqual({ path: "_headers", rule: "headers-invalid" });
  });

  test("one space then a token passes (positive control)", () => {
    expect(headersIn(withExtra("  ! X-Powered-By"))).toEqual([]);
  });
});
