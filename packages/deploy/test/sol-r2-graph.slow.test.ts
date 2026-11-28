/**
 * [slow] Security-sol round 2, S2-4, with the real pinned Vite: a public entry that reaches Kit code through a shared
 * helper outside the three public folders passes the source import ban but fails the build-graph check; and the
 * real apps/web build writes a report the gate accepts for that build.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { checkModuleGraph } from "../src/graph-check.ts";
import { graphReportPath } from "../src/graph-plugin.ts";
import { findPrivateImports } from "../src/imports.ts";
import type { ManifestEntry } from "../src/seal.ts";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { REPO_ROOT, tempDir, writeTree } from "./helpers.ts";

const WEB = join(REPO_ROOT, "apps", "web");
const VITE = join(WEB, "node_modules", ".bin", "vite");
const PLUGIN = pathToFileURL(join(REPO_ROOT, "packages", "deploy", "src", "graph-plugin.ts")).href;
const SLOW = { timeout: 120_000 };
/**
 * The positive control's precondition (owner decision #22, 2026-11-28, option (a)): the sealed site is not vacuous
 * (it holds the listing page and at least one bag page), and the build-graph report lists every sealed page with the
 * sealed file's SHA-256. Returns what is wrong, empty when nothing is.
 */
function pageCoverage(manifest: readonly ManifestEntry[], report: unknown): string[] {
  const problems: string[] = [];
  const pages = manifest.filter((entry) => entry.path.endsWith(".html"));
  if (!pages.some((entry) => entry.path === "uhmwpe-backpacks.html")) problems.push("no listing page");
  if (!pages.some((entry) => entry.path.startsWith("bags/"))) problems.push("no bag page");
  const outputs = (report as { outputs?: { path: string; sha256: string }[] } | null)?.outputs ?? [];
  const listed = new Map(outputs.map((output) => [output.path, output.sha256]));
  for (const page of pages) {
    const sha256 = listed.get(page.path);
    if (sha256 === undefined) problems.push(`${page.path}: not in the report`);
    else if (sha256 !== page.sha256) problems.push(`${page.path}: report hash differs`);
  }
  return problems;
}

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
      // The only finding is the fixture config's import of the plugin from outside the temp repository (N16); the
      // shared-helper route itself is not seen by the source scan.
      expect(findPrivateImports(repo.root)).toEqual([{ file: "apps/web/vite.config.mjs", line: 1, specifier: PLUGIN }]);
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
      const report: unknown = JSON.parse(readFileSync(graphReportPath(out.root), "utf8"));
      expect(pageCoverage(sealed.bundle.manifest, report)).toEqual([]);
      expect(checkModuleGraph(out.root, sealed.bundle.manifest)).toEqual([]);
    },
  );
});

describe("the positive control's precondition (owner decision #22)", () => {
  const sha = (c: string) => c.repeat(64);
  const entry = (path: string, sha256: string): ManifestEntry => ({ path, size: 1, sha256 });
  const manifest = [
    entry("uhmwpe-backpacks.html", sha("a")),
    entry("bags/x.html", sha("b")),
    entry("404.html", sha("c")),
  ];
  const report = { outputs: manifest.map(({ path, sha256 }) => ({ path, sha256 })) };

  test("passes a site with the listing and a bag page, every page listed with its hash", () => {
    expect(pageCoverage(manifest, report)).toEqual([]);
  });

  test("fails a site with no bag page or no listing page", () => {
    expect(
      pageCoverage(
        manifest.filter((e) => !e.path.startsWith("bags/")),
        report,
      ),
    ).toEqual(["no bag page"]);
    expect(pageCoverage(manifest.slice(1), report)).toEqual(["no listing page"]);
    expect(pageCoverage([], { outputs: [] })).toEqual(["no listing page", "no bag page"]);
  });

  test("fails a sealed page the report does not list, or lists with another hash", () => {
    const unlisted = { outputs: report.outputs.filter((o) => o.path !== "bags/x.html") };
    expect(pageCoverage(manifest, unlisted)).toEqual(["bags/x.html: not in the report"]);
    const changed = { outputs: report.outputs.map((o) => (o.path === "404.html" ? { ...o, sha256: sha("d") } : o)) };
    expect(pageCoverage(manifest, changed)).toEqual(["404.html: report hash differs"]);
    expect(pageCoverage(manifest, null)).toHaveLength(3);
  });
});
