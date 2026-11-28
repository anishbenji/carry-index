/**
 * The seal's walker against a folder swapped for a link mid-walk (GPT-6.2 Sol security round 1, P1). A hook
 * injected between the `lstat` and the `readdir` makes the race deterministic.
 */
import { renameSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { readWalkedFile, walkTree } from "../src/walk.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_PAGE, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function setup(): { site: string; outside: string } {
  const site = tempDir("cj-walk-site-");
  const outside = tempDir("cj-walk-outside-");
  temps.push(site, outside);
  writeTree(site.root, { "404.html": MINIMAL_PAGE, "bags/a.html": MINIMAL_PAGE });
  writeTree(outside.root, { "a.html": MINIMAL_PAGE, "secret.html": MINIMAL_PAGE });
  return { site: site.root, outside: outside.root };
}

function swap(dir: string, outside: string): void {
  renameSync(dir, `${dir}-moved`);
  symlinkSync(outside, dir);
}

describe("the walker refuses a folder swapped for a link", () => {
  test("a folder swapped for a link between lstat and readdir is reported as a link, and nothing from outside is listed", () => {
    const { site, outside } = setup();
    let swapped = false;
    const entries = walkTree(site, {
      beforeReaddir: (abs) => {
        if (!swapped && abs === join(site, "bags")) {
          swapped = true;
          swap(abs, outside);
        }
      },
    });
    expect(swapped).toBe(true);
    expect(entries.map((e) => [e.path, e.kind])).toEqual([
      ["404.html", "file"],
      ["bags", "symlink"],
    ]);
  });

  test("a file whose parent folder was swapped for a link after the walk is not read", () => {
    const { site, outside } = setup();
    const entry = walkTree(site).find((e) => e.path === "bags/a.html");
    if (entry?.kind !== "file") throw new Error("bags/a.html not walked");
    swap(join(site, "bags"), outside);
    expect(readWalkedFile(entry)).toBeUndefined();
  });

  test("an unchanged tree walks and reads (positive control)", () => {
    const { site } = setup();
    const entries = walkTree(site);
    expect(entries.map((e) => e.path)).toEqual(["404.html", "bags/a.html"]);
    for (const e of entries) {
      if (e.kind !== "file") throw new Error(`${e.path} is not a file`);
      expect(readWalkedFile(e)?.length).toBe(MINIMAL_PAGE.length);
    }
  });
});
