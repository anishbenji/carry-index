/**
 * Sol security r3, S5-7: the scan decoded numeric HTML references only, so an address written with named ones
 * (`someone&commat;example&period;com`) passed while a browser renders it whole. The scan now decodes a table of named
 * references (every ASCII punctuation name, `&nbsp;` and common typography), and fails closed: any other named
 * reference in a public page is `bad-content`. No new dependency.
 */
import { rmSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { scanBundle } from "../src/canary.ts";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, minimalSite, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
const sealedDirs: string[] = [];
afterEach(() => {
  for (const dir of sealedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

function scan(files: Record<string, string>) {
  const dir = tempDir("cj-named-refs-");
  temps.push(dir);
  writeTree(dir.root, { _headers: MINIMAL_HEADERS, ...files });
  return scanBundle(dir.root);
}

async function sealPage(page: string) {
  const site = minimalSite({ "about.html": page });
  temps.push(site);
  const result = await seal(site.root, PUBLIC_SITE);
  if (result.ok) sealedDirs.push(result.bundle.dir);
  return result.ok ? [] : result.problems;
}

describe("named HTML references (S5-7)", () => {
  test.each([
    ["&commat; and &period;", "write to someone&commat;example&period;com"],
    ["&commat; only", "write to someone&commat;example.com"],
    ["&commat; with &lowbar; in the local part", "write to some&lowbar;one&commat;example.com"],
    ["&commat; mixed with a numeric reference", "write to someone&commat;example&#46;com"],
  ])("an address written with %s is an email hit", async (_name, text) => {
    expect(await scan({ "about.html": `<!doctype html><p>${text}</p>` })).toEqual([
      { path: "about.html", rule: "email" },
    ]);
  });

  test("a named reference outside the table in a public page is bad-content (fail closed)", async () => {
    expect(await sealPage("<!doctype html><p>a&unknownref;b</p>")).toEqual([
      { path: "about.html", rule: "bad-content" },
    ]);
  });

  test("named references in the table, and && in an inline script, seal (positive control)", async () => {
    const page =
      "<!doctype html><p>Tom &amp; Jerry &mdash; 30&nbsp;L &copy; 2026 &lt;b&gt; &quot;x&quot; &rarr;</p>" +
      "<script>if(a&&b&&c){}</script>";
    expect(await sealPage(page)).toEqual([]);
  });
});
