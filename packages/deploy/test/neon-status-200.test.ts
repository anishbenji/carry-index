/**
 * Independent review (Neon, feat/17) N13: an unreadable reply that came back as HTTP 200 (a truncated body, a
 * missing `deployments` list, another version's id) was logged as `live-api-error: 200`, though a status is printed
 * only when the reply had one other than 200 (`Problem.status`). `deploymentReadProblem` now omits 200, as `apiError`
 * in check3.ts does.
 */
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import type { FakeCloudflareOptions } from "./fake-cloudflare.ts";
import { ENV, fakeCloudflare, PREVIOUS, SCRIPT } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite, sealedTag } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

async function run(command: "deploy" | "triggers", options: FakeCloudflareOptions) {
  const site = minimalSite();
  temps.push(site);
  const tag = await sealedTag(site.root);
  const cf = fakeCloudflare({ ...options, previous: { bindings: [], tag } });
  const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch: cf.fetch });
  fake.io.sleep = async () => {};
  const code = await main([command, site.root], fake.io);
  return { code, lines: fake.lines };
}

describe("a malformed 200 is logged without a status (N13)", () => {
  test.each([
    ["truncated", "{ not json"],
    ["unsuccessful", JSON.stringify({ success: false, errors: [] })],
    ["without a deployments list", JSON.stringify({ success: true, errors: [], result: {} })],
  ])("deploy: a %s 200 from /deployments is live-api-error with no 200", async (_name, body) => {
    const { code, lines } = await run("deploy", {
      intercept: (url) => (url === `${SCRIPT}/deployments` ? { status: 200, body } : undefined),
    });
    expect(code).toBe(1);
    expect(lines).toContain('live-api-error: "carry-journal"');
    expect(lines.some((l) => l.startsWith("live-api-error: 200"))).toBe(false);
  });

  test("triggers: a 200 /versions reply for another version is live-api-error with no 200", async () => {
    let versionReads = 0;
    const { code, lines } = await run("triggers", {
      intercept: (url) => {
        // The first read is check 3's (clean); the second is versionTag's, answered for another version.
        if (url !== `${SCRIPT}/versions/${PREVIOUS}` || ++versionReads < 2) return undefined;
        const other = { id: "00000000-0000-4000-8000-000000000000", resources: { bindings: [] } };
        return { status: 200, body: JSON.stringify({ success: true, errors: [], result: other }) };
      },
    });
    expect(code).toBe(1);
    expect(lines).toContain('live-api-error: "carry-journal"');
    expect(lines.some((l) => l.startsWith("live-api-error: 200"))).toBe(false);
  });

  test("a real non-200 status is still printed (control)", async () => {
    const { lines } = await run("deploy", {
      intercept: (url) => (url === `${SCRIPT}/deployments` ? { status: 503, body: "" } : undefined),
    });
    expect(lines).toContain('live-api-error: 503 "carry-journal"');
  });
});
