/**
 * Independent review (Neon) N5: right after `versions deploy` (or `rollback`), Cloudflare's deployments endpoint may
 * still show the earlier deployment for a moment. The confirmation did not retry that, logged a misleading
 * `live-bindings` (no binding was read), and dropped the reply's HTTP status. Now a deployment that has not yet
 * converged to the expected version is retried with backoff, bounded at 5 reads (waits of 2, 4, 6 and 8 s: at most
 * 20 s per confirmation), and then fails as `deployment-changed` after a promotion or `live-after-rollback` after a
 * rollback; an unreadable reply keeps its status. The waits go through the gate's injected sleep, so no real time
 * passes in these tests.
 */
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import type { FakeCloudflare, FakeCloudflareOptions } from "./fake-cloudflare.ts";
import { D1, ENV, fakeCloudflare, PREVIOUS, SCRIPT, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

/** A deployments reply showing `version` alone at 100%, as a stale read after a write would. */
const staleReply = (version: string) => ({
  status: 200,
  body: JSON.stringify({
    success: true,
    errors: [],
    result: { deployments: [{ id: `d-stale-${version}`, versions: [{ version_id: version, percentage: 100 }] }] },
  }),
});

/**
 * Runs deploy; once `after` has run (a command name), the next `stale` deployments reads show `staleVersion`.
 */
async function deploy(options: FakeCloudflareOptions, after: string, stale: number, staleVersion = PREVIOUS) {
  const site = minimalSite();
  temps.push(site);
  let cf: FakeCloudflare | undefined;
  let served = 0;
  cf = fakeCloudflare({
    previous: { bindings: [] },
    ...options,
    intercept: (url) => {
      const ran = cf?.commands.some((c) => c.startsWith(after)) ?? false;
      if (url === `${SCRIPT}/deployments` && ran && served < stale) {
        served++;
        return staleReply(staleVersion);
      }
      return undefined;
    },
  });
  const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch: cf.fetch });
  const slept: number[] = [];
  fake.io.sleep = async (ms) => {
    slept.push(ms);
  };
  const code = await main(["deploy", site.root], fake.io);
  const has = (text: string) => fake.lines.some((l) => l.includes(text));
  return { code, commands: cf.commands, slept, has, lines: fake.lines };
}

