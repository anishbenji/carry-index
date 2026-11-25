import { describe, expect, it } from "vitest";
import { formatWeight } from "../src/format.ts";

describe("formatWeight", () => {
  it("shows grams below a kilogram", () => {
    expect(formatWeight(812)).toBe("812 g");
  });

  it("shows kilograms to two decimals from a kilogram up", () => {
    expect(formatWeight(1000)).toBe("1.00 kg");
    expect(formatWeight(1234)).toBe("1.23 kg");
  });
});
