/**
 * Sol security r3, S5-1: `JSON.parse` keeps the last of two members with the same name, so a fit file whose earlier
 * member held an order reference passed `fitSchema` while the seal uploaded the original bytes, earlier member
 * included. Duplicate keys are refused at every level (`fit-data-invalid`), and the seal writes the canonical
 * `JSON.stringify` of the parsed value, so the uploaded bytes are exactly what was validated.
 */
import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite } from "./helpers.ts";

const temps: TempDir[] = [];
const sealedDirs: string[] = [];
afterEach(() => {
  for (const dir of sealedDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

const FIT = "data/fit/example-pack-30.json";

async function sealFit(content: string) {
  const site = minimalSite({ [FIT]: content });
  temps.push(site);
  const result = await seal(site.root, PUBLIC_SITE);
  if (result.ok) sealedDirs.push(result.bundle.dir);
  return result;
}

describe("fit data: duplicate keys and canonical bytes (S5-1)", () => {
  test.each([
    ["a duplicate top-level key", '{"slug":"syn-order-0001","slug":"example-pack-30"}'],
    [
      "a duplicate key inside an airline",
      '{"slug":"example-pack-30","airlines":[{"name":"SYN-ORDER-0001","name":"Example Air","regions":["Europe"],"checked":null}]}',
    ],
    ["a duplicate key spelled with an escape", '{"slug":"syn-order-0001","\\u0073lug":"example-pack-30"}'],
    [
      "a duplicate key inside a variant",
      '{"slug":"example-pack-30","variants":[{"name":"SYN-ORDER-0001","id":"a","name":"Example"}]}',
    ],
  ])("%s fails with fit-data-invalid", async (_name, content) => {
    const result = await sealFit(content);
    expect(result.ok ? [] : result.problems).toEqual([{ path: FIT, rule: "fit-data-invalid" }]);
  });

  test("the sealed copy is the canonical JSON of what was validated, and the manifest hashes those bytes", async () => {
    const pretty = '{\n  "slug": "example-pack-30",\n  "variants": [ { "name": "Example" } ]\n}\n';
    const result = await sealFit(pretty);
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    const copied = readFileSync(join(result.bundle.siteDir, FIT), "utf8");
    expect(copied).toBe(JSON.stringify(JSON.parse(pretty)));
    const entry = result.bundle.manifest.find((e) => e.path === FIT);
    expect(entry?.sha256).toBe(createHash("sha256").update(copied).digest("hex"));
    expect(entry?.size).toBe(Buffer.byteLength(copied));
  });

  test("the same key in different objects is not a duplicate (positive control)", async () => {
    const content = '{"slug":"example-pack-30","variants":[{"name":"A"},{"name":"B"}]}';
    const result = await sealFit(content);
    expect(result.ok).toBe(true);
  });
});
