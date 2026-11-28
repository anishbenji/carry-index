/** T2: the sealed folder holds only what the gate made (privacy-wall design v2, section 2). */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { SealedBundle } from "../src/seal.ts";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { byCodeUnit, isInside, listEntries, listFiles, PR8_INLINE, REPO_ROOT, sha256, tempDir } from "./helpers.ts";

const sealed: string[] = [];
const temps: TempDir[] = [];
afterEach(() => {
  for (const dir of sealed.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

async function sealOk(siteDir: string, parent?: string): Promise<SealedBundle> {
  const result = await seal(siteDir, PUBLIC_SITE, parent === undefined ? undefined : { parent });
  if (!result.ok) throw new Error(`seal failed: ${JSON.stringify(result.problems)}`);
  sealed.push(result.bundle.dir);
  return result.bundle;
}

describe("T2 the sealed folder holds only what the gate made", () => {
  test("T2 the sealed folder's listing is exactly wrangler.json plus site/ holding the manifest's files, all regular files", async () => {
    const bundle = await sealOk(PR8_INLINE);
    const entries = listEntries(bundle.dir);
    expect(entries.filter((e) => e.kind !== "file" && e.kind !== "dir")).toEqual([]);
    const files = entries.filter((e) => e.kind === "file").map((e) => e.path);
    const expected = ["wrangler.json", ...bundle.manifest.map((m) => `site/${m.path}`)].sort(byCodeUnit);
    expect(files).toEqual(expected);
    expect(bundle.configPath).toBe(join(bundle.dir, "wrangler.json"));
    expect(bundle.siteDir).toBe(join(bundle.dir, "site"));
  });

  test("T2 the manifest lists every source file once with its size and SHA-256, and the copies match byte for byte", async () => {
    const bundle = await sealOk(PR8_INLINE);
    const source = listFiles(PR8_INLINE);
    expect(source.length).toBe(78);
    expect(bundle.manifest.map((m) => m.path)).toEqual(source);
    for (const entry of bundle.manifest) {
      const original = join(PR8_INLINE, entry.path);
      expect(entry.sha256, entry.path).toBe(sha256(original));
      expect(entry.size, entry.path).toBe(readFileSync(original).length);
      expect(sha256(join(bundle.siteDir, entry.path)), entry.path).toBe(entry.sha256);
    }
  });

  test("T2 the sealed wrangler.json is the emitted site config and points assets at the sealed copy", async () => {
    const bundle = await sealOk(PR8_INLINE);
    const config = JSON.parse(readFileSync(bundle.configPath, "utf8")) as {
      name: string;
      assets: { directory: string };
    };
    expect(config.name).toBe("carry-journal");
    expect(config.assets.directory).toBe("./site");
  });

  test("T2 the sealed folder is fresh and outside the checkout and the source folder", async () => {
    const first = await sealOk(PR8_INLINE);
    const second = await sealOk(PR8_INLINE);
    expect(first.dir).not.toBe(second.dir);
    for (const dir of [first.dir, second.dir]) {
      expect(isInside(dir, REPO_ROOT), dir).toBe(false);
      expect(isInside(dir, PR8_INLINE), dir).toBe(false);
    }
  });

  test("T2 the sealed folder is created inside the requested parent when one is given", async () => {
    const parent = tempDir("cj-parent-");
    temps.push(parent);
    const bundle = await sealOk(PR8_INLINE, parent.root);
    expect(isInside(bundle.dir, parent.root)).toBe(true);
    expect(bundle.dir).not.toBe(parent.root);
  });

  test("T2 sealing never changes the source folder", async () => {
    const before = listEntries(PR8_INLINE);
    const hashes = listFiles(PR8_INLINE).map((p) => sha256(join(PR8_INLINE, p)));
    await sealOk(PR8_INLINE);
    expect(listEntries(PR8_INLINE)).toEqual(before);
    expect(listFiles(PR8_INLINE).map((p) => sha256(join(PR8_INLINE, p)))).toEqual(hashes);
  });
});
