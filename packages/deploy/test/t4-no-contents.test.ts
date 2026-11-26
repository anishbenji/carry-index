/**
 * T4: no file contents in output (privacy-wall design v2, crossing E: CI logs are public). Each rejected file holds
 * a sentinel; nothing the gate prints, through `io.log` or straight to the console, may contain it.
 */
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { captureConsole, expectReportedPrivately, fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function sentinel(): string {
  return `S3NT1NEL${randomUUID().replaceAll("-", "")}`;
}

describe("T4 no file contents in output", () => {
  test("T4 rejected files are reported by rule and an opaque reference, and none of their names or contents reach the output", async () => {
    const secret = sentinel();
    const site = minimalSite({
      ".dev.vars": `API_TOKEN=${secret}\n`,
      "notes.md": `${secret}\n`,
      // A failed content check must not quote what it found.
      "x.html": `${secret} is not a doctype`,
      // JSON.parse's own error message quotes the input: printing it would leak.
      "data/fit/x.json": `{"note": ${secret}`,
    });
    temps.push(site);
    const fake = fakeIo();
    const { value: code, output } = await captureConsole(() => main(["check", site.root], fake.io));
    const all = `${fake.lines.join("\n")}\n${output}`;
    expect(code).not.toBe(0);
    expectReportedPrivately(fake, all, ".dev.vars", "no-matching-row", site.root);
    expectReportedPrivately(fake, all, "notes.md", "no-matching-row", site.root);
    expectReportedPrivately(fake, all, "x.html", "bad-content", site.root);
    expectReportedPrivately(fake, all, "data/fit/x.json", "bad-content", site.root);
    expect(all).not.toContain(secret);
    expect(fake.spawned).toEqual([]);
    expect(fake.fetched).toEqual([]);
  });

  test("T4 a canary hit is reported by rule and an opaque reference, and the line around the marker is not printed", async () => {
    const secret = sentinel();
    const site = minimalSite({
      "bags/example-pack-30.html": `<!doctype html><p>private note ${secret} CJ-CANARY-${secret}</p>`,
    });
    temps.push(site);
    const fake = fakeIo();
    const { value: code, output } = await captureConsole(() => main(["check", site.root], fake.io));
    const all = `${fake.lines.join("\n")}\n${output}`;
    expect(code).not.toBe(0);
    expectReportedPrivately(fake, all, "bags/example-pack-30.html", "canary", site.root);
    expect(all).not.toContain(secret);
  });
});
