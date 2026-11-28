/**
 * `_headers` rule paths as Wrangler 4.168.0 keys them (Fable independent review, P1). Wrangler normalises a path with
 * `validateUrl`/`extractPathname` (wrangler-dist/cli.js:68730-68760) and stores rules by that path, so a later rule
 * for the same path replaces an earlier one (`rules[rule.path] = ...`, cli.js:219671). Two rules with one normalised
 * path fail, and the required headers come only from the single `/*` rule.
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
  return checkHeaders(dir.root);
}

describe("_headers rules are keyed by Wrangler's normalised path", () => {
  test.each([["/*"], ["/*?x"], ["/*#x"], ["/./*"]])(
    "a second rule for %s (normalised to /*) replaces the first: headers-invalid, and the headers it drops are missing",
    (path) => {
      expect(headersIn(`${MINIMAL_HEADERS}\n${path}\n  X-Robots-Tag: noindex\n`)).toEqual([
        { path: "_headers", rule: "headers-invalid" },
        { path: "_headers", rule: "headers-missing" },
      ]);
    },
  );

  test("a /*-equivalent path written differently still counts as the root rule (positive control)", () => {
    expect(headersIn(MINIMAL_HEADERS.replace("/*\n", "/./*\n"))).toEqual([]);
  });

  test("two different absolute hosts do not clash (positive control)", () => {
    const extra =
      "https://:version.:subdomain.workers.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:subdomain.workers.dev/*\n  X-Robots-Tag: noindex\n";
    expect(headersIn(`${MINIMAL_HEADERS}\n${extra}`)).toEqual([]);
  });
});
