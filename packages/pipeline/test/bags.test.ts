import { describe, expect, it } from "vitest";
import { readBags } from "../src/bags.ts";

const YAML = `
- slug: example-pack-30
  name: Example Pack 30
  brand: Example Brand
  weightGrams: 812
  capacityLitres: 30
  fabric: uhmwpe
`;

describe("readBags", () => {
  it("parses a YAML list of bags and validates each one", () => {
    expect(readBags(YAML)).toEqual([
      {
        slug: "example-pack-30",
        name: "Example Pack 30",
        brand: "Example Brand",
        weightGrams: 812,
        capacityLitres: 30,
        fabric: "uhmwpe",
      },
    ]);
  });

  it("throws naming the entry when one bag is invalid", () => {
    expect(() => readBags(YAML.replace("weightGrams: 812", "weightGrams: -1"))).toThrow(/bag 0/);
  });

  it("throws when the document is not a list", () => {
    expect(() => readBags("slug: x")).toThrow(/list/);
  });
});
