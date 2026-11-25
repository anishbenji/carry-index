import { describe, expect, it } from "vitest";
import type { WallCheck } from "../src/wall.ts";
import { evaluateWall, WALL_CHECKS } from "../src/wall.ts";

const PENDING = "packages/deploy (privacy-wall design v2)";

describe("WALL_CHECKS", () => {
  it("lists the three privacy-wall checks, each pending on packages/deploy", () => {
    expect(WALL_CHECKS.map((c) => c.id)).toEqual(["schema-never-public", "canary-export", "public-worker-bindings"]);
    for (const check of WALL_CHECKS) expect(check.status).toBe("pending");
    for (const check of WALL_CHECKS) expect(check.milestone).toBe(PENDING);
  });
});

describe("evaluateWall", () => {
  it("passes the clean scaffold and prints each check as pending", () => {
    const result = evaluateWall(["package.json", "apps/web/vite.config.ts", "docs/wrangler-notes.md"]);
    expect(result.ok).toBe(true);
    for (const check of WALL_CHECKS) expect(result.lines).toContain(`${check.id}: pending: ${PENDING}`);
  });

  it("fails when a wrangler.jsonc is tracked, because Worker configs are generated from code", () => {
    const result = evaluateWall(["package.json", "workers/web/wrangler.jsonc"]);
    expect(result.ok).toBe(false);
    expect(result.lines.join("\n")).toMatch(/workers\/web\/wrangler\.jsonc/);
  });

  it("fails on any tracked wrangler.* config name, JSON, JSONC or TOML, anywhere", () => {
    for (const path of [
      "wrangler.json",
      "apps/web/wrangler.toml",
      "apps/kit/wrangler.public.jsonc",
      "x/WRANGLER.JSON",
    ]) {
      expect(evaluateWall([path]).ok, path).toBe(false);
    }
  });

  it("also fails on other names Wrangler or its experimental config could load", () => {
    for (const path of [
      "apps/web/wrangler-preview.json",
      "workers/kit/wrangler_kit.toml",
      "apps/web/cloudflare.config.ts",
      "apps/web/.wrangler/deploy/config.json",
    ]) {
      expect(evaluateWall([path]).ok, path).toBe(false);
    }
  });

  it("still fails on a tracked config once the checks are implemented", () => {
    const done: WallCheck[] = WALL_CHECKS.map((c) => ({ ...c, status: "implemented" }));
    expect(evaluateWall(["workers/kit/wrangler.jsonc"], done).ok).toBe(false);
  });
});
