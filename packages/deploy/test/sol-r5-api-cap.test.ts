/**
 * Sol security r3, S5-9: Cloudflare API replies had a deadline but no byte limit, so a large reply was buffered
 * whole by `text()`, which could end the process after a promotion before it confirmed the live Worker. Replies are
 * now read from the body stream with a cap on the decoded bytes (1 MiB); the body is cancelled once over it, and the
 * reply is a `live-api-error`.
 */
import { describe, expect, test } from "vitest";
import type { Fetch } from "../src/check3.ts";
import { checkLive, MAX_API_REPLY_BYTES, readCapped, withTimeout } from "../src/check3.ts";
import { PUBLIC_SITE } from "../src/workers.ts";
import { ACCOUNT, TOKEN } from "./fake-cloudflare.ts";

/** A body that yields `chunks` chunks of `size` bytes, recording reads and whether it was cancelled. */
function body(chunks: number, size: number) {
  const state = { read: 0, cancelled: false };
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= chunks) return controller.close();
      sent++;
      state.read += size;
      controller.enqueue(new Uint8Array(size).fill(0x20));
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { stream, state };
}

const neverText = async (): Promise<string> => {
  throw new Error("text() must not be called when the body can be streamed");
};

describe("API replies are read with a byte cap (S5-9)", () => {
  test("the cap is 1 MiB", () => {
    expect(MAX_API_REPLY_BYTES).toBe(1024 * 1024);
  });

  test("a body over the cap is refused, cancelled, and read no further than one chunk past the cap", async () => {
    const chunk = 64 * 1024;
    const { stream, state } = body(1000, chunk);
    await expect(readCapped({ body: stream, text: neverText }, MAX_API_REPLY_BYTES)).rejects.toThrow(/cap/);
    expect(state.cancelled).toBe(true);
    expect(state.read).toBeLessThanOrEqual(MAX_API_REPLY_BYTES + chunk);
  });

  test("a body of exactly the cap is read in full (positive control)", async () => {
    const { stream } = body(16, 64 * 1024);
    expect((await readCapped({ body: stream, text: neverText }, MAX_API_REPLY_BYTES)).length).toBe(MAX_API_REPLY_BYTES);
  });

  test("a reply with no body stream is capped on its text too", async () => {
    const big = " ".repeat(MAX_API_REPLY_BYTES + 1);
    await expect(readCapped({ text: async () => big }, MAX_API_REPLY_BYTES)).rejects.toThrow(/cap/);
  });

  test("the live check reports an oversized settings reply as live-api-error", async () => {
    // text() would give a clean reply: only reading the oversized body stream can fail this.
    const clean = JSON.stringify({ success: true, errors: [], messages: [], result: { bindings: [] } });
    const fetch: Fetch = async () => ({ status: 200, body: body(40, 64 * 1024).stream, text: async () => clean });
    const result = await checkLive(PUBLIC_SITE, { accountId: ACCOUNT, apiToken: TOKEN, fetch });
    expect(result.problems.map((p) => p.rule)).toEqual(["live-api-error"]);
  });

  test("withTimeout keeps the cap: its text() refuses an oversized body", async () => {
    const { stream, state } = body(40, 64 * 1024);
    const wrapped = withTimeout(async () => ({ status: 200, body: stream, text: neverText }), 30_000);
    const reply = await wrapped("https://api.cloudflare.com/client/v4/x", { method: "GET", headers: {} });
    await expect(reply.text()).rejects.toThrow(/cap/);
    expect(state.cancelled).toBe(true);
  });
});
