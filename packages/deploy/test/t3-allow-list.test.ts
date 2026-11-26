/**
 * T3: only allow-listed files upload (privacy-wall design v2, section 2). Rejection fixtures are generated in a temp
 * folder at test time, never committed.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { Problem } from "../src/problems.ts";
import type { SealResult } from "../src/seal.ts";
import { MAX_FILE_BYTES, seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { listFiles, MINIMAL_PAGE, minimalSite, PR8_EXTERNAL, PR8_INLINE, sha256, tempDir } from "./helpers.ts";

const temps: TempDir[] = [];
const sealedDirs: string[] = [];
afterEach(() => {
  for (const dir of sealedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

function track(dir: TempDir): TempDir {
  temps.push(dir);
  return dir;
}

async function sealSite(siteDir: string): Promise<SealResult> {
  const result = await seal(siteDir, PUBLIC_SITE);
  if (result.ok) sealedDirs.push(result.bundle.dir);
  return result;
}

/** The problems sealing `files` beside a valid 404 page reports; `[]` means it sealed. */
async function problemsFor(files: Record<string, string | Uint8Array>): Promise<readonly Problem[]> {
  const site = track(minimalSite(files));
  const result = await sealSite(site.root);
  return result.ok ? [] : result.problems;
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const HTML = `${MINIMAL_PAGE}`;

describe("T3 only allow-listed files upload", () => {
  test.each([
    ["inline", PR8_INLINE, 78],
    ["external", PR8_EXTERNAL, 79],
  ])(
    "T3 PR 8's real static output (%s variant) seals unchanged: every file copied, none dropped",
    async (_name, dir, count) => {
      const result = await sealSite(dir);
      if (!result.ok) throw new Error(`expected PR 8's output to seal, got ${JSON.stringify(result.problems)}`);
      const source = listFiles(dir);
      expect(source.length).toBe(count);
      expect(result.bundle.manifest.map((m) => m.path)).toEqual(source);
      expect(result.bundle.manifest.map((m) => m.sha256)).toEqual(source.map((p) => sha256(join(dir, p))));
    },
  );

  test("T3 the minimal site the rejection cases start from seals (positive control)", async () => {
    expect(await problemsFor({})).toEqual([]);
  });

  test("T3 the planned fixed files and a lower-case page in a section folder are accepted", async () => {
    expect(
      await problemsFor({
        "robots.txt": "User-agent: *\n",
        "sitemap.xml": '<?xml version="1.0"?><urlset/>',
        _redirects: "/old /new 301\n",
        ".well-known/security.txt": "Contact: https://example.com/security\n",
        "bags/example-pack-30.html": HTML,
        "fabrics/example-fabric.html": HTML,
        "data/fit/example-pack-30.json": '{"slug":"example-pack-30"}',
        "drawings/example/sketch/example-front.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
        "assets/example-AbCd_9-z.js": "export{};",
      }),
    ).toEqual([]);
  });

  test.each([
    [".dev.vars", "SECRET=synthetic\n"],
    [".env", "CLOUDFLARE_API_TOKEN=synthetic\n"],
    [".git/config", "[core]\n"],
    ["node_modules/x.js", "module.exports = 1;\n"],
    [".assetsignore", "wrangler.json\n"],
    ["wrangler.json", '{"name":"carry-journal","d1_databases":[]}'],
    ["notes.md", "synthetic working notes\n"],
    ["app.js.map", '{"version":3}'],
    ["assets/sort-0Ir4Ifay.js.map", '{"version":3}'],
    ["Bags/x.html", HTML],
    [".well-known/other.txt", "synthetic\n"],
    ["_static/abc123/getBags-0123abcd.0123456789abcdef0123456789abcdef.txt", "solid-prerender-artifact/1\n"],
    ["assets/no-hash.js", "export{};"],
    ["data/private/owned.json", "{}"],
    ["page.HTML", HTML],
    ["og/example-pack-30.png", PNG_SIGNATURE],
  ])(
    "T3 %s fails the gate with rule no-matching-row (no skip list, nothing dropped quietly)",
    async (path, content) => {
      expect(await problemsFor({ [path]: content })).toEqual([{ path, rule: "no-matching-row" }]);
    },
  );

  test.each([
    ["x.html", "not a page"],
    ["bags/x.html", "<html><body>no doctype</body></html>"],
    ["data/fit/x.json", "{ not json"],
    ["drawings/x/sketch/x-front.svg", "<html>not a drawing</html>"],
  ])("T3 %s fails its row's content check with rule bad-content", async (path, content) => {
    expect(await problemsFor({ [path]: content })).toEqual([{ path, rule: "bad-content" }]);
  });

  test("T3 a symlink pointing out of the site fails with rule symlink", async () => {
    const outside = track(tempDir("cj-outside-"));
    writeFileSync(join(outside.root, "secret.html"), HTML);
    const site = track(minimalSite());
    symlinkSync(join(outside.root, "secret.html"), join(site.root, "leak.html"));
    const result = await sealSite(site.root);
    expect(result.ok ? [] : result.problems).toEqual([{ path: "leak.html", rule: "symlink" }]);
  });

  test("T3 a symlink pointing inside the site fails with rule symlink", async () => {
    const site = track(minimalSite());
    symlinkSync("404.html", join(site.root, "alias.html"));
    const result = await sealSite(site.root);
    expect(result.ok ? [] : result.problems).toEqual([{ path: "alias.html", rule: "symlink" }]);
  });

  test("T3 a symlinked folder fails with rule symlink and is not followed", async () => {
    const outside = track(tempDir("cj-outside-"));
    writeFileSync(join(outside.root, "x.html"), HTML);
    const site = track(minimalSite());
    symlinkSync(outside.root, join(site.root, "bags"));
    const result = await sealSite(site.root);
    expect(result.ok ? [] : result.problems).toEqual([{ path: "bags", rule: "symlink" }]);
  });

  test("T3 a FIFO fails with rule special-file without being opened", { timeout: 10_000 }, async () => {
    const site = track(minimalSite());
    execFileSync("mkfifo", [join(site.root, "pipe.html")], { encoding: "utf8" });
    const result = await sealSite(site.root);
    expect(result.ok ? [] : result.problems).toEqual([{ path: "pipe.html", rule: "special-file" }]);
  });

  test("T3 a file over the size cap fails with rule too-large; a file at the cap is accepted", async () => {
    expect(MAX_FILE_BYTES).toBeGreaterThan(173 * 1024);
    expect(MAX_FILE_BYTES).toBeLessThanOrEqual(25 * 1024 * 1024);
    const padded = (bytes: number): string => MINIMAL_PAGE + " ".repeat(bytes - MINIMAL_PAGE.length);
    expect(await problemsFor({ "big.html": padded(MAX_FILE_BYTES + 1) })).toEqual([
      { path: "big.html", rule: "too-large" },
    ]);
    expect(await problemsFor({ "edge.html": padded(MAX_FILE_BYTES) })).toEqual([]);
  });

  test("T3 every bad entry is reported, not only the first, sorted by path", async () => {
    const site = track(minimalSite({ ".env": "X=1\n", "notes.md": "x\n", "x.html": "no doctype" }));
    mkdirSync(join(site.root, "empty-dir"));
    const result = await sealSite(site.root);
    expect(result.ok ? [] : result.problems).toEqual([
      { path: ".env", rule: "no-matching-row" },
      { path: "notes.md", rule: "no-matching-row" },
      { path: "x.html", rule: "bad-content" },
    ]);
  });
});
