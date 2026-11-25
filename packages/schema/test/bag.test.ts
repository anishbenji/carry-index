import { describe, expect, expectTypeOf, it } from "vitest";
import { type Bag, bagSchema } from "../src/index.ts";

const sample = {
  slug: "example-pack-30",
  name: "Example Pack 30",
  brand: "Example Brand",
  weightGrams: 812,
  capacityLitres: 30,
  fabric: "uhmwpe",
};

describe("bagSchema", () => {
  it("accepts a well-formed bag and returns it unchanged", () => {
    expect(bagSchema.parse(sample)).toEqual(sample);
  });

  it("rejects a slug that is not lowercase kebab-case", () => {
    expect(bagSchema.safeParse({ ...sample, slug: "Example Pack" }).success).toBe(false);
  });

  it("rejects a non-integer or non-positive weight", () => {
    expect(bagSchema.safeParse({ ...sample, weightGrams: 812.5 }).success).toBe(false);
    expect(bagSchema.safeParse({ ...sample, weightGrams: 0 }).success).toBe(false);
  });

  it("rejects a fabric outside the list", () => {
    expect(bagSchema.safeParse({ ...sample, fabric: "cotton" }).success).toBe(false);
  });

  it("rejects unknown keys rather than passing them through", () => {
    expect(bagSchema.safeParse({ ...sample, pricePaid: 1 }).success).toBe(false);
  });

  it("infers the Bag type from the schema", () => {
    expectTypeOf<Bag["weightGrams"]>().toEqualTypeOf<number>();
    expectTypeOf<Bag["fabric"]>().toEqualTypeOf<"uhmwpe" | "ecopak" | "x-pac" | "nylon" | "polyester">();
  });
});
