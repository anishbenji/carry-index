/**
 * T7, upload, verify, then promote (GPT-6.2 Sol security round 1, P1; director's design change). The gate uploads a
 * version with no traffic, confirms that exact version through the API, promotes it only then, and after promotion
 * rolls back only to a verified previous version by id. Wrangler and the API are the shared fake in
 * `fake-cloudflare.ts`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { checkLive } from "../src/check3.ts";
import { main } from "../src/cli.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import type { FakeCloudflareOptions, FakeState } from "./fake-cloudflare.ts";
import { ACCOUNT, D1, ENV, fakeCloudflare, PREVIOUS, SCRIPT, TOKEN, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { builtSite } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

async function deploy(options: FakeCloudflareOptions) {
  const site = builtSite();
  temps.push(site);
  const cf = fakeCloudflare(options);
  const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch: cf.fetch });
  const slept: number[] = [];
  fake.io.sleep = async (ms) => {
    slept.push(ms);
  };
  const code = await main(["deploy", site.root], fake.io);
  const has = (rule: string): boolean => fake.lines.some((l) => l.includes(rule));
  return { code, cf, fake, slept, has };
}

const VERSION_URL = `${SCRIPT}/versions/${UPLOADED}`;

describe("T7 upload, verify, then promote", () => {
  test("T7 a clean deploy uploads, checks the uploaded version, promotes it and confirms it live (positive control)", async () => {
    const { code, cf, fake } = await deploy({ previous: { bindings: [] } });
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    const promote = fake.spawned.find((r) => r.argv[1] === "versions" && r.argv[2] === "deploy");
    expect(promote?.argv.slice(1)).toEqual([
      "versions",
      "deploy",
      `${UPLOADED}@100%`,
      "--config",
      `${promote?.cwd}/wrangler.json`,
      "--yes",
    ]);
    // The version is checked before the promotion, and the live Worker after it.
    expect(fake.fetched.indexOf(VERSION_URL)).toBeGreaterThan(-1);
    expect(fake.fetched.lastIndexOf(`${SCRIPT}/settings`)).toBeGreaterThan(fake.fetched.indexOf(VERSION_URL));
  });

  test("T7 an existing Worker with no active deployment promotes after the same checks", async () => {
    const { code, cf } = await deploy({});
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
  });

  test.each([
    ["shows a D1 binding", { uploadBindings: [D1] }, "live-bindings"],
    ["has a tail consumer on the script", { tailConsumers: [{ service: "kit-watch" }] }, "live-tail-consumers"],
  ] as const)(
    "T7 an uploaded version that %s is never promoted and nothing is rolled back",
    async (_name, options, rule) => {
      const { code, cf, has } = await deploy({ previous: { bindings: [] }, ...options });
      expect(code).not.toBe(0);
      expect(cf.commands).toEqual(["dry-run", "upload"]);
      expect(has(rule)).toBe(true);
    },
  );

  test.each([
    ["the version reply is a 500", (url: string) => (url === VERSION_URL ? { status: 500, body: "" } : undefined)],
    [
      "the version reply is for another version",
      (url: string) =>
        url === VERSION_URL
          ? {
              status: 200,
              body: JSON.stringify({ success: true, result: { id: PREVIOUS, resources: { bindings: [] } } }),
            }
          : undefined,
    ],
    [
      "the version reply has no bindings field",
      (url: string) =>
        url === VERSION_URL
          ? { status: 200, body: JSON.stringify({ success: true, result: { id: UPLOADED, resources: {} } }) }
          : undefined,
    ],
    [
      "the settings cannot be reached",
      (url: string) => (url === `${SCRIPT}/settings` ? new Error("network down") : undefined),
    ],
  ] as const)("T7 an unconfirmed version (%s) is retried, then not promoted", async (_name, intercept) => {
    const { code, cf, slept, has } = await deploy({ previous: { bindings: [] }, intercept });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload"]);
    expect(slept).toHaveLength(2);
    expect(has("live-api-error")).toBe(true);
  });

  test("T7 an API error then a clean reply promotes", async () => {
    const { code, cf } = await deploy({
      previous: { bindings: [] },
      intercept: (url, call) => (url === VERSION_URL && call < 4 ? { status: 503, body: "" } : undefined),
    });
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
  });

  test.each([
    ["exits non-zero", { uploadExit: 1 }],
    ["prints no version id", { uploadStdout: "Uploaded carry-journal\n" }],
  ] as const)("T7 an upload that %s promotes nothing", async (_name, options) => {
    const { code, cf } = await deploy({ previous: { bindings: [] }, ...options });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload"]);
  });

  test("T7 the deployments cannot be read before upload: nothing is uploaded", async () => {
    const { code, cf, has } = await deploy({
      previous: { bindings: [] },
      intercept: (url) => (url === `${SCRIPT}/deployments` ? { status: 403, body: "" } : undefined),
    });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(has("live-api-error")).toBe(true);
  });

  test("T7 another deployment made while the version was checked stops the promotion (compare and swap)", async () => {
    const { code, cf } = await deploy({
      previous: { bindings: [] },
      beforePromoteCheck: (state) => {
        state.deployments.unshift({ id: "d-other", versions: [{ version_id: PREVIOUS, percentage: 100 }] });
      },
    });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload"]);
  });

  test("T7 a failed promotion leaves the previous version live and rolls nothing back", async () => {
    const { code, cf } = await deploy({ previous: { bindings: [] }, promoteExit: 1 });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
  });
});

describe("T7 after promotion: recovery only to a verified previous version", () => {
  test("T7 a binding that appears after promotion rolls back to the previous version by id, confirmed live", async () => {
    const { code, cf, fake, has } = await deploy({ previous: { bindings: [] }, bindingsAfterPromotion: [D1] });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`, `rollback ${PREVIOUS}`]);
    const rollback = fake.spawned.find((r) => r.argv[1] === "rollback");
    expect(rollback?.argv.slice(1)).toEqual([
      "rollback",
      PREVIOUS,
      "--config",
      `${rollback?.cwd}/wrangler.json`,
      "--yes",
    ]);
    expect(fake.fetched).toContain(`${SCRIPT}/versions/${PREVIOUS}`);
    expect(has("live-bindings")).toBe(true);
    expect(fake.lines.some((l) => /rollback confirmed/i.test(l))).toBe(true);
  });

  test("T7 a rollback the live Worker still does not confirm fails with rule live-after-rollback", async () => {
    const { code, cf, has } = await deploy({
      previous: { bindings: [] },
      bindingsAfterPromotion: [D1],
      bindingsAfterRollback: [D1],
    });
    expect(code).not.toBe(0);
    expect(cf.commands.at(-1)).toBe(`rollback ${PREVIOUS}`);
    expect(has("live-after-rollback")).toBe(true);
  });

  test.each([
    ["there is no single previous version", {}],
    ["the previous version itself has a binding", { previous: { bindings: [D1] } }],
  ] as const)("T7 no rollback when %s: the gate fails with live-after-rollback", async (_name, options) => {
    const { code, cf, has } = await deploy({ ...options, bindingsAfterPromotion: [D1] });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(has("live-after-rollback")).toBe(true);
  });

  test("T7 the live Worker unreadable after promotion is retried, then fails without a rollback", async () => {
    const { code, cf, slept, has } = await deploy({ previous: { bindings: [] }, apiDownAfterPromotion: true });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(slept).toHaveLength(2);
    expect(has("live-api-error")).toBe(true);
  });
});

describe("T7 the live check reads bindings and tail consumers independently (Sol, CI review P1)", () => {
  const settings = (result: Record<string, unknown>) => async () => ({
    status: 200,
    text: async () => JSON.stringify({ success: true, errors: [], messages: [], result }),
  });
  const options = (result: Record<string, unknown>) => ({
    accountId: ACCOUNT,
    apiToken: TOKEN,
    fetch: settings(result),
  });

  test("T7 a binding mismatch is reported even when tail_consumers is malformed", async () => {
    const result = await checkLive(PUBLIC_SITE, options({ bindings: [D1], tail_consumers: "garbage" }));
    expect(result.problems.map((p) => p.rule).sort()).toEqual(["live-api-error", "live-bindings"]);
  });

  test("T7 a tail consumer is reported even when bindings is malformed", async () => {
    const result = await checkLive(PUBLIC_SITE, options({ bindings: "garbage", tail_consumers: [{ service: "x" }] }));
    expect(result.problems.map((p) => p.rule).sort()).toEqual(["live-api-error", "live-tail-consumers"]);
  });

  test.each([
    ["absent", {}],
    ["null", { tail_consumers: null }],
  ])("T7 tail_consumers %s (documented optional) means none", async (_name, extra) => {
    expect(await checkLive(PUBLIC_SITE, options({ bindings: [], ...extra }))).toEqual({ ok: true, problems: [] });
  });
});

/**
 * Security-sol round 2, S2-2: a deployment made by anyone else while the gate verifies must never be overwritten.
 * The active deployment is re-read immediately before each write (promote and rollback) and compared by id; on a
 * mismatch nothing is written and the gate fails with `deployment-changed`.
 */
