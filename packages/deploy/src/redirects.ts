/**
 * `_redirects` validation (security-sol r2, S2-7, director decision 2). Cloudflare applies redirects before
 * `_headers` and before serving an asset (https://developers.cloudflare.com/workers/static-assets/redirects/), so a
 * single off-site rule would send every visitor elsewhere. The file stays allow-listed, and every rule must keep the
 * visitor on the site.
 */

/** Cloudflare's documented limits: 2,000 static and 100 dynamic redirects, 1,000 characters a rule. */
export const MAX_STATIC_REDIRECTS = 2000;
export const MAX_DYNAMIC_REDIRECTS = 100;
export const MAX_REDIRECT_LINE_LENGTH = 1000;

const STATUSES = new Set(["301", "302", "303", "307", "308", "200"]);

/**
 * Whether `text` is only printable ASCII, spaces and tabs (security r3, S3-3). Anything else is refused: Wrangler
 * splits fields on `\s`, which includes U+00A0 and other Unicode spaces the gate would not see as separators.
 */
function isPrintableAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((code < 0x20 || code > 0x7e) && code !== 0x09) return false;
  }
  return true;
}

/** A `.` or `..` segment, plain or percent-encoded, anywhere in the path part. */
function hasDotSegment(path: string): boolean {
  const pathPart = path.split(/[?#]/)[0] ?? "";
  return pathPart.split("/").some((segment) => {
    const decoded = segment.replace(/%2e/gi, ".");
    return decoded === "." || decoded === "..";
  });
}

/** A percent-encoded slash, backslash or control character: decoded later, it could turn a path into `//host`. */
const ENCODED_DANGER = /%(?:2f|5c|[01][0-9a-f]|7f)/i;
/** A placeholder (`:name`) or a splat. */
const DYNAMIC = /\*|:[A-Za-z]/;

/**
 * A path that starts with exactly one `/`, with no backslash, tab, encoded slash, backslash or control character, and
 * no `.` or `..` segment, plain or encoded.
 */
function isSitePath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !path.includes("\t") &&
    !ENCODED_DANGER.test(path) &&
    !hasDotSegment(path)
  );
}

/**
 * A destination: a same-site path. Wrangler stores it as `new URL` normalises it (wrangler-dist/cli.js:68738), so the
 * path part must come through `new URL(path, "https://x.invalid")` unchanged: no segment collapses and nothing is
 * re-encoded. Splats and placeholders may appear in the path only, and not in its first segment: a splat or
 * placeholder there could hold `/evil.example` and make `//evil.example`, which a browser reads as another host.
 * Nothing dynamic in the query or fragment.
 */
function isDestination(to: string): boolean {
  if (!isSitePath(to)) return false;
  const cut = to.search(/[?#]/);
  const path = cut === -1 ? to : to.slice(0, cut);
  const rest = cut === -1 ? "" : to.slice(cut);
  let normalised: string;
  try {
    normalised = new URL(path, "https://x.invalid").pathname;
  } catch {
    return false;
  }
  if (normalised !== path || normalised.startsWith("//")) return false;
  const first = path.slice(1).split("/")[0] ?? "";
  return !DYNAMIC.test(first) && !DYNAMIC.test(rest);
}

/**
 * Whether every non-comment line of a `_redirects` file is `<from> <to> [status]`: `<from>` a site path, `<to>` a
 * destination as `isDestination` reads it, the status one of 301, 302, 303, 307, 308 or 200 (302 when absent), each
 * line printable ASCII and at most `MAX_REDIRECT_LINE_LENGTH` characters, and at most the static and dynamic rule
 * caps. Lines are tokenised as Wrangler tokenises them (cli.js:68934): an inline `\s+#.*$` comment is dropped, then
 * fields split on whitespace; and as Wrangler counts them, every rule after the first dynamic one is dynamic.
 */
export function redirectsValid(text: string): boolean {
  let statics = 0;
  let dynamics = 0;
  for (const raw of text.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.length > MAX_REDIRECT_LINE_LENGTH || !isPrintableAscii(line)) return false;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const fields = trimmed.replace(/[ \t]+#.*$/, "").split(/[ \t]+/);
    if (fields.length < 2 || fields.length > 3) return false;
    const [from = "", to = "", status = "302"] = fields;
    if (!isSitePath(from) || !isDestination(to) || !STATUSES.has(status)) return false;
    if (dynamics > 0 || DYNAMIC.test(from)) dynamics++;
    else statics++;
    if (statics > MAX_STATIC_REDIRECTS || dynamics > MAX_DYNAMIC_REDIRECTS) return false;
  }
  return true;
}
