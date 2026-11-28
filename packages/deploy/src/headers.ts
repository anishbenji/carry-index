import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Problem } from "./problems.ts";

/**
 * The security headers the site must send from `_headers` (architecture doc, "Security headers": a CSP with no
 * `unsafe-inline`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; unified brief: COOP and
 * CORP), as PR 8's `_headers` sets them on `/*`. Lower case.
 */
export const REQUIRED_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
] as const;

const CSP_FORBIDDEN = new Set(["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"]);
const REFERRER_POLICIES = new Set(["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"]);
const HSTS_MIN_SECONDS = 31_536_000;

interface Block {
  pattern: string;
  headers: Array<{ name: string; value: string }>;
  removed: string[];
}

/** Cloudflare's documented limits (https://developers.cloudflare.com/workers/static-assets/headers/). */
export const MAX_HEADER_RULES = 100;
export const MAX_HEADER_LINE_LENGTH = 2000;

interface Parsed {
  blocks: Block[];
  /** Any line Wrangler would warn about and skip. */
  invalid: boolean;
  /** A line over the length limit, or more rules than the limit. */
  overLimit: boolean;
}

const LINE_IS_PROBABLY_A_PATH = /^([^\s]+:\/\/|^\/)/;
const ABSOLUTE = /^https:\/\/+(?<host>[^/]+)\/?(?<path>.*)/;

/** Wrangler's `extractPathname` (cli.js:68736): the pathname of `//<path>` against `relative://`. */
function extractPathname(path: string): string {
  return new URL(`//${path.startsWith("/") ? path : `/${path}`}`, "relative://").pathname;
}

/**
 * A path line normalised as Wrangler's `validateUrl` does (cli.js:68746): relative from `/`, or `https://<host>` with
 * no port, with `.` and `..` segments, the query and the fragment removed; at most one `*` (cli.js:68904).
 * Undefined when Wrangler would refuse it.
 */
function normalisedPath(token: string): string | undefined {
  let path: string;
  try {
    const absolute = ABSOLUTE.exec(token);
    if (absolute?.groups?.host) {
      if (/.*:\d+$/.test(absolute.groups.host)) return undefined;
      path = `https://${absolute.groups.host}${extractPathname(absolute.groups.path ?? "")}`;
    } else if (token.startsWith("/")) path = extractPathname(token);
    else return undefined;
  } catch {
    return undefined;
  }
  const splats = (path.match(/\*/g) ?? []).length;
  return splats <= 1 && !(splats === 1 && /:splat(?!\w)/.test(path)) ? path : undefined;
}

/**
 * `_headers` read the way Wrangler 4.168.0 reads it (`parseHeaders` in workers-shared, wrangler-dist/cli.js:68765):
 * each trimmed line that looks like a path starts a rule whatever its indentation; `Name: value` and `! Name` lines
 * belong to the current rule. Every case Wrangler reports in its `invalid` list (and then skips) is recorded.
 */