describe("confirmation waits for the deployment to converge (N5)", () => {
  test("two stale reads after the promotion: retried, then confirmed", async () => {
    const { code, commands, slept, has } = await deploy({}, "promote", 2);
    expect(code).toBe(0);
    expect(commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(slept).toEqual([2000, 4000]);
    expect(has("live-bindings")).toBe(false);
  });

  test("never converging after the promotion: bounded at 5 reads, then deployment-changed, never live-bindings", async () => {
    const { code, commands, slept, has } = await deploy({}, "promote", 1000);
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(slept).toEqual([2000, 4000, 6000, 8000]);
    expect(has("deployment-changed")).toBe(true);
    expect(has("live-bindings")).toBe(false);
  });

  test("N5a: converging on read 6, just after the 5-read wait ran out, never rolls back a good promotion", async () => {
    const { code, commands, slept, has, lines } = await deploy({}, "promote", 5);
    expect(slept).toEqual([2000, 4000, 6000, 8000]);
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(has("deployment-changed")).toBe(true);
    expect(lines.some((l) => l.includes("wrangler rollback"))).toBe(false);
  });

  test("two stale reads after a rollback: retried, then the rollback is confirmed", async () => {
    const { code, commands, has } = await deploy({ bindingsAfterPromotion: [D1] }, "rollback", 2, UPLOADED);
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`, `rollback ${PREVIOUS}`]);
    expect(has("rollback confirmed")).toBe(true);
  });

  test("never converging after a rollback: bounded, then live-after-rollback", async () => {
    const { code, has, lines } = await deploy({ bindingsAfterPromotion: [D1] }, "rollback", 1000, UPLOADED);
    expect(code).toBe(1);
    expect(has("live-after-rollback")).toBe(true);
    expect(lines.some((l) => /rollback confirmed/i.test(l))).toBe(false);
  });

  test("an unreadable deployments reply after the promotion keeps its HTTP status", async () => {
    let promoted = false;
    let cfRef: FakeCloudflare | undefined;
    const site = minimalSite();
    temps.push(site);
    cfRef = fakeCloudflare({
      previous: { bindings: [] },
      intercept: (url) => {
        promoted ||= cfRef?.commands.some((c) => c.startsWith("promote")) ?? false;
        return promoted && url === `${SCRIPT}/deployments` ? { status: 503, body: "" } : undefined;
      },
    });
    const fake = fakeIo({ env: ENV, spawn: cfRef.spawn, fetch: cfRef.fetch });
    fake.io.sleep = async () => {};
    expect(await main(["deploy", site.root], fake.io)).toBe(1);
    expect(fake.lines).toContain('live-api-error: 503 "carry-journal"');
  });

  test("N5b: an unreadable deployments reply after a rollback is printed with its HTTP status", async () => {
    let rolledBack = false;
    let cfRef: FakeCloudflare | undefined;
    const site = minimalSite();
    temps.push(site);
    cfRef = fakeCloudflare({
      previous: { bindings: [] },
      bindingsAfterPromotion: [D1],
      intercept: (url) => {
        rolledBack ||= cfRef?.commands.some((c) => c.startsWith("rollback")) ?? false;
        return rolledBack && url === `${SCRIPT}/deployments` ? { status: 503, body: "" } : undefined;
      },
    });
    const fake = fakeIo({ env: ENV, spawn: cfRef.spawn, fetch: cfRef.fetch });
    fake.io.sleep = async () => {};
    expect(await main(["deploy", site.root], fake.io)).toBe(1);
    expect(cfRef.commands.at(-1)).toBe(`rollback ${PREVIOUS}`);
    const after = fake.lines.slice(fake.lines.findIndex((l) => l.includes("wrangler rollback")));
    expect(after).toContain('live-api-error: 503 "carry-journal"');
    expect(after).toContain('live-after-rollback: "carry-journal"');
  });

  test("N12: a transient settings error after three convergence reads still gets its own retries", async () => {
    let cfRef: FakeCloudflare | undefined;
    let staleServed = 0;
    let settingsFailed = 0;
    const site = minimalSite();
    temps.push(site);
    cfRef = fakeCloudflare({
      previous: { bindings: [] },
      intercept: (url) => {
        const promoted = cfRef?.commands.some((c) => c.startsWith("promote")) ?? false;
        if (!promoted) return undefined;
        if (url === `${SCRIPT}/deployments` && staleServed < 3) {
          staleServed++;
          return staleReply(PREVIOUS);
        }
        // Converged on read 4; its settings read fails once, transiently.
        if (url === `${SCRIPT}/settings` && staleServed === 3 && settingsFailed < 1) {
          settingsFailed++;
          return { status: 503, body: "" };
        }
        return undefined;
      },
    });
    const fake = fakeIo({ env: ENV, spawn: cfRef.spawn, fetch: cfRef.fetch });
    const slept: number[] = [];
    fake.io.sleep = async (ms) => {
      slept.push(ms);
    };
    expect(await main(["deploy", site.root], fake.io)).toBe(0);
    expect(cfRef.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(settingsFailed).toBe(1);
    // Convergence waits 2, 4 and 6 s; then the API error's own first wait, 2 s.
    expect(slept).toEqual([2000, 4000, 6000, 2000]);
  });

  test("N12: the worst case stays bounded: 4 convergence waits and 2 API-error waits, 26 s in all", async () => {
    let cfRef: FakeCloudflare | undefined;
    let staleServed = 0;
    const site = minimalSite();
    temps.push(site);
    cfRef = fakeCloudflare({
      previous: { bindings: [] },
      intercept: (url) => {
        const promoted = cfRef?.commands.some((c) => c.startsWith("promote")) ?? false;
        if (!promoted || url !== `${SCRIPT}/deployments`) return undefined;
        // Four stale reads, then the endpoint errors for good.
        if (staleServed < 4) {
          staleServed++;
          return staleReply(PREVIOUS);
        }
        return { status: 503, body: "" };
      },
    });
    const fake = fakeIo({ env: ENV, spawn: cfRef.spawn, fetch: cfRef.fetch });
    const slept: number[] = [];
    fake.io.sleep = async (ms) => {
      slept.push(ms);
    };
    expect(await main(["deploy", site.root], fake.io)).toBe(1);
    expect(slept.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(26_000);
    expect(slept.length).toBeLessThanOrEqual(6);
    expect(fake.lines).toContain('live-api-error: 503 "carry-journal"');
  });

  test("N12 (feat/17 review repro): two stale reads, a 503 on /settings, then a clean reply promotes", async () => {
    let cfRef: FakeCloudflare | undefined;
    let staleServed = 0;
    let settingsFailed = 0;
    const site = minimalSite();
    temps.push(site);
    cfRef = fakeCloudflare({
      previous: { bindings: [] },
      intercept: (url) => {
        const promoted = cfRef?.commands.some((c) => c.startsWith("promote")) ?? false;
        if (!promoted) return undefined;
        if (url === `${SCRIPT}/deployments` && staleServed < 2) {
          staleServed++;
          return staleReply(PREVIOUS);
        }
        if (url === `${SCRIPT}/settings` && staleServed === 2 && settingsFailed < 1) {
          settingsFailed++;
          return { status: 503, body: "" };
        }
        return undefined;
      },
    });
    const fake = fakeIo({ env: ENV, spawn: cfRef.spawn, fetch: cfRef.fetch });
    const slept: number[] = [];
    fake.io.sleep = async (ms) => {
      slept.push(ms);
    };
    expect(await main(["deploy", site.root], fake.io)).toBe(0);
    expect(cfRef.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(settingsFailed).toBe(1);
    expect(slept).toEqual([2000, 4000, 2000]);
  });
});
