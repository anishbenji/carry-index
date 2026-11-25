import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
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
  it("hold apps/web client JavaScript to the N2 listing limit in both gzip and Brotli, so the larger one gates", () => {
    // Cloudflare recompresses at gzip level 8 or Brotli level 4 (blog.cloudflare.com/this-is-brotli-from-origin);
    // size-limit measures gzip at level 9 and Brotli at quality 11, so both are reported and both must pass.
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { "size-limit"?: unknown };
    const path = "apps/web/dist/client/assets/*.js";
    expect(pkg["size-limit"]).toContainEqual(expect.objectContaining({ path, gzip: true, limit: "15 kB" }));
    expect(pkg["size-limit"]).toContainEqual(expect.objectContaining({ path, brotli: true, limit: "15 kB" }));
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
