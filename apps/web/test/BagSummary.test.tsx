import type { Bag } from "@cj/schema";
import { render } from "@solidjs/web";
import { describe, expect, it } from "vitest";
import { BagSummary } from "../src/BagSummary.tsx";

const bag: Bag = {
  slug: "example-pack-30",
  name: "Example Pack 30",
  brand: "Example Brand",
  weightGrams: 812,
  capacityLitres: 30,
  fabric: "uhmwpe",
};

describe("BagSummary", () => {
  it("renders the bag's name, brand and formatted weight into the DOM", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => <BagSummary bag={bag} />, container);
    try {
      expect(container.querySelector("strong")?.textContent).toBe("Example Pack 30");
      expect(container.textContent).toContain("by Example Brand: 812 g, 30 L, uhmwpe");
    } finally {
      dispose();
      container.remove();
    }
  });
});
