import { z } from "zod";

/** Main body fabrics the catalogue tracks. A minimal list for the scaffold; the data model phase extends it. */
export const FABRICS = ["uhmwpe", "ecopak", "x-pac", "nylon", "polyester"] as const;
export type Fabric = (typeof FABRICS)[number];

/**
 * A public catalogue bag: the smallest shape that exercises Zod 4 and its inferred types through the
 * toolchain. Strict, so a private field such as a price paid can never ride along unnoticed.
 */
export const bagSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  brand: z.string().min(1),
  weightGrams: z.int().positive(),
  capacityLitres: z.number().positive(),
  fabric: z.enum(FABRICS),
});

export type Bag = z.infer<typeof bagSchema>;
