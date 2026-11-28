/**
 * Security-sol round 2, S2-4: the import ban reads three fixed source folders, so a private module reached through a
 * shared helper elsewhere escapes it. The public build's own resolved module list is checked instead
 * (`graph-plugin.ts`), and `deploy` and `triggers` require that check's report for the same build: every output
 * file it lists must be in the sealed site with the same SHA-256, and every sealed `assets/` file must be listed.
 * The real-Vite cases are in `sol-r2-graph.slow.test.ts`.
 */
import { createHash } from "node:crypto";
import { readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import type { GraphContext, GraphReport } from "../src/graph-plugin.ts";
import {
  classifyModules,
  GRAPH_REPORT_FORMAT,
  graphReportPath,
  moduleGraph,
  OUTSIDE_REPOSITORY,
} from "../src/graph-plugin.ts";
import { ENV, fakeCloudflare, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_PAGE, minimalSite, REPO_ROOT, tempDir, writeGraphReport, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
const extraFiles: string[] = [];
afterEach(() => {
  for (const file of extraFiles.splice(0)) rmSync(file, { force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const ASSET = "assets/main-AbCdEfGh.js";
const CODE = "export const synthetic=1;\n";

function report(overrides: Partial<GraphReport> = {}): GraphReport {
  return {
    format: GRAPH_REPORT_FORMAT,
    modules: ["apps/web/src/main.tsx"],
    // The asset, and the page every minimal site holds: both are built output the report must list (N2).
    outputs: [
      { path: "404.html", sha256: sha256(MINIMAL_PAGE) },
      { path: ASSET, sha256: sha256(CODE) },
    ],
    // The check settings the build ran with (S4-1 hardening); every check on.
    checks: { workerImports: true },
    ...overrides,
  };
}

/** A site with one bundled asset, and (unless `write` is null) the graph report beside it. */
function siteWithAsset(write: string | GraphReport | null, files: Record<string, string> = {}): string {
  const site = minimalSite({ [ASSET]: CODE, ...files });
  temps.push(site);
  const path = graphReportPath(site.root);
  extraFiles.push(path);
  if (write !== null) writeFileSync(path, typeof write === "string" ? write : JSON.stringify(write));
  return site.root;
}

async function run(command: "deploy" | "triggers" | "check", siteDir: string) {
  const cf = fakeCloudflare({ previous: { bindings: [] } });
  const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch: cf.fetch });
  fake.io.sleep = async () => {};
  const code = await main([command, siteDir], fake.io);
  return { code, cf, fake, has: (text: string) => fake.lines.some((l) => l.includes(text)) };
}

describe("classifyModules reads the build's resolved module ids (S2-4)", () => {
  test("names every private module: private folders, installed private packages, paths outside the repository and ids that are not paths", () => {
    const ids = [
      join(REPO_ROOT, "apps/web/src/main.tsx"),
      join(REPO_ROOT, "packages/shared/src/helper.ts"),
      join(REPO_ROOT, "apps/kit/src/secret.ts"),
      `${join(REPO_ROOT, "packages/schema/src/private/owned.ts")}?raw`,
      join(REPO_ROOT, "node_modules/.bun/@cj+kit@0.0.0/node_modules/@cj/kit/index.js"),
      join(REPO_ROOT, "workers/kit/src/index.ts"),
      "/synthetic-outside/kit-export.json",
      "relative/id.js",
      "\0virtual:synthetic",
    ];
    const { modules, privateModules } = classifyModules(ids, REPO_ROOT);
    expect(privateModules).toEqual([
      OUTSIDE_REPOSITORY,
      "apps/kit/src/secret.ts",
      "node_modules/.bun/@cj+kit@0.0.0/node_modules/@cj/kit/index.js",
      "packages/schema/src/private/owned.ts",
      "workers/kit/src/index.ts",
    ]);
    expect(modules).toContain("apps/web/src/main.tsx");
    expect(modules).toContain("packages/shared/src/helper.ts");
    expect(modules).toContain("\0virtual:synthetic");
    expect(modules.some((m) => m.includes("synthetic-outside"))).toBe(false);
  });

  test("a module reached through a linked folder is judged by its real path", () => {
    const repo = tempDir("cj-graph-repo-");
    temps.push(repo);
    writeTree(repo.root, { "apps/kit/src/secret.ts": "export const s = 1;\n", "apps/web/src/main.ts": "" });
    symlinkSync(join(repo.root, "apps/kit/src"), join(repo.root, "apps/web/src/shared"));
    const { privateModules } = classifyModules([join(repo.root, "apps/web/src/shared/secret.ts")], repo.root);
    expect(privateModules).toEqual(["apps/kit/src/secret.ts"]);
  });

  test("public modules only: nothing private (positive control)", () => {
    const ids = [join(REPO_ROOT, "apps/web/src/main.tsx"), join(REPO_ROOT, "packages/schema/src/bag.ts")];
    expect(classifyModules(ids, REPO_ROOT).privateModules).toEqual([]);
  });
});

describe("the moduleGraph plugin (S2-4)", () => {
  const context = (ids: string[]): GraphContext => ({
    getModuleIds: () => ids,
    error: (message: string): never => {
      throw new Error(message);
    },
  });

  test("fails the build on a private module before anything is written, and removes an earlier report", () => {
    const out = tempDir("cj-graph-out-");
    temps.push(out);
    extraFiles.push(graphReportPath(out.root));
    writeFileSync(graphReportPath(out.root), JSON.stringify(report()));
    const plugin = moduleGraph({ repoRoot: REPO_ROOT });
    const ids = [join(REPO_ROOT, "apps/web/src/main.tsx"), join(REPO_ROOT, "apps/kit/src/secret.ts")];
    expect(() => plugin.generateBundle.call(context(ids), { dir: out.root })).toThrow(/apps\/kit\/src\/secret\.ts/);
    expect(() => readReport(out.root)).toThrow();
  });

  test("writes the report beside the output folder with each output's SHA-256 (positive control)", () => {
    const out = tempDir("cj-graph-out-");
    temps.push(out);
    extraFiles.push(graphReportPath(out.root));
    const plugin = moduleGraph({ repoRoot: REPO_ROOT });
    const ctx = context([join(REPO_ROOT, "apps/web/src/main.tsx")]);
    plugin.generateBundle.call(ctx, { dir: out.root });
    plugin.writeBundle.call(
      ctx,
      { dir: out.root },
      { [ASSET]: { type: "chunk", code: CODE }, "404.html": { type: "asset", source: MINIMAL_PAGE } },
    );
    expect(readReport(out.root)).toEqual(report());
  });
});

function readReport(outDir: string): unknown {
  return JSON.parse(readFileSync(graphReportPath(outDir), "utf8"));
}

describe("deploy and triggers require the graph report for the same build (S2-4)", () => {
  test.each(["deploy", "triggers"] as const)(
    "%s: no report beside a site with bundled code stops before any spawn",
    async (command) => {
      const { code, fake, has } = await run(command, siteWithAsset(null));
      expect(code).toBe(1);
      expect(fake.spawned).toEqual([]);
      expect(has("module-graph-missing")).toBe(true);
    },
  );

  test("deploy: a matching report lets the deploy run (positive control)", async () => {
    const { code, cf } = await run("deploy", siteWithAsset(report()));
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
  });

  test.each([
    ["an output's SHA-256 differs", report({ outputs: [{ path: ASSET, sha256: sha256("other") }] })],
    [
      "it lists an output the site does not hold",
      report({ outputs: [...report().outputs, { path: "assets/gone-AbCdEfGh.js", sha256: sha256(CODE) }] }),
    ],
    ["it lists no outputs", report({ outputs: [] })],
  ])("deploy: a report whose %s is a mismatch and stops before any spawn", async (_name, written) => {
    const { code, fake, has } = await run("deploy", siteWithAsset(written));
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("module-graph-mismatch")).toBe(true);
  });

  test("deploy: a sealed asset the report does not list is a mismatch", async () => {
    const { code, fake, has } = await run("deploy", siteWithAsset(report(), { "assets/extra-IjKlMnOp.js": CODE }));
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("module-graph-mismatch")).toBe(true);
  });

  test.each([
    ["a private module", report({ modules: ["apps/web/src/main.tsx", "apps/kit/src/secret.ts"] })],
    ["a module outside the repository", report({ modules: [OUTSIDE_REPOSITORY] })],
  ])("deploy: a report listing %s stops before any spawn", async (_name, written) => {
    const { code, fake, has } = await run("deploy", siteWithAsset(written));
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("private-module")).toBe(true);
  });

  test.each([
    ["is not JSON", "{ not json"],
    ["has another format", JSON.stringify({ ...report(), format: "other/1" })],
    ["has an extra key", JSON.stringify({ ...report(), ok: true })],
    ["has a malformed hash", JSON.stringify(report({ outputs: [{ path: ASSET, sha256: "abc" }] }))],
  ])("deploy: a report that %s counts as missing", async (_name, written) => {
    const { code, fake, has } = await run("deploy", siteWithAsset(written));
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("module-graph-missing")).toBe(true);
  });

  test("deploy: a report that is a symbolic link counts as missing", async () => {
    const site = siteWithAsset(null);
    const elsewhere = tempDir("cj-graph-elsewhere-");
    temps.push(elsewhere);
    writeFileSync(join(elsewhere.root, "report.json"), JSON.stringify(report()));
    symlinkSync(join(elsewhere.root, "report.json"), graphReportPath(site));
    const { code, fake, has } = await run("deploy", site);
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("module-graph-missing")).toBe(true);
  });

  test("check does not need the report: it runs on any build folder (positive control)", async () => {
    const { code } = await run("check", siteWithAsset(null));
    expect(code).toBe(0);
  });

  // N2 (owner decision #22, 2026-11-28): pages are built output too, so a site with pages and no bundled code needs
  // the report, and every page must be listed in it with the sealed file's SHA-256.
  const PAGE = "<!doctype html><title>x</title>\n";
  function pagesOnly(): string {
    const site = minimalSite({ "bags/example.html": PAGE });
    temps.push(site);
    extraFiles.push(graphReportPath(site.root));
    return site.root;
  }

  test.each(["deploy", "triggers"] as const)(
    "%s: a site with pages but no bundled code and no report stops before any spawn (N2)",
    async (command) => {
      const { code, fake, has } = await run(command, pagesOnly());
      expect(code).toBe(1);
      expect(fake.spawned).toEqual([]);
      expect(has("module-graph-missing")).toBe(true);
    },
  );

  test("deploy: a page changed after the build is a mismatch and stops before any spawn (N2)", async () => {
    const site = pagesOnly();
    writeGraphReport(site);
    writeFileSync(join(site, "bags", "example.html"), "<!doctype html><title>tampered</title>\n");
    const { code, fake, has } = await run("deploy", site);
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("module-graph-mismatch")).toBe(true);
  });

  test("deploy: a page the report does not list is a mismatch and stops before any spawn (N2)", async () => {
    const site = pagesOnly();
    writeGraphReport(site);
    writeFileSync(join(site, "bags", "added.html"), PAGE);
    const { code, fake, has } = await run("deploy", site);
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("module-graph-mismatch")).toBe(true);
  });

  test("deploy: a site with pages and no bundled code deploys with a matching report (positive control)", async () => {
    const site = pagesOnly();
    writeGraphReport(site);
    const { code } = await run("deploy", site);
    expect(code).toBe(0);
  });
});

