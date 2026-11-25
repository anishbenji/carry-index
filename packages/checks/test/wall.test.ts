import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
    const root = tree({ "workers/kit/wrangler.jsonc": VALID_D1 });
    const done: WallCheck[] = WALL_CHECKS.map((c) => ({ ...c, status: "implemented" }));
    expect(evaluateWall(root, done).ok).toBe(true);
    const oneLeft: WallCheck[] = done.map((c, i) => (i === 1 ? { ...c, status: "pending" } : c));
    expect(evaluateWall(root, oneLeft).ok).toBe(false);
  });
});

/** A config Wrangler's validator accepts, with one D1 binding (synthetic ids). */
const VALID_D1 =
  '{ "name": "kit", "d1_databases": [{ "binding": "DB", "database_name": "x", "database_id": "00000000-0000-0000-0000-000000000000" }] }';

const GENERATED = readFileSync(
  fileURLToPath(new URL("./fixtures/cloudflare-vite-plugin-1.70.1-wrangler.json", import.meta.url).href),
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

describe("evaluateWall: Worker configs only at fixed paths, read by Wrangler", () => {
  it("reads the four fixed config paths and reports their bindings", () => {
    expect(
      evaluateWall(tree({ "apps/web/wrangler.jsonc": '{ "name": "web", "assets": { "directory": "./dist/client" } }' }))
        .ok,
    ).toBe(true);
    const result = evaluateWall(tree({ "workers/kit/wrangler.jsonc": VALID_D1 }));
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toMatch(/workers\/kit\/wrangler\.jsonc declares d1_databases/);
  });

  it("fails on any other file Wrangler could load as a config, even one without bindings", () => {
    for (const path of [
      "wrangler.json",
      "workers/kit/sub/wrangler.jsonc",
      "apps/web/wrangler.json",
      "apps/web/wrangler.toml",
      "apps/web/wrangler.config.ts",
      "apps/web/cloudflare.config.ts",
      "apps/web/.wrangler/deploy/elsewhere/config.json",
      ".wrangler/deploy/config.json",
    ]) {
      const result = evaluateWall(tree({ [path]: '{ "name": "w" }' }));
      expect(result.ok, path).toBe(false);
      expect(result.lines.join("\n"), path).toContain(path);
    }
  });

  it("parses with Wrangler's own JSONC reader, so a comment ended by a bare carriage return hides nothing", () => {
    const text = '{ "name": "kit", // note\r "r2_buckets": [{ "binding": "B", "bucket_name": "bucket-1" }] }';
    const result = evaluateWall(tree({ "workers/kit/wrangler.jsonc": text }));
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toMatch(/declares r2_buckets/);
  });

  it("judges each environment as Wrangler loads it", () => {
    const text =
      '{ "name": "kit", "env": { "staging": { "d1_databases": [{ "binding": "DB", "database_name": "x", "database_id": "00000000-0000-0000-0000-000000000000" }] } } }';
    const result = evaluateWall(tree({ "workers/kit/wrangler.jsonc": text }));
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toMatch(/env\.staging\.d1_databases/);
  });

  it("fails closed when Wrangler rejects a config", () => {
    const result = evaluateWall(tree({ "workers/kit/wrangler.jsonc": '{ "name": 42 }' }));
    expect(result.ok).toBe(false);
  });

  it("fails on a symlink at a config path or on the way to one", () => {
    const root = tree({ "shared/public.json": '{ "name": "w", "kv_namespaces": [{ "binding": "K", "id": "1" }] }' });
    mkdirSync(join(root, "workers/web"), { recursive: true });
    symlinkSync(join(root, "shared/public.json"), join(root, "workers/web/wrangler.jsonc"));
    expect(evaluateWall(root).ok).toBe(false);

    const other = tree({ "elsewhere/web/wrangler.jsonc": '{ "name": "w" }' });
    mkdirSync(join(other, "apps"), { recursive: true });
    symlinkSync(join(other, "elsewhere/web"), join(other, "apps/web"));
    const result = evaluateWall(other);
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toMatch(/symlink/);
  });

  it("does not join an absolute redirect path onto the redirect's folder", () => {
    const root = tree({
      "apps/web/.wrangler/deploy/dist/public/wrangler.json": GENERATED,
      "apps/web/.wrangler/deploy/config.json": '{ "configPath": "/dist/public/wrangler.json" }',
    });
    expect(evaluateWall(root).ok).toBe(false);
  });

  it("resolves a deploy redirect as Wrangler does and fails on an absolute path outside the checked set", () => {
    const outside = tree({ "x/wrangler.json": "{}" });
    writeFileSync(join(outside, "x/wrangler.json"), '{ "name": "outside" }');
    const root = tree({
      "apps/web/dist/public/wrangler.json": GENERATED,
      "apps/web/.wrangler/deploy/config.json": JSON.stringify({ configPath: join(outside, "x/wrangler.json") }),
    });
    const result = evaluateWall(root);
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toMatch(/apps\/web/);
  });
});

describe("evaluateWall: Cloudflare plugin options are allow-listed", () => {
  const vite = (options: string) =>
    `import { cloudflare } from "@cloudflare/vite-plugin";\nexport default { plugins: [cloudflare(${options})] };\n`;

  it("accepts the options that cannot bring in another Worker or config", () => {
    const options =
      '{ persistState: false, inspectorPort: false, remoteBindings: false, viteEnvironment: { name: "ssr" }, assetsOnly: false }';
    expect(evaluateWall(tree({ "apps/web/vite.config.ts": vite(options) })).ok).toBe(true);
  });

  it("fails on auxiliaryWorkers, tunnel, experimental and any option it does not know", () => {
    for (const options of [
      '{ auxiliaryWorkers: [{ configPath: "./aux/wrangler.jsonc" }] }',
      "{ tunnel: true }",
      "{ experimental: { headersAndRedirectsDevModeSupport: true } }",
      "{ somethingNew: 1 }",
    ]) {
      expect(evaluateWall(tree({ "apps/web/vite.config.ts": vite(options) })).ok, options).toBe(false);
    }
  });
});

describe("evaluateWall: never echoes file contents", () => {
  const CANARY = "CANARY-wall-7f3a9c";
  // Phrases from Wrangler's own diagnostics, which quote file contents after them (cut off here only by length).
  const WRANGLER_DIAGNOSTIC =
    /Instead this file contains|Processing .* configuration|deploy configuration file was found/;

  it("does not read a symlinked deploy redirect, so its target's contents never reach the output", () => {
    const root = tree({
      "shared/notes.json": `{ "note": "${CANARY}" }`,
      "apps/web/wrangler.jsonc": '{ "name": "web" }',
    });
    mkdirSync(join(root, "apps/web/.wrangler/deploy"), { recursive: true });
    symlinkSync(join(root, "shared/notes.json"), join(root, "apps/web/.wrangler/deploy/config.json"));
    const result = evaluateWall(root);
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).not.toContain(CANARY);
    expect(result.lines.join("\n")).not.toMatch(WRANGLER_DIAGNOSTIC);
    expect(result.lines.join("\n")).toMatch(/apps\/web\/\.wrangler\/deploy\/config\.json/);
  });

  it("names only the path and the rule when Wrangler rejects a config or a redirect", () => {
    const rejected = evaluateWall(
      tree({ "workers/kit/wrangler.jsonc": `{ "name": 42, "vars": { "X": "${CANARY}" } }` }),
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.lines.join("\n")).not.toContain(CANARY);
    expect(rejected.lines.join("\n")).not.toMatch(WRANGLER_DIAGNOSTIC);
    const redirect = evaluateWall(tree({ "apps/web/.wrangler/deploy/config.json": `{ "note": "${CANARY}" }` }));
    expect(redirect.ok).toBe(false);
    expect(redirect.lines.join("\n")).not.toContain(CANARY);
    expect(redirect.lines.join("\n")).not.toMatch(WRANGLER_DIAGNOSTIC);
  });
});

