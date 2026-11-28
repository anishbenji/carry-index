/** T8, added for security review r2 (P3): every catalogue export is a schema or a named constant. */
import * as catalogue from "@cj/schema";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { unknownExports } from "../src/surface.ts";

describe("T8 check 1: every catalogue export is a schema or a named constant (security review r2, P3)", () => {
  test("T8 the catalogue's exports are all schemas or allow-listed constants (positive control)", () => {
    expect(unknownExports(catalogue)).toEqual([]);
  });

  test.each([
    ["an object holding a schema", { published: { bag: z.object({ pricePaid: z.number() }) } }, "published"],
    ["an array holding a schema", { list: [z.object({ a: z.string() })] }, "list"],
    ["a constant not on the allow-list", { OTHER: ["a", "b"] }, "OTHER"],
    ["a function", { make: () => z.object({ a: z.string() }) }, "make"],
  ])("T8 %s is refused as surface-unknown-export", (_name, module, path) => {
    expect(unknownExports({ bagSchema: catalogue.bagSchema, FABRICS: catalogue.FABRICS, ...module })).toEqual([
      { path, rule: "surface-unknown-export" },
    ]);
  });
});
