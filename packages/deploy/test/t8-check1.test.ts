/**
 * T8: check 1, no never-public field reaches the public build (privacy-wall design v2, section 5). Runs on the
 * catalogue schemas in packages/schema as they are; the synthetic schemas below exist only in this test.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as catalogue from "@cj/schema";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import { findPrivateImports } from "../src/imports.ts";
import { neverPublicFields, openShapes, publicSurface } from "../src/surface.ts";
import type { TempDir } from "./helpers.ts";
import { REPO_ROOT, tempDir, writeTree } from "./helpers.ts";

const SNAPSHOT = JSON.parse(
  readFileSync(join(REPO_ROOT, "packages", "deploy", "public-surface.json"), "utf8"),
) as string[];

describe("T8 check 1: the public surface snapshot", () => {
  test("T8 the catalogue schemas' readable surface equals the committed public-surface.json", () => {
    expect(SNAPSHOT.length).toBeGreaterThan(0);
    expect(publicSurface(catalogue)).toEqual(SNAPSHOT);
  });

  test("T8 a new readable field on a catalogue schema changes the surface, so it shows as a diff to review", () => {
    const widened = { ...catalogue, bagSchema: catalogue.bagSchema.extend({ colourway: z.string() }) };
    const surface = publicSurface(widened);
    expect(surface).toContain("bagSchema.colourway: string");
    expect(surface).not.toEqual(SNAPSHOT);
  });

  test("T8 the surface lists leaves as export.path: type, with [] for array items, .* for record values and sorted | for unions", () => {
    const sample = z.object({
      id: z.string(),
      tags: z.array(z.string()),
      parts: z.array(z.object({ weight: z.number().nullable().optional() })),
      names: z.record(z.string(), z.object({ name: z.string() })),
      count: z.int(),
      limit: z.union([z.number().positive(), z.literal("inf")]).nullable(),
      when: z.iso.date(),
    });
    expect(publicSurface({ sample, NOT_A_SCHEMA: ["a", "b"], alsoNot: 3 })).toEqual([
      "sample.count: integer",
      "sample.id: string",
      "sample.limit: null|number|string",
      "sample.names.*.name: string",
      "sample.parts[].weight: null|number",
      "sample.tags[]: string",
      "sample.when: string",
    ]);
  });
});

describe("T8 check 1: never-public names", () => {
  test("T8 the catalogue schemas hold no never-public field", () => {
    expect(neverPublicFields(catalogue)).toEqual([]);
  });

  test.each([
    ["pricePaid", "sample.pricePaid"],
    ["price_paid", "sample.price_paid"],
    ["orderNumber", "sample.orderNumber"],
    ["order_reference", "sample.order_reference"],
    ["shippingAddress", "sample.shippingAddress"],
    ["address", "sample.address"],
    ["medicine", "sample.medicine"],
    ["medication", "sample.medication"],
  ])("T8 a public schema field named %s is refused as never-public", (key, path) => {
    const sample = z.object({ id: z.string(), [key]: z.string() });
    expect(neverPublicFields({ sample })).toEqual([{ path, rule: "never-public-name" }]);
  });

  test("T8 a never-public name nested in an array of objects is found by its full path", () => {
    const sample = z.object({ items: z.array(z.object({ id: z.string(), pricePaid: z.number() })) });
    expect(neverPublicFields({ sample })).toEqual([{ path: "sample.items[].pricePaid", rule: "never-public-name" }]);
  });
});

describe("T8 check 1: no open shapes", () => {
  test("T8 the catalogue schemas have no open shape", () => {
    expect(openShapes(catalogue)).toEqual([]);
  });

  test("T8 stripping objects, strict objects and records with closed values are accepted (positive control)", () => {
    expect(
      openShapes({
        strip: z.object({ a: z.string() }),
        strict: z.strictObject({ a: z.string() }),
        record: z.record(z.string(), z.object({ name: z.string() })),
        nested: z.object({ list: z.array(z.object({ n: z.number() })) }),
      }),
    ).toEqual([]);
  });

  test.each([
    ["unknown", z.object({ a: z.string(), extra: z.unknown() }), "sample.extra"],
    ["any", z.object({ a: z.string(), extra: z.any() }), "sample.extra"],
    ["a loose object", z.looseObject({ a: z.string() }), "sample"],
    ["a catch-all object", z.object({ a: z.string() }).catchall(z.string()), "sample"],
    ["a record of unknown values", z.record(z.string(), z.unknown()), "sample.*"],
    ["a record of loose objects", z.record(z.string(), z.looseObject({ name: z.string() })), "sample.*"],
    ["a nested loose object", z.object({ inner: z.looseObject({ a: z.string() }) }), "sample.inner"],
  ])("T8 %s is refused as an open shape", (_name, sample, path) => {
    expect(openShapes({ sample })).toEqual([{ path, rule: "open-shape" }]);
  });
});

describe("T8 check 1: the import ban keeps private modules out of the public side", () => {
  const temps: TempDir[] = [];
  afterEach(() => {
    for (const t of temps.splice(0)) t.cleanup();
  });

  test("T8 the import ban rejects private-schema and private-app imports from apps/web, workers/web and packages/pipeline, type-only ones included", () => {
    const repo = tempDir("cj-imports-");
    temps.push(repo);
    writeTree(repo.root, {
      "apps/web/src/leak-type.ts": 'import type { OwnedUnit } from "@cj/schema/private";\nexport type X = OwnedUnit;\n',
      "apps/web/src/leak-path.ts": 'import { db } from "../../../workers/kit/src/index.ts";\nexport const x = db;\n',
      "apps/web/src/leak-schema-path.tsx":
        'import { ownedUnitSchema } from "../../../packages/schema/src/private/owned.ts";\nexport const s = ownedUnitSchema;\n',
      "packages/pipeline/src/leak.ts": 'export * from "@cj/worker-kit";\n',
      "workers/web/src/leak.ts":
        'export async function load() {\n  return import("../../../apps/kit/src/main.tsx");\n}\n',
      "workers/web/src/leak-app.ts": 'import type { App } from "@cj/kit";\nexport type A = App;\n',
      // Allowed: the public schemas by type, and the private side importing its own schemas.
      "apps/web/src/ok.ts": 'import type { Bag } from "@cj/schema";\nexport type B = Bag;\n',
      "apps/kit/src/ok.ts": 'import type { OwnedUnit } from "@cj/schema/private";\nexport type O = OwnedUnit;\n',
      "workers/kit/src/index.ts": 'import { z } from "zod";\nexport const db = z.string();\n',
    });
    expect(findPrivateImports(repo.root)).toEqual([
      { file: "apps/web/src/leak-path.ts", line: 1, specifier: "../../../workers/kit/src/index.ts" },
      {
        file: "apps/web/src/leak-schema-path.tsx",
        line: 1,
        specifier: "../../../packages/schema/src/private/owned.ts",
      },
      { file: "apps/web/src/leak-type.ts", line: 1, specifier: "@cj/schema/private" },
      { file: "packages/pipeline/src/leak.ts", line: 1, specifier: "@cj/worker-kit" },
      { file: "workers/web/src/leak-app.ts", line: 1, specifier: "@cj/kit" },
      { file: "workers/web/src/leak.ts", line: 2, specifier: "../../../apps/kit/src/main.tsx" },
    ]);
  });

  test("T8 this repository's public side imports nothing private today", () => {
    expect(findPrivateImports(REPO_ROOT)).toEqual([]);
  });
});

describe("T8 check 1: records with fixed keys (security review r1, P1)", () => {
  test("T8 an enum-keyed record holding never-public names is refused at each key's full path", () => {
    const sample = z.object({ id: z.string(), prices: z.record(z.enum(["pricePaid", "orderId"]), z.number()) });
    expect(neverPublicFields({ sample })).toEqual([
      { path: "sample.prices.orderId", rule: "never-public-name" },
      { path: "sample.prices.pricePaid", rule: "never-public-name" },
    ]);
  });

  test("T8 literal-keyed and partial enum-keyed records are refused the same way", () => {
    const literal = z.object({ x: z.record(z.literal("medicine"), z.string()) });
    const partial = z.object({ y: z.partialRecord(z.enum(["address", "slug"]), z.string()) });
    expect(neverPublicFields({ literal, partial })).toEqual([
      { path: "literal.x.medicine", rule: "never-public-name" },
      { path: "partial.y.address", rule: "never-public-name" },
    ]);
  });

  test("T8 the surface names each fixed key of a record, so the snapshot diff shows them", () => {
    const sample = z.object({ prices: z.record(z.enum(["pricePaid", "orderId"]), z.number()) });
    expect(publicSurface({ sample })).toEqual(["sample.prices.orderId: number", "sample.prices.pricePaid: number"]);
  });

  test("T8 a record keyed by a union of a literal and a pattern lists the literal key and keeps .* for the rest", () => {
    const sample = z.object({ m: z.record(z.union([z.literal("x"), z.string().regex(/^q/)]), z.number()) });
    expect(publicSurface({ sample })).toEqual(["sample.m.*: number", "sample.m.x: number"]);
    expect(openShapes({ sample })).toEqual([]);
  });
});
