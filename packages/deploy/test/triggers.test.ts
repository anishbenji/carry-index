/**
 * The gate's `triggers` command (director, after 92e548c): `wrangler versions deploy` does not apply `workers_dev`,
 * `preview_urls` or routes, so the first deploy is followed once by `wrangler triggers deploy` on the same sealed
 * config. The gate runs it like every other Wrangler command: after check 1, the seal, the scan and the dry run, with
 * a constant argv and the allow-listed environment, and confirms the live Worker afterwards. It uploads and promotes
 * nothing. Wrangler and the API are the shared fake in `fake-cloudflare.ts`, with `triggers deploy` answered here.
 */
import { afterEach, describe, expect, test } from "vitest";
import { main, parseCliArgs } from "../src/cli.ts";
import type { SpawnRequest, SpawnResult } from "../src/runner.ts";
import type { FakeCloudflareOptions } from "./fake-cloudflare.ts";
import { D1, ENV, fakeCloudflare, SCRIPT } from "./fake-cloudflare.ts";
import { FAKE_WRANGLER, fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite, sealedTag } from "./helpers.ts";

/** Written here, not imported: the test must not agree with the gate by sharing its constant. */
const ALLOWED_ENV = [
  "PATH",
  "HOME",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "WRANGLER_SEND_METRICS",
  "WRANGLER_SEND_ERROR_REPORTS",
];

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

interface TriggersOptions extends FakeCloudflareOptions {
  triggersExit?: number;
  dryRunStdout?: string;
  env?: Record<string, string | undefined>;
  files?: Record<string, string>;
}

async function triggers(options: TriggersOptions = {}) {
  const site = minimalSite(options.files ?? {});
  temps.push(site);
  // S5-5: the live version carries this build's sealed tag, as after the first deploy (a site that does not seal
  // has none: the gate stops before any spawn or fetch).
  const tag = await sealedTag(site.root).catch(() => undefined);
  const cf = fakeCloudflare({ ...options, previous: { bindings: [], tag, ...options.previous } });
  const commands: string[] = [];
  const spawn = (request: SpawnRequest): SpawnResult => {
    const [, first, second] = request.argv;
    if (first === "triggers" && second === "deploy") {
      commands.push("triggers");
      return { exitCode: options.triggersExit ?? 0, stdout: "", stderr: "" };
    }
    if (options.dryRunStdout !== undefined && first === "deploy") {
      commands.push("dry-run");
      return { exitCode: 0, stdout: options.dryRunStdout, stderr: "" };
    }
    const result = cf.spawn(request);
    commands.push(cf.commands[cf.commands.length - 1] ?? "?");
    return result;
  };
  const fake = fakeIo({ env: options.env ?? ENV, spawn, fetch: cf.fetch });
  fake.io.sleep = async () => {};
  const code = await main(["triggers", site.root], fake.io);
  return { code, commands, fake, has: (text: string) => fake.lines.some((l) => l.includes(text)) };
}

describe("the gate's triggers command", () => {
  test("parses `triggers <siteDir>` and nothing longer", () => {
    expect(parseCliArgs(["triggers", "dist/client"])).toEqual({
      ok: true,
      command: "triggers",
      siteDir: "dist/client",
    });
    expect(parseCliArgs(["triggers", "dist/client", "--routes", "example.com/*"]).ok).toBe(false);
    expect(parseCliArgs(["triggers", "--routes"]).ok).toBe(false);
    expect(parseCliArgs(["triggers"]).ok).toBe(false);
  });

  test("runs the dry run, then exactly `triggers deploy --config <sealed>/wrangler.json`, and confirms the live Worker (positive control)", async () => {
    const { code, commands, fake, has } = await triggers();
    expect(code).toBe(0);
    expect(commands).toEqual(["dry-run", "triggers"]);
    const request = fake.spawned.find((r) => r.argv[1] === "triggers");
    expect(request?.argv).toEqual([FAKE_WRANGLER, "triggers", "deploy", "--config", `${request?.cwd}/wrangler.json`]);
    for (const key of Object.keys(request?.env ?? {})) expect(ALLOWED_ENV).toContain(key);
    expect(fake.fetched).toContain(`${SCRIPT}/settings`);
    expect(has("wrangler triggers deploy exited with 0")).toBe(true);
  });

  test("never uploads, promotes or rolls back", async () => {
    const { commands } = await triggers({ previous: { bindings: [D1] } });
    expect(commands.filter((c) => /upload|promote|rollback/.test(c))).toEqual([]);
  });

  test("needs the token and a 32-character hex account id, and spawns nothing without them", async () => {
    const { code, fake } = await triggers({ env: { PATH: "/usr/bin:/bin" } });
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
  });

  test("stops before triggers when the dry run shows a binding", async () => {
    const { code, commands } = await triggers({
      dryRunStdout: "Your Worker has access to the following bindings:\nenv.DB\n",
    });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
  });

  test("stops before any spawn when the seal refuses a file", async () => {
    const { code, fake } = await triggers({ files: { ".env": "SYNTHETIC=1\n" } });
    expect(code).toBe(1);
    expect(fake.spawned).toEqual([]);
  });

  test("fails when triggers deploy fails", async () => {
    const { code, has } = await triggers({ triggersExit: 1 });
    expect(code).toBe(1);
    expect(has("wrangler triggers deploy exited with 1")).toBe(true);
  });

  test("fails, without rolling back or running triggers deploy, when the live Worker shows a binding", async () => {
    const { code, commands, has } = await triggers({ previous: { bindings: [D1] } });
    expect(code).toBe(1);
    // S2-1: the check runs before workers.dev is changed, so no trigger call happens.
    expect(commands).toEqual(["dry-run"]);
    expect(has("live-bindings")).toBe(true);
    expect(has("Check it by hand now")).toBe(true);
  });
});