function parse(text: string): Parsed {
  const blocks: Block[] = [];
  let invalid = false;
  let overLimit = false;
  let current: Block | undefined;
  let skipUntilNextPath = false;
  const close = (): void => {
    if (!current) return;
    if (current.headers.length === 0 && current.removed.length === 0) invalid = true;
    else {
      // Wrangler stores rules by normalised path, so a later rule for the same path replaces the earlier one.
      const earlier = blocks.findIndex((b) => b.pattern === current?.pattern);
      if (earlier !== -1) {
        invalid = true;
        blocks.splice(earlier, 1);
      }
      blocks.push(current);
    }
    current = undefined;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    if (line.length > MAX_HEADER_LINE_LENGTH) {
      overLimit = true;
      continue;
    }
    if (LINE_IS_PROBABLY_A_PATH.test(line)) {
      skipUntilNextPath = false;
      if (blocks.length + (current ? 1 : 0) >= MAX_HEADER_RULES) {
        overLimit = true;
        current = undefined;
        break;
      }
      close();
      const pattern = normalisedPath(line);
      if (pattern === undefined) {
        invalid = true;
        skipUntilNextPath = true;
        continue;
      }
      current = { pattern, headers: [], removed: [] };
      continue;
    }
    if (skipUntilNextPath) continue;
    if (!line.includes(":")) {
      // Not trimmed: Wrangler keeps whatever follows "! " as the name (cli.js:68833), so extra whitespace must fail
      // the token test here (Neon N17).
      const removed = line.slice(2);
      // A removed header's name must be a token too (sol security r4, S6-2).
      if (current && line.startsWith("! ") && TOKEN.test(removed)) current.removed.push(removed.toLowerCase());
      else invalid = true;
      continue;
    }
    const colon = line.indexOf(":");
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    // Every name an RFC 9110 token and every value plain text (sol security r4, S6-2): Cloudflare's Headers.set
    // throws on anything else, on every asset the rule matches.
    if (!TOKEN.test(name) || value === "" || !isPrintableAscii(value) || !current) {
      invalid = true;
      continue;
    }
    current.headers.push({ name, value });
  }
  close();
  return { blocks, invalid, overLimit };
}

/** ASCII whitespace as browsers split header values on it (tab, LF, FF, CR, space), never Unicode spaces. */
const ASCII_WHITESPACE = /[\t\n\f\r ]+/;

function asciiTrim(text: string): string {
  return text.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "");
}

/** A `_headers` placeholder or splat as Cloudflare substitutes it into header values. */
const PLACEHOLDER = /:[A-Za-z_]/;

/** Whether a header value is only printable ASCII and tabs (security r3, S3-4). */
function isPrintableAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code < 0x20 || code > 0x7e) && code !== 0x09) return false;
  }
  return true;
}

/** Whether one policy names a directive twice: browsers keep the first, so the policy says two things (Neon N14). */
function cspRepeatsDirective(value: string): boolean {
  const names = value
    .split(";")
    .map((d) => (d.split(ASCII_WHITESPACE).find(Boolean) ?? "").toLowerCase())
    .filter((name) => name !== "");
  return new Set(names).size !== names.length;
}

/** A script source the site may use: itself, nothing, or the hash of an inline script. */
const SCRIPT_SOURCE = /^(?:'self'|'none'|'sha(?:256|384|512)-[A-Za-z0-9+/_-]+={0,2}')$/i;

function cspWeak(value: string, isRoot: boolean): boolean {
  const directives = value
    .split(";")
    .map((d) => d.split(ASCII_WHITESPACE).filter(Boolean))
    .filter((d) => d.length > 0);
  const sources = directives.flatMap((d) => d.slice(1).map((s) => s.toLowerCase()));
  // A static file sends the same nonce on every response, so a nonce allows any inline script that carries it.
  if (sources.some((s) => CSP_FORBIDDEN.has(s) || s.includes("*") || s.startsWith("'nonce-"))) return true;
  // A bare scheme (`data:`, `blob:`, `https:`) in a directive that governs scripts allows script from anywhere.
  const scriptDirectives = new Set(["default-src", "script-src", "script-src-elem", "script-src-attr"]);
  const scriptSources = directives
    .filter((d) => scriptDirectives.has((d[0] ?? "").toLowerCase()))
    .flatMap((d) => d.slice(1).map((s) => s.toLowerCase()));
  if (scriptSources.some((s) => /^[a-z][a-z0-9+.-]*:$/.test(s))) return true;
  // The directives that govern scripts (script-src, or default-src when there is none; script-src-elem and
  // script-src-attr) may hold only 'self', 'none' and hashes: an explicit origin could serve the site any script, and
  // the brief allows no third-party script (sol security r4, S6-5).
  // The first occurrence of a name, as browsers keep it (a repeat is refused as headers-invalid, Neon N14).
  const byName = new Map<string, string[]>();
  for (const d of directives) {
    const name = (d[0] ?? "").toLowerCase();
    if (!byName.has(name)) byName.set(name, d.slice(1));
  }
  const governing = [
    byName.get("script-src") ?? byName.get("default-src") ?? [],
    byName.get("script-src-elem") ?? [],
    byName.get("script-src-attr") ?? [],
  ].flat();
  if (governing.some((source) => !SCRIPT_SOURCE.test(source))) return true;
  const names = new Set(directives.map((d) => (d[0] ?? "").toLowerCase()));
  return isRoot && !(names.has("default-src") && names.has("frame-ancestors"));
}

