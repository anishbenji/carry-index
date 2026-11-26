/**
 * Check 2, `_headers` as Cloudflare parses it (GPT-6.2 Sol security round 1, P1). The rules mirror Wrangler 4.168.0's
 * `parseHeaders` (wrangler-dist/cli.js:68765): at most 100 rules and 2,000 characters a line
 * (https://developers.cloudflare.com/workers/static-assets/headers/), and every parser warning is a failure.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { checkHeaders } from "../src/headers.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, PR8_EXTERNAL, PR8_INLINE, REPO_ROOT, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function headersIn(content: string): ReturnType<typeof checkHeaders> {
  const dir = tempDir("cj-headers-");
  temps.push(dir);
  writeTree(dir.root, { _headers: content });
  return checkHeaders(dir.root);
}

describe("_headers as Cloudflare parses it", () => {
  test.each([
    ["PR 8 inline", readFileSync(join(PR8_INLINE, "_headers"), "utf8")],
    ["PR 8 external", readFileSync(join(PR8_EXTERNAL, "_headers"), "utf8")],
    ["apps/web/public", readFileSync(join(REPO_ROOT, "apps", "web", "public", "_headers"), "utf8")],
    ["the minimal fixture", MINIMAL_HEADERS],
  ])("%s _headers parses with no warning and passes (positive control)", (_name, content) => {
    expect(headersIn(content)).toEqual([]);
  });

  test("a CSP line over 2,000 characters is dropped by Cloudflare, so it fails headers-over-limit and headers-missing", () => {
    const hashes = Array.from({ length: 50 }, (_, i) => `'sha256-${String(i).padStart(43, "A")}='`).join(" ");
    const long = MINIMAL_HEADERS.replace("script-src 'self'", `script-src 'self' ${hashes}`);
    expect(long.split("\n").some((l) => l.length > 2000)).toBe(true);
    expect(headersIn(long)).toEqual([
      { path: "_headers", rule: "headers-missing" },
      { path: "_headers", rule: "headers-over-limit" },
    ]);
  });

  test("more than 100 rules fails headers-over-limit", () => {
    const extra = Array.from({ length: 100 }, (_, i) => `/p${i}/*\n  X-Robots-Tag: noindex\n`).join("");
    expect(headersIn(`${MINIMAL_HEADERS}\n${extra}`)).toEqual([{ path: "_headers", rule: "headers-over-limit" }]);
  });

  test.each([
    ["a header before any path", `  X-Robots-Tag: noindex\n${MINIMAL_HEADERS}`],
    ["a header line without a colon", `${MINIMAL_HEADERS}\n/bags/*\n  X-Robots-Tag noindex\n`],
    ["a header name with a space", `${MINIMAL_HEADERS}\n/bags/*\n  X Robots: noindex\n`],
    ["an empty header value", `${MINIMAL_HEADERS}\n/bags/*\n  X-Robots-Tag:\n`],
    ["an absolute URL with a port", `${MINIMAL_HEADERS}\nhttps://example.com:8443/*\n  X-Robots-Tag: noindex\n`],
    ["two wildcards in one path", `${MINIMAL_HEADERS}\n/a/*/b/*\n  X-Robots-Tag: noindex\n`],
    ["a path with no headers", `${MINIMAL_HEADERS}\n/empty/*\n`],
    ["a path not starting with / or https://", `${MINIMAL_HEADERS}\nbags/*\n  X-Robots-Tag: noindex\n`],
  ])("%s is a parser warning and fails headers-invalid", (_name, content) => {
    expect(headersIn(content)).toEqual([{ path: "_headers", rule: "headers-invalid" }]);
  });

  test("an indented path line starts a new rule, as Wrangler reads it, leaving the rule above it empty", () => {
    const content = `${MINIMAL_HEADERS}\n/x/*\n  /y/*\n  X-Robots-Tag: noindex\n`;
    expect(headersIn(content)).toEqual([{ path: "_headers", rule: "headers-invalid" }]);
  });
});