/**
 * Security-sol round 2, S2-1: `triggers deploy` turns workers.dev on, so it must never run before the live Worker is
 * known to be clean. Every lookup error except "Worker missing" (10007/10090) stops the gate; the script settings,
 * their bindings and every version the active deployment serves are checked first, and a failing check leaves
 * workers.dev untouched.
 */
describe("the triggers command checks the live Worker before it changes workers.dev (S2-1)", () => {
  const OTHER = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";
  const reply = (result: unknown) => ({
    status: 200,
    body: JSON.stringify({ success: true, errors: [], messages: [], result }),
  });
  const split = reply({
    deployments: [
      {
        id: "d-split",
        versions: [
          { version_id: OTHER, percentage: 50 },
          { version_id: "66666666-7777-4888-9999-aaaaaaaaaaaa", percentage: 50 },
        ],
      },
    ],
  });

  test.each([
    [
      "the deployments reply is a 500",
      (url: string) => (url === `${SCRIPT}/deployments` ? { status: 500, body: "" } : undefined),
    ],
    [
      "the deployments reply is a 403",
      (url: string) => (url === `${SCRIPT}/deployments` ? { status: 403, body: "" } : undefined),
    ],
    [
      "the deployments request fails",
      (url: string) => (url === `${SCRIPT}/deployments` ? new Error("network down") : undefined),
    ],
    [
      "the deployments reply is malformed",
      (url: string) =>
        url === `${SCRIPT}/deployments`
          ? reply({ deployments: [{ id: "d-x", versions: [{ percentage: 100 }] }] })
          : undefined,
    ],
    [
      "a 404 without a Worker-missing code",
      (url: string) =>
        url === `${SCRIPT}/deployments`
          ? { status: 404, body: JSON.stringify({ success: false, errors: [{ code: 10000 }] }) }
          : undefined,
    ],
  ] as const)("stops before triggers deploy when %s", async (_name, intercept) => {
    const { code, commands, has } = await triggers({ intercept });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(has("live-api-error")).toBe(true);
  });

  test("stops before triggers deploy when the Worker does not exist", async () => {
    const { code, commands, has } = await triggers({ missing: true });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(has("worker-missing")).toBe(true);
  });

  test("stops before triggers deploy when any version of a split deployment has a binding", async () => {
    const { code, commands, fake, has } = await triggers({
      intercept: (url) => {
        if (url === `${SCRIPT}/deployments`) return split;
        if (url === `${SCRIPT}/versions/${OTHER}`) {
          return reply({ id: OTHER, resources: { bindings: [D1] } });
        }
        return undefined;
      },
    });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(fake.fetched).toContain(`${SCRIPT}/versions/${OTHER}`);
    expect(has("live-bindings")).toBe(true);
  });

  test("checks every version of a split deployment, then refuses it: workers.dev needs one version at 100% (S5-5)", async () => {
    const { code, commands, fake, has } = await triggers({
      intercept: (url) => {
        if (url === `${SCRIPT}/deployments`) return split;
        if (url === `${SCRIPT}/versions/${OTHER}`) return reply({ id: OTHER, resources: { bindings: [] } });
        return undefined;
      },
    });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(has("live-version-not-sole")).toBe(true);
    expect(fake.fetched).toContain(`${SCRIPT}/versions/${OTHER}`);
    expect(fake.fetched).toContain(`${SCRIPT}/versions/66666666-7777-4888-9999-aaaaaaaaaaaa`);
    const firstSettings = fake.fetched.indexOf(`${SCRIPT}/settings`);
    expect(firstSettings).toBeGreaterThan(-1);
  });

  test("stops before triggers deploy when a version of the active deployment cannot be read (retried)", async () => {
    const { code, commands, has } = await triggers({
      intercept: (url) =>
        url === `${SCRIPT}/versions/66666666-7777-4888-9999-aaaaaaaaaaaa` ? { status: 500, body: "" } : undefined,
    });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(has("live-api-error")).toBe(true);
  });

  test("stops before triggers deploy when the script settings show a binding the versions do not", async () => {
    const { code, commands, has } = await triggers({
      intercept: (url) => (url === `${SCRIPT}/settings` ? reply({ bindings: [D1] }) : undefined),
    });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(has("live-bindings")).toBe(true);
  });

  test("stops before triggers deploy when the script has a tail consumer", async () => {
    const { code, commands, has } = await triggers({ tailConsumers: [{ service: "synthetic-tail" }] });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(has("live-tail-consumers")).toBe(true);
  });

  test("stops before triggers deploy when the script settings cannot be read (retried)", async () => {
    const { code, commands, has } = await triggers({
      intercept: (url) => (url === `${SCRIPT}/settings` ? { status: 503, body: "" } : undefined),
    });
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(has("live-api-error")).toBe(true);
  });
});
