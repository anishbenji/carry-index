/**
 * [slow] Security round 4, S4-1b, with the real pinned Vite: a nested worker build's files reach the parent build only
 * through the `vite:worker` load hook's `addWatchFile`, on Rolldown's `LoadPluginContextImpl`, a class of its own that
 * the plugin did not wrap. With S4-1a's worker-import refusal turned off, the watch path alone must catch the private
 * file. The same fixture as `sol-r4-worker.slow.test.ts`.
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
  expect(findPrivateImports(repo.root)).toEqual([]);
  const result = spawnSync(VITE, ["build", "--config", join(repo.root, "apps/web/vite.config.mjs")], {
    cwd: join(repo.root, "apps/web"),
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("[slow] the watch path catches a worker's private files on its own (S4-1b)", () => {
  const off = ", checks: { workerImports: false }";
  test.each(["?worker", "?worker&inline"])(
    "[slow] with the worker refusal off, %s reaching Kit data still fails the build",
    (query) => {
      const { status, output } = build(query, off);
      expect(status).not.toBe(0);
      expect(output).not.toContain("worker-import");
      expect(output).toContain("apps/kit/src/orders.json");
    },
    SLOW.timeout,
  );

  test(
    "[slow] with the worker refusal off, a worker reading only public data builds (positive control)",
    () => {
      const { status } = build("?worker", off, "./public.json");
      expect(status).toBe(0);
    },
    SLOW.timeout,
  );
});
