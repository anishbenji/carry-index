import type { CatalogueExport } from "@cj/schema";

/** A synthetic catalogue export: made-up makers and bags, two models, three builds. */
export const CATALOGUE: CatalogueExport = {
  models: [
    {
      slug: "example-pack-30l",
      name: "Example Pack 30L",
      brand: "Example Maker",
      builds: [
        {
          slug: "example-pack-30l-heavy",
          name: "Example Pack 30L Heavy",
          brand: "Example Maker",
          weightGrams: 1234,
          capacityLitres: 30,
          fabric: "uhmwpe",
        },
        {
          slug: "example-pack-30l-light",
          name: "Example Pack 30L Light",
          brand: "Example Maker",
          weightGrams: 812,
          capacityLitres: 30,
          fabric: "uhmwpe",
        },
      ],
    },
    {
      slug: "test-bag-20l",
      name: 'Test Bag <20L> & "Co"',
      brand: "Second Maker",
      builds: [
        {
          slug: "test-bag-20l",
          name: "Test Bag 20L",
          brand: "Second Maker",
          weightGrams: 950,
          capacityLitres: 20.5,
          fabric: "x-pac",
        },
      ],
    },
  ],
};
