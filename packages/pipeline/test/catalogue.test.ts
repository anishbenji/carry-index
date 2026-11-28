import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bagSchema } from "@cj/schema";
import { describe, expect, it } from "vitest";
import { catalogueFrom, fabricOf, readCatalogue } from "../src/catalogue.ts";

// Synthetic catalogue: made-up makers, bags and fabrics in the shape of `data/`.
const BRANDS = `
example-maker:
  name: Example Maker
  site: https://maker.example
second-maker:
  name: Second Maker
`;

const MATERIALS = `
test-uhmwpe-a:
  name: Test UHMWPE A
  family: TEST A
  fibre: UHMWPE
test-uhmwpe-b:
  name: Test UHMWPE B
  fibre: UHMWPE
test-nylon:
  name: Test nylon
  family: nylon
test-grid:
  name: Test grid
  family: Grid
  fibre: recycled nylon with a grid
`;

const MODEL = `
migration:
  source: synthetic
model:
  id: example-pack-30l
  brand: example-maker
  label: Example Pack 30L
  photos:
  - file: img/example.jpg
variants:
- id: example-pack-30l-light
  name: Example Pack 30L Light
  fabric:
    shell: [test-uhmwpe-a, test-uhmwpe-b]
  volume_l: 30
  weight_g: 812
  price:
    amount: 100
  notes: a working note that must not travel
- id: example-pack-30l-heavy
  name: Example Pack 30L Heavy
  fabric:
    shell: [test-uhmwpe-a]
  volume_l: 30
  weight_g: 1234
- id: example-pack-30l-nylon
  name: Example Pack 30L Nylon
  record: comparison
  fabric:
    shell: [test-nylon]
  volume_l: 30
  weight_g: 1500
`;

const SECOND = `
model:
  id: another-bag-20l
  brand: second-maker
  label: Another Bag 20L
variants:
- id: another-bag-20l
  name: Another Bag 20L
  fabric:
    shell: [test-uhmwpe-b]
  volume_l: 20.5
  weight_g: 640
`;

const files = (...texts: string[]) => texts.map((text, i) => ({ path: `data/bags/x/model-${i}.yaml`, text }));

describe("fabricOf", () => {
  it("reads a UHMWPE fibre as uhmwpe whatever the family", () => {
    expect(fabricOf("a", { fibre: "UHMWPE", family: "ULTRA X" })).toBe("uhmwpe");
  });

  it("reads the listed families by name, ignoring case", () => {
    expect(fabricOf("a", { family: "nylon" })).toBe("nylon");
    expect(fabricOf("a", { family: "X-Pac" })).toBe("x-pac");
    expect(fabricOf("a", { family: "ECOPAK", fibre: "recycled polyester" })).toBe("ecopak");
    expect(fabricOf("a", { family: "polyester" })).toBe("polyester");
  });

  it("throws naming the material when it maps to no listed fabric", () => {
    expect(() => fabricOf("test-grid", { family: "Grid", fibre: "recycled nylon with a grid" })).toThrow(/test-grid/);
  });
});

describe("catalogueFrom", () => {
  it("returns each model with its listed builds as schema-checked bags, maker names resolved", () => {
    const [model] = catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(MODEL) });
    expect(model).toEqual({
      slug: "example-pack-30l",
      name: "Example Pack 30L",
      brand: "Example Maker",
      builds: [
        {
          slug: "example-pack-30l-light",
          name: "Example Pack 30L Light",
          brand: "Example Maker",
          weightGrams: 812,
          capacityLitres: 30,
          fabric: "uhmwpe",
        },
        {
          slug: "example-pack-30l-heavy",
          name: "Example Pack 30L Heavy",
          brand: "Example Maker",
          weightGrams: 1234,
          capacityLitres: 30,
          fabric: "uhmwpe",
        },
      ],
    });
    for (const build of model?.builds ?? []) expect(bagSchema.parse(build)).toEqual(build);
  });

  it("carries no field outside the public bag shape", () => {
    const text = JSON.stringify(catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(MODEL) }));
    for (const word of ["price", "notes", "working note", "photos", "migration", "comparison", "maker.example"]) {
      expect(text).not.toContain(word);
    }
  });

  it("sorts models by maker, then name", () => {
    const models = catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(SECOND, MODEL) });
    expect(models.map((m) => m.slug)).toEqual(["example-pack-30l", "another-bag-20l"]);
  });

  it("throws naming the file when a build breaks the bag schema", () => {
    const broken = MODEL.replace("weight_g: 812", "weight_g: 812.5");
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(broken) })).toThrow(
      /data\/bags\/x\/model-0\.yaml.*example-pack-30l-light/,
    );
  });

  it("throws when a build has no published weight or capacity", () => {
    const noWeight = SECOND.replace("  weight_g: 640\n", "");
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(noWeight) })).toThrow(
      /another-bag-20l/,
    );
  });

  it("throws when a build's shell fabrics map to different fabrics", () => {
    const mixed = SECOND.replace("[test-uhmwpe-b]", "[test-uhmwpe-b, test-nylon]");
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(mixed) })).toThrow(/test-nylon/);
  });

  it("throws on a maker or fabric the catalogue does not list", () => {
    const badBrand = SECOND.replace("brand: second-maker", "brand: nobody");
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(badBrand) })).toThrow(/nobody/);
    const badFabric = SECOND.replace("[test-uhmwpe-b]", "[test-unknown]");
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(badFabric) })).toThrow(
      /test-unknown/,
    );
  });

  it("throws on a model slug that is not lowercase kebab-case, or used twice", () => {
    const badSlug = SECOND.replace("id: another-bag-20l\n  brand", "id: ../another\n  brand");
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(badSlug) })).toThrow(/slug/);
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(SECOND, SECOND) })).toThrow(
      /another-bag-20l.*twice/,
    );
  });

  it("throws on a model with no listed build", () => {
    const onlyComparison = SECOND.replace(
      "  name: Another Bag 20L\n",
      "  name: Another Bag 20L\n  record: comparison\n",
    );
    expect(() => catalogueFrom({ brands: BRANDS, materials: MATERIALS, models: files(onlyComparison) })).toThrow(
      /no listed build/,
    );
  });
});

describe("readCatalogue", () => {
  const repo = fileURLToPath(new URL("../../../", import.meta.url));

  it("reads every model file under data/bags of the repository", () => {
    const count = readdirSync(join(repo, "data/bags"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((dir) => readdirSync(join(repo, "data/bags", dir.name)).filter((name) => name.endsWith(".yaml"))).length;
    const models = readCatalogue(repo);
    expect(count).toBeGreaterThan(0);
    expect(models).toHaveLength(count);
    for (const model of models) {
      expect(model.builds.length).toBeGreaterThan(0);
      for (const build of model.builds) expect(bagSchema.parse(build)).toEqual(build);
    }
  });
});
