import { readFileSync } from "node:fs";
import { join, matchesGlob, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listFiles } from "../src/files.ts";
import { scanImports } from "../src/imports.ts";
import { publicDirs, TYPE_ONLY_MODULES, TYPE_ONLY_PATHS } from "../src/policy.ts";
import { evaluateWall, repoFiles } from "../src/wall.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url).href);

describe("this repository", () => {
  it("apps/web imports Zod and @cj/schema by `import type` only", () => {
    for (const dir of publicDirs(ROOT)) expect(scanImports(ROOT, dir, TYPE_ONLY_MODULES, TYPE_ONLY_PATHS)).toEqual([]);
  });

  it("apps/web uses at least one schema type, so the check above guards a real import", () => {
    const sources = listFiles(ROOT, "apps/web/src", (name) => /\.tsx?$/.test(name));
    const typeImports = sources.filter((file) =>
      /import type [^;]+ from "@cj\/schema"/.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(typeImports.length).toBeGreaterThan(0);
  });

  it("passes the privacy-wall check", () => {
    expect(evaluateWall(repoFiles(ROOT)).ok).toBe(true);
  });
});

describe("Vite dev servers", () => {
  it("bind to loopback only, so the dev WebSocket is not reachable from the network", async () => {
    for (const app of ["web", "kit"]) {
      const module = (await import(`../../../apps/${app}/vite.config.ts`)) as {
        default: { server?: { host?: unknown } };
      };
      expect(module.default.server?.host, app).toBe("localhost");
    }
  });
});

describe("size budgets", () => {
  // Owner decision #23 (2026-11-28), option (a): the static-first site ships no script, so the budgets are held per
  // page. Every built page needs a gzip and a Brotli size-limit row at or under its N2 HTML budget (Cloudflare
  // recompresses at gzip 8 or Brotli 4, size-limit measures gzip 9 and Brotli 11, so both are reported and both must
  // pass). The JavaScript budgets have no file to measure: apps/web/test/static-site.test.ts shows the build refuses
  // any script chunk, and e2e/site.spec.ts asserts no page has a <script>.
  const DIST = "apps/web/dist/client";
  const LISTING_BUDGET = 40_000;
  const CONTENT_BUDGET = 14_000;

  /** The pages the build writes, each with its N2 budget: the listing, one per data/bags model, and 404.html. */
  function builtPages(): { path: string; budget: number }[] {
    const models = listFiles(ROOT, "data/bags", (name) => name.endsWith(".yaml")).map((file) => {
      const id = /^model:\n(?: {2}.*\n)*? {2}id: ([a-z0-9-]+)$/m.exec(readFileSync(join(ROOT, file), "utf8"))?.[1];
      if (!id) throw new Error(`${file}: no model id`);
      return id;
    });
    return [
      { path: `${DIST}/uhmwpe-backpacks.html`, budget: LISTING_BUDGET },
      ...models.map((id) => ({ path: `${DIST}/bags/${id}.html`, budget: CONTENT_BUDGET })),
      { path: `${DIST}/404.html`, budget: CONTENT_BUDGET },
    ];
  }

  /** "<page> <gzip|brotli>" for every page with no row of that compression covering it within its budget. */
  function budgetGaps(rows: unknown, pages: { path: string; budget: number }[]): string[] {
    const list = (Array.isArray(rows) ? rows : []) as { path?: unknown; limit?: unknown; [key: string]: unknown }[];
    return pages.flatMap((page) =>
      (["gzip", "brotli"] as const)
        .filter(
          (compression) =>
            !list.some(
              (row) =>
                row[compression] === true &&
                (Array.isArray(row.path) ? row.path : [row.path]).some(
                  (glob) => typeof glob === "string" && (glob === page.path || matchesGlob(page.path, glob)),
                ) &&
                typeof row.limit === "string" &&
                kiloBytes(row.limit) <= page.budget,
            ),
        )
        .map((compression) => `${page.path} ${compression}`),
    );
  }

  /** size-limit's reading of a limit: kB is 1,000 bytes. Anything else counts as over every budget. */
  function kiloBytes(limit: string): number {
    const match = /^(\d+(?:\.\d+)?)\s*kB$/.exec(limit.trim());
    return match ? Number(match[1]) * 1000 : Number.POSITIVE_INFINITY;
  }

  it("hold every built page to its N2 HTML budget in both gzip and Brotli, so the larger one gates", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { "size-limit"?: unknown };
    const pages = builtPages();
    expect(pages.filter((p) => p.path.includes("/bags/")).length).toBeGreaterThan(0);
    expect(budgetGaps(pkg["size-limit"], pages)).toEqual([]);
  });

  it("finds a page with no row, a row over budget, and a missing compression (the check above is not vacuous)", () => {
    const page = { path: `${DIST}/bags/x.html`, budget: CONTENT_BUDGET };
    const row = (extra: object) => ({ path: page.path, limit: "14 kB", ...extra });
    expect(budgetGaps([row({ gzip: true }), row({ brotli: true })], [page])).toEqual([]);
    expect(budgetGaps([], [page])).toEqual([`${page.path} gzip`, `${page.path} brotli`]);
    expect(budgetGaps([row({ gzip: true }), { ...row({ brotli: true }), limit: "15 kB" }], [page])).toEqual([
      `${page.path} brotli`,
    ]);
    expect(budgetGaps([row({ brotli: true })], [page])).toEqual([`${page.path} gzip`]);
    expect(budgetGaps([{ path: `${DIST}/bags/*.html`, limit: "14 kB", gzip: true, brotli: true }], [page])).toEqual([]);
  });
});