describe("the gate refuses a report that lists a worker import (S4-1a)", () => {
  test("deploy: a worker import in the report stops before any spawn", async () => {
    const written = report({ modules: ["apps/web/src/main.tsx", "packages/shared/src/w.js?worker&inline"] });
    const { code, fake, has } = await run("deploy", siteWithAsset(written));
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("worker-import")).toBe(true);
  });
});

/**
 * S4-1 hardening (director): `checks: { workerImports: false }` is a test-only way to turn a security check off, and
 * it lives in production code. The plugin records the settings it ran with, and the gate refuses a report made with
 * any check off, or with no record of them, as `graph-checks-disabled`.
 */
describe("the gate refuses a report made with a check turned off", () => {
  test("a report with workerImports false is refused even when it lists no worker import", async () => {
    const written = report({ checks: { workerImports: false } });
    expect(written.modules.some((m) => m.includes("worker"))).toBe(false);
    const { code, fake, has } = await run("deploy", siteWithAsset(written));
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("graph-checks-disabled")).toBe(true);
  });

  test("a report with no record of its check settings is refused", async () => {
    const { checks: _omitted, ...withoutChecks } = report();
    const { code, fake, has } = await run("deploy", siteWithAsset(withoutChecks as GraphReport));
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
    expect(has("graph-checks-disabled")).toBe(true);
  });

  test("the plugin records its check settings: on by default, off only when the test switch is set", () => {
    const ctx = (): GraphContext =>
      Object.assign(
        new (class {
          addWatchFile(_id: string): void {}
        })(),
        {
          getModuleIds: () => [join(REPO_ROOT, "apps/web/src/main.tsx")],
          error: (message: string): never => {
            throw new Error(message);
          },
        },
      ) as unknown as GraphContext;
    for (const [options, expected] of [
      [{}, { workerImports: true }],
      [{ checks: { workerImports: false } }, { workerImports: false }],
    ] as const) {
      const out = tempDir("cj-graph-out-");
      temps.push(out);
      extraFiles.push(graphReportPath(out.root));
      const plugin = moduleGraph({ repoRoot: REPO_ROOT, ...options });
      const c = ctx();
      plugin.buildStart.call(c);
      plugin.generateBundle.call(c, { dir: out.root });
      plugin.writeBundle.call(c, { dir: out.root }, { [ASSET]: { type: "chunk", code: CODE } });
      expect((readReport(out.root) as GraphReport).checks).toEqual(expected);
    }
  });
});
