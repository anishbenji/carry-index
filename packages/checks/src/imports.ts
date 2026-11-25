import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "./files.ts";

export interface ValueImport {
  line: number;
  specifier: string;
}

/**
 * Finds every import or re-export of a banned module that is not type-only. Only `import type` and
 * `export type` count as type-only: an import whose specifiers are all inline `type` names still compiles to
 * a side-effect import under `verbatimModuleSyntax`, which would pull the module into the bundle.
 * A specifier is banned when it equals a banned name or is a subpath of it (`zod/v4`).
 */
export function findValueImports(source: string, banned: readonly string[]): ValueImport[] {
  const masked = maskCommentsAndStrings(source);
  const found: ValueImport[] = [];
  const patterns = [
    // import x from "m"; import { a } from "m"; import * as m from "m"; import type ... from "m"
    /(?<![\w$.])import\s+(type\s+)?[\w$\s{},*]+?\s*from\s*(["'])/g,
    // import "m";
    /(?<![\w$.])import\s*(["'])/g,
    // import("m")
    /(?<![\w$.])import\s*\(\s*(["'`])/g,
    // export * from "m"; export * as n from "m"; export { a } from "m"; export type { a } from "m"
    /(?<![\w$.])export\s+(type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(["'])/g,
  ];
  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern)) {
      const typeOnly = match.length > 2 && match[1] !== undefined;
      if (typeOnly) continue;
      const quoteIndex = (match.index ?? 0) + match[0].length - 1;
      const specifier = readString(source, quoteIndex);
      if (!banned.some((name) => specifier === name || specifier.startsWith(`${name}/`))) continue;
      found.push({ line: lineOf(source, match.index ?? 0), specifier });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

/** Scans every TypeScript and JavaScript source under `dir` (skipping node_modules and dist). */
export function scanImports(
  root: string,
  dir: string,
  banned: readonly string[],
): Array<ValueImport & { file: string }> {
  const files = listFiles(root, dir, (name) => /\.(m|c)?[jt]sx?$/.test(name), new Set(["dist"]));
  return files.flatMap((file) =>
    findValueImports(readFileSync(join(root, file), "utf8"), banned).map((f) => ({ file, ...f })),
  );
}

/**
 * Replaces comments with spaces and the contents of string and template literals with spaces, keeping
 * quotes, newlines and every offset, so pattern matching sees code only.
 */
function maskCommentsAndStrings(source: string): string {
  const out = source.split("");
  let i = 0;
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const stop = stringEnd(source, i);
      blank(i + 1, stop - 1);
      i = stop;
    } else {
      i++;
    }
  }
  return out.join("");
}

/** Index just past the closing quote of the literal opening at `start` (or the end of the source). */
function stringEnd(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") i += 2;
    else if (ch === quote) return i + 1;
    else if (ch === "\n" && quote !== "`") return i;
    else i++;
  }
  return source.length;
}

function readString(source: string, quoteIndex: number): string {
  return source.slice(quoteIndex + 1, stringEnd(source, quoteIndex) - 1);
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === "\n") line++;
  return line;
}
