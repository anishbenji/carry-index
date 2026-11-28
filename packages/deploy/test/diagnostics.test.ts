/**
 * Diagnosable failures without leaking (CI branch independent review, third finding): `live-api-error` carries the
 * HTTP status, and Wrangler output that shows an authentication failure (Cloudflare codes 10000 or 9109, or
 * Wrangler's own wording) adds one fixed word, `wrangler-auth-error`. The output itself is never printed.
 */
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import type { FakeCloudflareOptions } from "./fake-cloudflare.ts";
import { ENV, fakeCloudflare, SCRIPT, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { builtSite } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

const SENTINEL = "S3NT1NELdiag0123456789abcdef";

async function deploy(options: FakeCloudflareOptions, uploadStderr?: string) {
  const site = builtSite();
  temps.push(site);
  const cf = fakeCloudflare({ previous: { bindings: [] }, ...options });
  const fake = fakeIo({
    env: ENV,
    spawn: (r) =>
      uploadStderr !== undefined && r.argv[1] === "versions" && r.argv[2] === "upload"
        ? { exitCode: 1, stdout: "", stderr: uploadStderr }
        : cf.spawn(r),
    fetch: cf.fetch,
  });
  fake.io.sleep = async () => {};
  const code = await main(["deploy", site.root], fake.io);
  return { code, lines: fake.lines, log: fake.lines.join("\n") };
}

describe("live-api-error carries the HTTP status", () => {
  test("a 403 on the version check logs live-api-error with 403", async () => {
    const { code, lines } = await deploy({
      intercept: (url) =>
        url === `${SCRIPT}/versions/${UPLOADED}`
          ? { status: 403, body: `{"errors":[{"message":"${SENTINEL}"}]}` }
          : undefined,
    });
    expect(code).not.toBe(0);
    expect(lines.some((l) => l.startsWith("live-api-error: 403"))).toBe(true);
    expect(lines.join("\n")).not.toContain(SENTINEL);
  });
});

describe("wrangler-auth-error", () => {
  test.each([
    [
      "Cloudflare code 10000",
      `✘ [ERROR] A request to the Cloudflare API (/accounts/${SENTINEL}) failed.\n  Authentication error [code: 10000]\n`,
    ],
    ["Cloudflare code 9109", `✘ [ERROR] ${SENTINEL} Invalid access token [code: 9109]\n`],
    ["Wrangler's own wording", `You are not authenticated. Please run \`wrangler login\`. ${SENTINEL}\n`],
  ])("%s adds the fixed word wrangler-auth-error and nothing of the output", async (_name, stderr) => {
    const { code, lines, log } = await deploy({}, stderr);
    expect(code).not.toBe(0);
    expect(lines).toContain("wrangler-auth-error");
    expect(log).not.toContain(SENTINEL);
    expect(log).not.toMatch(/Authentication error|Invalid access token|not authenticated/);
  });

  test("a non-authentication code logs only its code (positive control)", async () => {
    const { lines } = await deploy({}, `✘ [ERROR] ${SENTINEL} [code: 7003]\n`);
    expect(lines).toContain("wrangler-error: code 7003");
    expect(lines).not.toContain("wrangler-auth-error");
  });
});
