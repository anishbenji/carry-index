/**
 * [slow] Security round 3, S3-1, with the real pinned Vite: a file reached as an asset never becomes a module, so
 * `this.getModuleIds()` does not list it. `new URL("<file>", import.meta.url)` and CSS `@import` or `url()` read it
 * and either inline it into a public chunk or emit it as a hashed asset. Both routes, through a helper outside the
 * public roots, must fail the build.
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

/** A temp repository whose public entry imports `entryImport`, with the given extra files; returns the build result. */
function build(files: Record<string, string>, entry: string) {
  const repo = tempDir("cj-graph-asset-repo-");
  temps.push(repo);
  writeTree(repo.root, {
    ...files,
    "apps/web/src/main.js": entry,
    "apps/web/vite.config.mjs": [
      `import { moduleGraph } from ${JSON.stringify(PLUGIN)};`,
      `export default { root: import.meta.dirname, logLevel: "silent", plugins: [moduleGraph({ repoRoot: ${JSON.stringify(repo.root)} })],`,
      `  build: { outDir: "dist", emptyOutDir: true, rollupOptions: { input: "src/main.js" } } };`,
    ].join("\n"),
  });
  // The gap: the source scan reads apps/web and sees only a public relative import.
  expect(findPrivateImports(repo.root)).toEqual([]);
  const result = spawnSync(VITE, ["build", "--config", join(repo.root, "apps/web/vite.config.mjs")], {
    cwd: join(repo.root, "apps/web"),
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("[slow] files reached as assets fail the build-graph check (S3-1)", () => {
  test("[slow] new URL(..., import.meta.url) in a shared helper pointing at a small Kit file (inlined)", SLOW, () => {
    const { status, output } = build(
      {
        "packages/shared/src/helper.js":
          'export const ordersUrl = new URL("../../../apps/kit/src/orders.json", import.meta.url).href;\n',
        "apps/kit/src/orders.json": '{"orderReference":"SYN-0001"}\n',
      },
      'import { ordersUrl } from "../../../packages/shared/src/helper.js";\nconsole.log(ordersUrl);\n',
    );
    expect(status).not.toBe(0);
    expect(output).toContain("apps/kit/src/orders.json");
  });

  test("[slow] new URL(..., import.meta.url) pointing at a large Kit file (emitted as an asset)", SLOW, () => {
    const { status, output } = build(
      {
        "packages/shared/src/helper.js":
          'export const ordersUrl = new URL("../../../apps/kit/src/orders.json", import.meta.url).href;\n',
        "apps/kit/src/orders.json": `{"pad":"${"x".repeat(8192)}"}\n`,
      },
      'import { ordersUrl } from "../../../packages/shared/src/helper.js";\nconsole.log(ordersUrl);\n',
    );
    expect(status).not.toBe(0);
    expect(output).toContain("apps/kit/src/orders.json");
  });

  test("[slow] CSS @import and url() in a shared stylesheet pointing at Kit files", SLOW, () => {
    const { status, output } = build(
      {
        "packages/shared/src/style.css":
          '@import "../../../apps/kit/src/private.css";\n.badge { background: url("../../../apps/kit/src/mark.svg"); }\n',
        "apps/kit/src/private.css": ".owned { content: 'SYN-ORDER-0001'; }\n",
        "apps/kit/src/mark.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
      },
      'import "../../../packages/shared/src/style.css";\n',
    );
    expect(status).not.toBe(0);
    expect(output).toContain("apps/kit/src/private.css");
  });

  test("[slow] the same helpers pointing at public files build (positive control)", SLOW, () => {
    const { status } = build(
      {
        "packages/shared/src/helper.js": 'export const dataUrl = new URL("./public.json", import.meta.url).href;\n',
        "packages/shared/src/public.json": '{"public":true}\n',
        "packages/shared/src/style.css": '.badge { background: url("./mark.svg"); }\n',
        "packages/shared/src/mark.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
      },
      'import { dataUrl } from "../../../packages/shared/src/helper.js";\nimport "../../../packages/shared/src/style.css";\nconsole.log(dataUrl);\n',
    );
    expect(status).toBe(0);
  });
});
