/**
 * T7: check 3 fails closed (privacy-wall design v2, section 4). Dry-run outputs are recorded from Wrangler 4.168.0;
 * Cloudflare API replies are fakes (see README: replace the synthetic settings replies with the recorded
 * first-deploy replies).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { Fetch } from "../src/check3.ts";
import { checkDryRun, confirmLive } from "../src/check3.ts";
import { main } from "../src/cli.ts";
import type { SpawnRequest, SpawnResult } from "../src/runner.ts";
import { BEACON, PUBLIC_SITE } from "../src/workers.ts";
import { fakeCloudflare, UPLOADED } from "./fake-cloudflare.ts";
import { FAKE_WRANGLER, fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { FIXTURES, minimalSite } from "./helpers.ts";

const SITE_DRY_RUN = readFileSync(join(FIXTURES, "dry-run", "site.txt"), "utf8");
const BEACON_DRY_RUN = readFileSync(join(FIXTURES, "dry-run", "beacon.txt"), "utf8");
const SITE_SETTINGS = readFileSync(join(FIXTURES, "api", "site-settings.json"), "utf8");
const BEACON_SETTINGS = readFileSync(join(FIXTURES, "api", "beacon-settings.json"), "utf8");

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const TOKEN = "synthetic-token";

const D1_ROWS = [
  "Your Worker has access to the following bindings:",
  "Binding                   Resource         ",
  "env.DECOY_DB (decoy)      D1 Database      ",
  "",
].join("\n");

describe("T7 check 3 before upload: the dry run must show exactly the expected bindings", () => {
  test("T7 the recorded site dry run (No bindings found.) passes for the site", () => {
    expect(checkDryRun(PUBLIC_SITE, SITE_DRY_RUN)).toEqual({ ok: true, problems: [] });
  });

  test("T7 the recorded beacon dry run (one Analytics Engine row) passes for the beacon", () => {
    expect(checkDryRun(BEACON, BEACON_DRY_RUN)).toEqual({ ok: true, problems: [] });
  });

  test.each([
    ["a D1 binding table instead of No bindings found.", SITE_DRY_RUN.replace("No bindings found.\n", D1_ROWS)],
    [
      "No bindings found. followed by a binding table",
      SITE_DRY_RUN.replace("No bindings found.\n", `No bindings found.\n${D1_ROWS}`),
    ],
    ["no bindings line at all", SITE_DRY_RUN.replace("No bindings found.\n", "")],
    ["an empty output", ""],
    ["a reworded bindings line", SITE_DRY_RUN.replace("No bindings found.", "No bindings were found.")],
    ["the beacon's output", BEACON_DRY_RUN],
  ])("T7 the site's dry-run check fails closed on %s", (_name, output) => {
    const result = checkDryRun(PUBLIC_SITE, output);
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual(expect.objectContaining({ rule: "dry-run-output" }));
  });

  test.each([
    ["the site's output (no binding)", SITE_DRY_RUN],
    [
      "a second binding row",
      BEACON_DRY_RUN.replace(
        "Analytics Engine Dataset      \n",
        "Analytics Engine Dataset      \nenv.KV (00000000)                      KV Namespace                  \n",
      ),
    ],
    ["another dataset name", BEACON_DRY_RUN.replace("env.BEACON (carry_journal_beacon)", "env.BEACON (kit_events)  ")],
    [
      "another binding name",
      BEACON_DRY_RUN.replace("env.BEACON (carry_journal_beacon)", "env.KIT (carry_journal_beacon)   "),
    ],
    [
      "additional modules attached beside main",
      BEACON_DRY_RUN.replace(
        "Total Upload",
        "Attaching additional modules:\n│ notes.txt │ text │ 0.08 KiB │\nTotal Upload",
      ),
    ],
    ["an empty output", ""],
  ])("T7 the beacon's dry-run check fails closed on %s", (_name, output) => {
    const result = checkDryRun(BEACON, output);
    expect(result.ok).toBe(false);
    expect(result.problems).toContainEqual(expect.objectContaining({ rule: "dry-run-output" }));
  });
});

interface FakeApi {
  fetch: Fetch;
  calls: Array<{ url: string; method: string; headers: Readonly<Record<string, string>> }>;
}

function api(reply: { status: number; body: string } | Error): FakeApi {
  const calls: FakeApi["calls"] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers });
    if (reply instanceof Error) throw reply;
    return { status: reply.status, text: async () => reply.body };
  };
  return { fetch, calls };
}

function withResult(body: string, change: (result: Record<string, unknown>) => void): string {
  const parsed = JSON.parse(body) as { result: Record<string, unknown> };
  change(parsed.result);
  return JSON.stringify(parsed);
}

describe("T7 check 3 after deploy: the live settings must match, or the gate rolls back", () => {
  test("T7 the recorded first-deploy reply passes for the site: one GET to the settings URL with the token, no rollback", async () => {
    const fake = api({ status: 200, body: SITE_SETTINGS });
    let rollbacks = 0;
    const result = await confirmLive(PUBLIC_SITE, {
      accountId: ACCOUNT,
      apiToken: TOKEN,
      fetch: fake.fetch,
      rollback: async () => {
        rollbacks++;
      },
    });
    expect(result).toEqual({ ok: true, problems: [] });
    expect(fake.calls).toEqual([
      {
        url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/carry-journal/settings`,
        method: "GET",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      },
    ]);
    expect(rollbacks).toBe(0);
  });

  test("T7 the recorded first-deploy reply passes for the beacon, with its one Analytics Engine binding", async () => {
    const fake = api({ status: 200, body: BEACON_SETTINGS });
    let rollbacks = 0;
    const result = await confirmLive(BEACON, {
      accountId: ACCOUNT,
      apiToken: TOKEN,
      fetch: fake.fetch,
      rollback: async () => {
        rollbacks++;
      },
    });
    expect(result).toEqual({ ok: true, problems: [] });
    expect(fake.calls.map((c) => c.url)).toEqual([
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/carry-journal-beacon/settings`,
    ]);
    expect(rollbacks).toBe(0);
  });

  const D1_BINDING = { type: "d1", name: "DB", id: "00000000-0000-0000-0000-000000000000" };
  test.each([
    [
      "an extra D1 binding",
      PUBLIC_SITE,
      { status: 200, body: withResult(SITE_SETTINGS, (r) => (r.bindings = [D1_BINDING])) },
    ],
    [
      "an extra KV binding on the beacon",
      BEACON,
      {
        status: 200,
        body: withResult(BEACON_SETTINGS, (r) => {
          (r.bindings as unknown[]).push({ type: "kv_namespace", name: "KV", namespace_id: "0" });
        }),
      },
    ],
    ["the beacon's binding on the site", PUBLIC_SITE, { status: 200, body: BEACON_SETTINGS }],
    [
      "a tail consumer",
      PUBLIC_SITE,
      { status: 200, body: withResult(SITE_SETTINGS, (r) => (r.tail_consumers = [{ service: "kit-watch" }])) },
    ],
    [
      "a 403 reply",
      PUBLIC_SITE,
      { status: 403, body: '{"success":false,"errors":[{"code":10000,"message":"Authentication error"}]}' },
    ],
    ["a 500 reply with a valid-looking body", PUBLIC_SITE, { status: 500, body: SITE_SETTINGS }],
    ["a body that is not JSON", PUBLIC_SITE, { status: 200, body: "<html>gateway</html>" }],
    [
      "success: false",
      PUBLIC_SITE,
      { status: 200, body: SITE_SETTINGS.replace('"success": true', '"success": false') },
    ],
    [
      "a result without bindings",
      PUBLIC_SITE,
      { status: 200, body: withResult(SITE_SETTINGS, (r) => delete r.bindings) },
    ],
    [
      "bindings that are not a list",
      PUBLIC_SITE,
      { status: 200, body: withResult(SITE_SETTINGS, (r) => (r.bindings = {})) },
    ],
    ["a request error", PUBLIC_SITE, new Error("network down")],
  ] as const)("T7 the live check fails closed and rolls back exactly once on %s", async (_name, worker, reply) => {
    const fake = api(reply);
    let rollbacks = 0;
    const result = await confirmLive(worker, {
      accountId: ACCOUNT,
      apiToken: TOKEN,
      fetch: fake.fetch,
      rollback: async () => {
        rollbacks++;
      },
    });
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(fake.calls).toHaveLength(1);
    expect(rollbacks).toBe(1);
  });
});

describe("T7 the gate blocks before upload", () => {
  const temps: TempDir[] = [];
  afterEach(() => {
    for (const t of temps.splice(0)) t.cleanup();
  });

  const env = { PATH: "/usr/bin:/bin", CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
  const isUpload = (r: SpawnRequest): boolean => r.argv[1] === "versions" && r.argv[2] === "upload";
  const isRollback = (r: SpawnRequest): boolean => r.argv[1] === "rollback";

  function answer(dryRun: string): (r: SpawnRequest) => SpawnResult {
    return (r) => ({
      exitCode: 0,
      stdout: r.argv.includes("--dry-run") ? dryRun : "Deployed carry-journal\n",
      stderr: "",
    });
  }

  test("T7 a dry run showing a binding stops the deploy: nothing is uploaded, nothing is fetched, the exit code fails", async () => {
    const site = minimalSite();
    temps.push(site);
    const fake = fakeIo({ env, spawn: answer(SITE_DRY_RUN.replace("No bindings found.\n", D1_ROWS)) });
    const code = await main(["deploy", site.root], fake.io);
    expect(code).not.toBe(0);
    expect(fake.spawned.filter((r) => r.argv.includes("--dry-run"))).toHaveLength(1);
    expect(fake.spawned.filter(isUpload)).toEqual([]);
    expect(fake.fetched).toEqual([]);
    expect(fake.lines.some((l) => l.includes("dry-run-output"))).toBe(true);
  });

  test("T7 a clean run goes dry run, then upload, then the version check, then promotion, and exits 0 (positive control)", async () => {
    const site = minimalSite();
    temps.push(site);
    const cf = fakeCloudflare({ previous: { bindings: [] } });
    const fake = fakeIo({ env, spawn: cf.spawn, fetch: cf.fetch });
    const code = await main(["deploy", site.root], fake.io);
    expect(code).toBe(0);
    expect(fake.spawned.map((r) => r.argv.slice(1, 3).join(" "))).toEqual([
      "deploy --config",
      "versions upload",
      "versions deploy",
    ]);
    expect(fake.spawned[0]?.argv).toContain("--dry-run");
    expect(fake.spawned[1] && isUpload(fake.spawned[1])).toBe(true);
    expect(fake.spawned.every((r) => r.argv[0] === FAKE_WRANGLER)).toBe(true);
    expect(fake.fetched).toContain(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/carry-journal/versions/${UPLOADED}`,
    );
    expect(fake.spawned.filter(isRollback)).toEqual([]);
  });

  test("T7 a check that finds a binding on the uploaded version fails the job: it is never promoted, so nothing is rolled back", async () => {
    const site = minimalSite();
    temps.push(site);
    const cf = fakeCloudflare({ previous: { bindings: [] }, uploadBindings: [{ type: "d1", name: "DB", id: "0" }] });
    const fake = fakeIo({ env, spawn: cf.spawn, fetch: cf.fetch });
    const code = await main(["deploy", site.root], fake.io);
    expect(code).not.toBe(0);
    expect(fake.spawned.filter(isUpload)).toHaveLength(1);
    expect(fake.spawned.filter((r) => r.argv[1] === "versions" && r.argv[2] === "deploy")).toEqual([]);
    expect(fake.spawned.filter(isRollback)).toEqual([]);
  });

  test("T7 a site that fails the seal is never dry-run or uploaded", async () => {
    const site = minimalSite({ ".dev.vars": "SECRET=synthetic\n" });
    temps.push(site);
    const fake = fakeIo({ env, spawn: answer(SITE_DRY_RUN) });
    const code = await main(["deploy", site.root], fake.io);
    expect(code).not.toBe(0);
    expect(fake.spawned).toEqual([]);
    expect(fake.fetched).toEqual([]);
  });
});
