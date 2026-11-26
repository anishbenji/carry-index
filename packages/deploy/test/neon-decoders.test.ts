/**
 * Independent review (Neon) N3: HTML numeric references and JavaScript `\u{...}` escapes may carry any number of
 * leading zeros (WHATWG HTML 13.2.5.73-78, ECMA-262 12.9.4), but the scan's decoders capped the digit count, so
 * `&#00000064;` passed as text while a browser rendered `@`. The decoders now allow leading zeros. The reviewer's
 * three lines are the cases.
 */
import { afterEach, describe, expect, test } from "vitest";
import { CANARY_MARKER, scanBundle } from "../src/canary.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function scan(files: Record<string, string>) {
  const dir = tempDir("cj-neon-decoders-");
  temps.push(dir);
  writeTree(dir.root, { _headers: MINIMAL_HEADERS, ...files });
  return scanBundle(dir.root);
}

/** The canary marker with its hyphen written as `entity`. */
const canaryWith = (entity: string): string => `${CANARY_MARKER.replace("-", entity)}0001`;

describe("leading zeros in numeric references and escapes (N3)", () => {
  test.each([
    [
      "a decimal reference with leading zeros",
      "about.html",
      "<!doctype html><p>user&#00000064;example.com</p>",
      "email",
    ],
    [
      "a hex reference with leading zeros",
      "about.html",
      `<!doctype html><p>${canaryWith("&#x000002d;")}</p>`,
      "canary",
    ],
    [
      "a \\u{...} escape with leading zeros",
      "assets/app-AbCdEfGh.js",
      'const a = "user\\u{0000040}example.com";\n',
      "email",
    ],
  ])("%s is decoded and found", async (_name, path, content, rule) => {
    expect(await scan({ [path]: content })).toEqual([{ path, rule }]);
  });

  test("the same text without leading zeros is still found (control)", async () => {
    expect(await scan({ "about.html": "<!doctype html><p>user&#64;example.com</p>" })).toEqual([
      { path: "about.html", rule: "email" },
    ]);
  });
});
