/**
 * Independent review (Neon) r3, N16: the import ban judged a resolved import by the repository's private folders and
 * files only, so an import that lands outside the checkout (a relative path climbing out, a `file:` URL, a linked
 * folder pointing outside) or a Vite root-relative `/../...` path into Kit code passed. For `workers/web` and
 * `packages/pipeline`, which run no build-graph check, this ban is the only one. Now any target outside the
 * repository is private, and a specifier starting with `/` is resolved as Vite resolves it: against the public
 * workspace, or as a file-system path when no such file exists there.
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

function found(line: string, setup?: (root: string) => void) {
  const dir = tempDir("cj-neon-outside-");
  temps.push(dir);
  writeTree(dir.root, {
    "apps/web/src/page.ts": `${line}\n`,
    "apps/web/src/logo.svg": "<svg/>",
    "apps/kit/src/main.tsx": "export const k = 1;\n",
  });
  setup?.(dir.root);
  return findPrivateImports(dir.root).map((i) => i.specifier);
}

describe("imports that land outside the repository or in Kit through / (N16)", () => {
  test.each([
    ['import notes from "../../../../private-store/my-bags.yaml?raw";', "../../../../private-store/my-bags.yaml?raw"],
    ['import data from "file:///synthetic-outside/private.json";', "file:///synthetic-outside/private.json"],
    ['import kit from "/../kit/src/main.tsx";', "/../kit/src/main.tsx"],
    ['import data from "/synthetic-outside/private.json";', "/synthetic-outside/private.json"],
  ])("%s is reported", (line, specifier) => {
    expect(found(line)).toEqual([specifier]);
  });

  test("a linked folder that points outside the repository is reported", () => {
    const outside = tempDir("cj-neon-outside-target-");
    temps.push(outside);
    writeTree(outside.root, { "private.json": "{}" });
    const specifiers = found('import data from "./linked/private.json";', (root) =>
      symlinkSync(outside.root, join(root, "apps/web/src/linked")),
    );
    expect(specifiers).toEqual(["./linked/private.json"]);
  });

  test.each([['import logo from "./logo.svg";'], ['import logo from "/src/logo.svg";']])(
    "%s, a public file, passes (positive control)",
    (line) => {
      expect(found(line)).toEqual([]);
    },
  );
});
