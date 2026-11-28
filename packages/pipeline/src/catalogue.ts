import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogueModel, Fabric } from "@cj/schema";
import { bagSchema } from "@cj/schema";
import { parse } from "yaml";
import { z } from "zod";

// The source files hold far more (sources, claims, prices, photos, notes); these stripping shapes read only the
// keys a `Bag` is made from. They are local on purpose: the public surface stays `bagSchema`, which every build is
// checked against before it leaves this module.
const namesFile = z.record(z.string(), z.object({ name: z.string().min(1) }));
const materialsFile = z.record(z.string(), z.object({ fibre: z.string().optional(), family: z.string().optional() }));
const modelFile = z.object({
  model: z.object({
    id: z.string(),
    brand: z.string().min(1),
    label: z.string().min(1),
  }),
  variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        record: z.string().optional(),
        fabric: z.object({ shell: z.array(z.string()) }).optional(),
        volume_l: z.number().nullable().optional(),
        weight_g: z.number().nullable().optional(),
      }),
    )
    .min(1),
});

/** Families read by name; anything with a UHMWPE fibre is `uhmwpe` first. */
const FAMILIES: Readonly<Record<string, Fabric>> = {
  ecopak: "ecopak",
  "x-pac": "x-pac",
  nylon: "nylon",
  polyester: "polyester",
};

/** The listed fabric a material belongs to, from `data/materials.yaml`; throws, naming it, when there is none. */
export function fabricOf(id: string, material: { fibre?: string | undefined; family?: string | undefined }): Fabric {
  if (material.fibre?.toUpperCase() === "UHMWPE") return "uhmwpe";
  const fabric = FAMILIES[material.family?.toLowerCase() ?? ""];
  if (!fabric) throw new Error(`material ${id} maps to no listed fabric`);
  return fabric;
}

/** Parses and validates one file; a YAML syntax error or a schema failure throws, naming the file. */
function parseYaml<T extends z.ZodType>(schema: T, path: string, text: string): z.infer<T> {
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const result = schema.safeParse(doc);
  if (!result.success) throw new Error(`${path}: ${result.error.message}`);
  return result.data;
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Builds the catalogue from the text of `data/brands.yaml`, `data/materials.yaml` and each model file. Builds marked
 * `record: comparison` are left out: the data keeps them only for comparison and lists them nowhere (README-data).
 * Fails on the first problem, naming the file and build. Models come sorted by maker, then name.
 */
export function catalogueFrom(input: {
  brands: string;
  materials: string;
  models: readonly { path: string; text: string }[];
}): CatalogueModel[] {
  const brands = parseYaml(namesFile, "data/brands.yaml", input.brands);
  const materials = parseYaml(materialsFile, "data/materials.yaml", input.materials);
  const seen = new Set<string>();
  const models = input.models.map(({ path, text }): CatalogueModel => {
    const file = parseYaml(modelFile, path, text);
    const { id: slug, label: name } = file.model;
    if (!bagSchema.shape.slug.safeParse(slug).success) {
      throw new Error(`${path}: model slug ${JSON.stringify(slug)} is not lowercase kebab-case`);
    }
    if (seen.has(slug)) throw new Error(`${path}: model ${slug} appears twice`);
    seen.add(slug);
    const brand = brands[file.model.brand]?.name;
    if (!brand) throw new Error(`${path}: maker ${file.model.brand} is not in data/brands.yaml`);
    const builds = file.variants
      .filter((variant) => variant.record !== "comparison")
      .map((variant) => {
        const fabrics = new Set(
          (variant.fabric?.shell ?? []).map((id) => {
            const material = materials[id];
            if (!material)
              throw new Error(`${path}: build ${variant.id}: material ${id} is not in data/materials.yaml`);
            return fabricOf(id, material);
          }),
        );
        if (fabrics.size > 1) {
          throw new Error(
            `${path}: build ${variant.id}: shell ${variant.fabric?.shell.join(", ")} maps to ${[...fabrics].join(", ")}`,
          );
        }
        const result = bagSchema.safeParse({
          slug: variant.id,
          name: variant.name,
          brand,
          weightGrams: variant.weight_g,
          capacityLitres: variant.volume_l,
          fabric: [...fabrics][0],
        });
        if (!result.success) throw new Error(`${path}: build ${variant.id}: ${result.error.message}`);
        return result.data;
      });
    if (builds.length === 0) throw new Error(`${path}: model ${slug} has no listed build`);
    return { slug, name, brand, builds };
  });
  return models.sort((a, b) => byCodeUnit(a.brand, b.brand) || byCodeUnit(a.name, b.name));
}

/** Reads the public catalogue under `root/data`: the maker and fabric lists and every `data/bags/<maker>/*.yaml`. */
export function readCatalogue(root: string): CatalogueModel[] {
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  const models = readdirSync(join(root, "data/bags"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(root, "data/bags", dir.name), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
        .map((entry) => `data/bags/${dir.name}/${entry.name}`),
    )
    .sort(byCodeUnit)
    .map((path) => ({ path, text: read(path) }));
  return catalogueFrom({ brands: read("data/brands.yaml"), materials: read("data/materials.yaml"), models });
}
