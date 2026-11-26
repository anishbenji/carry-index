/**
 * T5, added for GPT-6.2 Sol security round 1: Wrangler's JavaScript entry runs under this process's own Node
 * (`process.execPath`), never a `node` found on PATH (P1); the child's PATH is the gate's, not the ambient one (P1);
 * and no ambient Wrangler output path reaches the child (P2).
 */
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { SpawnRequest } from "../src/runner.ts";
import { runWrangler, spawnProcess } from "../src/runner.ts";
import type { TempDir } from "./helpers.ts";
import { tempDir } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

describe("T5 Wrangler is launched with a controlled interpreter and environment", () => {
  test("T5 a .js entry runs under process.execPath even when PATH offers a planted node", async () => {
    const dir = tempDir("cj-launch-");
    temps.push(dir);
    const marker = join(dir.root, "planted-node-ran");
    const planted = join(dir.root, "node");
    writeFileSync(planted, `#!/bin/sh\ntouch "${marker}"\necho planted\n`);
    chmodSync(planted, 0o755);
    const entry = join(dir.root, "entry.js");
    writeFileSync(entry, '#!/usr/bin/env node\nprocess.stdout.write("real:" + process.execPath);\n');
    const result = await spawnProcess({ argv: [entry], cwd: dir.root, env: { PATH: `${dir.root}:/usr/bin:/bin` } });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`real:${process.execPath}`);
    expect(existsSync(marker)).toBe(false);
  });

  test("T5 the child PATH is the gate's own (Node's folder, /usr/bin, /bin), and no ambient output path is passed", async () => {
    const dir = tempDir("cj-sealed-");
    temps.push(dir);
    writeFileSync(join(dir.root, "wrangler.json"), "{}");
    const requests: SpawnRequest[] = [];
    await runWrangler(
      { dir: dir.root, configPath: join(dir.root, "wrangler.json"), siteDir: join(dir.root, "site"), manifest: [] },
      "dry-run",
      {
        wrangler: "/opt/cj-test/wrangler.js",
        env: { PATH: "/tmp/evil/bin:/usr/bin", WRANGLER_OUTPUT_FILE_PATH: join(dir.root, "site", "out.ndjson") },
        spawn: async (request) => {
          requests.push(request);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    );
    expect(requests[0]?.env.PATH).toBe(`${dirname(process.execPath)}:/usr/bin:/bin`);
    expect(requests[0]?.env).not.toHaveProperty("WRANGLER_OUTPUT_FILE_PATH");
  });
});