/** An RFC 7230 quoted string. */
const QUOTED_STRING = /^"(?:[^"\\]|\\.)*"$/;

/** An RFC 7230 token: a directive name. */
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * An HSTS value parsed in full, as RFC 6797 section 6.1 reads it (security-sol r2, S2-8): `;`-separated directives
 * (empty ones allowed), each a token name with an optional `=value`; no name twice (case-insensitive); exactly one
 * `max-age`, whose value is digits, plain or quoted, of at least a year. Anything else is weak: a browser ignores a
 * header that does not parse.
 */
function hstsWeak(value: string): boolean {
  const seen = new Set<string>();
  let maxAge: number | undefined;
  for (const part of value.split(";")) {
    const directive = asciiTrim(part);
    if (directive === "") continue;
    const equals = directive.indexOf("=");
    const name = asciiTrim(equals === -1 ? directive : directive.slice(0, equals)).toLowerCase();
    if (!TOKEN.test(name) || seen.has(name)) return true;
    seen.add(name);
    const rawValue = equals === -1 ? undefined : asciiTrim(directive.slice(equals + 1));
    // includeSubDomains and preload take no value: Chromium drops the whole header otherwise (sol security r3,
    // S5-6). Any other directive's value must be a token or a quoted string (RFC 6797 section 6.1).
    if (name === "includesubdomains" || name === "preload") {
      if (rawValue !== undefined) return true;
      continue;
    }
    if (name !== "max-age") {
      if (rawValue !== undefined && !TOKEN.test(rawValue) && !QUOTED_STRING.test(rawValue)) return true;
      continue;
    }
    const digits = /^(?:(\d+)|"(\d+)")$/.exec(rawValue ?? "");
    if (!digits) return true;
    maxAge = Number(digits[1] ?? digits[2]);
  }
  return maxAge === undefined || maxAge < HSTS_MIN_SECONDS;
}

function valueWeak(name: string, value: string, isRoot: boolean): boolean {
  const v = value.toLowerCase();
  switch (name) {
    case "content-security-policy":
      return cspWeak(value, isRoot);
    case "strict-transport-security":
      return hstsWeak(value);
    case "x-content-type-options":
      return v !== "nosniff";
    case "referrer-policy":
      return !REFERRER_POLICIES.has(v);
    case "permissions-policy":
      return v === "" || v.includes("*");
    case "cross-origin-opener-policy":
      return v !== "same-origin";
    case "cross-origin-resource-policy":
      return v !== "same-origin" && v !== "same-site";
    default:
      return false;
  }
}

export interface HeaderCheckOptions {
  /** Fail when the site has no `_headers` at all. */
  requireFile?: boolean;
}

