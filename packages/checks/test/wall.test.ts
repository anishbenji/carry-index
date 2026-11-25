import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { WallCheck } from "../src/wall.ts";
import { declaredBindings, evaluateWall, WALL_CHECKS } from "../src/wall.ts";
import { makeTree } from "./helpers.ts";

let cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups) c();
  cleanups = [];
});
function tree(files: Record<string, string>): string {
  const t = makeTree(files);
  cleanups.push(t.cleanup);
  return t.root;
}

describe("WALL_CHECKS", () => {
  it("lists the three privacy-wall checks, each still pending with a milestone", () => {
    expect(WALL_CHECKS.map((c) => c.id)).toEqual(["schema-never-public", "canary-export", "public-worker-bindings"]);
    for (const check of WALL_CHECKS) {
      expect(check.status).toBe("pending");
      expect(check.milestone.length).toBeGreaterThan(0);
    }
  });
});

describe("declaredBindings", () => {
  it("finds resource bindings at the top level and under env", () => {
    const config = {
      name: "kit",
      main: "src/index.ts",
      d1_databases: [{ binding: "DB", database_name: "x", database_id: "y" }],
      env: { preview: { r2_buckets: [{ binding: "MEDIA", bucket_name: "m" }] } },
    };
    expect(declaredBindings(config)).toEqual(["d1_databases", "env.preview.r2_buckets"]);
  });

  it("counts an assets binding name but not a bare assets directory", () => {
    expect(declaredBindings({ assets: { directory: "./dist" } })).toEqual([]);
    expect(declaredBindings({ assets: { directory: "./dist", binding: "ASSETS" } })).toEqual(["assets.binding"]);
  });

  it("returns nothing for a config without bindings", () => {
    expect(declaredBindings({ name: "web", compatibility_date: "2026-11-25" })).toEqual([]);
  });
});

describe("evaluateWall", () => {
  it("passes and prints each pending check when no wrangler config declares a binding", () => {
    const root = tree({ "workers/web/wrangler.jsonc": '{ "name": "web", // no bindings\n }' });
    const result = evaluateWall(root);
    expect(result.ok).toBe(true);
    for (const check of WALL_CHECKS) {
      expect(result.lines).toContain(`${check.id}: pending: ${check.milestone}`);
    }
  });

  it("fails when any wrangler.jsonc declares a binding while a check is pending", () => {
    const root = tree({
      "workers/kit/wrangler.jsonc": '{ "d1_databases": [{ "binding": "DB" }], }',
    });
    const result = evaluateWall(root);
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toMatch(/workers\/kit\/wrangler\.jsonc declares d1_databases/);
  });

  it("finds wrangler.json as well as wrangler.jsonc, outside node_modules", () => {
    const root = tree({
      "apps/web/dist/web/wrangler.json": '{ "kv_namespaces": [{ "binding": "KV" }] }',
      "node_modules/pkg/wrangler.jsonc": '{ "d1_databases": [{ "binding": "DB" }] }',
    });
    const result = evaluateWall(root);
    expect(result.ok).toBe(false);
    const text = result.lines.join("\n");
    expect(text).toMatch(/apps\/web\/dist\/web\/wrangler\.json declares kv_namespaces/);
    expect(text).not.toMatch(/node_modules/);
  });

  it("fails closed on a wrangler.toml or an unreadable wrangler.jsonc", () => {
    expect(evaluateWall(tree({ "workers/x/wrangler.toml": 'name = "x"' })).ok).toBe(false);
    expect(evaluateWall(tree({ "workers/x/wrangler.jsonc": "{ not json" })).ok).toBe(false);
  });

  it("allows bindings only once every check is implemented", () => {
    const root = tree({ "workers/kit/wrangler.jsonc": '{ "d1_databases": [{ "binding": "DB" }] }' });
    const done: WallCheck[] = WALL_CHECKS.map((c) => ({ ...c, status: "implemented" }));
    expect(evaluateWall(root, done).ok).toBe(true);
    const oneLeft: WallCheck[] = done.map((c, i) => (i === 1 ? { ...c, status: "pending" } : c));
    expect(evaluateWall(root, oneLeft).ok).toBe(false);
  });
});

const GENERATED = readFileSync(
  fileURLToPath(new URL("./fixtures/cloudflare-vite-plugin-1.70.1-wrangler.json", import.meta.url)),
  "utf8",
);

describe("declaredBindings: allow-list of non-binding keys", () => {
  it("reports binding types missing from older deny-lists, and keys it has never seen", () => {
    const config = {
      name: "web",
      agent_memory: [{ binding: "M" }],
      artifacts: [{ binding: "A" }],
      ratelimits: [{ name: "R", namespace_id: "1" }],
      worker_loaders: [{ binding: "L" }],
      containers: [{ class_name: "C" }],
      logfwdr: { bindings: [{ name: "F", destination: "d" }] },
      some_future_binding: { binding: "X" },
    };
    expect(declaredBindings(config)).toEqual([
      "agent_memory",
      "artifacts",
      "ratelimits",
      "worker_loaders",
      "containers",
      "logfwdr",
      "some_future_binding",
    ]);
  });

  it("accepts the known non-binding keys", () => {
    const config = {
      $schema: "x",
      name: "web",
      main: "src/index.ts",
      compatibility_date: "2026-11-25",
      compatibility_flags: ["nodejs_compat"],
      assets: { directory: "./dist", not_found_handling: "404-page" },
      vars: { MODE: "public" },
      observability: { enabled: true },
      routes: [{ pattern: "example.com/*", zone_name: "example.com" }],
      workers_dev: false,
      preview_urls: false,
      build: { command: "x" },
      rules: [],
      minify: true,
      keep_names: false,
      limits: { cpu_ms: 50 },
      placement: { mode: "smart" },
      triggers: { crons: ["0 0 * * *"] },
    };
    expect(declaredBindings(config)).toEqual([]);
  });

  it("treats nested empty objects and arrays as empty, so the Cloudflare plugin's generated config has no bindings", () => {
    expect(declaredBindings(JSON.parse(GENERATED))).toEqual([]);
    expect(declaredBindings({ durable_objects: { bindings: [] }, queues: { producers: [], consumers: [] } })).toEqual(
      [],
    );
    expect(declaredBindings({ queues: { producers: [{ binding: "Q", queue: "q" }], consumers: [] } })).toEqual([
      "queues",
    ]);
  });

  it("checks previews at the top level and inside each environment", () => {
    const config = {
      name: "web",
      previews: { d1_databases: [{ binding: "DB", database_id: "x" }] },
      env: { staging: { previews: { r2_buckets: [{ binding: "B", bucket_name: "b" }] } } },
    };
    expect(declaredBindings(config)).toEqual(["previews.d1_databases", "env.staging.previews.r2_buckets"]);
  });
});

