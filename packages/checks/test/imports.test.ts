import { afterEach, describe, expect, it } from "vitest";
import { findValueImports, scanImports } from "../src/imports.ts";
import { makeTree } from "./helpers.ts";

const BANNED = ["zod", "@cj/schema"];

describe("findValueImports", () => {
  it("allows type-only imports and re-exports", () => {
    const src = [
      'import type { Bag } from "@cj/schema";',
      "import type * as S from 'zod';",
      "// import { z } from 'zod';",
      '/* export * from "@cj/schema"; */',
      'export type { Bag } from "@cj/schema";',
      'const x = "import { z } from \\"zod\\"";',
    ].join("\n");
    expect(findValueImports(src, BANNED)).toEqual([]);
  });

  it("flags value imports, mixed imports, side-effect imports, re-exports and dynamic imports", () => {
    const src = [
      'import { z } from "zod";',
      'import { type Bag, bagSchema } from "@cj/schema";',
      'import "zod";',
      'import * as zod from "zod/v4";',
      'export { bagSchema } from "@cj/schema";',
      'export * from "@cj/schema";',
      'const m = await import("zod");',
      'import Default from "@cj/schema/bag";',
    ].join("\n");
    expect(findValueImports(src, BANNED).map((f) => f.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("flags inline type specifiers, which verbatimModuleSyntax keeps as a side-effect import", () => {
    expect(findValueImports('import { type Bag as B, type Fabric } from "@cj/schema";', BANNED)).toHaveLength(1);
  });

  it("flags a multi-line value import", () => {
    const src = 'import {\n  type Bag,\n  bagSchema,\n} from "@cj/schema";\n';
    expect(findValueImports(src, BANNED)).toHaveLength(1);
  });

  it("is not fooled by a backtick inside a regular expression literal", () => {
    const src = 'const t = /`/;\nimport { bagSchema } from "@cj/schema";\nconst u = /"/;\n';
    expect(findValueImports(src, BANNED)).toEqual([{ line: 2, specifier: "@cj/schema" }]);
  });

  it("flags require calls, import-equals and dynamic imports it cannot resolve to a literal", () => {
    const src = [
      'const a = require("zod");',
      'import b = require("@cj/schema");',
      "const c = await import(name);",
      'import type T = require("zod");',
    ].join("\n");
    expect(findValueImports(src, BANNED).map((f) => f.line)).toEqual([1, 2, 3]);
  });

  it("ignores packages whose names only start with a banned name", () => {
    expect(findValueImports('import { x } from "zodiac";\nimport { y } from "@cj/schemata";', BANNED)).toEqual([]);
  });
});

describe("scanImports", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const c of cleanups) c();
    cleanups = [];
  });

  it("reports each value import with its file and line, skipping node_modules and dist", () => {
    const t = makeTree({
      "apps/web/src/ok.tsx": 'import type { Bag } from "@cj/schema";\n',
      "apps/web/src/bad.ts": '\nimport { bagSchema } from "@cj/schema";\n',
      "apps/web/node_modules/x/index.ts": 'import { z } from "zod";\n',
      "apps/web/dist/client/a.js": 'import { z } from "zod";\n',
    });
    cleanups.push(t.cleanup);
    expect(scanImports(t.root, "apps/web", BANNED)).toEqual([
      { file: "apps/web/src/bad.ts", line: 2, specifier: "@cj/schema" },
    ]);
  });
});

describe("scanImports: resolved paths", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const c of cleanups) c();
    cleanups = [];
  });

  it("bans value imports that reach a banned package by a relative path, not only by its name", () => {
    const t = makeTree({
      "apps/web/src/a.ts": 'import { bagSchema } from "../../../packages/schema/src/index.ts";\n',
      "apps/web/src/b.ts": 'import type { Bag } from "../../../packages/schema/src/bag.ts";\n',
      "apps/web/src/c.ts": 'import { formatWeight } from "./format.ts";\n',
      "apps/web/src/d.ts": 'import { z } from "../../../node_modules/zod/index.js";\n',
      "apps/web/src/e.ts": 'export * from "../../../node_modules/.bun/zod@4.6.7/node_modules/zod/v4/index.js";\n',
    });
    cleanups.push(t.cleanup);
    expect(scanImports(t.root, "apps/web", BANNED, ["packages/schema"]).map((f) => f.file)).toEqual([
      "apps/web/src/a.ts",
      "apps/web/src/d.ts",
      "apps/web/src/e.ts",
    ]);
  });
});
