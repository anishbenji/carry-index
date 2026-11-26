/**
 * Independent review (Neon) N2: Vite resolves `import.meta.glob` patterns against `options.base`, leaves `**`
 * unanchored and passes bare specifiers through resolution, while the import ban read only the first argument and
 * anchored every pattern at the importing file. Now an options argument that is not a literal object, or that sets
 * `base`, is `NON_LITERAL`, and a pattern (after a leading `!`) that does not start with `./`, `../` or `/` is
 * refused as written.
 */
import { afterEach, describe, expect, test } from "vitest";
import { findPrivateImports, NON_LITERAL } from "../src/imports.ts";
import type { TempDir } from "./helpers.ts";
import { tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function found(line: string) {
  const dir = tempDir("cj-neon-glob-");
  temps.push(dir);
  writeTree(dir.root, { "apps/web/src/page.ts": `${line}\n` });
  return findPrivateImports(dir.root).map((i) => i.specifier);
}

describe("import.meta.glob options and pattern anchors (N2)", () => {
  test.each([
    [
      "an options base pointing at Kit",
      'export const a = import.meta.glob("./*.ts", { base: "../../kit/src" });',
      [NON_LITERAL],
    ],
    [
      "an options base that looks harmless",
      'export const a = import.meta.glob("./*.ts", { base: "./" });',
      [NON_LITERAL],
    ],
    [
      "a non-literal options argument",
      'const o = { eager: true };\nexport const a = import.meta.glob("./*.ts", o);',
      [NON_LITERAL],
    ],
    ["a spread in the options", 'const o = {};\nexport const a = import.meta.glob("./*.ts", { ...o });', [NON_LITERAL]],
    ["a bare package pattern", 'export const a = import.meta.glob("@cj/kit/*.ts");', ["@cj/kit/*.ts"]],
    ["an unanchored **", 'export const a = import.meta.glob("**/*.ts");', ["**/*.ts"]],
    [
      "an unanchored negative pattern",
      'export const a = import.meta.glob(["./pages/*.ts", "!**/x.ts"]);',
      ["!**/x.ts"],
    ],
    // Follow-up to the automated review: only eager, import and query, each with a literal value.
    [
      "exhaustive: true, which walks node_modules and dot folders",
      'export const a = import.meta.glob("./**/*.ts", { exhaustive: true });',
      [NON_LITERAL],
    ],
    [
      "an option name outside the allow-list",
      'export const a = import.meta.glob("./*.ts", { as: "raw" });',
      [NON_LITERAL],
    ],
    [
      "an allowed option with a non-literal value",
      'const e = true;\nexport const a = import.meta.glob("./*.ts", { eager: e });',
      [NON_LITERAL],
    ],
    [
      "an allowed option given by shorthand",
      'const eager = true;\nexport const a = import.meta.glob("./*.ts", { eager });',
      [NON_LITERAL],
    ],
  ])("%s is refused", (_name, line, expected) => {
    expect(found(line)).toEqual(expected);
  });

  test.each([
    [
      "a literal options object without base",
      'export const a = import.meta.glob("./pages/*.ts", { eager: true, import: "default" });',
    ],
    [
      "a literal query option",
      'export const a = import.meta.glob("./pages/*.svg", { query: "?url", import: "default", eager: false });',
    ],
    ["anchored patterns", 'export const a = import.meta.glob(["./pages/*.ts", "/src/*.ts", "!./pages/x.ts"]);'],
  ])("%s passes (positive control)", (_name, line) => {
    expect(found(line)).toEqual([]);
  });
});
