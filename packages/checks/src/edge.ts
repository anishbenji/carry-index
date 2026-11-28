import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

/**
 * The compression levels Cloudflare documents for recompressing at the edge: Brotli level 4 or gzip level 8,
 * depending on the visitor's Accept-Encoding (blog.cloudflare.com/this-is-brotli-from-origin). size-limit can only
 * measure gzip level 9 and Brotli quality 11, so this measures the two edge levels itself.
 */
const GZIP_LEVEL = 8;
const BROTLI_QUALITY = 4;

export interface EdgeResult {
  ok: boolean;
  lines: string[];
}

/**
 * Measures every root `size-limit` target at Cloudflare's edge levels and fails any target whose larger edge
 * size exceeds its limit. Together with size-limit's own gzip and Brotli checks, a target passes only if the
 * largest measured value is within the limit. A target that matches no file fails.
 */
export function evaluateEdgeSizes(root: string): EdgeResult {
  const pkg: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const raw = typeof pkg === "object" && pkg !== null ? (pkg as { "size-limit"?: unknown })["size-limit"] : undefined;
  const targets = Array.isArray(raw) ? raw : [];
  const lines: string[] = [];
  let ok = true;
  for (const target of targets) {
    const { name, path, limit } = (typeof target === "object" && target !== null ? target : {}) as {
      name?: unknown;
      path?: unknown;
      limit?: unknown;
    };
    const label = typeof name === "string" ? name : String(path);
    const max = typeof limit === "string" ? parseLimit(limit) : undefined;
    const globs = (Array.isArray(path) ? path : [path]).filter((p): p is string => typeof p === "string");
    const files = [...new Set(globs.flatMap((glob) => globSync(glob, { cwd: root })))].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    if (max === undefined || files.length === 0) {
      lines.push(`edge size: ${label}: ${files.length === 0 ? "matches no file" : "has no readable limit"}; failing`);
      ok = false;
      continue;
    }
    let gzip = 0;
    let brotli = 0;
    for (const file of files) {
      const bytes = readFileSync(join(root, file));
      gzip += gzipSync(bytes, { level: GZIP_LEVEL }).length;
      brotli += brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } }).length;
    }
    const largest = Math.max(gzip, brotli);
    const pass = largest <= max;
    if (!pass) ok = false;
    lines.push(
      `edge size: ${label}: gzip ${GZIP_LEVEL}: ${gzip} B, brotli ${BROTLI_QUALITY}: ${brotli} B, limit ${max} B: ${pass ? "pass" : "FAIL"}`,
    );
  }
  return { ok, lines };
}

/** Parses a size-limit limit the way size-limit does: kB is 1,000 bytes, KiB 1,024. */
function parseLimit(limit: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s*(?:([kmg])?(i)?b)?$/i.exec(limit.trim());
  if (!match) return undefined;
  const [, number, prefix, iec] = match;
  const power = prefix ? "kmg".indexOf(prefix.toLowerCase()) + 1 : 0;
  return Math.floor(Number.parseFloat(number ?? "0") * (iec ? 1024 : 1000) ** power);
}