describe("T7 compare and swap before every deployment write (S2-2)", () => {
  const HOTFIX = "99999999-aaaa-4bbb-8ccc-dddddddddddd";

  test("T7 a deployment made while the uploaded version was checked stops the promotion with deployment-changed", async () => {
    const { code, cf, has } = await deploy({
      previous: { bindings: [] },
      beforePromoteCheck: (state) => {
        state.versions.set(HOTFIX, { bindings: [] });
        state.deployments.unshift({ id: "d-hotfix", versions: [{ version_id: HOTFIX, percentage: 100 }] });
      },
    });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload"]);
    expect(has("deployment-changed")).toBe(true);
  });

  test("T7 a hotfix promoted while the rollback target was verified is not rolled back over", async () => {
    let state: FakeState | undefined;
    let hotfixed = false;
    const { code, cf, has } = await deploy({
      previous: { bindings: [] },
      bindingsAfterPromotion: [D1],
      beforePromoteCheck: (s) => {
        state = s;
      },
      intercept: (url) => {
        // The rollback target is read only after promotion, while the gate verifies it.
        if (url === `${SCRIPT}/versions/${PREVIOUS}` && state && !hotfixed) {
          hotfixed = true;
          state.versions.set(HOTFIX, { bindings: [] });
          state.deployments.unshift({ id: "d-hotfix", versions: [{ version_id: HOTFIX, percentage: 100 }] });
        }
        return undefined;
      },
    });
    expect(hotfixed).toBe(true);
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(has("deployment-changed")).toBe(true);
    expect(state?.deployments[0]?.id).toBe("d-hotfix");
  });

  test("T7 the deployments unreadable immediately before the rollback: no rollback", async () => {
    let promotedRead = 0;
    const { code, cf, has } = await deploy({
      previous: { bindings: [] },
      bindingsAfterPromotion: [D1],
      intercept: (url) => {
        if (url !== `${SCRIPT}/versions/${PREVIOUS}` && promotedRead === 0) return undefined;
        if (url === `${SCRIPT}/versions/${PREVIOUS}`) promotedRead++;
        return url === `${SCRIPT}/deployments` ? { status: 500, body: "" } : undefined;
      },
    });
    expect(promotedRead).toBeGreaterThan(0);
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(has("live-api-error")).toBe(true);
  });

  test("T7 the rollback still runs when nothing else deployed (positive control)", async () => {
    const { code, cf, has } = await deploy({ previous: { bindings: [] }, bindingsAfterPromotion: [D1] });
    expect(code).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`, `rollback ${PREVIOUS}`]);
    expect(has("deployment-changed")).toBe(false);
  });
});