describe("evaluateWall: which files it reads", () => {
  const binding = '{ "name": "w", "d1_databases": [{ "binding": "DB" }] }';

  it("finds wrangler configs whatever their name, and any .jsonc file", () => {
    for (const path of [
      "apps/web/wrangler.public.jsonc",
      "apps/web/wrangler-preview.json",
      "workers/kit/deploy.jsonc",
    ]) {
      const result = evaluateWall(tree({ [path]: binding }));
      expect(result.ok, path).toBe(false);
      expect(result.lines.join("\n")).toContain(path);
    }
  });

  it("fails closed on any .toml file except bunfig.toml", () => {
    expect(evaluateWall(tree({ "workers/kit/public.toml": 'name = "x"' })).ok).toBe(false);
    expect(evaluateWall(tree({ "bunfig.toml": "[install]" })).ok).toBe(true);
  });

  it("reads the plugin's generated dist config and its .wrangler/deploy redirect", () => {
    const ok = evaluateWall(
      tree({
        "apps/web/dist/public/wrangler.json": GENERATED,
        "apps/web/.wrangler/deploy/config.json":
          '{"configPath":"../../dist/public/wrangler.json","auxiliaryWorkers":[]}',
      }),
    );
    expect(ok.ok).toBe(true);
    expect(ok.lines).toContain("wrangler configs checked: 2");
  });

  it("fails when a deploy redirect points at a config the wall did not check", () => {
    const outside = evaluateWall(
      tree({ "apps/web/.wrangler/deploy/config.json": '{"configPath":"../../../../elsewhere/wrangler.json"}' }),
    );
    expect(outside.ok).toBe(false);
    const missing = evaluateWall(
      tree({ "apps/web/.wrangler/deploy/config.json": '{"configPath":"../../dist/x/wrangler.json"}' }),
    );
    expect(missing.ok).toBe(false);
    const auxiliary = evaluateWall(
      tree({
        "apps/web/dist/public/wrangler.json": GENERATED,
        "apps/web/.wrangler/deploy/config.json":
          '{"configPath":"../../dist/public/wrangler.json","auxiliaryWorkers":[{"configPath":"../../cf/aux.json"}]}',
        "apps/web/cf/aux.json": binding,
      }),
    );
    expect(auxiliary.ok).toBe(false);
  });

  it("does not read wrangler state under .wrangler other than the deploy redirect", () => {
    expect(evaluateWall(tree({ "apps/web/.wrangler/state/v3/x.json": binding })).ok).toBe(true);
  });
});

describe("evaluateWall: Cloudflare plugin options in Vite configs", () => {
  const vite = (call: string, importLine = 'import { cloudflare } from "@cloudflare/vite-plugin";') =>
    `${importLine}\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [${call}] });\n`;

  it("passes when the plugin finds its config by the default rules", () => {
    expect(evaluateWall(tree({ "apps/web/vite.config.ts": vite("cloudflare()") })).ok).toBe(true);
    expect(evaluateWall(tree({ "apps/web/vite.config.ts": vite("cloudflare({ persistState: false })") })).ok).toBe(
      true,
    );
  });

  it("fails when the plugin is given configPath or an inline config", () => {
    for (const call of [
      'cloudflare({ configPath: "./cf/public.json" })',
      'cloudflare({ "config": { d1_databases: [] } })',
      "cloudflare({ configPath })",
      'cf({ configPath: "x.json" })',
    ]) {
      const importLine = call.startsWith("cf(")
        ? 'import { cloudflare as cf } from "@cloudflare/vite-plugin";'
        : undefined;
      const result = evaluateWall(tree({ "apps/web/vite.config.mts": vite(call, importLine) }));
      expect(result.ok, call).toBe(false);
      expect(result.lines.join("\n")).toMatch(/apps\/web\/vite\.config\.mts/);
    }
  });

  it("fails closed when it cannot see the options: a variable, a spread or the plugin passed around", () => {
    for (const call of ["cloudflare(options)", "cloudflare({ ...options })", "wrap(cloudflare)"]) {
      expect(evaluateWall(tree({ "apps/web/vite.config.js": vite(call) })).ok, call).toBe(false);
    }
    const namespace = vite("cf.cloudflare({ configPath: 'x' })", 'import * as cf from "@cloudflare/vite-plugin";');
    expect(evaluateWall(tree({ "apps/web/vite.config.ts": namespace })).ok).toBe(false);
  });
});
