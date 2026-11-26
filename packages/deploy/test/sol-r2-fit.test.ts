/**
 * Security-sol round 2, S2-3 (fit-data half): the fit-data row accepted any valid JSON, so a private export with no
 * canary, email or local-path marker could ship at an allowed path. Every `data/fit/*.json` file must now parse
 * against `fitSchema` from `@cj/schema`, which is closed at every level; one that is JSON but does not fits fails with
 * rule `fit-data-invalid` (a file that is not JSON stays `bad-content`).
 */
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fitSchema } from "@cj/schema";
import { afterEach, describe, expect, test } from "vitest";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite, PR8_EXTERNAL, PR8_INLINE } from "./helpers.ts";

const temps: TempDir[] = [];
const sealedDirs: string[] = [];
afterEach(() => {
  for (const dir of sealedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

const FIT = "data/fit/example-pack-30.json";
const AIRLINE = { name: "Example Air", regions: ["Europe"], checked: "2026-11-15" };
const GOOD = {
  slug: "example-pack-30",
  airlines: [AIRLINE],
  variants: [{ id: "example", name: "Example", marks: "y" }],
};

async function problemsFor(content: string) {
  const site = minimalSite({ [FIT]: content });
  temps.push(site);
  const result = await seal(site.root, PUBLIC_SITE);
  if (result.ok) sealedDirs.push(result.bundle.dir);
  return result.ok ? [] : result.problems;
}

describe("fit data must match the closed fitSchema (S2-3)", () => {
  const files = readdirSync(join(PR8_INLINE, "data", "fit")).sort();

  test("PR 8 holds 12 fit files, the same in both variants", () => {
    expect(files).toHaveLength(12);
    expect(readdirSync(join(PR8_EXTERNAL, "data", "fit")).sort()).toEqual(files);
  });

  test.each(files)("PR 8's real %s passes fitSchema (both variants)", (name) => {
    for (const dir of [PR8_INLINE, PR8_EXTERNAL]) {
      const parsed = fitSchema.safeParse(JSON.parse(readFileSync(join(dir, "data", "fit", name), "utf8")));
      expect(parsed.error?.issues ?? []).toEqual([]);
    }
  });

  test("a well-formed synthetic fit file seals (positive control)", async () => {
    expect(await problemsFor(JSON.stringify(GOOD))).toEqual([]);
  });

  test.each([
    ["an unknown top-level key", { ...GOOD, pricePaid: 120 }],
    ["an unknown key on an airline", { ...GOOD, airlines: [{ ...AIRLINE, orderReference: "SYN-0001" }] }],
    ["an unknown key on a variant", { ...GOOD, variants: [{ name: "Example", purchasedFrom: "synthetic shop" }] }],
    ["a checked value that is not a date", { ...GOOD, airlines: [{ ...AIRLINE, checked: "last week" }] }],
    ["a JSON array instead of an object", [GOOD]],
    ["no slug", { airlines: [AIRLINE] }],
  ])("%s fails with rule fit-data-invalid", async (_name, value) => {
    expect(await problemsFor(JSON.stringify(value))).toEqual([{ path: FIT, rule: "fit-data-invalid" }]);
  });

  test("a fit file that is not JSON stays bad-content", async () => {
    expect(await problemsFor("{ not json")).toEqual([{ path: FIT, rule: "bad-content" }]);
  });
});
