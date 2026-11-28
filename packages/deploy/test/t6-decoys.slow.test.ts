/**
 * T6 [slow]: decoys are ignored (privacy-wall design v2, section 3). Runs the real, pinned `wrangler deploy
 * --dry-run` through the gate's own spawner. No network and no account: a dry run uploads nothing. Re-run on every
 * Wrangler upgrade.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { checkDryRun } from "../src/check3.ts";
import type { SpawnResult } from "../src/runner.ts";
import { runWrangler, spawnProcess } from "../src/runner.ts";
import type { SealedBundle } from "../src/seal.ts";
import { seal } from "../src/seal.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite, REPO_ROOT, tempDir } from "./helpers.ts";

const WRANGLER = join(REPO_ROOT, "node_modules", ".bin", "wrangler");
const SLOW = { timeout: 120_000 };

/** A config that binds a D1 database, and every way Wrangler might be led to it. */
function plantDecoys(dir: string): void {
  mkdirSync(join(dir, ".wrangler", "deploy"), { recursive: true });
  writeFileSync(
    join(dir, "wrangler.json"),
    JSON.stringify({
      name: "decoy",
      main: "decoy.js",
      compatibility_date: "2026-11-01",
      d1_databases: [
        { binding: "DECOY_DB", database_name: "decoy", database_id: "00000000-0000-0000-0000-000000000000" },
      ],
    }),
  );
  writeFileSync(join(dir, "decoy.js"), 'export default { fetch() { return new Response("decoy"); } };\n');
  writeFileSync(join(dir, ".wrangler", "deploy", "config.json"), JSON.stringify({ configPath: "../../wrangler.json" }));
  writeFileSync(join(dir, ".env"), "CLOUDFLARE_ENV=decoy\n");
}

/** The ambient environment the gate is given: enough to find Node, nothing else. */
function ambient(): Record<string, string | undefined> {
  return { PATH: process.env.PATH, CLOUDFLARE_ENV: "decoy" };
}

const temps: TempDir[] = [];
const cwd = process.cwd();
afterEach(() => {
  process.chdir(cwd);
  for (const t of temps.splice(0)) t.cleanup();
});

function track(dir: TempDir): TempDir {
  temps.push(dir);
  return dir;
}

describe("T6 [slow] decoys are ignored by the real Wrangler", () => {
  test(
    "T6 [slow] with decoy configs, a deploy redirect and a dotenv file in the sealed folder's parent and in the launch folder, the real dry run shows No bindings found.",
    SLOW,
    async () => {
      // The guarantee is about the pinned release; a different Wrangler needs this test re-run and re-read.
      expect(execFileSync(WRANGLER, ["--version"], { encoding: "utf8" })).toContain("4.168.0");
      const parent = track(tempDir("cj-t6-parent-"));
      const launch = track(tempDir("cj-t6-launch-"));
      plantDecoys(parent.root);
      plantDecoys(launch.root);
      const site = track(minimalSite());
      const sealed = await seal(site.root, PUBLIC_SITE, { parent: parent.root });
      if (!sealed.ok) throw new Error(`seal failed: ${JSON.stringify(sealed.problems)}`);
      expect(dirname(sealed.bundle.dir)).toBe(parent.root);

      process.chdir(launch.root);
      let result: SpawnResult;
      try {
        result = await runWrangler(sealed.bundle, "dry-run", {
          wrangler: WRANGLER,
          spawn: spawnProcess,
          env: ambient(),
        });
      } finally {
        process.chdir(cwd);
        rmSync(sealed.bundle.dir, { recursive: true, force: true });
      }
      const output = `${result.stdout}\n${result.stderr}`;
      expect(result.exitCode).toBe(0);
      expect(output).toContain("No bindings found.");
      expect(output).not.toMatch(/DECOY_DB|D1 Database|decoy/i);
      expect(checkDryRun(PUBLIC_SITE, output).ok).toBe(true);
    },
  );

  test(
    "T6 [slow] negative control: the same decoy in the working directory, without --config, shows its D1 binding through the gate's spawner",
    SLOW,
    async () => {
      const launch = track(tempDir("cj-t6-control-"));
      plantDecoys(launch.root);
      const home = track(tempDir("cj-t6-home-"));
      const result = await spawnProcess({
        argv: [WRANGLER, "deploy", "--dry-run"],
        cwd: launch.root,
        env: {
          PATH: process.env.PATH ?? "",
          HOME: home.root,
          WRANGLER_SEND_METRICS: "false",
          WRANGLER_SEND_ERROR_REPORTS: "false",
        },
      });
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output).toContain("env.DECOY_DB (decoy)");
      expect(output).toContain("D1 Database");
      expect(checkDryRun(PUBLIC_SITE, output).ok).toBe(false);
    },
  );

  test(
    "T6 [slow] the sealed folder handed to the real Wrangler is the one seal made (no decoy reached it)",
    SLOW,
    async () => {
      const parent = track(tempDir("cj-t6-parent-"));
      plantDecoys(parent.root);
      const site = track(minimalSite());
      const sealed = await seal(site.root, PUBLIC_SITE, { parent: parent.root });
      if (!sealed.ok) throw new Error(`seal failed: ${JSON.stringify(sealed.problems)}`);
      const bundle: SealedBundle = sealed.bundle;
      try {
        const result = await runWrangler(bundle, "dry-run", {
          wrangler: WRANGLER,
          spawn: spawnProcess,
          env: ambient(),
        });
        expect(result.stdout).toMatch(/Read 2 files from the assets directory/);
      } finally {
        rmSync(bundle.dir, { recursive: true, force: true });
      }
    },
  );
});
