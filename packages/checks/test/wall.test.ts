import { afterEach, describe, expect, it } from "vitest";
import { declaredBindings, evaluateWall, WALL_CHECKS, type WallCheck } from "../src/wall.ts";
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
