/**
 * [slow] Security-sol round 2, S2-4, with the real pinned Vite: a public entry that reaches Kit code through a shared
 * helper outside the three public folders passes the source import ban but fails the build-graph check; and the
 * real apps/web build writes a report the gate accepts for that build.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { checkModuleGraph } from "../src/graph-check.ts";
import { graphReportPath } from "../src/graph-plugin.ts";
import { findPrivateImports } from "../src/imports.ts";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { REPO_ROOT, tempDir, writeTree } from "./helpers.ts";

const WEB = join(REPO_ROOT, "apps", "web");
const VITE = join(WEB, "node_modules", ".bin", "vite");
const PLUGIN = pathToFileURL(join(REPO_ROOT, "packages", "deploy", "src", "graph-plugin.ts")).href;
const SLOW = { timeout: 120_000 };

const temps: TempDir[] = [];
const extra: string[] = [];
afterEach(() => {
  for (const path of extra.splice(0)) rmSync(path, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

describe("[slow] the build-graph check with the real Vite (S2-4)", () => {
  test(
    "[slow] a Kit module reached through a shared helper fails the build, though the source ban misses it",
    SLOW,
    () => {
      const repo = tempDir("cj-graph-repo-");
      temps.push(repo);
      writeTree(repo.root, {
        "apps/web/src/main.js":
          'import { label } from "../../../packages/shared/src/helper.js";\nconsole.log(label);\n',
        "packages/shared/src/helper.js": 'export { label } from "../../../apps/kit/src/owned.js";\n',
        "apps/kit/src/owned.js": 'export const label = "synthetic private label";\n',
        "apps/web/vite.config.mjs": [
          `import { moduleGraph } from ${JSON.stringify(PLUGIN)};`,
          `export default { root: import.meta.dirname, logLevel: "silent", plugins: [moduleGraph({ repoRoot: ${JSON.stringify(repo.root)} })],`,
          `  build: { outDir: "dist", emptyOutDir: true, rollupOptions: { input: "src/main.js" } } };`,
        ].join("\n"),
      });
      // The gap S2-4 closes: the source scan reads apps/web, sees only a public relative import, and passes.
      expect(findPrivateImports(repo.root)).toEqual([]);
      const result = spawnSync(VITE, ["build", "--config", join(repo.root, "apps/web/vite.config.mjs")], {
        cwd: join(repo.root, "apps/web"),
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain("apps/kit/src/owned.js");
    },
  );

  test(
    "[slow] the real apps/web build writes a report the gate accepts for that build (positive control)",
    SLOW,
    async () => {
      const out = tempDir("cj-web-graph-");
      temps.push(out);
      extra.push(graphReportPath(out.root));
      const built = spawnSync(VITE, ["build", "--outDir", out.root, "--emptyOutDir", "--logLevel", "error"], {
        cwd: WEB,
        encoding: "utf8",
      });
      expect(built.status).toBe(0);
      const sealed = await seal(out.root, PUBLIC_SITE);
      if (!sealed.ok) throw new Error(`seal failed: ${JSON.stringify(sealed.problems)}`);
      extra.push(sealed.bundle.dir);
      expect(sealed.bundle.manifest.some((e) => e.path.startsWith("assets/"))).toBe(true);
      expect(checkModuleGraph(out.root, sealed.bundle.manifest)).toEqual([]);
    },
  );
});
