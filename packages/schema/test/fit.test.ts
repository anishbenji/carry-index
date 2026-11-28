import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import type { Fit } from "../src/index.ts";
import { fitSchema } from "../src/index.ts";

/** Synthetic, in the shape of a build's `data/fit/<slug>.json`. */
const sample = {
  slug: "example-pack-30",
  airlines: [
    { name: "Example Air", regions: ["Europe"], checked: "2026-11-15" },
    { name: "Sample Airways", regions: ["Asia", "Oceania"], checked: null },
  ],
  variants: [{ id: "example-pack-30-ultra", name: "Example Pack 30 Ultra", marks: "yn" }],
};

describe("fitSchema", () => {
  it("accepts a well-formed fit file and returns it unchanged", () => {
    expect(fitSchema.parse(sample)).toEqual(sample);
  });

  it.each([
    ["at the top level", { ...sample, pricePaid: 1 }],
    ["on an airline", { ...sample, airlines: [{ ...sample.airlines[0], orderReference: "x" }] }],
    ["on a variant", { ...sample, variants: [{ ...sample.variants[0], purchasedFrom: "x" }] }],
  ])("rejects an unknown key %s", (_where, value) => {
    expect(fitSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["a checked date that is not an ISO date", { name: "Example Air", regions: ["Europe"], checked: "15/11/2026" }],
    ["a region outside the list", { name: "Example Air", regions: ["Atlantis"], checked: null }],
    ["no region", { name: "Example Air", regions: [], checked: null }],
    ["an empty airline name", { name: "", regions: ["Europe"], checked: null }],
    ["an airline name over 100 characters", { name: "x".repeat(101), regions: ["Europe"], checked: null }],
  ])("rejects %s", (_name, airline) => {
    expect(fitSchema.safeParse({ ...sample, airlines: [airline] }).success).toBe(false);
  });

  it("rejects a slug that is not lowercase kebab-case, and marks other than y, n and u", () => {
    expect(fitSchema.safeParse({ ...sample, slug: "Example Pack" }).success).toBe(false);
    expect(fitSchema.safeParse({ ...sample, variants: [{ ...sample.variants[0], marks: "yx" }] }).success).toBe(false);
  });

  it("bounds the lists", () => {
    const airline = sample.airlines[0];
    expect(fitSchema.safeParse({ ...sample, airlines: Array(1001).fill(airline) }).success).toBe(false);
    expect(fitSchema.safeParse({ ...sample, variants: Array(51).fill(sample.variants[0]) }).success).toBe(false);
  });

  it("its output JSON Schema is closed at every level and matches this snapshot", () => {
    expect(z.toJSONSchema(fitSchema, { io: "output" })).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        slug: { type: "string", minLength: 1, maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        airlines: {
          type: "array",
          maxItems: 1000,
          items: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 1, maxLength: 100 },
              regions: {
                type: "array",
                minItems: 1,
                maxItems: 7,
                items: {
                  type: "string",
                  enum: ["Africa", "Asia", "Europe", "Middle East", "North America", "Oceania", "South America"],
                },
              },
              checked: {
                anyOf: [
                  {
                    type: "string",
                    format: "date",
                    pattern:
                      "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$",
                  },
                  { type: "null" },
                ],
              },
            },
            required: ["name", "regions", "checked"],
            additionalProperties: false,
          },
        },
        variants: {
          type: "array",
          maxItems: 50,
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1, maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
              name: { type: "string", minLength: 1, maxLength: 200 },
              marks: { type: "string", maxLength: 1000, pattern: "^[ynu]*$" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["slug"],
      additionalProperties: false,
    });
  });

  it("infers the Fit type from the schema", () => {
    expectTypeOf<Fit["slug"]>().toEqualTypeOf<string>();
  });
});
