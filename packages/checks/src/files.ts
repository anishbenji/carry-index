import type { Dirent } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ALWAYS_SKIPPED = new Set(["node_modules", ".git"]);

/**
 * Lists files under `dir` (recursively) that pass `accept`, as sorted paths relative to `root` with forward
 * slashes. `accept` gets the file name and its repo-relative path. node_modules and .git are always skipped,
 * plus any directory named in `skip`.
 */
export function listFiles(
  root: string,
  dir: string,
  accept: (name: string, path: string) => boolean,
  skip: ReadonlySet<string> = new Set(),
): string[] {
  const found: string[] = [];
  const walk = (abs: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const full = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!ALWAYS_SKIPPED.has(entry.name) && !skip.has(entry.name)) walk(full);
      } else if (entry.isFile()) {
        const path = relative(root, full).split(sep).join("/");
        if (accept(entry.name, path)) found.push(path);
      }
    }
  };
  walk(join(root, dir));
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
