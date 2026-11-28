/**
 * T7, the first deploy and the subdomain settings (Fable independent review, P1 and P2). `versions upload` cannot
 * create a Worker (Wrangler 4.168.0, cli.js:70109), so when the script does not exist the gate stops and names the
 * one-time owner steps. And `versions deploy` applies no triggers, so check 3 reads the script's subdomain settings
 * (`GET /accounts/{account_id}/workers/scripts/{script_name}/subdomain`, Wrangler's read at cli.js:60556) and fails
 * when they differ from the definition (`workers_dev`, `preview_urls`).
 */
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import type { FakeCloudflareOptions } from "./fake-cloudflare.ts";
import { ENV, fakeCloudflare, SCRIPT, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite, sealedTag } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

async function gate(command: "deploy" | "triggers", options: FakeCloudflareOptions) {
  const site = minimalSite();
  temps.push(site);
  // S5-5: for triggers, the live version carries this build's sealed tag, as after the first deploy.
  const tag = command === "triggers" && options.previous ? await sealedTag(site.root) : undefined;
  const cf = fakeCloudflare(options.previous ? { ...options, previous: { tag, ...options.previous } } : options);
  const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch: cf.fetch });
  const slept: number[] = [];
  fake.io.sleep = async (ms) => {
    slept.push(ms);
  };
  const code = await main([command, site.root], fake.io);
  const text = fake.lines.join("\n");
  return { code, cf, fake, slept, text };
}

describe("T7 a Worker that does not exist yet", () => {
  test("the fake refuses versions upload for a missing Worker, as Wrangler does", () => {
    const cf = fakeCloudflare({ missing: true });
    const result = cf.spawn({
      argv: ["/w.js", "versions", "upload", "--config", "/x/wrangler.json"],
      cwd: "/x",
      env: {},
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not yet exist");
  });

  test.each([["deploy"], ["triggers"]] as const)(
    "%s on a missing Worker stops before any upload or triggers, with rule worker-missing and the owner steps",
    async (command) => {
      const { code, cf, text } = await gate(command, { missing: true });
      expect(code).not.toBe(0);
      expect(cf.commands).toEqual(["dry-run"]);
      expect(text).toContain("worker-missing");
      expect(text).toMatch(/dashboard/);
      expect(text).toMatch(/apply_triggers/);
    },
  );
});

describe("T7 check 3 reads the subdomain settings", () => {
  test("a clean deploy reads the subdomain settings before upload (positive control)", async () => {
    const { code, fake } = await gate("deploy", { previous: { bindings: [] } });
    expect(code).toBe(0);
    expect(fake.fetched.indexOf(`${SCRIPT}/subdomain`)).toBeGreaterThan(-1);
  });

  test.each([
    ["preview URLs are on", { enabled: true, previews_enabled: true }],
    ["preview URLs are on with workers.dev off", { enabled: false, previews_enabled: true }],
  ])("deploy stops before upload when %s, with rule live-subdomain and the triggers step", async (_name, subdomain) => {
    const { code, cf, text } = await gate("deploy", { previous: { bindings: [] }, subdomain });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(text).toContain("live-subdomain");
    expect(text).toMatch(/apply_triggers/);
  });

  // S5-5: the first deploy runs with both public hostnames off; workers.dev is turned on only afterwards, by triggers.
  test.each([
    ["workers.dev is off", { enabled: false, previews_enabled: false }],
    ["the fields are absent (Wrangler reads them as false)", {}],
  ])("deploy uploads, verifies and promotes when %s and preview URLs are off", async (_name, subdomain) => {
    const { code, cf } = await gate("deploy", { previous: { bindings: [] }, subdomain });
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
  });

  test("unreadable subdomain settings are retried, then nothing is uploaded", async () => {
    const { code, cf, slept, text } = await gate("deploy", {
      previous: { bindings: [] },
      intercept: (url) => (url === `${SCRIPT}/subdomain` ? { status: 503, body: "" } : undefined),
    });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(slept).toHaveLength(2);
    expect(text).toContain("live-api-error");
  });

  test("triggers applies the definition's subdomain settings and confirms them (positive control)", async () => {
    const { code, cf, fake } = await gate("triggers", {
      previous: { bindings: [] },
      subdomain: { enabled: true, previews_enabled: true },
    });
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "triggers"]);
    expect(fake.fetched.lastIndexOf(`${SCRIPT}/subdomain`)).toBeGreaterThan(-1);
  });

  test("triggers fails with rule live-subdomain when the settings still differ afterwards", async () => {
    const { code, text } = await gate("triggers", {
      previous: { bindings: [] },
      subdomain: { enabled: true, previews_enabled: true },
      triggersApply: false,
    });
    expect(code).not.toBe(0);
    expect(text).toContain("live-subdomain");
  });
});
