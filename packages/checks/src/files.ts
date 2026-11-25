import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIPPED_DIRS = new Set(["node_modules", ".git", ".wrangler"]);

/**
 * Lists files under `dir` (recursively) whose names pass `accept`, as sorted paths relative to `root`
 * with forward slashes. Skips node_modules, .git and .wrangler, plus any directory named in `skip`.
 */
export function listFiles(
  root: string,
  dir: string,
  accept: (name: string) => boolean,
  skip: ReadonlySet<string> = new Set(),
): string[] {
  const found: string[] = [];
  const walk = (abs: string): void => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const full = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name) && !skip.has(entry.name)) walk(full);
      } else if (entry.isFile() && accept(entry.name)) {
        found.push(relative(root, full).split(sep).join("/"));
      }
    }
  };
  walk(join(root, dir));
  return found.sort();
}
