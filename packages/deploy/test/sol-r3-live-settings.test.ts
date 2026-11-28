/**
 * Security round 3, S3-6 (independent review): a streaming tail consumer links the public Worker to another Worker,
 * the same crossing `live-tail-consumers` exists to catch, and Wrangler 4.168.0 keeps it as its own setting
 * (`streaming_tail_consumers`). Director decision: a non-empty list fails with `live-tail-consumers`, and
 * `logpush: true` fails with `live-logpush` in Release 1, since no log destination is approved. The fake settings
 * reply carries neither field, and whether Cloudflare's reply does is unverified, so an absent field (or null) counts
 * as off; anything else that is not the expected type is unconfirmed (`live-api-error`).
 */
import { afterEach, describe, expect, test } from "vitest";
import { checkLive, checkVersion } from "../src/check3.ts";
import { main } from "../src/cli.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import { ACCOUNT, ENV, fakeCloudflare, SCRIPT, TOKEN, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { builtSite } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

const reply = (result: unknown) => ({
  status: 200,
  text: async () => JSON.stringify({ success: true, errors: [], messages: [], result }),
});

/** A fetch answering the settings with `extra` beside clean bindings, and version `id` with no bindings. */
function api(extra: Record<string, unknown>) {
  return {
    accountId: ACCOUNT,
    apiToken: TOKEN,
    fetch: async (url: string) =>
      url.includes("/versions/")
        ? reply({ id: UPLOADED, resources: { bindings: [] } })
        : reply({ bindings: [], ...extra }),
  };
}

const rules = (result: { problems: readonly { rule: string }[] }) => result.problems.map((p) => p.rule).sort();

describe("streaming tail consumers and logpush (S3-6)", () => {
  test.each([
    ["both absent", {}],
    ["both null", { streaming_tail_consumers: null, logpush: null }],
    ["an empty streaming list and logpush off", { streaming_tail_consumers: [], logpush: false }],
  ])("%s: the live check and the version check pass (positive control)", async (_name, extra) => {
    expect(await checkLive(PUBLIC_SITE, api(extra))).toEqual({ ok: true, problems: [] });
    expect(await checkVersion(PUBLIC_SITE, api(extra), UPLOADED)).toEqual({ ok: true, problems: [] });
  });

  test.each([
    [
      "a streaming tail consumer",
      { streaming_tail_consumers: [{ service: "synthetic-tail" }] },
      ["live-tail-consumers"],
    ],
    ["logpush on", { logpush: true }, ["live-logpush"]],
    [
      "both",
      { streaming_tail_consumers: [{ service: "synthetic-tail" }], logpush: true },
      ["live-logpush", "live-tail-consumers"],
    ],
    ["a malformed streaming list", { streaming_tail_consumers: "garbage" }, ["live-api-error"]],
    ["a malformed logpush", { logpush: "yes" }, ["live-api-error"]],
  ])("%s fails both checks", async (_name, extra, expected) => {
    expect(rules(await checkLive(PUBLIC_SITE, api(extra)))).toEqual(expected);
    expect(rules(await checkVersion(PUBLIC_SITE, api(extra), UPLOADED))).toEqual(expected);
  });

  async function gate(command: "deploy" | "triggers", extra: Record<string, unknown>) {
    const site = builtSite();
    temps.push(site);
    const cf = fakeCloudflare({ previous: { bindings: [] } });
    const fetch = async (url: string, init: Parameters<typeof cf.fetch>[1]) => {
      const answer = await cf.fetch(url, init);
      if (url !== `${SCRIPT}/settings`) return answer;
      const body = JSON.parse(await answer.text()) as { result: Record<string, unknown> };
      return reply({ ...body.result, ...extra });
    };
    const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch });
    fake.io.sleep = async () => {};
    const code = await main([command, site.root], fake.io);
    return { code, commands: cf.commands, lines: fake.lines };
  }

  test.each([
    ["a streaming tail consumer", { streaming_tail_consumers: [{ service: "synthetic-tail" }] }, "live-tail-consumers"],
    ["logpush on", { logpush: true }, "live-logpush"],
  ])("deploy: %s means the uploaded version is never promoted", async (_name, extra, rule) => {
    const { code, commands, lines } = await gate("deploy", extra);
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run", "upload"]);
    expect(lines.some((l) => l.startsWith(`${rule}:`))).toBe(true);
  });

  test.each([
    ["a streaming tail consumer", { streaming_tail_consumers: [{ service: "synthetic-tail" }] }, "live-tail-consumers"],
    ["logpush on", { logpush: true }, "live-logpush"],
  ])("triggers: %s means workers.dev is never changed", async (_name, extra, rule) => {
    const { code, commands, lines } = await gate("triggers", extra);
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(lines.some((l) => l.startsWith(`${rule}:`))).toBe(true);
  });

  test("deploy with both fields absent promotes (positive control)", async () => {
    const { code, commands } = await gate("deploy", {});
    expect(code).toBe(0);
    expect(commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
  });
});
