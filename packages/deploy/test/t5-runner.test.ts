/**
 * T5: Wrangler runs exactly as intended (privacy-wall design v2, section 3). The spawner is injected, so the test
 * sees the argv, cwd and environment without running anything.
 */
import { existsSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parseCliArgs } from "../src/cli.ts";
import type { SpawnRequest, WranglerCommand } from "../src/runner.ts";
import { runWrangler } from "../src/runner.ts";
import type { SealedBundle } from "../src/seal.ts";
import { manifestTag } from "../src/seal.ts";
import type { TempDir } from "./helpers.ts";
import { isInside, REPO_ROOT, tempDir } from "./helpers.ts";

/** Written here, not imported: the test must not agree with the gate by sharing its constant. */
const ALLOWED_ENV = [
  "PATH",
  "HOME",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "WRANGLER_SEND_METRICS",
  "WRANGLER_SEND_ERROR_REPORTS",
  "WRANGLER_OUTPUT_FILE_PATH",
];

const WRANGLER = "/opt/cj-test/node_modules/.bin/wrangler";

/** An ambient environment full of variables that would redirect or loosen Wrangler. Values are synthetic. */
const AMBIENT = {
  PATH: "/usr/bin:/bin",
  HOME: "/Users/someone",
  CLOUDFLARE_API_TOKEN: "synthetic-token",
  CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  CLOUDFLARE_ENV: "staging",
  CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
  WRANGLER_LOG: "debug",
  WRANGLER_SEND_METRICS: "true",
  NODE_OPTIONS: "--require /tmp/x.js",
  XDG_CONFIG_HOME: "/Users/someone/.config",
  CF_API_TOKEN: "synthetic-legacy-token",
  GITHUB_TOKEN: "synthetic-github-token",
};

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

/** A hand-made bundle, so this test depends only on the runner, not on seal. */
function bundle(): SealedBundle {
  const dir = tempDir("cj-sealed-");
  temps.push(dir);
  writeFileSync(join(dir.root, "wrangler.json"), "{}");
  return { dir: dir.root, configPath: join(dir.root, "wrangler.json"), siteDir: join(dir.root, "site"), manifest: [] };
}

async function spawnedFor(command: WranglerCommand): Promise<{ sealed: SealedBundle; request: SpawnRequest }> {
  const sealed = bundle();
  const requests: SpawnRequest[] = [];
  await runWrangler(sealed, command, {
    wrangler: WRANGLER,
    env: AMBIENT,
    spawn: async (request) => {
      requests.push(request);
      return { exitCode: 0, stdout: "", stderr: "" };
    },
  });
  expect(requests).toHaveLength(1);
  const [request] = requests;
  if (!request) throw new Error("no spawn");
  return { sealed, request };
}

describe("T5 Wrangler runs exactly as intended", () => {
  test.each([
    ["dry-run", ["deploy", "--config", "<config>", "--dry-run"]],
    // S5-5: each upload is tagged with the sealed manifest's tag, so triggers can tell this build's version.
    ["upload", ["versions", "upload", "--config", "<config>", "--tag", "<tag>"]],
  ] as const)(
    "T5 %s runs Wrangler with the constant argv and --config naming the sealed wrangler.json",
    async (command, args) => {
      const { sealed, request } = await spawnedFor(command);
      const fill = (a: string): string =>
        a === "<config>" ? sealed.configPath : a === "<tag>" ? manifestTag(sealed.manifest) : a;
      expect(request.argv).toEqual([WRANGLER, ...args.map(fill)]);
    },
  );

  test("T5 the working directory is the sealed folder", async () => {
    const { sealed, request } = await spawnedFor("upload");
    expect(request.cwd).toBe(sealed.dir);
  });

  test("T5 the environment holds only allow-listed variables: no CLOUDFLARE_ENV, NODE_OPTIONS or stray tokens", async () => {
    const { request } = await spawnedFor("upload");
    const keys = Object.keys(request.env);
    expect(keys.filter((k) => !ALLOWED_ENV.includes(k))).toEqual([]);
    expect(request.env.PATH).toBe(`${dirname(process.execPath)}:/usr/bin:/bin`);
    expect(request.env.CLOUDFLARE_API_TOKEN).toBe(AMBIENT.CLOUDFLARE_API_TOKEN);
    expect(request.env.CLOUDFLARE_ACCOUNT_ID).toBe(AMBIENT.CLOUDFLARE_ACCOUNT_ID);
    expect(request.env.WRANGLER_SEND_METRICS).toBe("false");
    expect(request.env.WRANGLER_SEND_ERROR_REPORTS).toBe("false");
  });

  test("T5 HOME is a fresh temporary folder, not the ambient HOME, outside the checkout", async () => {
    const { sealed, request } = await spawnedFor("upload");
    expect(request.env).toHaveProperty("HOME");
    const home = String(request.env.HOME);
    expect(home).not.toBe(AMBIENT.HOME);
    expect(existsSync(home) && statSync(home).isDirectory()).toBe(true);
    expect(isInside(home, REPO_ROOT)).toBe(false);
    expect(isInside(home, sealed.siteDir)).toBe(false);
  });

  test.each([
    [["deploy", "dist/static/inline", "--env", "staging"]],
    [["deploy", "dist/static/inline", "--config", "other/wrangler.json"]],
    [["deploy", "--assets", "dist/client"]],
    [["deploy", "dist/static/inline", "--var", "TOKEN:x"]],
    [["deploy", "dist/static/inline", "--", "--dry-run"]],
    [["deploy", "dist/static/inline", "extra"]],
    [["deploy"]],
    [["publish", "dist/static/inline"]],
    [[]],
  ])("T5 the gate CLI refuses extra or unknown arguments: %j", (argv) => {
    const parsed = parseCliArgs(argv);
    expect(parsed.ok).toBe(false);
  });

  test.each([
    ["check", "dist/static/inline"],
    ["deploy", "dist/static/external"],
  ] as const)("T5 the gate CLI accepts exactly `%s <siteDir>` (positive control)", (command, siteDir) => {
    expect(parseCliArgs([command, siteDir])).toEqual({ ok: true, command, siteDir });
  });
});
