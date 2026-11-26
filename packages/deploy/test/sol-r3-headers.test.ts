/**
 * Security round 3, S3-4 (independent review): JavaScript's `\s` splits on U+00A0, so the gate read
 * `default-src<NBSP>'none'` as a directive and passed; a browser splits directive names on ASCII whitespace only
 * (CSP3, "parse a serialized policy"), ignores the unknown names, and enforces no policy. Any required header value
 * with a character outside printable ASCII is `headers-invalid`, and CSP and HSTS split on ASCII whitespace only.
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

const NBSP = "\u00a0";
const CSP_LINE = MINIMAL_HEADERS.split("\n").find((l) => l.includes("Content-Security-Policy:")) ?? "";
const INVALID = { path: "_headers", rule: "headers-invalid" };

describe("required header values are printable ASCII (S3-4)", () => {
  test("the reviewer's CSP with NBSP between directive names and values is headers-invalid", () => {
    const csp = `  Content-Security-Policy: default-src${NBSP}'none'; frame-ancestors${NBSP}'none'`;
    expect(headersIn(MINIMAL_HEADERS.replace(CSP_LINE, csp))).toContainEqual(INVALID);
  });

  test.each([
    [
      "an NBSP inside the HSTS value",
      MINIMAL_HEADERS.replace("max-age=31536000; includeSubDomains", `max-age=31536000;${NBSP}includeSubDomains`),
    ],
    ["a non-ASCII letter in X-Content-Type-Options", MINIMAL_HEADERS.replace("nosniff", "nosnif\u00df")],
    // Inside the value: Wrangler trims each value with String.prototype.trim, as the gate does, so an edge one goes.
    [
      "an ideographic space in Referrer-Policy",
      MINIMAL_HEADERS.replace("strict-origin-when-cross-origin", "strict-origin\u3000when-cross-origin"),
    ],
    ["a vertical tab in the CSP", MINIMAL_HEADERS.replace("frame-ancestors 'none'", "frame-ancestors\u000b'none'")],
  ])("%s is headers-invalid", (_name, content) => {
    expect(headersIn(content)).toContainEqual(INVALID);
  });

  test("a CSP split by ASCII whitespace of every kind passes (positive control)", () => {
    expect(
      headersIn(MINIMAL_HEADERS.replace("default-src 'self'; script-src", "default-src\t'self';\tscript-src")),
    ).toEqual([]);
  });
});
