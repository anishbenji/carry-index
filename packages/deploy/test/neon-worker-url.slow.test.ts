/**
 * [slow] Independent review (Neon) N1, with the real pinned Vite: `new Worker(new URL("<file>", import.meta.url))` and
 * `new SharedWorker(...)` build the worker in a nested Rolldown run without a `?worker` id, so S4-1a's worker-import
 * refusal does not see them. The nested build's files still reach the watch list through the transform hook's
 * `addWatchFile` (S4-1b), so the build fails. These cases pin that: a worker in Kit code, and a public worker that
 * reads Kit data, each through a helper outside the public roots.
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
const TIMEOUT = 120_000;

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function build(helper: string, files: Record<string, string>) {
  const repo = tempDir("cj-graph-worker-url-repo-");
  temps.push(repo);
  writeTree(repo.root, {
    ...files,
    "packages/shared/src/helper.js": helper,
    "apps/web/src/main.js": 'import { make } from "../../../packages/shared/src/helper.js";\nconsole.log(make);\n',
    "apps/web/vite.config.mjs": [
      `import { moduleGraph } from ${JSON.stringify(PLUGIN)};`,
      `export default { root: import.meta.dirname, logLevel: "silent", plugins: [moduleGraph({ repoRoot: ${JSON.stringify(repo.root)} })],`,
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

const KIT_WORKER = { "apps/kit/src/w.js": 'postMessage({ orderReference: "SYNTHETIC-PRIVATE-VALUE" });\n' };
const PUBLIC_WORKER_READING_KIT = {
  "packages/shared/src/w.js": 'import orders from "../../../apps/kit/src/orders.json";\npostMessage(orders);\n',
  "apps/kit/src/orders.json": '{"orderReference":"SYNTHETIC-PRIVATE-VALUE"}\n',
};

describe("[slow] workers built from new URL(...) fail the build when they reach Kit code (N1)", () => {
  test.each([
    ["Worker", "new Worker"],
    ["SharedWorker", "new SharedWorker"],
  ])(
    "[slow] %s pointing at a Kit file fails the build",
    (_name, ctor) => {
      const helper = `export const make = () => ${ctor}(new URL("../../../apps/kit/src/w.js", import.meta.url), { type: "module" });\n`;
      const { status, output } = build(helper, KIT_WORKER);
      expect(status).not.toBe(0);
      expect(output).toContain("apps/kit/src/w.js");
    },
    TIMEOUT,
  );

  test.each([
    ["Worker", "new Worker"],
    ["SharedWorker", "new SharedWorker"],
  ])(
    "[slow] a public %s that reads Kit data fails the build",
    (_name, ctor) => {
      const helper = `export const make = () => ${ctor}(new URL("./w.js", import.meta.url), { type: "module" });\n`;
      const { status, output } = build(helper, PUBLIC_WORKER_READING_KIT);
      expect(status).not.toBe(0);
      expect(output).toContain("apps/kit/src/orders.json");
    },
    TIMEOUT,
  );

  test(
    "[slow] a public Worker reading public data builds (positive control)",
    () => {
      const helper = 'export const make = () => new Worker(new URL("./w.js", import.meta.url), { type: "module" });\n';
      const { status, output } = build(helper, { "packages/shared/src/w.js": "postMessage(1);\n" });
      expect(status, output).toBe(0);
    },
    TIMEOUT,
  );
});
