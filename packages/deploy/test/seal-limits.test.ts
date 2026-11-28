/**
 * The seal's file-count and total-size limits (GPT-6.2 Sol security round 1, P2): checked from the walk's sizes
 * before anything is read, and nothing is left behind when the seal fails. Tests lower the limits through options;
 * an option can only lower them.
 */
import { readdirSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { MAX_SITE_BYTES, MAX_SITE_FILES, seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_PAGE, minimalSite, tempDir } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

describe("the seal's limits", () => {
  test("the limits sit between today's site and Cloudflare's 20,000-file version limit", () => {
    expect(MAX_SITE_FILES).toBeGreaterThanOrEqual(1_000);
    expect(MAX_SITE_FILES).toBeLessThanOrEqual(20_000);
    expect(MAX_SITE_BYTES).toBeGreaterThanOrEqual(50 * 1024 * 1024);
    expect(MAX_SITE_BYTES).toBeLessThanOrEqual(1024 * 1024 * 1024);
  });

  test("more files than the limit fails with rule too-many-files at path ., and the parent is left empty", async () => {
    const site = minimalSite({ "a.html": MINIMAL_PAGE, "b.html": MINIMAL_PAGE });
    const parent = tempDir("cj-parent-");
    temps.push(site, parent);
    const result = await seal(site.root, PUBLIC_SITE, { parent: parent.root, maxFiles: 3 });
    expect(result.ok ? [] : result.problems).toEqual([{ path: ".", rule: "too-many-files" }]);
    expect(readdirSync(parent.root)).toEqual([]);
  });

  test("more bytes than the limit fails with rule total-too-large at path .", async () => {
    const site = minimalSite({ "a.html": MINIMAL_PAGE + " ".repeat(1000) });
    temps.push(site);
    const result = await seal(site.root, PUBLIC_SITE, { maxTotalBytes: 1000 });
    expect(result.ok ? [] : result.problems).toEqual([{ path: ".", rule: "total-too-large" }]);
  });

  test("an option cannot raise a limit above the constant", async () => {
    const site = minimalSite();
    temps.push(site);
    const result = await seal(site.root, PUBLIC_SITE, { maxFiles: MAX_SITE_FILES * 10, maxTotalBytes: 1 });
    expect(result.ok ? [] : result.problems).toEqual([{ path: ".", rule: "total-too-large" }]);
  });

  test("a failed content check leaves nothing in the parent folder", async () => {
    const site = minimalSite({ "x.html": "not a page" });
    const parent = tempDir("cj-parent-");
    temps.push(site, parent);
    const result = await seal(site.root, PUBLIC_SITE, { parent: parent.root });
    expect(result.ok).toBe(false);
    expect(readdirSync(parent.root)).toEqual([]);
  });
});