describe("evaluateWall: assets come only from the app's build output", () => {
  const assets = (dir: string) => `{ "name": "w", "assets": { "directory": "${dir}" } }`;

  it("accepts dist/client under the Worker's own folder, as written or as the plugin generates it", () => {
    expect(evaluateWall(tree({ "apps/web/wrangler.jsonc": assets("./dist/client") })).ok).toBe(true);
    expect(evaluateWall(tree({ "workers/web/wrangler.jsonc": assets("dist/client") })).ok).toBe(true);
    expect(evaluateWall(tree({ "apps/web/dist/public/wrangler.json": GENERATED })).ok).toBe(true);
  });

  it("fails on any other directory, in an environment too, and on a Pages output directory", () => {
    for (const config of [
      assets("./public"),
      assets("../../data"),
      assets("./dist"),
      assets("../kit/dist/client"),
      '{ "name": "w", "env": { "staging": { "assets": { "directory": "./src" } } } }',
      '{ "name": "w", "pages_build_output_dir": "./dist/client" }',
    ]) {
      const result = evaluateWall(tree({ "apps/web/wrangler.jsonc": config }));
      expect(result.ok, config).toBe(false);
      expect(result.lines.join("\n"), config).toMatch(/apps\/web\/wrangler\.jsonc/);
    }
  });

  it("fails when the build output directory is a symlink to somewhere else", () => {
    const root = tree({ "apps/web/wrangler.jsonc": assets("./dist/client"), "private/notes.txt": "x" });
    mkdirSync(join(root, "apps/web/dist"), { recursive: true });
    symlinkSync(join(root, "private"), join(root, "apps/web/dist/client"));
    expect(evaluateWall(root).ok).toBe(false);
  });
});

