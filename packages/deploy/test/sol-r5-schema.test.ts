/**
 * Sol security r3, S5-2: `z.toJSONSchema` overlays a schema's registered metadata on the shape it generates, so
 * `.meta({ properties: ... })` could hide a field from Check 1 while the parser still returns it. Check 1 converts
 * with an empty metadata registry.
 */
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { neverPublicFields, openShapes, publicSurface } from "../src/surface.ts";

describe("check 1 ignores registered metadata (S5-2)", () => {
  const hidden = z
    .strictObject({ name: z.string(), pricePaid: z.number() })
    .meta({ properties: { name: { type: "string" } }, required: ["name"] });

  test("the metadata really does hide the field from a plain conversion (the attack)", () => {
    expect(JSON.stringify(z.toJSONSchema(hidden, { io: "output" }))).not.toContain("pricePaid");
  });

  test("a never-public field hidden by metadata is still found", () => {
    expect(neverPublicFields({ sample: hidden })).toEqual([{ path: "sample.pricePaid", rule: "never-public-name" }]);
  });

  test("the surface still lists the hidden field", () => {
    expect(publicSurface({ sample: hidden })).toEqual(["sample.name: string", "sample.pricePaid: number"]);
  });

  test("metadata cannot close an open shape", () => {
    const loose = z.looseObject({ name: z.string() }).meta({ additionalProperties: false });
    expect(openShapes({ sample: loose })).toEqual([{ path: "sample", rule: "open-shape" }]);
  });
});
