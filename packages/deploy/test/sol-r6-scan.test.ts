/**
 * Sol security r4, on the bundle scan.
 * - S6-6: a page formatter that put inline markup inside an address (`<wbr>`, `<span>`) left fragments the scan could
 *   not match, while the browser still showed the whole address. HTML is also scanned with its tags removed and the
 *   text around them joined; the raw scan stays.
 */
import { afterEach, describe, expect, test } from "vitest";
import { CANARY_MARKER, scanBundle } from "../src/canary.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, PR8_EXTERNAL, PR8_INLINE, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function scan(files: Record<string, string>) {
  const dir = tempDir("cj-r6-scan-");
  temps.push(dir);
  writeTree(dir.root, { _headers: MINIMAL_HEADERS, ...files });
  return scanBundle(dir.root);
}

describe("addresses and canaries split by inline markup (S6-6)", () => {
  test.each([
    ["a <wbr> before the at-sign", "<p>write to someone<wbr>@example.com</p>", "email"],
    ["a <span> across the address", "<p>write to some<span>one@exa</span>mple.com</p>", "email"],
    ["a <wbr> inside the canary", `<p>${CANARY_MARKER.slice(0, 5)}<wbr>${CANARY_MARKER.slice(5)}0001</p>`, "canary"],
  ])("%s is found", async (_name, body, rule) => {
    expect(await scan({ "about.html": `<!doctype html>${body}` })).toEqual([{ path: "about.html", rule }]);
  });

  test.each([
    ["inline", PR8_INLINE],
    ["external", PR8_EXTERNAL],
  ])("PR 8's real %s output still has no hit (positive control)", async (_name, dir) => {
    expect(await scanBundle(dir)).toEqual([]);
  });
});
