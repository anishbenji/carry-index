import { decodeNamedReferences } from "./named-refs.ts";
import type { Problem, Rule } from "./problems.ts";
import { byCodeUnit, readWalkedFile, walkTree } from "./walk.ts";

/** Must never appear in anything deployed. Public by design: knowing it helps no one. */
export const CANARY_MARKER = "CJ-CANARY-";

/** Planted in fields the site renders, so a fixture build proves the scan can see rendered data. */
export const PUBLIC_MARKER = "CJ-PUBLIC-";

export interface ScanOptions {
  /** Fixture builds only: fail unless `PUBLIC_MARKER` appears somewhere in the folder. */
  requirePublicMarker?: boolean;
}

/**
 * Check 2 on a folder (a sealed bundle's `site/`, or a fixture build): every file is searched for `CANARY_MARKER`
 * plain, JSON-escaped, URL-encoded, as HTML entities and in base64; plus two heuristic scans, email shapes and local
 * path prefixes (`/Users/`, `/home/`, `C:\Users\`). Problems name the path and rule only. Sorted by path.
 */
export async function scanBundle(dir: string, options: ScanOptions = {}): Promise<Problem[]> {
  const problems: Problem[] = [];
  let sawPublicMarker = false;
  for (const entry of walkTree(dir)) {
    if (entry.kind === "symlink") problems.push({ path: entry.path, rule: "symlink" });
    else if (entry.kind === "hardlink") problems.push({ path: entry.path, rule: "hard-link" });
    else if (entry.kind === "special") problems.push({ path: entry.path, rule: "special-file" });
    else {
      const bytes = readWalkedFile(entry);
      if (!bytes) {
        problems.push({ path: entry.path, rule: "special-file" });
        continue;
      }
      const forms = decodedForms(new TextDecoder().decode(bytes));
      for (const rule of hits(forms)) problems.push({ path: entry.path, rule });
      sawPublicMarker ||= forms.some((form) => form.includes(PUBLIC_MARKER));
    }
  }
  if (options.requirePublicMarker && !sawPublicMarker) problems.push({ path: ".", rule: "public-marker-missing" });
  return problems.sort((a, b) => byCodeUnit(a.path, b.path) || byCodeUnit(a.rule, b.rule));
}

/** How many rounds of decoding to apply, so a marker encoded twice (an entity inside a URL) is still found. */
const DECODE_ROUNDS = 3;

/**
 * The text as stored, then repeatedly with JSON and JavaScript escapes, percent-encoding and numeric HTML entities
 * decoded. Each decoder leaves what it does not recognise unchanged.
 */
function decodedForms(text: string): string[] {
  const forms = [text];
  let current = text;
  for (let round = 0; round < DECODE_ROUNDS; round++) {
    const next = decodeEntities(decodePercent(decodeEscapes(current)));
    if (next === current) break;
    forms.push(next);
    current = next;
  }
  return forms;
}

const fromCode = (code: number): string => (code <= 0x10ffff ? String.fromCodePoint(code) : "");

// Leading zeros are allowed in every numeric form, as HTML and JavaScript allow them (Neon N3).
function decodeEscapes(text: string): string {
  return text
    .replace(/\\u\{0*([0-9a-fA-F]{1,6})\}/g, (_m, hex: string) => fromCode(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => fromCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => fromCode(Number.parseInt(hex, 16)))
    .replace(/\\\//g, "/");
}

function decodePercent(text: string): string {
  return text.replace(/%([0-9a-fA-F]{2})/g, (_m, hex: string) => fromCode(Number.parseInt(hex, 16)));
}

function decodeEntities(text: string): string {
  return decodeNamedReferences(text)
    .replace(/&#[xX]0*([0-9a-fA-F]{1,6});?/g, (_m, hex: string) => fromCode(Number.parseInt(hex, 16)))
    .replace(/&#0*([0-9]{1,7});?/g, (_m, dec: string) => fromCode(Number.parseInt(dec, 10)));
}

/**
 * The parts of the canary's base64 encoding that do not depend on what comes before it, for each of the three
 * byte alignments, in the standard and the URL-safe alphabet. A character is kept only when all six of its bits
 * come from the marker.
 */
const CANARY_BASE64: readonly string[] = [0, 1, 2].flatMap((offset) => {
  const encoded = btoa("\0".repeat(offset) + CANARY_MARKER);
  const first = Math.ceil((offset * 8) / 6);
  const last = Math.floor(((offset + CANARY_MARKER.length) * 8) / 6);
  const stable = encoded.slice(first, last);
  return [stable, stable.replaceAll("+", "-").replaceAll("/", "_")];
});

/**
 * An address shape. Every part is bounded at its RFC 5321 length (local part 64, label 63, at most ten labels), so
 * the match is linear in the input. A domain may start with a digit (`163.com`), but then its last label must not be
 * a file extension, so `icon@2x.png` and `sprite@3x.webp` are not hits; `pkg@1.2.3` has no alphabetic last label.
 */
const EMAIL =
  /[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9])[A-Za-z0-9-]{0,62}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.([A-Za-z]{2,63})(?![A-Za-z0-9-])/g;
const FILE_EXTENSIONS = new Set(
  "avif bmp css gif htm html ico jpeg jpg js json map mjs mp3 mp4 pdf png svg txt wasm webm webp woff woff2 xml".split(
    " ",
  ),
);

function hasEmail(text: string): boolean {
  if (!text.includes("@")) return false;
  for (const match of text.matchAll(EMAIL)) {
    const [, first, last] = match;
    if (first && /[A-Za-z]/.test(first)) return true;
    if (last && !FILE_EXTENSIONS.has(last.toLowerCase())) return true;
  }
  return false;
}
/**
 * A macOS or Linux home folder, or a Windows one with single or JSON-doubled backslashes. The Unix prefixes must
 * not follow a word character, dot or hyphen, so a web address such as `example.com/home/` is not a hit while
 * `file:///Users/` is.
 */
const LOCAL_PATH = /(?<![\w.-])\/(?:Users|home)\/[^/\s]|\b[A-Za-z]:\\{1,2}Users\\{1,2}/;

/** The rules a file's text breaks, each at most once. */
function hits(forms: readonly string[]): Rule[] {
  const found: Rule[] = [];
  const canary = CANARY_MARKER.toLowerCase();
  if (forms.some((f) => f.toLowerCase().includes(canary) || CANARY_BASE64.some((b) => f.includes(b)))) {
    found.push("canary");
  }
  if (forms.some(hasEmail)) found.push("email");
  if (forms.some((f) => LOCAL_PATH.test(f))) found.push("local-path");
  return found;
}
