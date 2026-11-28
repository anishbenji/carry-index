/**
 * Independent review (Neon) N8: a site folder that is a dangling symbolic link made the seal throw ENOENT (the gate
 * then logged an unexpected error) instead of reporting the link. It is now `symlink` at `.`, like any linked root.
 */
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite, tempDir } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

describe("a linked site folder is reported, never followed (N8)", () => {
  test("a dangling link as the site folder is symlink at .", async () => {
    const dir = tempDir("cj-dangling-");
    temps.push(dir);
    const link = join(dir.root, "site");
    symlinkSync(join(dir.root, "missing"), link);
    const result = await seal(link, PUBLIC_SITE);
    expect(result.ok ? [] : result.problems).toEqual([{ path: ".", rule: "symlink" }]);
  });

  test("the gate's check reports it as a rule, not an unexpected error", async () => {
    const dir = tempDir("cj-dangling-");
    temps.push(dir);
    const link = join(dir.root, "site");
    symlinkSync(join(dir.root, "missing"), link);
    const fake = fakeIo();
    expect(await main(["check", link], fake.io)).toBe(1);
    expect(fake.lines).toContain('symlink: "."');
    expect(fake.lines.some((l) => l.includes("unexpected"))).toBe(false);
  });

  test("a link to a real site folder is symlink at . too (control)", async () => {
    const site = minimalSite();
    const dir = tempDir("cj-linked-root-");
    temps.push(site, dir);
    const link = join(dir.root, "site");
    symlinkSync(site.root, link);
    const result = await seal(link, PUBLIC_SITE);
    expect(result.ok ? [] : result.problems).toEqual([{ path: ".", rule: "symlink" }]);
  });
});
