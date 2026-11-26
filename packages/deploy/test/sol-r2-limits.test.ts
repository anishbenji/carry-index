/**
 * Security-sol round 2, S2-9: the seal's file-count and byte caps applied only after an unbounded walk and full
 * reads. The walk now counts entries as it goes and stops at the cap (`too-many-files`), each read is bounded by the
 * file's enumerated size and the remaining byte budget, and a file that changed size since the walk is refused
 * (`file-changed`) instead of being read to its end.
 */
import { appendFileSync, mkdirSync, rmSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { seal } from "../src/seal.ts";
import { readWalkedEntry, WalkLimitExceeded, walkTree } from "../src/walk.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_PAGE, minimalSite, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
const sealedDirs: string[] = [];
afterEach(() => {
  for (const dir of sealedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

function site(files: Record<string, string> = {}): string {
  const dir = minimalSite(files);
  temps.push(dir);
  return dir.root;
}

async function problems(root: string, options: Parameters<typeof seal>[2] = {}) {
  const result = await seal(root, PUBLIC_SITE, options);
  if (result.ok) sealedDirs.push(result.bundle.dir);
  return result.ok ? [] : result.problems;
}

describe("the walk stops at its entry cap (S2-9)", () => {
  test("the walk stops early: it does not open every folder of a tree over the cap", () => {
    const dir = tempDir("cj-walk-cap-");
    temps.push(dir);
    for (let i = 0; i < 40; i++) mkdirSync(join(dir.root, `f${String(i).padStart(2, "0")}`));
    let opened = 0;
    expect(() => walkTree(dir.root, { beforeReaddir: () => void opened++ }, { maxEntries: 5 })).toThrow(
      WalkLimitExceeded,
    );
    expect(opened).toBeLessThan(10);
  });

  test("one folder with more names than the cap stops while it is read", () => {
    const dir = tempDir("cj-walk-cap-");
    temps.push(dir);
    const files: Record<string, string> = {};
    for (let i = 0; i < 40; i++) files[`p${i}.html`] = MINIMAL_PAGE;
    writeTree(dir.root, files);
    expect(() => walkTree(dir.root, {}, { maxEntries: 5 })).toThrow(WalkLimitExceeded);
  });

  test("a tree within the cap walks in full (positive control)", () => {
    const root = site({ "bags/a.html": MINIMAL_PAGE });
    expect(walkTree(root, {}, { maxEntries: 5 }).map((e) => e.path)).toEqual(["404.html", "_headers", "bags/a.html"]);
  });

  test("the seal turns the stop into too-many-files: many empty folders count too", async () => {
    const root = site();
    for (let i = 0; i < 30; i++) mkdirSync(join(root, `d${i}`));
    expect(await problems(root, { maxFiles: 3 })).toEqual([{ path: ".", rule: "too-many-files" }]);
  });
});

describe("reads are bounded by the walk's sizes (S2-9)", () => {
  test("a file that grew after the walk is refused with file-changed, not read to its end", async () => {
    const root = site();
    const result = await problems(root, {
      afterWalk: () => appendFileSync(join(root, "404.html"), "x".repeat(3 * 1024 * 1024)),
    });
    expect(result).toEqual([{ path: "404.html", rule: "file-changed" }]);
  });

  test("a file that shrank after the walk is refused with file-changed", async () => {
    const root = site();
    const result = await problems(root, { afterWalk: () => truncateSync(join(root, "404.html"), 20) });
    expect(result).toEqual([{ path: "404.html", rule: "file-changed" }]);
  });

  test("readWalkedEntry refuses a file over the remaining byte budget without reading it", () => {
    const root = site();
    const entry = walkTree(root).find((e) => e.path === "404.html");
    if (entry?.kind !== "file") throw new Error("404.html not walked as a file");
    expect(readWalkedEntry(entry, 10)).toEqual({ ok: false, reason: "over-budget" });
    const whole = readWalkedEntry(entry, MINIMAL_PAGE.length);
    expect(whole.ok && whole.bytes.length).toBe(MINIMAL_PAGE.length);
  });

  test("an unchanged site seals (positive control)", async () => {
    expect(await problems(site({ "bags/a.html": MINIMAL_PAGE }))).toEqual([]);
  });
});
