import type { Fabric } from "@cj/schema";

/**
 * Formats a weight in grams for display: grams below a kilogram, kilograms to two decimals from one up. Rounds in
 * whole tens of grams first, so a tie (1005 g) always rounds up rather than following the binary value of 1.005.
 */
export function formatWeight(grams: number): string {
  return grams < 1000 ? `${grams} g` : `${(Math.round(grams / 10) / 100).toFixed(2)} kg`;
}

/** A capacity in litres, as published. */
export function formatCapacity(litres: number): string {
  return `${litres} L`;
}

const FABRIC_NAMES: Readonly<Record<Fabric, string>> = {
  uhmwpe: "UHMWPE",
  ecopak: "EcoPak",
  "x-pac": "X-Pac",
  nylon: "Nylon",
  polyester: "Polyester",
};

/** A listed fabric's display name. */
export function formatFabric(fabric: Fabric): string {
  return FABRIC_NAMES[fabric];
}
