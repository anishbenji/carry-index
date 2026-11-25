/** Formats a weight in grams for display: grams below a kilogram, kilograms to two decimals from one up. */
export function formatWeight(grams: number): string {
  return grams < 1000 ? `${grams} g` : `${(grams / 1000).toFixed(2)} kg`;
}
