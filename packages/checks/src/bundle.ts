import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "./files.ts";
import { WEB_DIST } from "./gates.ts";

/**
 * Strings Zod 4's runtime carries through minification: its class names, registered as string literals
 * (`"$ZodType"`, `"$ZodError"`, ...), and its global registry and config keys. Found in a `bun build --minify` of
 * packages/schema; ordinary text that mentions Zod or a zodiac does not produce them.
 */
const ZOD_MARKERS = /\$Zod[A-Z][A-Za-z]*|__zod_global(?:Registry|Config)/;

/**
 * Built apps/web files (JavaScript, and HTML for inline scripts) that contain Zod's runtime. Returns nothing when
 * apps/web has not been built.
 */
export function zodInBuild(root: string): string[] {
  const files = listFiles(root, WEB_DIST, (name) => /\.(m?js|html)$/.test(name));
  return files.filter((file) => ZOD_MARKERS.test(readFileSync(join(root, file), "utf8")));
}
