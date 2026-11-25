import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listFiles } from "../src/files.ts";
import { scanImports } from "../src/imports.ts";
import { TYPE_ONLY_DIRS, TYPE_ONLY_MODULES } from "../src/policy.ts";
import { evaluateWall } from "../src/wall.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

describe("this repository", () => {
  it("apps/web imports Zod and @cj/schema by `import type` only", () => {
    for (const dir of TYPE_ONLY_DIRS) expect(scanImports(ROOT, dir, TYPE_ONLY_MODULES)).toEqual([]);
  });

  it("apps/web uses at least one schema type, so the check above guards a real import", () => {
    const sources = listFiles(ROOT, "apps/web/src", (name) => /\.tsx?$/.test(name));
    const typeImports = sources.filter((file) =>
      /import type [^;]+ from "@cj\/schema"/.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(typeImports.length).toBeGreaterThan(0);
  });

  it("passes the privacy-wall check", () => {
    expect(evaluateWall(ROOT).ok).toBe(true);
  });
});
