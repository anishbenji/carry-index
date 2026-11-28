/**
 * The public site's routes for this slice (ADR-0023). The deployed Worker serves assets with `html_handling:
 * "drop-trailing-slash"` (packages/deploy/src/workers.ts), so `uhmwpe-backpacks.html` is served at
 * `/uhmwpe-backpacks` and `bags/<slug>.html` at `/bags/<slug>`; the gate's allow-list accepts exactly these names.
 */
export const LISTING_PATH = "/uhmwpe-backpacks";
export const LISTING_FILE = "uhmwpe-backpacks.html";
export const NOT_FOUND_FILE = "404.html";

/** `/` has no page of its own yet: a `_redirects` rule sends it to the listing, temporarily (302). */
export const HOME_REDIRECT = `/ ${LISTING_PATH} 302\n`;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The slug, after checking it is lowercase kebab-case (the schema's rule), so it can name no other path. */
function checked(slug: string): string {
  if (!SLUG.test(slug)) throw new Error(`bag slug ${JSON.stringify(slug)} is not lowercase kebab-case`);
  return slug;
}

export const bagPath = (slug: string): string => `/bags/${checked(slug)}`;
export const bagFile = (slug: string): string => `bags/${checked(slug)}.html`;
