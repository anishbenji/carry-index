import type { JSX } from "@solidjs/web";
import { render } from "@solidjs/web";
import { describe, expect, it } from "vitest";
import { BagPage, byWeight, ListingPage, NotFoundPage, SiteLayout } from "../src/pages.tsx";
import { CATALOGUE } from "./fixtures.ts";

function mount(view: () => JSX.Element): { root: HTMLElement; done: () => void } {
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(view, root);
  return {
    root,
    done: () => {
      dispose();
      root.remove();
    },
  };
}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim();

describe("SiteLayout", () => {
  it("puts a header linking to the listing before the page's main landmark", () => {
    const { root, done } = mount(() => (
      <SiteLayout>
        <p>content</p>
      </SiteLayout>
    ));
    try {
      expect(root.querySelector("header a")?.getAttribute("href")).toBe("/uhmwpe-backpacks");
      expect(text(root.querySelector("main"))).toBe("content");
    } finally {
      done();
    }
  });
});

describe("byWeight", () => {
  const build = {
    slug: "test-bag-a",
    name: "Test Bag",
    brand: "Example Maker",
    weightGrams: 900,
    capacityLitres: 20,
    fabric: "uhmwpe" as const,
  };

  it("is a total order: 0 on a full tie, and opposite signs either way round (N11)", () => {
    expect(byWeight(build, { ...build })).toBe(0);
    for (const other of [
      { ...build, weightGrams: 901 },
      { ...build, name: "Test Bag B" },
      { ...build, brand: "Second Maker" },
      { ...build, slug: "test-bag-b" },
    ]) {
      expect(byWeight(build, other), JSON.stringify(other)).toBeLessThan(0);
      expect(byWeight(other, build), JSON.stringify(other)).toBeGreaterThan(0);
    }
  });
});

describe("ListingPage", () => {
  it("lists every build, lightest first, each linking to its bag's page with its public facts", () => {
    const { root, done } = mount(() => <ListingPage models={CATALOGUE.models} />);
    try {
      expect(text(root.querySelector("h1"))).toBe("Backpacks");
      const items = [...root.querySelectorAll("ol > li")];
      expect(items.map((li) => text(li.querySelector("h2")))).toEqual([
        "Example Pack 30L Light",
        "Test Bag 20L",
        "Example Pack 30L Heavy",
      ]);
      expect(items.map((li) => li.querySelector("h2 a")?.getAttribute("href"))).toEqual([
        "/bags/example-pack-30l",
        "/bags/test-bag-20l",
        "/bags/example-pack-30l",
      ]);
      expect([...(items[1]?.querySelectorAll("dt, dd") ?? [])].map(text)).toEqual([
        "Maker",
        "Second Maker",
        "Weight",
        "950 g",
        "Capacity",
        "20.5 L",
        "Fabric",
        "X-Pac",
      ]);
      expect(text(root.querySelector(".count"))).toBe("3 builds of 2 bags, lightest first.");
    } finally {
      done();
    }
  });
});

describe("BagPage", () => {
  it("names the bag and its maker and tables every build's public facts", () => {
    const model = CATALOGUE.models[0];
    if (!model) throw new Error("fixture has no model");
    const { root, done } = mount(() => <BagPage model={model} />);
    try {
      expect(text(root.querySelector("h1"))).toBe("Example Pack 30L");
      expect(text(root.querySelector(".maker"))).toBe("Example Maker");
      expect([...root.querySelectorAll("thead th")].map(text)).toEqual(["Build", "Weight", "Capacity", "Fabric"]);
      expect([...root.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(text))).toEqual([
        ["Example Pack 30L Heavy", "1.23 kg", "30 L", "UHMWPE"],
        ["Example Pack 30L Light", "812 g", "30 L", "UHMWPE"],
      ]);
      expect(root.querySelector("tbody th")?.getAttribute("scope")).toBe("row");
      expect(root.querySelector('a[href="/uhmwpe-backpacks"]')?.textContent).toBe("All backpacks");
    } finally {
      done();
    }
  });
});

describe("NotFoundPage", () => {
  it("says the page was not found and links to the listing", () => {
    const { root, done } = mount(() => <NotFoundPage />);
    try {
      expect(text(root.querySelector("h1"))).toBe("Page not found");
      expect(root.querySelector('a[href="/uhmwpe-backpacks"]')).not.toBeNull();
    } finally {
      done();
    }
  });
});