/**
 * Check 2's header half on a site folder (the sealed copy): the `/*` block of `_headers` must set every
 * `REQUIRED_HEADERS` entry (`headers-missing`), and no block may weaken one: a CSP source `'unsafe-inline'`,
 * `'unsafe-eval'`, `'unsafe-hashes'` or any `*`, a root CSP without `default-src` and `frame-ancestors`, HSTS under a
 * year, `X-Content-Type-Options` other than `nosniff`, a leaky `Referrer-Policy`, a `*` in `Permissions-Policy`,
 * COOP or CORP looser than same-origin, a `! Name` line removing a required header, or a required header other
 * than the CSP set more than once anywhere in the file (`headers-weak`; HSTS is parsed in full: one valid `max-age`,
 * no directive twice). The file is read as Wrangler reads it: any line Wrangler would warn about and skip is
 * `headers-invalid`, and so is a CSP value holding a comma (a policy list), a CSP set twice in one rule, or a required
 * header value with a character outside printable ASCII (CSP and HSTS split on ASCII whitespace only) or a
 * placeholder Cloudflare would substitute (`:name`, `:splat`); a line
 * over 2,000 characters or more than 100 rules is `headers-over-limit` (Cloudflare then drops what is over). At most
 * one problem of each rule, at path `_headers`; values are never printed.
 */
export function checkHeaders(siteDir: string, options: HeaderCheckOptions = {}): Problem[] {
  const file = join(siteDir, "_headers");
  if (!existsSync(file)) return options.requireFile ? [{ path: "_headers", rule: "headers-missing" }] : [];
  const { blocks, invalid, overLimit } = parse(readFileSync(file, "utf8"));
  const root = blocks.filter((b) => b.pattern === "/*");
  const rootNames = new Set(root.flatMap((b) => b.headers.map((h) => h.name)));
  const missing = root.length === 0 || REQUIRED_HEADERS.some((name) => !rootNames.has(name));
  const required: ReadonlySet<string> = new Set(REQUIRED_HEADERS);
  // Cloudflare joins a header set by several matching rules with commas; for every required header but the CSP
  // (several policies are all enforced) the joined value is invalid and browsers drop it. So each is set once.
  const counts = new Map<string, number>();
  for (const h of blocks.flatMap((b) => b.headers)) counts.set(h.name, (counts.get(h.name) ?? 0) + 1);
  const repeated = REQUIRED_HEADERS.some((name) => name !== "content-security-policy" && (counts.get(name) ?? 0) > 1);
  const weak =
    repeated ||
    blocks.some(
      (b) =>
        b.removed.some((name) => required.has(name)) ||
        b.headers.some((h) => valueWeak(h.name, h.value, b.pattern === "/*")),
    );
  // A browser splits a CSP value on commas into separate policies before it parses any (CSP3, "parse a serialized
  // CSP list"), so a comma would hide a policy from the checks above; and Cloudflare joins a header set twice in one
  // rule with a comma (security-sol r2, S2-6).
  const cspList = blocks.some((b) => {
    const csp = b.headers.filter((h) => h.name === "content-security-policy");
    return csp.length > 1 || csp.some((h) => h.value.includes(",") || cspRepeatsDirective(h.value));
  });
  // A browser splits directives on ASCII whitespace only, so a Unicode space hides a directive name the checks above
  // read (security r3, S3-4); no required header may hold anything outside printable ASCII.
  const nonAscii = blocks.some((b) => b.headers.some((h) => required.has(h.name) && !isPrintableAscii(h.value)));
  // Cloudflare substitutes a rule's placeholders and splat (`:name`, `:splat`) into its header values, so a visitor's
  // path could become a CSP source; none may appear in a required header (sol security r3, S5-4). A scheme or port
  // (`https:`, `:8443`) is not a placeholder: one is a colon followed by a letter or underscore.
  const placeholder = blocks.some((b) => b.headers.some((h) => required.has(h.name) && PLACEHOLDER.test(h.value)));
  const problems: Problem[] = [];
  if (invalid || cspList || nonAscii || placeholder) problems.push({ path: "_headers", rule: "headers-invalid" });
  if (missing) problems.push({ path: "_headers", rule: "headers-missing" });
  if (overLimit) problems.push({ path: "_headers", rule: "headers-over-limit" });
  if (weak) problems.push({ path: "_headers", rule: "headers-weak" });
  return problems;
}
