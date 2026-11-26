/**
 * Sol security r3, S5-5 (director-sanctioned contract): `triggers` turned workers.dev on while the Worker still served
 * the dashboard placeholder, which never passed the seal. Now:
 * - `versions upload` tags each version with the sealed manifest's tag (`--tag <first 12 hex of its SHA-256>`);
 * - `deploy` runs with workers.dev off as well as on, preview URLs off either way, so the first deploy promotes the
 *   sealed site before any public hostname is on;
 * - `triggers` turns workers.dev on only when the active deployment is one version at 100% (`live-version-not-sole`)
 *   that passes check 3 and whose `workers/tag` equals the tag of the bundle `triggers` has just sealed from the same
 *   build: a missing or malformed tag is `live-version-untagged`, another build's is `live-version-not-sealed`, with
 *   no fallback. The active deployment is re-read just before `triggers deploy` (`deployment-changed`).
 */
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { manifestTag } from "../src/seal.ts";
import type { FakeCloudflareOptions } from "./fake-cloudflare.ts";
import { ENV, fakeCloudflare, PREVIOUS, SCRIPT, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_PAGE, minimalSite, sealedTag } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

/** Runs the gate, recording API reads and Wrangler runs in one ordered list. */
async function run(command: "deploy" | "triggers", options: (tag: string) => FakeCloudflareOptions) {
  const site = minimalSite();
  temps.push(site);
  const tag = await sealedTag(site.root);
  const events: string[] = [];
  const opts = options(tag);
  const cf = fakeCloudflare({
    ...opts,
    intercept: (url, call) => {
      if (url === `${SCRIPT}/deployments`) events.push("read deployments");
      return opts.intercept?.(url, call);
    },
  });
  const spawn = (request: Parameters<typeof cf.spawn>[0]) => {
    const result = cf.spawn(request);
    events.push(`run ${cf.commands[cf.commands.length - 1]}`);
    return result;
  };
  const fake = fakeIo({ env: ENV, spawn, fetch: cf.fetch });
  fake.io.sleep = async () => {};
  const code = await main([command, site.root], fake.io);
  const has = (text: string) => fake.lines.some((l) => l.includes(text));
  return { code, cf, fake, events, tag, has };
}

describe("the manifest tag (S5-5)", () => {
  test("is 12 lower-case hex characters and follows the sealed content", async () => {
    const a = minimalSite();
    const b = minimalSite({ "about.html": MINIMAL_PAGE });
    temps.push(a, b);
    const tagA = await sealedTag(a.root);
    expect(tagA).toMatch(/^[0-9a-f]{12}$/);
    expect(await sealedTag(a.root)).toBe(tagA);
    expect(await sealedTag(b.root)).not.toBe(tagA);
    expect(manifestTag([])).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("the first deploy runs with workers.dev off (S5-5)", () => {
  test("deploy uploads with --tag <manifest tag> and promotes with both public hostnames off", async () => {
    const { code, cf, fake, tag } = await run("deploy", () => ({
      previous: { bindings: [] },
      subdomain: { enabled: false, previews_enabled: false },
    }));
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    const upload = fake.spawned.find((r) => r.argv[1] === "versions" && r.argv[2] === "upload");
    expect(upload?.argv.slice(1)).toEqual([
      "versions",
      "upload",
      "--config",
      `${upload?.cwd}/wrangler.json`,
      "--tag",
      tag,
    ]);
    expect(cf.state.versions.get(UPLOADED)?.tag).toBe(tag);
  });
});

describe("triggers turns workers.dev on only for this build's sealed version (S5-5)", () => {
  test("the active version is this build's, clean and alone: triggers deploy runs after a fresh read (positive control)", async () => {
    const { code, cf, events } = await run("triggers", (tag) => ({
      previous: { bindings: [], tag },
      subdomain: { enabled: false, previews_enabled: false },
    }));
    expect(code).toBe(0);
    expect(cf.commands).toEqual(["dry-run", "triggers"]);
    const at = events.indexOf("run triggers");
    expect(events.slice(0, at).filter((e) => e === "read deployments").length).toBeGreaterThanOrEqual(2);
    expect(events[at - 1]).toBe("read deployments");
  });

  test.each([
    ["has no workers/tag", { bindings: [] }],
    ["has a workers/tag that is not a string", { bindings: [], tag: 42 }],
    ["has an empty workers/tag", { bindings: [], tag: "" }],
  ])("the active version %s: live-version-untagged, workers.dev untouched", async (_name, previous) => {
    const { code, cf, has } = await run("triggers", () => ({ previous }));
    expect(code).toBe(1);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(has("live-version-untagged")).toBe(true);
  });

  test("the version's annotations are malformed: live-version-untagged", async () => {
    const { code, cf, has } = await run("triggers", () => ({
      previous: { bindings: [] },
      intercept: (url) =>
        url === `${SCRIPT}/versions/${PREVIOUS}`
          ? {
              status: 200,
              body: JSON.stringify({
                success: true,
                result: { id: PREVIOUS, annotations: "workers/tag", resources: { bindings: [] } },
              }),
            }
          : undefined,
    }));
    expect(code).toBe(1);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(has("live-version-untagged")).toBe(true);
  });

  test("the active version carries another build's tag (the placeholder, or an older site): live-version-not-sealed", async () => {
    const { code, cf, has } = await run("triggers", () => ({ previous: { bindings: [], tag: "0123456789ab" } }));
    expect(code).toBe(1);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(has("live-version-not-sealed")).toBe(true);
  });

  test("no deployment at all: live-version-not-sole", async () => {
    const { code, cf, has } = await run("triggers", () => ({}));
    expect(code).toBe(1);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(has("live-version-not-sole")).toBe(true);
  });

  test("a deployment made between the checks and triggers deploy stops it: deployment-changed", async () => {
    const { code, cf, has, events } = await run("triggers", (tag) => ({
      previous: { bindings: [], tag },
      // The fake runs this on the second deployments read: the re-read just before triggers deploy.
      beforePromoteCheck: (state) => {
        state.deployments.unshift({ id: "d-other", versions: [{ version_id: PREVIOUS, percentage: 100 }] });
      },
    }));
    expect(events.filter((e) => e === "read deployments")).toHaveLength(2);
    expect(code).toBe(1);
    expect(cf.commands).toEqual(["dry-run"]);
    expect(has("deployment-changed")).toBe(true);
  });
});
