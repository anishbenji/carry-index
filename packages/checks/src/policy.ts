import type { Dirent } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** The private app and Worker: the only workspaces under apps/ and workers/ that may use schema values. */
export const PRIVATE_DIRS = ["apps/kit", "workers/kit"] as const;

/**
 * Public-facing workspaces, found rather than listed: every folder under apps/ and workers/ except PRIVATE_DIRS.
 * They may use the schema's types but must never bundle Zod or a schema value; the unified brief exempts only the
 * private side.
 */
export function publicDirs(root: string): string[] {
  const found: string[] = [];
  for (const parent of ["apps", "workers"]) {
    let entries: Dirent[];
    try {
      entries = readdirSync(join(root, parent), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = `${parent}/${entry.name}`;
      if (entry.isDirectory() && !(PRIVATE_DIRS as readonly string[]).includes(dir)) found.push(dir);
    }
  }
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Modules those workspaces may import with `import type` only: Zod and every workspace that carries it. */
export const TYPE_ONLY_MODULES = ["zod", "@cj/schema", "@cj/pipeline"] as const;

/** Workspace folders those modules live in, so a relative import of them counts as importing the module. */
export const TYPE_ONLY_PATHS = ["packages/schema", "packages/pipeline"] as const;
