import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogueExport } from "@cj/schema";
import { readCatalogue } from "../catalogue.ts";

/**
 * `bun packages/pipeline/src/cli/export.ts <outFile>`: validates the public catalogue and writes it as JSON for the
 * public site build, which reads that file and never this package's code (apps/web imports types only). Exits
 * non-zero, naming the file, on the first record that fails its schema.
 */
const [out, ...rest] = process.argv.slice(2);
if (out === undefined || out === "" || out.startsWith("-") || rest.length > 0) {
  console.error("usage: export.ts <outFile>");
  process.exit(2);
}
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const data: CatalogueExport = { models: readCatalogue(repo) };
const target = resolve(out);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
const builds = data.models.reduce((n, model) => n + model.builds.length, 0);
console.log(`catalogue export: ${data.models.length} models, ${builds} builds`);
