/** T5, added for security review r2 (P3): a hanging Wrangler child is killed. No real waits: the timer is injected. */
import { describe, expect, test } from "vitest";
import { spawnProcess } from "../src/runner.ts";

describe("T5 a Wrangler child that hangs is killed (security review r2, P3)", () => {
  test("T5 spawnProcess kills the child when the injected timer fires and returns a non-zero exit", async () => {
    let fire: (() => void) | undefined;
    const pending = spawnProcess(
      { argv: ["/bin/sleep", "30"], cwd: "/", env: { PATH: "/usr/bin:/bin" } },
      {
        timeoutMs: 600_000,
        setTimer: (callback, ms) => {
          expect(ms).toBe(600_000);
          fire = callback;
          return () => undefined;
        },
      },
    );
    fire?.();
    const result = await pending;
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/timed out/);
  });

  test("T5 spawnProcess returns a finished child's real exit code and cancels its timer (positive control)", async () => {
    let cancelled = false;
    const result = await spawnProcess(
      { argv: ["/bin/sh", "-c", "exit 3"], cwd: "/", env: { PATH: "/usr/bin:/bin" } },
      {
        setTimer: () => () => {
          cancelled = true;
        },
      },
    );
    expect(result.exitCode).toBe(3);
    expect(cancelled).toBe(true);
  });
});
