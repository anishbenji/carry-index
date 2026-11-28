/**
 * Sol security r3, S5-4 and S5-6, on `_headers`.
 * - S5-4: Cloudflare substitutes a rule's placeholders (`:name`) and splat (`:splat`) into its header values
 *   (developers.cloudflare.com/workers/static-assets/headers/#splats). A catch-all rule whose CSP names `:splat` as a
 *   script source gets the visitor's path there, for the custom 404 too. Any placeholder in a required header value
 *   is `headers-invalid`.
 * - S5-6: Chromium rejects a whole HSTS header with `includeSubDomains=<value>`. `includeSubDomains` and `preload`
 *   must have no value, and an extension directive's value must be a token or a quoted string.
 */
import { afterEach, describe, expect, test } from "vitest";
import { checkHeaders } from "../src/headers.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

function headersIn(content: string): ReturnType<typeof checkHeaders> {
  const dir = tempDir("cj-headers-");
  temps.push(dir);
  writeTree(dir.root, { _headers: content });
  return checkHeaders(dir.root, { requireFile: true });
}

const INVALID = { path: "_headers", rule: "headers-invalid" };

describe("no substitution in required header values (S5-4)", () => {
  test.each([
    [
      "the root CSP names the splat as a script source",
      MINIMAL_HEADERS.replace("script-src 'self'", "script-src 'self' :splat"),
    ],
    [
      "a placeholder rule's CSP names its placeholder",
      `${MINIMAL_HEADERS}\n/bags/:slug\n  Content-Security-Policy: default-src 'self'; script-src :slug; frame-ancestors 'none'\n`,
    ],
    [
      "a placeholder inside a source",
      MINIMAL_HEADERS.replace("img-src 'self'", "img-src 'self' https://:host.example"),
    ],
    ["a placeholder in Referrer-Policy", MINIMAL_HEADERS.replace("strict-origin-when-cross-origin", ":policy")],
  ])("%s is headers-invalid", (_name, content) => {
    expect(headersIn(content)).toContainEqual(INVALID);
  });

  test("schemes, ports and hashes are not placeholders (positive control)", () => {
    const content = MINIMAL_HEADERS.replace(
      "connect-src 'self'",
      "connect-src 'self' https://api.example.com:8443 wss://ws.example.com",
    );
    expect(headersIn(content)).toEqual([]);
  });

  test("a placeholder in a header that is not a security header still passes (positive control)", () => {
    expect(headersIn(`${MINIMAL_HEADERS}\n/bags/:slug\n  Link: </bags/:slug>; rel=canonical\n`)).toEqual([]);
  });
});

describe("HSTS directives are valueless where the standard says so (S5-6)", () => {
  const HSTS = "max-age=31536000; includeSubDomains";
  const withHsts = (value: string): string => MINIMAL_HEADERS.replace(HSTS, value);
  const WEAK = [{ path: "_headers", rule: "headers-weak" }];

  test.each([
    ["includeSubDomains with a boolean value", "max-age=31536000; includeSubDomains=true"],
    ["includeSubDomains with an empty value", "max-age=31536000; includeSubDomains="],
    ["preload with a value", "max-age=31536000; preload=1"],
    ["an extension directive whose value is not a token or quoted string", "max-age=31536000; ext=a b"],
    ["an extension directive with an unterminated quoted string", 'max-age=31536000; ext="abc'],
  ])("%s is headers-weak", (_name, value) => {
    expect(headersIn(withHsts(value))).toEqual(WEAK);
  });

  test.each([
    ["an extension directive with a token value", "max-age=31536000; includeSubDomains; ext=token-1"],
    ["an extension directive with a quoted value", 'max-age=31536000; ext="quoted value"'],
    ["a valueless extension directive", "max-age=31536000; ext"],
  ])("%s passes (positive control)", (_name, value) => {
    expect(headersIn(withHsts(value))).toEqual([]);
  });
});
