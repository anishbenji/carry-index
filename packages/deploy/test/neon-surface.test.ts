/**
 * Independent review (Neon) N4: Zod writes a second pattern or `multipleOf` check as an `allOf` of refinement-only
 * sub-schemas beside the primitive `type` (`{ type: "string", allOf: [{ pattern }, { pattern }] }`). The surface walk
 * visited each sub-schema on its own, found no type, and reported a false `open-shape` (and `string|unknown` on the
 * surface). A sub-schema of refinement keywords only, under a node with a primitive `type`, is now part of that type.
 * A truly open member (`{}`, as from an intersection with `z.any()`) is still open.
 */
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { openShapes, publicSurface } from "../src/surface.ts";

describe("stacked refinements are not open shapes (N4)", () => {
  test.each([
    ["two string patterns (startsWith and endsWith)", z.string().startsWith("a").endsWith("z"), "string"],
    ["two regex checks", z.string().regex(/^a/).regex(/z$/), "string"],
    ["two multipleOf checks", z.number().multipleOf(2).multipleOf(3), "number"],
    ["two lengths and two patterns", z.string().min(1).max(9).regex(/a/).regex(/b/), "string"],
  ])("%s: closed, one type on the surface", (_name, field, type) => {
    const sample = z.strictObject({ f: field });
    expect(openShapes({ sample })).toEqual([]);
    expect(publicSurface({ sample })).toEqual([`sample.f: ${type}`]);
  });

  test("an intersection with z.any() is still open (control)", () => {
    const sample = z.strictObject({ f: z.intersection(z.string(), z.any()) });
    expect(openShapes({ sample })).toEqual([{ path: "sample.f", rule: "open-shape" }]);
  });
});
