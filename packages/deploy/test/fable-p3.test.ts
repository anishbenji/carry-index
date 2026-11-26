/** Fable independent review, P3 findings: each fixed behaviour, with a positive control where one fits. */
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import { scanBundle } from "../src/canary.ts";
import { main } from "../src/cli.ts";
import { checkHeaders } from "../src/headers.ts";
import { neverPublicFields } from "../src/surface.ts";
import { ENV, fakeCloudflare, UPLOADED } from "./fake-cloudflare.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, minimalSite, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function dirWith(files: Record<string, string>): string {
  const dir = tempDir("cj-p3-");
  temps.push(dir);
  writeTree(dir.root, files);
  return dir.root;
}

describe("P3: bare scheme sources in default-src and script-src are weak", () => {
  test.each([
    ["script-src data:", MINIMAL_HEADERS.replace("script-src 'self'", "script-src 'self' data:")],
    ["script-src https:", MINIMAL_HEADERS.replace("script-src 'self'", "script-src 'self' https:")],
    ["script-src blob:", MINIMAL_HEADERS.replace("script-src 'self'", "script-src 'self' blob:")],
    ["default-src http:", MINIMAL_HEADERS.replace("default-src 'self'", "default-src 'self' http:")],
  ])("%s fails with rule headers-weak", (_name, content) => {
    expect(checkHeaders(dirWith({ _headers: content }))).toEqual([{ path: "_headers", rule: "headers-weak" }]);
  });

  test("data: in img-src and a host source in script-src pass (positive control)", () => {
    const content = MINIMAL_HEADERS.replace("img-src 'self'", "img-src 'self' data:").replace(
      "script-src 'self'",
      "script-src 'self' https://static.example.com",
    );
    expect(checkHeaders(dirWith({ _headers: content }))).toEqual([]);
  });
});

describe("P3: a tail consumer found after promotion is reported, not rolled back", () => {
  test("a tail consumer attached after promotion fails the deploy with no rollback", async () => {
    const site = minimalSite();
    temps.push(site);
    const cf = fakeCloudflare({ previous: { bindings: [] }, tailConsumersAfterPromotion: [{ service: "kit-watch" }] });
    const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch: cf.fetch });
    fake.io.sleep = async () => {};
    expect(await main(["deploy", site.root], fake.io)).not.toBe(0);
    expect(cf.commands).toEqual(["dry-run", "upload", `promote ${UPLOADED}@100%`]);
    expect(fake.lines.some((l) => l.includes("live-tail-consumers"))).toBe(true);
    expect(fake.lines.some((l) => /not rolling back/.test(l))).toBe(true);
  });
});

describe("P3: the email heuristic accepts a domain starting with a digit", () => {
  // Synthetic addresses, assembled at run time so no address literal is tracked: a domain that starts with a digit,
  // and an all-digit first label, each under a reserved last label that is not a file extension.
  const syntheticAddress = (local: string, domain: string): string => [local, domain].join("@");
  test.each([[syntheticAddress("someone", "1example.test")], [syntheticAddress("someone", "163.example")]])(
    "%s is an email hit",
    async (address) => {
      expect(await scanBundle(dirWith({ "x.html": `<!doctype html><p>${address}</p>` }))).toEqual([
        { path: "x.html", rule: "email" },
      ]);
    },
  );

  test.each([["icon@2x.png"], ["pkg@1.2.3"], ["sprite@3x.webp"]])(
    "%s is not an email hit (positive control)",
    async (text) => {
      expect(await scanBundle(dirWith({ "x.html": `<!doctype html><p>${text}</p>` }))).toEqual([]);
    },
  );
});

describe("P3: never-public names match their plurals", () => {
  test.each([["orderReferences"], ["purchasePrices"], ["orderNumbers"], ["shippingAddresses"], ["partnerNames"]])(
    "a field named %s is refused as never-public",
    (key) => {
      const sample = z.object({ id: z.string(), [key]: z.string() });
      expect(neverPublicFields({ sample })).toEqual([{ path: `sample.${key}`, rule: "never-public-name" }]);
    },
  );
});
