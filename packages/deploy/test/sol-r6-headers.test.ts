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
