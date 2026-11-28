import type { Bag } from "@cj/schema";
import { render } from "@solidjs/web";
import { BagSummary } from "./BagSummary.tsx";

// Synthetic sample for the toolchain spike. Spike PR 7 replaces this entry with start mode and prerendering.
const sample: Bag = {
  slug: "example-pack-30",
  name: "Example Pack 30",
  brand: "Example Brand",
  weightGrams: 812,
  capacityLitres: 30,
  fabric: "uhmwpe",
};

const mount = document.getElementById("app");
if (mount) render(() => <BagSummary bag={sample} />, mount);
