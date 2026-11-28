/**
 * Security-sol round 2, S2-3 (hard-link half): a hard link to a private file passes the inode, regular-file and
 * path checks, because it is a regular file at an allowed path. Any file with more than one link is refused with
 * rule `hard-link`, by the walk and again on the opened handle (a link made after the walk).
 */
import { linkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { scanBundle } from "../src/canary.ts";
import { seal } from "../src/seal.ts";
import { readWalkedEntry, readWalkedFile, walkTree } from "../src/walk.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_PAGE, minimalSite, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
const sealedDirs: string[] = [];
afterEach(() => {
  for (const dir of sealedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

/** A site plus a synthetic "private export" outside it, in the same temp folder (so on the same filesystem). */
function setup(): { site: string; privateFile: string } {
  const site = minimalSite();
  const outside = tempDir("cj-private-");
  temps.push(site, outside);
  writeTree(outside.root, { "export.html": MINIMAL_PAGE });
  return { site: site.root, privateFile: join(outside.root, "export.html") };
}

describe("hard links never reach the sealed artifact (S2-3)", () => {
  test("a hard link to a file outside the site, at an allowed path, fails with rule hard-link", async () => {
    const { site, privateFile } = setup();
    linkSync(privateFile, join(site, "leak.html"));
    const result = await seal(site, PUBLIC_SITE);
    if (result.ok) sealedDirs.push(result.bundle.dir);
    expect(result.ok ? [] : result.problems).toEqual([{ path: "leak.html", rule: "hard-link" }]);
  });

  test("two names for one file inside the site are both refused", async () => {
    const { site } = setup();
    linkSync(join(site, "404.html"), join(site, "copy.html"));
    const result = await seal(site, PUBLIC_SITE);
    if (result.ok) sealedDirs.push(result.bundle.dir);
    expect(result.ok ? [] : result.problems).toEqual([
      { path: "404.html", rule: "hard-link" },
      { path: "copy.html", rule: "hard-link" },
    ]);
  });

  test("the walk reports a multiply linked file as kind hardlink, never as a file", () => {
    const { site, privateFile } = setup();
    linkSync(privateFile, join(site, "leak.html"));
    const entry = walkTree(site).find((e) => e.path === "leak.html");
    expect(entry?.kind).toBe("hardlink");
  });

  test("a link made after the walk is refused on the opened handle", async () => {
    const { site, privateFile } = setup();
    const result = await seal(site, PUBLIC_SITE, {
      afterWalk: () => {
        linkSync(join(site, "404.html"), `${privateFile}-second-name`);
      },
    });
    if (result.ok) sealedDirs.push(result.bundle.dir);
    expect(result.ok ? [] : result.problems).toEqual([{ path: "404.html", rule: "hard-link" }]);
  });

  test("readWalkedEntry names the reason; readWalkedFile returns nothing", () => {
    const { site, privateFile } = setup();
    const entry = walkTree(site).find((e) => e.path === "404.html");
    if (entry?.kind !== "file") throw new Error("404.html not walked as a file");
    linkSync(join(site, "404.html"), `${privateFile}-second-name`);
    expect(readWalkedEntry(entry)).toEqual({ ok: false, reason: "hard-link" });
    expect(readWalkedFile(entry)).toBeUndefined();
  });

  test("the bundle scan reports a hard link too", async () => {
    const { site, privateFile } = setup();
    linkSync(privateFile, join(site, "leak.html"));
    expect(await scanBundle(site)).toEqual([{ path: "leak.html", rule: "hard-link" }]);
  });

  test("a site with no hard links still seals (positive control)", async () => {
    const { site } = setup();
    const result = await seal(site, PUBLIC_SITE);
    if (result.ok) sealedDirs.push(result.bundle.dir);
    expect(result.ok).toBe(true);
  });
});
