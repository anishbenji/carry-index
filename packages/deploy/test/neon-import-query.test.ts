/**
 * Independent review (Neon) r2, N11: the import ban compared specifiers with their `?raw`, `?url` or `#...` suffix
 * still on, so a private package, a private file or a linked private folder imported with Vite's query syntax passed.
 * The suffix is now stripped before every check, as the build-graph check already does. The reviewer's lines are the
 * cases.
 */
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { findPrivateImports } from "../src/imports.ts";
import type { TempDir } from "./helpers.ts";
import { tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function found(line: string, link = false) {
  const dir = tempDir("cj-neon-query-");
  temps.push(dir);
  writeTree(dir.root, {
    "apps/web/src/page.ts": `${line}\n`,
    "apps/web/src/logo.svg": "<svg/>",
    "data/my-notes.yaml": "synthetic: true\n",
    "apps/kit/src/secret.ts": "export const s = 1;\n",
  });
  if (link) symlinkSync(join(dir.root, "apps/kit/src"), join(dir.root, "apps/web/src/linked"));
  return findPrivateImports(dir.root).map((i) => i.specifier);
}

describe("query and hash suffixes do not hide a private import (N11)", () => {
  test.each([
    ['import notes from "../../../data/my-notes.yaml?raw";', "../../../data/my-notes.yaml?raw"],
    ['import priv from "@cj/schema/private?raw";', "@cj/schema/private?raw"],
    ['import kit from "@cj/kit?url";', "@cj/kit?url"],
    ['import kit from "@cj/kit#main";', "@cj/kit#main"],
  ])("%s is reported", (line, specifier) => {
    expect(found(line)).toEqual([specifier]);
  });

  test("a linked private folder imported with ?raw is reported", () => {
    expect(found('import secret from "./linked/secret.ts?raw";', true)).toEqual(["./linked/secret.ts?raw"]);
  });

  test("a public file imported with ?url passes (positive control)", () => {
    expect(found('import logo from "./logo.svg?url";')).toEqual([]);
  });
});
