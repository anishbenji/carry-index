import { z } from "zod";

/** The regions an airline's fit row can name: the seven PR 8's real fit files use. Module-local, not exported. */
const REGIONS = ["Africa", "Asia", "Europe", "Middle East", "North America", "Oceania", "South America"] as const;

const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * A bag's airline-fit table, published as the static `data/fit/<slug>.json` that loads on demand (unified brief, "How
 * a page gets its data"). Strict at every level, with every string and list bounded, so the deploy gate can refuse
 * any fit file that carries anything else (security-sol r2, S2-3). `airlines` and `variants` and a variant's `id`
 * and `marks` are optional: the gate's synthetic test fixtures carry partial fit files. `marks` holds one `y`, `n`
 * or `u` per airline.
 */
export const fitSchema = z.strictObject({
  slug,
  airlines: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(100),
        regions: z.array(z.enum(REGIONS)).min(1).max(REGIONS.length),
        checked: z.iso.date().nullable(),
      }),
    )
    .max(1000)
    .optional(),
  variants: z
    .array(
      z.strictObject({
        id: slug.optional(),
        name: z.string().min(1).max(200),
        marks: z
          .string()
          .max(1000)
          .regex(/^[ynu]*$/)
          .optional(),
      }),
    )
    .max(50)
    .optional(),
});

export type Fit = z.infer<typeof fitSchema>;
