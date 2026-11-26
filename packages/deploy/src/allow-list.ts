import { fitSchema } from "@cj/schema";
import { hasUnknownNamedReference } from "./named-refs.ts";
import type { Rule } from "./problems.ts";
import { redirectsValid } from "./redirects.ts";

/**
 * The allow-list the seal copies by (privacy-wall design v2, section 2). A file that matches no row fails the gate;
 * nothing is skipped quietly. Upper case is allowed only in the eight-character hash of a hashed asset. Adding a
 * row is a never-auto-merge change.
 *
 * Not enabled: Open Graph PNGs (`og/<slug>.png`), until the build re-encodes them without metadata: a compressed
 * `zTXt` or `iTXt` chunk could carry private text past the canary scan. Also not enabled: the hydrated build's `_static/<id>/get<Name>-<hash>.<hash>.txt` row (enabled only for that build,
 * which does not ship on Saturday) and a photo row (added with the first permitted photo, ADR-0013).
 */

export interface AllowListRow {
  kind: string;
  /** Matched against the whole path relative to the site folder, forward slashes. */
  path: RegExp;
  /** The content check; a file it refuses fails with `bad-content`. */
  accepts: (bytes: Uint8Array) => boolean;
  /** A stricter check run once `accepts` passes, with its own rule. */
  validate?: { rule: Rule; accepts: (bytes: Uint8Array) => boolean };
  /** The bytes the seal copies instead of the source's, once every check has passed. */
  canonical?: (bytes: Uint8Array) => Uint8Array;
}

/** The text, if `bytes` is valid UTF-8; undefined otherwise. Decoding errors are not passed on (they could quote input). */
function utf8(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

const isUtf8 = (bytes: Uint8Array): boolean => utf8(bytes) !== undefined;

/**
 * A page: UTF-8 starting with a doctype, holding no named reference the bundle scan cannot decode (sol security r3,
 * S5-7: fail closed rather than ship text the scan cannot read).
 */
function isPage(bytes: Uint8Array): boolean {
  const text = utf8(bytes);
  return text?.slice(0, 14).toLowerCase() === "<!doctype html" && !hasUnknownNamedReference(text);
}

function isDrawing(bytes: Uint8Array): boolean {
  const text = utf8(bytes);
  return text !== undefined && (text.startsWith("<svg") || text.startsWith("<?xml"));
}

/** The parsed JSON, or undefined when `bytes` are not UTF-8 JSON. */
function json(bytes: Uint8Array): { value: unknown } | undefined {
  const text = utf8(bytes);
  if (text === undefined) return undefined;
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return undefined;
  }
}

const isJson = (bytes: Uint8Array): boolean => json(bytes) !== undefined;

/**
 * Whether valid JSON `text` names a member twice in one object, at any depth. `JSON.parse` keeps the last, so an
 * earlier member would ship unvalidated in the original bytes (sol security r3, S5-1). Keys compare decoded, so
 * `"slug"` and `"\u0073lug"` are the same key.
 */
export function hasDuplicateKeys(text: string): boolean {
  const objects: Array<Set<string> | undefined> = [];
  let expectKey = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const top = objects[objects.length - 1];
      if (top && expectKey) {
        const key = JSON.parse(text.slice(i, j + 1)) as string;
        if (top.has(key)) return true;
        top.add(key);
        expectKey = false;
      }
      i = j;
    } else if (c === "{") {
      objects.push(new Set());
      expectKey = true;
    } else if (c === "[") objects.push(undefined);
    else if (c === "}" || c === "]") objects.pop();
    else if (c === ",") expectKey = objects[objects.length - 1] !== undefined;
  }
  return false;
}

/**
 * A fit file must match the closed public `fitSchema` (security-sol r2, S2-3) and name no key twice in one object
 * (S5-1).
 */
function isFitData(bytes: Uint8Array): boolean {
  const parsed = json(bytes);
  const text = utf8(bytes);
  return (
    parsed !== undefined && text !== undefined && !hasDuplicateKeys(text) && fitSchema.safeParse(parsed.value).success
  );
}

/** The canonical bytes of a fit file: `JSON.stringify` of the value that was validated (S5-1). */
function canonicalJson(bytes: Uint8Array): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(json(bytes)?.value));
}

export const ALLOW_LIST: readonly AllowListRow[] = [
  { kind: "page", path: /^(?:(?:bags|fabrics)\/)?[a-z0-9-]+\.html$/, accepts: isPage },
  { kind: "hashed asset", path: /^assets\/[a-z0-9_-]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/, accepts: isUtf8 },
  { kind: "drawing", path: /^drawings\/[a-z0-9-]+\/sketch\/[a-z0-9-]+\.svg$/, accepts: isDrawing },
  {
    kind: "fit data",
    path: /^data\/fit\/[a-z0-9-]+\.json$/,
    accepts: isJson,
    validate: { rule: "fit-data-invalid", accepts: isFitData },
    canonical: canonicalJson,
  },
  { kind: "fixed file", path: /^(?:_headers|favicon\.svg)$/, accepts: isUtf8 },
  {
    kind: "redirects",
    path: /^_redirects$/,
    accepts: isUtf8,
    validate: { rule: "redirects-invalid", accepts: (bytes) => redirectsValid(utf8(bytes) ?? "") },
  },
  {
    kind: "planned fixed file",
    path: /^(?:robots\.txt|sitemap\.xml|\.well-known\/security\.txt)$/,
    accepts: isUtf8,
  },
];

/** The row `path` falls under, or undefined when it matches none. */
export function allowListRow(path: string): AllowListRow | undefined {
  return ALLOW_LIST.find((row) => row.path.test(path));
}
