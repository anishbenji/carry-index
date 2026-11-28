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

/**
 * Independent review (Neon) r2, N10: Vite joins a glob onto its folder with `posix.join`, which collapses a wildcard
 * segment followed by `..`, so the reviewer's first pattern reached Kit while the check read only `./`; and a glob
 * rooted above the repository was not refused. A `..` segment after the first glob metacharacter, any `node_modules` segment,
 * and any target at or outside the repository root are now refused. The reviewer's lines are the cases.
 */
describe("glob patterns that climb after a wildcard or above the repository (N10)", () => {
  test.each([
    ['export const a = import.meta.glob("./*/../../../kit/src/*.ts");', "./*/../../../kit/src/*.ts"],
    ['export const a = import.meta.glob("./{x}/../../../kit/src/*.ts");', "./{x}/../../../kit/src/*.ts"],
    [
      'export const a = import.meta.glob("./a*/../../../node_modules/@cj/kit/*.js");',
      "./a*/../../../node_modules/@cj/kit/*.js",
    ],
    ['export const a = import.meta.glob("../../../../**/*.ts");', "../../../../**/*.ts"],
    ['export const a = import.meta.glob("./pages/*/node_modules/x/*.js");', "./pages/*/node_modules/x/*.js"],
  ])("%s is refused", (line, pattern) => {
    expect(found(line)).toEqual([pattern]);
  });

  test("a glob that climbs before its wildcard into public code passes (positive control)", () => {
    expect(found('export const a = import.meta.glob("../../src/pages/*.ts");')).toEqual([]);
  });
});
