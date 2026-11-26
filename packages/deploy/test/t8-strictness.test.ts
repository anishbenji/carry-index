/**
 * T8, added for GPT-6.2 Sol security round 1: object or array fallbacks (`.default()`, `.catch()`) skip parsing
 * and could carry keys the shape never declares (P2), and a string-keyed record has no list of keys to check
 * against the never-public names (P1, CI review). Both fail check 1.
 */
import * as catalogue from "@cj/schema";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { strictnessProblems } from "../src/surface.ts";

const inner = z.strictObject({ a: z.string() });
const leaky = { a: "x", pricePaid: 1 } as { a: string };

describe("T8 check 1: fallbacks and open records", () => {
  test("T8 the catalogue schemas have no unsafe fallback and no open record (positive control)", () => {
    expect(strictnessProblems(catalogue)).toEqual([]);
  });

  test.each([
    ["an object .default()", z.object({ o: inner.default(leaky) }), "sample.o"],
    ["an object .catch()", z.object({ o: inner.catch(leaky) }), "sample.o"],
    ["an array .default() with items", z.object({ l: z.array(inner).default([leaky]) }), "sample.l"],
    ["a nested object .default()", z.object({ x: z.object({ o: inner.default(leaky) }) }), "sample.x.o"],
  ])("T8 %s is refused as unsafe-default", (_name, sample, path) => {
    expect(strictnessProblems({ sample })).toEqual([{ path, rule: "unsafe-default" }]);
  });

  test("T8 scalar defaults, an empty array default and .prefault() are accepted (positive control)", () => {
    const sample = z.object({
      n: z.number().default(3),
      s: z.string().catch("x"),
      l: z.array(z.string()).default([]),
      o: inner.prefault({ a: "x" }),
    });
    expect(strictnessProblems({ sample })).toEqual([]);
  });

  test.each([
    ["a string-keyed record", z.object({ m: z.record(z.string(), inner) }), "sample.m"],
    ["a pattern-keyed record", z.object({ m: z.record(z.string().regex(/^q/), inner) }), "sample.m"],
    [
      "a record keyed by a literal or a pattern",
      z.object({ m: z.record(z.union([z.literal("x"), z.string().regex(/^q/)]), inner) }),
      "sample.m",
    ],
  ])("T8 %s is refused as open-record", (_name, sample, path) => {
    expect(strictnessProblems({ sample })).toEqual([{ path, rule: "open-record" }]);
  });

  test("T8 an enum-keyed record lists its keys and is accepted (positive control)", () => {
    const sample = z.object({ m: z.record(z.enum(["x", "y"]), inner) });
    expect(strictnessProblems({ sample })).toEqual([]);
  });
});
