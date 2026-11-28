import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { z } from "zod";
import { GRAPH_REPORT_FORMAT, graphReportPath, isWorkerImport, OUTSIDE_REPOSITORY } from "./graph-plugin.ts";
import { isPrivatePath } from "./private-roots.ts";
import type { Problem } from "./problems.ts";
import type { ManifestEntry } from "./seal.ts";
import { byCodeUnit } from "./walk.ts";

/** Far above a real report (today's is under 10 KiB); a larger file is refused. */
export const MAX_REPORT_BYTES = 8 * 1024 * 1024;

type ReadFn = (fd: number, buffer: Uint8Array, offset: number, length: number) => number;

/**
 * At most `maxBytes` from `fd`, read into a buffer of `maxBytes + 1` bytes; undefined when that buffer fills, so a
 * file that is larger, or grows while it is read, is refused without being read to its end (security r3, S3-2).
 */
export function readUpTo(
  fd: number,
  maxBytes: number,
  read: ReadFn = (f, buffer, offset, length) => readSync(f, buffer, offset, length, null),
): Uint8Array | undefined {
  const buffer = new Uint8Array(maxBytes + 1);
  let filled = 0;
  while (filled < buffer.length) {
    const n = read(fd, buffer, filled, buffer.length - filled);
    if (n <= 0) break;
    filled += n;
  }
  return filled > maxBytes ? undefined : buffer.subarray(0, filled);
}

const reportSchema = z.strictObject({
  format: z.literal(GRAPH_REPORT_FORMAT),
  modules: z.array(z.string()),
  outputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })),
  // Optional here so that a report without it is refused by name (graph-checks-disabled), not as malformed.
  checks: z.strictObject({ workerImports: z.boolean() }).optional(),
});

/** The report's text, or undefined when it is absent, not a regular file (a link is not followed) or too large. */
function readReport(path: string): string | undefined {
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    return undefined;
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_REPORT_BYTES) return undefined;
    const bytes = readUpTo(fd, MAX_REPORT_BYTES);
    return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
  } finally {
    closeSync(fd);
  }
}

/**
 * The build-graph check (security-sol r2, S2-4), for `deploy` and `triggers`. A site with built output (any
 * `assets/` file or page, N2) must have the `moduleGraph` plugin's report beside its build folder
 * (`<siteDir>.module-graph.json`) for that same build: every output it lists must be in the sealed manifest with the
 * same SHA-256, and every sealed `assets/` file and page must be listed (`module-graph-mismatch`, at the file's path). The modules it lists are checked
 * again here (`private-module`, `worker-import`), and every check the build ran with must have been on
 * (`graph-checks-disabled` otherwise, or when the report does not say). An absent, linked, oversized or malformed report is `module-graph-missing`. A site
 * with no built output has no build graph to check.
 */
export function checkModuleGraph(siteDir: string, manifest: readonly ManifestEntry[]): Problem[] {
  const built = manifest.filter((entry) => entry.path.startsWith("assets/") || entry.path.endsWith(".html"));
  if (built.length === 0) return [];
  const text = readReport(graphReportPath(siteDir));
  let parsed: z.infer<typeof reportSchema> | undefined;
  try {
    parsed = text === undefined ? undefined : reportSchema.parse(JSON.parse(text));
  } catch {
    parsed = undefined;
  }
  if (!parsed) return [{ path: ".", rule: "module-graph-missing" }];

  const problems: Problem[] = [];
  // A check the build ran with turned off (a test-only switch), or no record of them: never deployable.
  if (!parsed.checks || Object.values(parsed.checks).some((on) => on !== true)) {
    problems.push({ path: ".", rule: "graph-checks-disabled" });
  }
  const sealed = new Map(manifest.map((entry) => [entry.path, entry.sha256]));
  const listed = new Set<string>();
  for (const output of parsed.outputs) {
    listed.add(output.path);
    if (sealed.get(output.path) !== output.sha256) problems.push({ path: output.path, rule: "module-graph-mismatch" });
  }
  for (const entry of built) {
    if (!listed.has(entry.path)) problems.push({ path: entry.path, rule: "module-graph-mismatch" });
  }
  for (const module of parsed.modules) {
    if (isWorkerImport(module)) problems.push({ path: module, rule: "worker-import" });
    if (module === OUTSIDE_REPOSITORY || (!module.startsWith("\0") && isPrivatePath(module))) {
      problems.push({ path: module, rule: "private-module" });
    }
  }
  const unique = new Map(problems.map((p) => [`${p.path}\u0000${p.rule}`, p]));
  return [...unique.values()].sort((a, b) => byCodeUnit(a.path, b.path) || byCodeUnit(a.rule, b.rule));
}
