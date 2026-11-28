/**
 * Formats a weight in grams for display: grams below a kilogram, kilograms to two decimals from one up. Rounds in
 * whole tens of grams first, so a tie (1005 g) always rounds up rather than following the binary value of 1.005.
 */
export function formatWeight(grams: number): string {
  return grams < 1000 ? `${grams} g` : `${(Math.round(grams / 10) / 100).toFixed(2)} kg`;
}
