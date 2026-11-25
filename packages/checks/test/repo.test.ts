import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listFiles } from "../src/files.ts";
import { scanImports } from "../src/imports.ts";
import { TYPE_ONLY_DIRS, TYPE_ONLY_MODULES } from "../src/policy.ts";
import { evaluateWall } from "../src/wall.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url).href);

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
  it("hold apps/web client JavaScript to the N2 listing limit, measured in Brotli as Cloudflare serves it", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { "size-limit"?: unknown };
    expect(pkg["size-limit"]).toContainEqual(
      expect.objectContaining({ path: "apps/web/dist/client/assets/*.js", brotli: true, limit: "15 kB" }),
    );
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
