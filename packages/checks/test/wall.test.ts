import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { WallCheck } from "../src/wall.ts";
import { defaultConfigsOnDisk, evaluateWall, repoFiles, WALL_CHECKS } from "../src/wall.ts";
import { makeTree } from "./helpers.ts";

/** The gate command that runs each check: `check` runs checks 1 and 2; the bindings check (3) runs in `deploy`. */
const COMMANDS: Record<string, string> = {
  "schema-never-public": "node packages/deploy/src/bin.ts check <siteDir>",
  "canary-export": "node packages/deploy/src/bin.ts check <siteDir>",
  "public-worker-bindings": "node packages/deploy/src/bin.ts deploy <siteDir>",
};

describe("WALL_CHECKS", () => {
  it("lists the three privacy-wall checks, each implemented by the deploy gate's command", () => {
    expect(WALL_CHECKS.map((c) => c.id)).toEqual(["schema-never-public", "canary-export", "public-worker-bindings"]);
    for (const check of WALL_CHECKS) expect(check.status).toBe("implemented");
    for (const check of WALL_CHECKS) expect(check.command).toBe(COMMANDS[check.id]);
    for (const check of WALL_CHECKS)
      expect(check.command).toMatch(/^node packages\/deploy\/src\/bin\.ts (check|deploy) <siteDir>$/);
  });
});

describe("evaluateWall", () => {
  it("passes the clean scaffold and prints each check as implemented, with its gate command", () => {
    const result = evaluateWall(["package.json", "apps/web/vite.config.ts", "docs/wrangler-notes.md"]);
    expect(result.ok).toBe(true);
    for (const check of WALL_CHECKS) expect(result.lines).toContain(`${check.id}: implemented: ${COMMANDS[check.id]}`);
    expect(result.lines.some((l) => l.includes("pending"))).toBe(false);
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

describe("repoFiles", () => {
  it("lists tracked and untracked files but not git-ignored ones, so an untracked wrangler.jsonc still fails", () => {
    const t = makeTree({
      ".gitignore": "dist/\n",
      "package.json": "{}",
      "workers/web/wrangler.jsonc": '{ "name": "web" }',
      "apps/web/dist/web/wrangler.json": "{}",
    });
    try {
      const git = (...args: string[]) => execFileSync("git", args, { cwd: t.root, stdio: "ignore" });
      git("init", "-q");
      git("add", "package.json", ".gitignore");
      const files = repoFiles(t.root);
      expect(files).toContain("package.json");
      expect(files).toContain("workers/web/wrangler.jsonc");
      expect(files).not.toContain("apps/web/dist/web/wrangler.json");
      expect(evaluateWall(files).ok).toBe(false);
    } finally {
      t.cleanup();
    }
  });
});

describe("defaultConfigsOnDisk", () => {
  it("finds Wrangler's default config names at the repo root and each workspace root, ignored or not", () => {
    const t = makeTree({
      "package.json": JSON.stringify({ workspaces: ["packages/*", "apps/*", "workers/*"] }),
      ".gitignore": "/*\n!/package.json\n",
      "wrangler.jsonc": "{}",
      "apps/web/wrangler.toml": "",
      "workers/kit/wrangler.json": "{}",
      "apps/web/src/wrangler.json": "{}",
      "packages/schema/package.json": "{}",
    });
    try {
      expect(defaultConfigsOnDisk(t.root)).toEqual([
        "apps/web/wrangler.toml",
        "workers/kit/wrangler.json",
        "wrangler.jsonc",
      ]);
      expect(evaluateWall(defaultConfigsOnDisk(t.root)).ok).toBe(false);
    } finally {
      t.cleanup();
    }
  });

  it("finds nothing in a clean tree", () => {
    const t = makeTree({ "package.json": JSON.stringify({ workspaces: ["apps/*"] }), "apps/web/package.json": "{}" });
    try {
      expect(defaultConfigsOnDisk(t.root)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});
