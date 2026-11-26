/**
 * Security-sol round 2, S2-5: Zod runs `.overwrite()` callbacks and transforms after parsing, while the JSON Schema
 * the surface walk reads still shows the declared shape, so a callback could add purchase data the snapshot and the
 * never-public check never see. Check 1 refuses every overwrite check (`.trim()` and the other string normalisers
 * are overwrites too), every transform (`.transform()`, `z.preprocess()`) and every codec, at any depth, as
 * `schema-rewrite`.
 */
import * as catalogue from "@cj/schema";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { rewriteProblems } from "../src/surface.ts";

const inner = z.strictObject({ a: z.string() });
const enrich = (value: { a: string }) => ({ ...value, pricePaid: 1 }) as { a: string };

describe("check 1 refuses schemas that rewrite their output (S2-5)", () => {
  test("the catalogue schemas rewrite nothing (positive control)", () => {
    expect(rewriteProblems(catalogue)).toEqual([]);
  });

  test("an object-valued .overwrite() is refused even though its JSON Schema shows only the declared keys", () => {
    const sample = z.strictObject({ o: inner.overwrite(enrich) });
    expect(z.toJSONSchema(sample, { io: "output" })).toMatchObject({
      properties: { o: { additionalProperties: false } },
    });
    expect(rewriteProblems({ sample })).toEqual([{ path: "sample.o", rule: "schema-rewrite" }]);
  });

  test.each([
    ["an overwrite on the export itself", inner.overwrite(enrich), "sample"],
    ["a string .trim()", z.strictObject({ s: z.string().trim() }), "sample.s"],
    ["a .transform()", z.strictObject({ s: z.string().transform((s) => s) }), "sample.s"],
    ["a z.preprocess()", z.strictObject({ s: z.preprocess((x) => x, z.string()) }), "sample.s"],
    ["a codec", z.strictObject({ n: z.codec(z.string(), z.number(), { decode: Number, encode: String }) }), "sample.n"],
    ["an overwrite in an array's items", z.strictObject({ l: z.array(inner.overwrite(enrich)) }), "sample.l[]"],
    ["an overwrite inside an optional", z.strictObject({ o: inner.overwrite(enrich).optional() }), "sample.o"],
    [
      "an overwrite in a union branch",
      z.strictObject({ u: z.union([z.string(), inner.overwrite(enrich)]) }),
      "sample.u",
    ],
    [
      "an overwrite in a record's values",
      z.strictObject({ m: z.record(z.enum(["k"]), inner.overwrite(enrich)) }),
      "sample.m.*",
    ],
    ["an overwrite behind a z.lazy()", z.strictObject({ x: z.lazy(() => inner.overwrite(enrich)) }), "sample.x"],
    ["a pipe into a transform", z.strictObject({ p: z.string().pipe(z.transform((s: string) => s)) }), "sample.p"],
  ])("%s is refused as schema-rewrite", (_name, sample, path) => {
    expect(rewriteProblems({ sample })).toEqual([{ path, rule: "schema-rewrite" }]);
  });

  test("a recursive schema is walked once and does not loop", () => {
    interface Node {
      name: string;
      children: Node[];
    }
    const node: z.ZodType<Node> = z.strictObject({
      name: z.string(),
      get children() {
        return z.array(node);
      },
    });
    expect(rewriteProblems({ node })).toEqual([]);
  });

  test("checks that only validate are accepted (positive control)", () => {
    const sample = z.strictObject({
      s: z
        .string()
        .min(1)
        .regex(/^[a-z]+$/),
      n: z.int().positive(),
      e: z.enum(["a"]),
    });
    expect(rewriteProblems({ sample })).toEqual([]);
  });
});

/**
 * The director's follow-up to S2-5: an allow-list. Only check kinds that validate without changing the value pass
 * (lengths, sizes, string formats and patterns, number comparisons and formats, multipleOf, MIME types, and the
 * metadata-only describe and meta). `refine`, `superRefine`, `.check()` with a function and `z.custom()` hand the
 * value to a callback that can change it; a function-valued `.catch()` or `.default()` returns whatever the function
 * makes, unparsed. All are `schema-rewrite`.
 */
describe("check 1 allows only checks that validate (S2-5 allow-list)", () => {
  let calls = 0;
  test.each([
    ["a .refine()", z.strictObject({ s: z.string().refine(() => true) }), "sample.s"],
    ["a .superRefine()", z.strictObject({ s: z.string().superRefine(() => {}) }), "sample.s"],
    ["a .check() with a function", z.strictObject({ s: z.string().check(() => {}) }), "sample.s"],
    ["a refine on an object", inner.refine((o) => o.a !== ""), "sample"],
    ["a z.custom()", z.strictObject({ c: z.custom<string>(() => true) }), "sample.c"],
    ["a function-valued .catch()", z.strictObject({ s: z.string().catch(() => "made") }), "sample.s"],
    ["a function-valued .default()", z.strictObject({ n: z.number().default(() => ++calls) }), "sample.n"],
    ["a refine inside an array", z.strictObject({ l: z.array(z.string().refine(() => true)) }), "sample.l[]"],
    // S5-3: any default or prefault, constant or not: a default can return private data later, unvalidated.
    ["a constant .default()", z.strictObject({ f: z.number().default(3) }), "sample.f"],
    ["a .prefault()", z.strictObject({ p: inner.prefault({ a: "x" }) }), "sample.p"],
    [
      "an array .default() that is empty when inspected",
      z.strictObject({ l: z.array(inner).default(() => []) }),
      "sample.l",
    ],
  ])("%s is refused as schema-rewrite", (_name, sample, path) => {
    expect(rewriteProblems({ sample })).toEqual([{ path, rule: "schema-rewrite" }]);
  });

  test("validate-only checks, a constant .catch() and metadata are accepted (positive control)", () => {
    const sample = z.strictObject({
      s: z
        .string()
        .min(1)
        .max(9)
        .length(3)
        .regex(/^[a-z]+$/)
        .startsWith("a")
        .endsWith("c")
        .includes("b"),
      e: z.email(),
      d: z.iso.date(),
      n: z.number().gt(0).lte(10).multipleOf(2),
      i: z.int().positive(),
      l: z.array(z.string()).min(1).max(3),
      k: z.enum(["a", "b"]),
      t: z.literal("x"),
      c: z.string().catch("constant"),
      m: z.string().describe("described").meta({ title: "meta" }),
    });
    expect(rewriteProblems({ sample })).toEqual([]);
  });
});
