/**
 * Sol security r3, S5-8: a Worker with OpenTelemetry export on sends invocation logs and traces (request URLs
 * included) to an external destination. The settings reply carries it as `observability.logs.destinations` and
 * `observability.traces.destinations` (field names as Wrangler 4.168.0 reads the reply, cli.js:199880). A non-empty
 * destination list is an export unless that section or `observability` itself is explicitly disabled:
 * `live-observability-export`. An absent or null field counts as off; a value of the wrong type is unconfirmed
 * (`live-api-error`). Both shapes are tested, since the fake reply carries none of it by default.
 */
import { afterEach, describe, expect, test } from "vitest";
import { checkLive, checkVersion } from "../src/check3.ts";
import { main } from "../src/cli.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import { ACCOUNT, ENV, fakeCloudflare, SCRIPT, TOKEN, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

const reply = (result: unknown) => ({
  status: 200,
  text: async () => JSON.stringify({ success: true, errors: [], messages: [], result }),
});

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
const exportTo = (section: "logs" | "traces", more: Record<string, unknown> = {}) => ({
  observability: { enabled: true, [section]: { enabled: true, destinations: ["synthetic-otel-sink"], ...more } },
});

describe("external observability export (S5-8)", () => {
  test.each([
    ["absent", {}],
    ["null", { observability: null }],
    ["on with no destinations", { observability: { enabled: true, logs: { enabled: true, invocation_logs: true } } }],
    ["empty destination lists", { observability: { logs: { destinations: [] }, traces: { destinations: [] } } }],
    ["destinations with logs disabled", exportTo("logs", { enabled: false })],
    [
      "destinations with observability disabled",
      { observability: { enabled: false, traces: { destinations: ["x"] } } },
    ],
  ])("observability %s passes both checks (positive control)", async (_name, extra) => {
    expect(await checkLive(PUBLIC_SITE, api(extra))).toEqual({ ok: true, problems: [] });
    expect(await checkVersion(PUBLIC_SITE, api(extra), UPLOADED)).toEqual({ ok: true, problems: [] });
  });

  test.each([
    ["log export", exportTo("logs"), ["live-observability-export"]],
    ["trace export", exportTo("traces"), ["live-observability-export"]],
    [
      "trace export with enabled left out",
      { observability: { traces: { destinations: ["x"] } } },
      ["live-observability-export"],
    ],
    ["a malformed observability", { observability: "on" }, ["live-api-error"]],
    ["malformed destinations", { observability: { logs: { destinations: "x" } } }, ["live-api-error"]],
    ["a malformed enabled", { observability: { enabled: "yes", logs: { destinations: ["x"] } } }, ["live-api-error"]],
  ])("%s fails both checks", async (_name, extra, expected) => {
    expect(rules(await checkLive(PUBLIC_SITE, api(extra)))).toEqual(expected);
    expect(rules(await checkVersion(PUBLIC_SITE, api(extra), UPLOADED))).toEqual(expected);
  });

  async function gate(command: "deploy" | "triggers", extra: Record<string, unknown>) {
    const site = minimalSite();
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

  test("deploy: trace export means the uploaded version is never promoted", async () => {
    const { code, commands, lines } = await gate("deploy", exportTo("traces"));
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run", "upload"]);
    expect(lines.some((l) => l.startsWith("live-observability-export:"))).toBe(true);
  });

  test("triggers: log export means workers.dev is never changed", async () => {
    const { code, commands, lines } = await gate("triggers", exportTo("logs"));
    expect(code).toBe(1);
    expect(commands).toEqual(["dry-run"]);
    expect(lines.some((l) => l.startsWith("live-observability-export:"))).toBe(true);
  });
});

/**
 * Sol security r4, S6-4: `observability.enabled` is shorthand for logs, and traces are enabled on their own, but
 * the check let a top-level `false` switch off an explicitly enabled section. Now a section's own `enabled` always
 * wins; the top-level flag is used only when the section does not say.
 */
describe("an explicitly enabled section is never masked by the top-level flag (S6-4)", () => {
  test.each([
    [
      "traces enabled under a disabled top level",
      { observability: { enabled: false, traces: { enabled: true, destinations: ["x"] } } },
    ],
    [
      "logs enabled under a disabled top level",
      { observability: { enabled: false, logs: { enabled: true, destinations: ["x"] } } },
    ],
  ])("%s fails both checks", async (_name, extra) => {
    expect(rules(await checkLive(PUBLIC_SITE, api(extra)))).toEqual(["live-observability-export"]);
    expect(rules(await checkVersion(PUBLIC_SITE, api(extra), UPLOADED))).toEqual(["live-observability-export"]);
  });

  test("a section explicitly disabled under an enabled top level passes (positive control)", async () => {
    const extra = { observability: { enabled: true, traces: { enabled: false, destinations: ["x"] } } };
    expect(await checkLive(PUBLIC_SITE, api(extra))).toEqual({ ok: true, problems: [] });
  });
});
