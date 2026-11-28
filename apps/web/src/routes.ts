/**
 * The public site's routes for this slice. The deployed Worker serves assets with `html_handling:
 * "drop-trailing-slash"` (packages/deploy/src/workers.ts), so `bags/<slug>.html` is served at `/bags/<slug>` (the
 * ADR-0023 route) and the gate's allow-list accepts exactly these file names.
 */
export const LISTING_PATH = "/";
export const LISTING_FILE = "index.html";
export const NOT_FOUND_FILE = "404.html";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The slug, after checking it is lowercase kebab-case (the schema's rule), so it can name no other path. */
function checked(slug: string): string {
  if (!SLUG.test(slug)) throw new Error(`bag slug ${JSON.stringify(slug)} is not lowercase kebab-case`);
  return slug;
}

export const bagPath = (slug: string): string => `/bags/${checked(slug)}`;
export const bagFile = (slug: string): string => `bags/${checked(slug)}.html`;