describe("Vite dev file access", () => {
  it("denies Wrangler local secret files while keeping Vite's default deny list", async () => {
    for (const app of ["web", "kit"]) {
      const module = (await import(`../../../apps/${app}/vite.config.ts`)) as {
        default: { server?: { fs?: { deny?: unknown } } };
      };
      // Vite 8.3.8's own defaults (configDefaults.server.fs.deny), which a configured list replaces, then ours.
      expect(module.default.server?.fs?.deny, app).toEqual([
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**",
        ".dev.vars",
        ".dev.vars.*",
      ]);
    }
  });
});

describe("Vite dev server reach", () => {
  it("serves only the app folder, the workspace packages it imports and node_modules, with CORS off", async () => {
    for (const app of ["web", "kit"]) {
      const module = (await import(`../../../apps/${app}/vite.config.ts`)) as {
        default: { server?: { cors?: unknown; fs?: { allow?: unknown } } };
      };
      const allow = module.default.server?.fs?.allow;
      expect(Array.isArray(allow), app).toBe(true);
      const relativeAllow = (allow as string[]).map((p) => relative(ROOT, p).split(sep).join("/").replace(/\/$/, ""));
      expect(relativeAllow, app).toEqual([`apps/${app}`, "packages/schema", "node_modules"]);
      expect(module.default.server?.cors, app).toBe(false);
    }
  });
});

describe("Vite public folders", () => {
  it("apps/kit copies no public folder; apps/web keeps public/ for PR 7's _headers", async () => {
    const load = async (app: string) =>
      ((await import(`../../../apps/${app}/vite.config.ts`)) as { default: { publicDir?: unknown } }).default;
    expect((await load("kit")).publicDir).toBe(false);
    expect((await load("web")).publicDir ?? "public").toBe("public");
  });
});

describe("Node version", () => {
  it("is declared in .node-version and in engines, which agree", () => {
    const pinned = readFileSync(join(ROOT, ".node-version"), "utf8").trim();
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { engines?: { node?: string } };
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.engines?.node).toBe(`>=${pinned}`);
  });
});

describe("TypeScript projects for the apps", () => {
  it("type-check browser source on its own, without Node globals, and the tooling configs in a separate project", () => {
    const rootRefs = (
      JSON.parse(readFileSync(join(ROOT, "tsconfig.json"), "utf8")) as { references: { path: string }[] }
    ).references.map((r) => r.path);
    for (const app of ["web", "kit"]) {
      const browser = JSON.parse(readFileSync(join(ROOT, `apps/${app}/tsconfig.json`), "utf8")) as {
        include: string[];
        compilerOptions: { types?: string[]; lib?: string[] };
      };
      expect(browser.include, app).toEqual(["src"]);
      expect(browser.compilerOptions.types, app).toEqual([]);
      expect(browser.compilerOptions.lib, app).toContain("dom");
      const tooling = JSON.parse(readFileSync(join(ROOT, `apps/${app}/tsconfig.node.json`), "utf8")) as {
        include: string[];
      };
      expect(tooling.include, app).toContain("vite.config.ts");
      expect(rootRefs, app).toContain(`apps/${app}/tsconfig.node.json`);
    }
  });
});

describe("the built public app", () => {
  it("contains no Zod in apps/web/dist", async () => {
    const { zodInBuild } = await import("../src/bundle.ts");
    expect(zodInBuild(ROOT)).toEqual([]);
  });
});

describe("end-to-end sources", () => {
  it("are linted by Biome and type-checked by a project the root references", () => {
    const biome = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as { files: { includes: string[] } };
    expect(biome.files.includes).toEqual(expect.arrayContaining(["playwright.config.ts", "e2e/**"]));
    const root = JSON.parse(readFileSync(join(ROOT, "tsconfig.json"), "utf8")) as { references: { path: string }[] };
    expect(root.references.map((r) => r.path)).toContain("tsconfig.e2e.json");
    const e2e = JSON.parse(readFileSync(join(ROOT, "tsconfig.e2e.json"), "utf8")) as { include: string[] };
    expect(e2e.include).toEqual(expect.arrayContaining(["playwright.config.ts", "e2e"]));
  });
});
