/** Fable independent re-check, P3 findings: nonce sources, schema conversion failures, Wrangler error codes. */
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import { main } from "../src/cli.ts";
import { checkHeaders } from "../src/headers.ts";
import {
  neverPublicFields,
  openShapes,
  publicSurface,
  schemaConversionProblems,
  strictnessProblems,
} from "../src/surface.ts";
import { ENV, fakeCloudflare } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, minimalSite, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

describe("P3: a nonce in the CSP is weak on a static site", () => {
  test("script-src 'nonce-…' fails with rule headers-weak; hashes stay allowed", () => {
    const dir = tempDir("cj-nonce-");
    temps.push(dir);
    writeTree(dir.root, { _headers: MINIMAL_HEADERS.replace("script-src 'self'", "script-src 'self' 'nonce-abc123'") });
    expect(checkHeaders(dir.root)).toEqual([{ path: "_headers", rule: "headers-weak" }]);
  });
});

describe("P3: a schema that cannot be converted is reported by its export name", () => {
  const module = { good: z.strictObject({ a: z.string() }), dated: z.strictObject({ d: z.date() }) };

  test("schemaConversionProblems names the export with rule schema-unrepresentable", () => {
    expect(schemaConversionProblems(module)).toEqual([{ path: "dated", rule: "schema-unrepresentable" }]);
  });

  test("the other check 1 walks skip that export instead of throwing (positive control)", () => {
    expect(publicSurface(module)).toEqual(["good.a: string"]);
    expect(neverPublicFields(module)).toEqual([]);
    expect(openShapes(module)).toEqual([]);
    expect(strictnessProblems(module)).toEqual([]);
  });
});

describe("P3: a failed Wrangler run prints only Cloudflare error codes", () => {
  const SENTINEL = "S3NT1NELwrangler0123456789abcdef";

  test("an upload refused with [code: 10000] logs wrangler-error: code 10000 and none of the message", async () => {
    const site = minimalSite();
    temps.push(site);
    const cf = fakeCloudflare({ previous: { bindings: [] } });
    const fake = fakeIo({
      env: ENV,
      spawn: (r) =>
        r.argv[1] === "versions"
          ? {
              exitCode: 1,
              stdout: `uploading /Users/someone/${SENTINEL}/site\n`,
              stderr: `✘ [ERROR] A request to the Cloudflare API (/accounts/${SENTINEL}) failed.\n  Authentication error [code: 10000]\n  ${SENTINEL} [code: 7003]\n`,
            }
          : cf.spawn(r),
      fetch: cf.fetch,
    });
    fake.io.sleep = async () => {};
    expect(await main(["deploy", site.root], fake.io)).not.toBe(0);
    const log = fake.lines.join("\n");
    expect(fake.lines).toContain("wrangler-error: code 10000");
    expect(fake.lines).toContain("wrangler-error: code 7003");
    expect(log).not.toContain(SENTINEL);
    expect(log).not.toContain("Authentication error");
  });
});
