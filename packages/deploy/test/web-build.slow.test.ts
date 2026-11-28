/**
 * [slow] The real apps/web build passes the gate: it runs the app's own pinned Vite into a temp folder (never the
 * checkout's dist/), then requires `_headers` in the output, `checkHeaders` clean, and the gate's `check` exit 0.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { checkHeaders } from "../src/headers.ts";
import { fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { REPO_ROOT, tempDir } from "./helpers.ts";

const WEB = join(REPO_ROOT, "apps", "web");
const VITE = join(WEB, "node_modules", ".bin", "vite");

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

describe("[slow] the apps/web build passes the gate", () => {
  test("[slow] the built output holds _headers, which passes every header rule, and the gate's check passes", {
    timeout: 120_000,
  }, async () => {
    const out = tempDir("cj-web-build-");
    temps.push(out);
    execFileSync(VITE, ["build", "--outDir", out.root, "--emptyOutDir", "--logLevel", "error"], {
      cwd: WEB,
      encoding: "utf8",
    });
    expect(existsSync(join(out.root, "_headers"))).toBe(true);
    expect(checkHeaders(out.root, { requireFile: true })).toEqual([]);
    const fake = fakeIo();
    expect(await main(["check", out.root], fake.io)).toBe(0);
    expect(fake.spawned).toEqual([]);
    expect(fake.fetched).toEqual([]);
  });
});
