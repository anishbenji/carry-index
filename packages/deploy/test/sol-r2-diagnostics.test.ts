/**
 * Security-sol round 2, S2-10: a rejected file's name can itself be private (a recipient's email, an order
 * reference), and the gate's output becomes a public CI log. Public lines carry the rule and an opaque reference; the
 * full paths go to a private diagnostics file in the run temp folder. The T4 and T9 cases are in their own files.
 */
import { readdirSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { ENV, fakeCloudflare } from "./fake-cloudflare.ts";
import { captureConsole, diagnosticsOf, expectReportedPrivately, fakeIo, keyedRef, unkeyedRef } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, minimalSite } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

// Built at run time, so no address literal sits in this file (the CI email scan reads every tracked line).
const at = (local: string, domain: string): string => [local, domain].join("@");

/** Synthetic names shaped like the ones S2-10 is about. */
const EMAIL_NAME = `exports/${at("order-0001-someone", "example.com")}.json`;
const ORDER_NAME = "bags/SYN-ORDER-123456.html";

describe("rejected file names stay out of the public output (S2-10)", () => {
  test.each(["check", "deploy"] as const)(
    "%s: names shaped like an email or an order reference are not printed",
    async (command) => {
      const site = minimalSite({ [EMAIL_NAME]: "{}", [ORDER_NAME]: "<!doctype html>" });
      temps.push(site);
      const cf = fakeCloudflare({ previous: { bindings: [] } });
      const fake = fakeIo({ env: ENV, spawn: cf.spawn, fetch: cf.fetch });
      const { value: code, output } = await captureConsole(() => main([command, site.root], fake.io));
      const all = `${fake.lines.join("\n")}\n${output}`;
      expect(code).toBe(1);
      expect(fake.spawned).toEqual([]);
      expectReportedPrivately(fake, all, EMAIL_NAME, "no-matching-row", site.root);
      expectReportedPrivately(fake, all, ORDER_NAME, "no-matching-row", site.root);
      expect(all).not.toContain(at("someone", "example.com"));
      expect(all).not.toContain("SYN-ORDER-123456");
    },
  );

  test("a name holding a newline cannot add a line to the diagnostics file", async () => {
    const name = "line\nbreak.html";
    const site = minimalSite({ [name]: "<!doctype html>" });
    temps.push(site);
    const fake = fakeIo();
    expect(await main(["check", site.root], fake.io)).toBe(1);
    expectReportedPrivately(fake, fake.lines.join("\n"), name, "no-matching-row", site.root);
  });

  test("two runs over the same path give different references: each run has its own random key, never printed", async () => {
    const name = "exports/SYN-ORDER-0001.json";
    const site = minimalSite({ [name]: "{}" });
    temps.push(site);
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const fake = fakeIo();
      const { value: code, output } = await captureConsole(() => main(["check", site.root], fake.io));
      expect(code).toBe(1);
      const all = `${fake.lines.join("\n")}\n${output}`;
      expectReportedPrivately(fake, all, name, "no-matching-row", site.root);
      const { key } = diagnosticsOf(fake);
      expect(all).not.toContain(key);
      expect(all).not.toContain(unkeyedRef(name));
      runs.push({ key, ref: keyedRef(key, name) });
    }
    expect(runs[0]?.key).not.toBe(runs[1]?.key);
    expect(runs[0]?.ref).not.toBe(runs[1]?.ref);
  });

  test("the gate's own fixed names are still printed as they are (positive control)", async () => {
    const site = minimalSite({ _headers: MINIMAL_HEADERS.replace("nosniff", "sniff") });
    temps.push(site);
    const fake = fakeIo();
    expect(await main(["check", site.root], fake.io)).toBe(1);
    expect(fake.lines).toContain('headers-weak: "_headers"');
  });

  test("a clean run writes no diagnostics file (positive control)", async () => {
    const site = minimalSite();
    temps.push(site);
    const fake = fakeIo();
    const folders = () => readdirSync(fake.io.tempDir ?? "").filter((n) => n.startsWith("cj-gate-diagnostics-"));
    const before = folders();
    expect(await main(["check", site.root], fake.io)).toBe(0);
    expect(folders()).toEqual(before);
    expect(fake.lines.some((l) => l.includes("diagnostics"))).toBe(false);
  });
});
