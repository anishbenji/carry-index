import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "./files.ts";
import { WEB_DIST } from "./gates.ts";

/**
 * Built apps/web files that contain Zod. Zod's runtime carries its own names as strings (`$ZodType`,
 * `ZodError`), which survive minification, so any case-insensitive "zod" in a built file is treated as Zod having
 * reached the public bundle. Returns nothing when apps/web has not been built.
 */
export function zodInBuild(root: string): string[] {
  const files = listFiles(root, WEB_DIST, (name) => /\.(m?js|html|css)$/.test(name));
  return files.filter((file) => /zod/i.test(readFileSync(join(root, file), "utf8")));
}
