import type { Bag } from "./bag.ts";

/**
 * A bag page's data: one model and its listed builds. Plain types, no schema: `packages/pipeline` builds these from
 * `data/`, checking every build against the strict `bagSchema`, and `apps/web` imports them with `import type`. The
 * model's own fields are the same kinds as a bag's (a slug, a name, a maker), so a page built from them shows only
 * what the public surface (`packages/deploy/public-surface.json`) allows.
 */
export interface CatalogueModel {
  slug: string;
  name: string;
  brand: string;
  builds: Bag[];
}

/** The public catalogue export the site build reads (`packages/pipeline/src/cli/export.ts`). */
export interface CatalogueExport {
  /** Every model with all its listed builds: the bag pages. */
  models: CatalogueModel[];
  /** The UHMWPE section listing: the same models with only the builds the section's rule admits. */
  listing: CatalogueModel[];
}
