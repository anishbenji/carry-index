/**
 * Security round 3, S3-2: the graph report was read to EOF before its size cap applied, so a report that grows after
 * the `fstat` could be read without bound. `readUpTo` reads into a buffer of at most the cap plus one byte and
 * refuses the file once that buffer fills.
 */
import { describe, expect, test } from "vitest";
import { MAX_REPORT_BYTES, readUpTo } from "../src/graph-check.ts";

describe("the graph report is read with a bound (S3-2)", () => {
  test("a file that never ends is refused after at most the cap plus one byte", () => {
    let requested = 0;
    const endless = (_fd: number, buffer: Uint8Array, offset: number, length: number): number => {
      requested += length;
      buffer.fill(0x20, offset, offset + length);
      return length;
    };
    expect(readUpTo(-1, 1024, endless)).toBeUndefined();
    expect(requested).toBeLessThanOrEqual(1025);
  });

  test("a file of exactly the cap is read in full; one byte more is refused", () => {
    const source = (size: number) => {
      let left = size;
      return (_fd: number, buffer: Uint8Array, offset: number, length: number): number => {
        const n = Math.min(left, length, 7);
        buffer.fill(0x61, offset, offset + n);
        left -= n;
        return n;
      };
    };
    expect(readUpTo(-1, 64, source(64))?.length).toBe(64);
    expect(readUpTo(-1, 64, source(65))).toBeUndefined();
  });

  test("the cap stays 8 MiB", () => {
    expect(MAX_REPORT_BYTES).toBe(8 * 1024 * 1024);
  });
});
