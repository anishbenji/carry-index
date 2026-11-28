import { describe, expect, it } from "vitest";
import { formatCapacity, formatFabric, formatWeight } from "../src/format.ts";

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

describe("formatCapacity", () => {
  it("shows litres with the unit, keeping a published half litre", () => {
    expect(formatCapacity(30)).toBe("30 L");
    expect(formatCapacity(20.5)).toBe("20.5 L");
  });
});

describe("formatFabric", () => {
  it("names each listed fabric as it is written", () => {
    expect(formatFabric("uhmwpe")).toBe("UHMWPE");
    expect(formatFabric("ecopak")).toBe("EcoPak");
    expect(formatFabric("x-pac")).toBe("X-Pac");
    expect(formatFabric("nylon")).toBe("Nylon");
    expect(formatFabric("polyester")).toBe("Polyester");
  });
});
