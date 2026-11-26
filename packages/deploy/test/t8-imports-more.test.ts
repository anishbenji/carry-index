/**
 * T8, the import ban's other ways in (Fable independent re-check, P2): Vite's `import.meta.glob`, asset URLs built
 * with `new URL(x, import.meta.url)`, and specifier aliases (tsconfig `paths` or `baseUrl`, package.json `imports`,
 * Vite `resolve.alias`). A literal that lands in a private folder is reported; a non-literal one always is; any
 * alias configuration on the public side is refused outright rather than resolved.
 */
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { findPrivateImports, NON_LITERAL } from "../src/imports.ts";
import type { TempDir } from "./helpers.ts";
import { tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function repo(files: Record<string, string>): string {
  const dir = tempDir("cj-imports-");
  temps.push(dir);
  writeTree(dir.root, files);
  return dir.root;
}

describe("T8 the import ban covers globs, asset URLs and aliases", () => {
  test("T8 import.meta.glob and new URL(x, import.meta.url) into a private folder are reported; public ones are not", () => {
    const root = repo({
      "apps/web/src/glob.ts": [
        'export const a = import.meta.glob("../../kit/src/*.ts", { eager: true });',
        'export const b = import.meta.glob(["./pages/*.tsx", "../../../workers/kit/**/*.ts"]);',
        'export const c = import.meta.glob("./pages/*.tsx");',
        "export const d = (p: string) => import.meta.glob(p);",
        "",
      ].join("\n"),
      "apps/web/src/url.ts": [
        'export const a = new URL("../../kit/src/secret.ts", import.meta.url);',
        'export const b = new URL("./logo.svg", import.meta.url);',
        "export const c = (n: string) => new URL(n, import.meta.url);",
        'export const d = new URL("https://example.com/");',
        "",
      ].join("\n"),
    });
    expect(findPrivateImports(root)).toEqual([
      { file: "apps/web/src/glob.ts", line: 1, specifier: "../../kit/src/*.ts" },
      { file: "apps/web/src/glob.ts", line: 2, specifier: "../../../workers/kit/**/*.ts" },
      { file: "apps/web/src/glob.ts", line: 4, specifier: NON_LITERAL },
      { file: "apps/web/src/url.ts", line: 1, specifier: "../../kit/src/secret.ts" },
      { file: "apps/web/src/url.ts", line: 3, specifier: NON_LITERAL },
    ]);
  });

  test("T8 alias configuration on the public side is refused: tsconfig paths and baseUrl, package.json imports, Vite resolve.alias", () => {
    const root = repo({
      "apps/web/tsconfig.json": '{\n  "compilerOptions": {\n    "paths": { "#kit/*": ["../kit/src/*"] }\n  }\n}\n',
      "packages/pipeline/tsconfig.json": '{\n  "compilerOptions": { "baseUrl": "." }\n}\n',
      "workers/web/package.json": '{\n  "name": "w",\n  "imports": { "#kit/*": "../kit/src/*" }\n}\n',
      "apps/web/vite.config.ts": 'export default {\n  resolve: {\n    alias: { "~private": "../kit/src" },\n  },\n};\n',
      // Allowed: the same files without any alias.
      "workers/web/tsconfig.json": '{ "compilerOptions": { "strict": true } }\n',
    });
    expect(findPrivateImports(root)).toEqual([
      { file: "apps/web/tsconfig.json", line: 3, specifier: "(alias configuration: paths)" },
      { file: "apps/web/vite.config.ts", line: 3, specifier: "(alias configuration: resolve.alias)" },
      { file: "packages/pipeline/tsconfig.json", line: 2, specifier: "(alias configuration: baseUrl)" },
      { file: "workers/web/package.json", line: 3, specifier: "(alias configuration: imports)" },
    ]);
  });
});

describe("T8 the import ban's glob and alias checks have no gaps (automated security review)", () => {
  test("T8 a glob whose wildcard sits inside a folder name, one through node_modules, and one through a link are reported", () => {
    const root = repo({
      "apps/web/src/a.ts": [
        'export const a = import.meta.glob("../../k*/src/*.ts");',
        'export const b = import.meta.glob("../../../node_modules/@cj/kit/**/*.js");',
        'export const c = import.meta.glob("./linked/*.ts");',
        "",
      ].join("\n"),
      "apps/kit/src/secret.ts": "export const s = 1;\n",
    });
    symlinkSync(join(root, "apps", "kit", "src"), join(root, "apps", "web", "src", "linked"));
    expect(findPrivateImports(root).map((f) => f.line)).toEqual([1, 2, 3]);
  });

  test("T8 vite alias written as a computed key or a member assignment is refused", () => {
    const root = repo({
      "apps/web/vite.config.ts": [
        'const config = { resolve: { ["alias"]: { "~p": "../kit/src" } } };',
        'config.resolve.alias = { "~q": "../kit/src" };',
        "export default config;",
        "",
      ].join("\n"),
    });
    expect(findPrivateImports(root)).toEqual([
      { file: "apps/web/vite.config.ts", line: 1, specifier: "(alias configuration: resolve.alias)" },
      { file: "apps/web/vite.config.ts", line: 2, specifier: "(alias configuration: resolve.alias)" },
    ]);
  });

  test("T8 paths inherited through tsconfig extends, and paths in a jsconfig, are refused", () => {
    const root = repo({
      "tsconfig.shared.json": '{\n  "compilerOptions": {\n    "paths": { "#kit/*": ["apps/kit/src/*"] }\n  }\n}\n',
      "apps/web/tsconfig.json": '{\n  "extends": "../../tsconfig.shared.json"\n}\n',
      "workers/web/jsconfig.json": '{\n  "compilerOptions": { "paths": {} }\n}\n',
    });
    expect(findPrivateImports(root)).toEqual([
      { file: "apps/web/tsconfig.json", line: 2, specifier: "(alias configuration: paths)" },
      { file: "workers/web/jsconfig.json", line: 2, specifier: "(alias configuration: paths)" },
    ]);
  });
});
