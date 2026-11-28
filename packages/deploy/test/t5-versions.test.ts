/**
 * T5, the targeted Wrangler commands of upload, verify, then promote (GPT-6.2 Sol security round 1, P1): `versions
 * deploy <id>@100%` and `rollback <id>` with constant flags; neither runs without a version id, and no other
 * command takes one. There is no untargeted rollback.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { SpawnRequest, WranglerCommand } from "../src/runner.ts";
import { runWrangler } from "../src/runner.ts";
import type { SealedBundle } from "../src/seal.ts";
import type { TempDir } from "./helpers.ts";
import { tempDir } from "./helpers.ts";

const WRANGLER = "/opt/cj-test/wrangler.js";
const ID = "11111111-2222-4333-8444-555555555555";
const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function bundle(): SealedBundle {
  const dir = tempDir("cj-sealed-");
  temps.push(dir);
  writeFileSync(join(dir.root, "wrangler.json"), "{}");
  return { dir: dir.root, configPath: join(dir.root, "wrangler.json"), siteDir: join(dir.root, "site"), manifest: [] };
}

async function run(command: WranglerCommand, id?: string): Promise<SpawnRequest[]> {
  const requests: SpawnRequest[] = [];
  await runWrangler(
    bundle(),
    command,
    {
      wrangler: WRANGLER,
      env: {},
      spawn: async (request) => {
        requests.push(request);
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    },
    id,
  );
  return requests;
}

describe("T5 the targeted version commands", () => {
  test.each([
    ["promote", ["versions", "deploy", `${ID}@100%`, "--config", "<config>", "--yes"]],
    ["rollback", ["rollback", ID, "--config", "<config>", "--yes"]],
  ] as const)("T5 %s runs with the version id and constant flags", async (command, args) => {
    const [request] = await run(command, ID);
    expect(request?.argv).toEqual([
      WRANGLER,
      ...args.map((a) => (a === "<config>" ? join(String(request?.cwd), "wrangler.json") : a)),
    ]);
  });

  test.each([["promote"], ["rollback"]] as const)(
    "T5 %s without a version id is refused before anything runs",
    async (command) => {
      await expect(run(command)).rejects.toThrow(/needs version id/);
    },
  );

  test.each([
    ["rollback", "latest"],
    ["promote", `${ID} --dry-run`],
    ["upload", ID],
    ["dry-run", ID],
  ] as const)("T5 %s with %j as a version id is refused", async (command, id) => {
    await expect(run(command, id)).rejects.toThrow(/version id/);
  });
});
