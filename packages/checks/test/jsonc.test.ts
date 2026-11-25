import { describe, expect, it } from "vitest";
import { parseJsonc } from "../src/jsonc.ts";

describe("parseJsonc", () => {
  it("parses plain JSON", () => {
    expect(parseJsonc('{"a": 1}')).toEqual({ a: 1 });
  });

  it("drops line and block comments and trailing commas", () => {
    const text = `{
      // line comment
      "name": "web", /* block
      comment */
      "list": [1, 2,],
    }`;
    expect(parseJsonc(text)).toEqual({ name: "web", list: [1, 2] });
  });

  it("keeps comment markers and commas that sit inside strings", () => {
    const text = '{"url": "https://example.com/a//b", "s": "/* x */", "t": "a,}", "q": "say \\"hi\\" // no"}';
    expect(parseJsonc(text)).toEqual({
      url: "https://example.com/a//b",
      s: "/* x */",
      t: "a,}",
      q: 'say "hi" // no',
    });
  });

  it("throws on malformed input instead of guessing", () => {
    expect(() => parseJsonc('{"a": }')).toThrow();
    expect(() => parseJsonc('{"a": 1 /* unterminated')).toThrow();
  });
});
