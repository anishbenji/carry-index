/**
 * Sol security r4, on the bundle scan.
 * - S6-6: a page formatter that put inline markup inside an address (`<wbr>`, `<span>`) left fragments the scan could
 *   not match, while the browser still showed the whole address. HTML is also scanned with its tags removed and the
 *   text around them joined; the raw scan stays.
 */
import { afterEach, describe, expect, test } from "vitest";
import { CANARY_MARKER, scanBundle } from "../src/canary.ts";
import { main } from "../src/cli.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, MINIMAL_PAGE, minimalSite, PR8_EXTERNAL, PR8_INLINE, tempDir, writeTree } from "./helpers.ts";

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

/**
 * S6-7: a file's path becomes its public URL, but only contents were scanned, so a page slug derived from a private
 * decoy (`bags/cj-canary-0001.html`) shipped its marker in the URL. The canary and email scans now run on each path.
 */
describe("canary markers and addresses in file paths (S6-7)", () => {
  // Built at run time, so no address literal sits in this file (the CI email scan reads every tracked line).
  const at = (local: string, domain: string): string => [local, domain].join("@");
  const slug = `bags/${CANARY_MARKER.toLowerCase()}0001.html`;

  test("a lower-case canary in a page's path is a canary hit at that path", async () => {
    expect(await scan({ [slug]: MINIMAL_PAGE })).toEqual([{ path: slug, rule: "canary" }]);
  });

  test("an address in a file's path is an email hit at that path", async () => {
    const path = `contact-${at("someone", "example.com")}.html`;
    expect(await scan({ [path]: MINIMAL_PAGE })).toEqual([{ path, rule: "email" }]);
  });

  test("the gate's check fails on a canary that is only in a path", async () => {
    const site = minimalSite({ [slug]: MINIMAL_PAGE });
    temps.push(site);
    const fake = fakeIo();
    expect(await main(["check", site.root], fake.io)).toBe(1);
    expect(fake.lines.some((l) => l.startsWith("canary: #"))).toBe(true);
  });

  test("ordinary paths give no hit (positive control)", async () => {
    expect(await scan({ "bags/example-pack-30.html": MINIMAL_PAGE, "assets/main-AbCdEfGh.js": "export{};" })).toEqual(
      [],
    );
  });
});
