/** T7, added for security review r2 (P3): Cloudflare API calls time out. No real waits: the timer is injected. */
import { describe, expect, test } from "vitest";
import type { Fetch } from "../src/check3.ts";
import { checkLive, withTimeout } from "../src/check3.ts";
import { PUBLIC_SITE } from "../src/workers.ts";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const TOKEN = "synthetic-token";

describe("T7 API calls time out (security review r2, P3)", () => {
  test("T7 withTimeout aborts a fetch that never answers when the injected timer fires, and the live check fails closed", async () => {
    let fire: (() => void) | undefined;
    let aborted = false;
    const hanging: Fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        });
      });
    const timed = withTimeout(hanging, 30_000, (callback, ms) => {
      expect(ms).toBe(30_000);
      fire = callback;
      return () => undefined;
    });
    const pending = checkLive(PUBLIC_SITE, { accountId: ACCOUNT, apiToken: TOKEN, fetch: timed });
    await Promise.resolve();
    fire?.();
    expect(await pending).toEqual({ ok: false, problems: [{ path: "carry-journal", rule: "live-api-error" }] });
    expect(aborted).toBe(true);
  });

  test("T7 withTimeout rejects even when the fetch ignores the abort signal", async () => {
    let fire: (() => void) | undefined;
    const deaf: Fetch = () => new Promise(() => undefined);
    const timed = withTimeout(deaf, 30_000, (callback) => {
      fire = callback;
      return () => undefined;
    });
    const pending = timed("https://api.cloudflare.com/client/v4/x", { method: "GET", headers: {} });
    fire?.();
    await expect(pending).rejects.toThrow(/timed out/);
  });

  test("T7 withTimeout passes a reply through and cancels its timer", async () => {
    let cancelled = false;
    const timed = withTimeout(
      async () => ({ status: 200, text: async () => "{}" }),
      30_000,
      () => () => {
        cancelled = true;
      },
    );
    const reply = await timed("https://api.cloudflare.com/client/v4/x", { method: "GET", headers: {} });
    expect(reply.status).toBe(200);
    expect(cancelled).toBe(true);
  });
});