describe("evaluateWall: apps/web/public holds no hidden or linked files", () => {
  it("accepts ordinary files such as _headers", () => {
    expect(evaluateWall(tree({ "apps/web/public/_headers": "/*\n  X-Content-Type-Options: nosniff\n" })).ok).toBe(true);
  });

  it("accepts only the allow-listed files, so a key or any other stray file fails", () => {
    expect(evaluateWall(tree({ "apps/web/public/_headers": "", "apps/web/public/favicon.svg": "<svg/>" })).ok).toBe(
      true,
    );
    for (const [path, reported] of [
      ["apps/web/public/server.pem", "apps/web/public/server.pem"],
      ["apps/web/public/notes.txt", "apps/web/public/notes.txt"],
      ["apps/web/public/img/a.png", "apps/web/public/img"],
    ] as const) {
      const result = evaluateWall(tree({ [path]: "x" }));
      expect(result.ok, path).toBe(false);
      expect(result.lines.join("\n"), path).toContain(reported);
    }
  });

  it("fails on any dotfile or dot-folder, Wrangler local secrets included, naming only the path", () => {
    for (const path of [
      "apps/web/public/.dev.vars",
      "apps/web/public/.dev.vars.staging",
      "apps/web/public/assets/.notes",
      "apps/web/public/.well-known/security.txt",
    ]) {
      const result = evaluateWall(tree({ [path]: "SECRET_TOKEN=canary-public-41" }));
      expect(result.ok, path).toBe(false);
      expect(result.lines.join("\n"), path).not.toContain("canary-public-41");
    }
  });

  it("fails on a symlink or a Wrangler local-secrets file inside a build output, but allows the plugin's .assetsignore", () => {
    expect(evaluateWall(tree({ "apps/web/dist/client/.assetsignore": "wrangler.json\n" })).ok).toBe(true);
    expect(evaluateWall(tree({ "apps/kit/dist/client/.dev.vars": "x" })).ok).toBe(false);
    const root = tree({ "apps/web/dist/client/index.js": "", "private/notes.txt": "x" });
    symlinkSync(join(root, "private/notes.txt"), join(root, "apps/web/dist/client/notes.txt"));
    expect(evaluateWall(root).ok).toBe(false);
  });

  it("fails on a symlink inside public/", () => {
    const root = tree({ "apps/web/public/_headers": "", "private/notes.txt": "x" });
    symlinkSync(join(root, "private/notes.txt"), join(root, "apps/web/public/notes.txt"));
    expect(evaluateWall(root).ok).toBe(false);
  });
});
