/**
 * [slow] Security round 4, S4-1, with the real pinned Vite: a `?worker` import is built by Vite in a nested Rolldown
 * run that does not run `moduleGraph`, and that run's files reach the parent only through a `load` hook's
 * `addWatchFile`. Both reviewers built it: the private value deployed. S4-1a refuses any worker import in the public
 * build (`worker-import`).
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { findPrivateImports } from "../src/imports.ts";
import type { TempDir } from "./helpers.ts";
import { REPO_ROOT, tempDir, writeTree } from "./helpers.ts";

const VITE = join(REPO_ROOT, "apps", "web", "node_modules", ".bin", "vite");
const PLUGIN = pathToFileURL(join(REPO_ROOT, "packages", "deploy", "src", "graph-plugin.ts")).href;
const SLOW = { timeout: 120_000 };

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

/** A temp repository whose public entry uses a shared helper that imports `./w.js<query>`; returns the build result. */
function build(query: string, options = "", workerImports = "") {
  const repo = tempDir("cj-graph-worker-repo-");
  temps.push(repo);
  writeTree(repo.root, {
    "packages/shared/src/helper.js": `import W from "./w.js${query}";\nexport const make = () => new W();\n`,
    "packages/shared/src/w.js": `import orders from "${workerImports || "../../../apps/kit/src/orders.json"}";\npostMessage(orders);\n`,
    "apps/kit/src/orders.json": '{"orderReference":"SYNTHETIC-PRIVATE-VALUE"}\n',
    "packages/shared/src/public.json": '{"public":true}\n',
    "apps/web/src/main.js": 'import { make } from "../../../packages/shared/src/helper.js";\nconsole.log(make);\n',
    "apps/web/vite.config.mjs": [
      `import { moduleGraph } from ${JSON.stringify(PLUGIN)};`,
      `export default { root: import.meta.dirname, logLevel: "silent", plugins: [moduleGraph({ repoRoot: ${JSON.stringify(repo.root)}${options} })],`,
      `  build: { outDir: "dist", emptyOutDir: true, rollupOptions: { input: "src/main.js" } } };`,
    ].join("\n"),
  });
  // The only finding is the fixture config's import of the plugin from outside the temp repository (N16); the
  // shared-helper route itself is not seen by the source scan.
  expect(findPrivateImports(repo.root)).toEqual([{ file: "apps/web/vite.config.mjs", line: 1, specifier: PLUGIN }]);
  const result = spawnSync(VITE, ["build", "--config", join(repo.root, "apps/web/vite.config.mjs")], {
    cwd: join(repo.root, "apps/web"),
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("[slow] worker imports in the public build (S4-1a)", () => {
  test.each(["?worker", "?worker&inline"])(
    "[slow] a shared helper's %s import fails the build with worker-import",
    (query) => {
      const { status, output } = build(query);
      expect(status).not.toBe(0);
      expect(output).toContain("worker-import");
      expect(output).toContain("packages/shared/src/w.js");
    },
    SLOW.timeout,
  );
});
