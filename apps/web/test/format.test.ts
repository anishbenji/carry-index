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

  it("rounds a tie at 5 g up every time, whatever the binary value of grams / 1000", () => {
    expect(formatWeight(1005)).toBe("1.01 kg");
    expect(formatWeight(1015)).toBe("1.02 kg");
    expect(formatWeight(1045)).toBe("1.05 kg");
    expect(formatWeight(8125)).toBe("8.13 kg");
  });
});
