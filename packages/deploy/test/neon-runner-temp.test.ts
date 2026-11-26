/**
 * Independent review (Neon) N6: with `RUNNER_TEMP` set to an empty string, `resolve("")` is the working folder (the
 * checkout), so the private diagnostics file landed inside it. An empty or blank `io.tempDir` or `RUNNER_TEMP` now
 * counts as unset, and the system temp folder is used.
 */
import { realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, sep } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { minimalSite, REPO_ROOT } from "./helpers.ts";

const temps: TempDir[] = [];
const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const t of temps.splice(0)) t.cleanup();
});

const inside = (path: string, dir: string): boolean => {
  const rel = relative(realpathSync(dir), realpathSync(path));
  return rel === "" || !(rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith(sep));
};

describe("an empty run temp folder setting falls back to the system temp folder (N6)", () => {
  test.each([
    ["RUNNER_TEMP is empty", { RUNNER_TEMP: "" }, undefined],
    ["RUNNER_TEMP is blank", { RUNNER_TEMP: "   " }, undefined],
    ["io.tempDir is empty", {}, ""],
    ["io.tempDir is blank and RUNNER_TEMP is empty", { RUNNER_TEMP: "" }, " "],
  ])("%s: the diagnostics file is in the system temp folder, not the checkout", async (_name, env, tempDir) => {
    const site = minimalSite({ "notes.md": "synthetic\n" });
    temps.push(site);
    const fake = fakeIo({ env });
    if (tempDir === undefined) delete fake.io.tempDir;
    else fake.io.tempDir = tempDir;
    expect(await main(["check", site.root], fake.io)).toBe(1);
    const file = fake.lines
      .map((l) => /^gate: full paths for the #references above are in (\S+) /.exec(l)?.[1])
      .find((p) => p !== undefined);
    expect(file).toBeDefined();
    made.push(dirname(file ?? ""));
    expect(inside(file ?? "", tmpdir())).toBe(true);
    expect(inside(file ?? "", REPO_ROOT)).toBe(false);
    expect(inside(file ?? "", process.cwd())).toBe(false);
  });
});
