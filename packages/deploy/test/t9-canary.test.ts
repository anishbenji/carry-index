/**
 * T9: check 2, the canary (privacy-wall design v2, section 5). `CJ-PUBLIC-` marks what the site renders and must
 * appear in a fixture build; `CJ-CANARY-` marks what must never ship and must not appear in any encoding. The
 * fixture build is generated at test time and is synthetic.
 */
import { afterEach, describe, expect, test } from "vitest";
import { CANARY_MARKER, PUBLIC_MARKER, scanBundle } from "../src/canary.ts";
import { main } from "../src/cli.ts";
import { checkHeaders } from "../src/headers.ts";
import { expectReportedPrivately, fakeIo } from "./gate-io.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_HEADERS, PR8_EXTERNAL, PR8_INLINE, tempDir, writeTree } from "./helpers.ts";

// Built at run time, so no address literal sits in this file (the CI email scan reads every tracked line).
const at = (local: string, domain: string): string => [local, domain].join("@");

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

/** A fixture build: the public marker in rendered fields, as the real build on a fixture data root would emit. */
function fixtureBuild(extra: Record<string, string> = {}): TempDir {
  const dir = tempDir("cj-fixture-build-");
  temps.push(dir);
  writeTree(dir.root, {
    "404.html": "<!doctype html><title>Not found</title>",
    _headers: MINIMAL_HEADERS,
    "uhmwpe-backpacks.html": `<!doctype html><title>Listing</title><li data-key="example">${PUBLIC_MARKER}MODEL-LABEL</li>`,
    "bags/example-pack-30.html": `<!doctype html><h1>${PUBLIC_MARKER}MODEL-LABEL</h1><p>${PUBLIC_MARKER}VARIANT-NAME</p>`,
    "data/fit/example-pack-30.json": JSON.stringify({
      slug: "example-pack-30",
      variants: [{ name: `${PUBLIC_MARKER}VARIANT-NAME` }],
    }),
    ...extra,
  });
  return dir;
}

const htmlEntities = (text: string, hex: boolean): string =>
  [...text].map((c) => (hex ? `&#x${c.charCodeAt(0).toString(16)};` : `&#${c.charCodeAt(0)};`)).join("");
const jsonEscaped = (text: string): string =>
  [...text].map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
const percentEncoded = (text: string): string =>
  [...text].map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`).join("");

describe("T9 check 2: the canary", () => {
  test("T9 a fixture build with the public marker in rendered fields and no canary passes, public marker required", async () => {
    expect([CANARY_MARKER, PUBLIC_MARKER]).toEqual(["CJ-CANARY-", "CJ-PUBLIC-"]);
    expect(await scanBundle(fixtureBuild().root, { requirePublicMarker: true })).toEqual([]);
  });

  test("T9 a fixture build missing the public marker fails, so a build that rendered nothing cannot pass", async () => {
    const dir = tempDir("cj-fixture-build-");
    temps.push(dir);
    writeTree(dir.root, { "404.html": "<!doctype html><title>Not found</title>" });
    expect(await scanBundle(dir.root, { requirePublicMarker: true })).toEqual([
      { path: ".", rule: "public-marker-missing" },
    ]);
  });

  const canary = `${CANARY_MARKER}0001-PRIVATE-NOTE`;
  test.each([
    ["plain", "bags/example-pack-30.html", `<!doctype html><p>${canary}</p>`],
    ["JSON-escaped", "data/fit/example-pack-30.json", `{"note":"${jsonEscaped(canary)}"}`],
    ["URL-encoded", "uhmwpe-backpacks.html", `<!doctype html><a href="/search?q=${percentEncoded(canary)}">x</a>`],
    [
      "URL-encoded, hyphens only",
      "uhmwpe-backpacks.html",
      `<!doctype html><a href="/q?n=${canary.replaceAll("-", "%2D")}">x</a>`,
    ],
    ["HTML decimal entities", "bags/example-pack-30.html", `<!doctype html><p>${htmlEntities(canary, false)}</p>`],
    ["HTML hex entities", "bags/example-pack-30.html", `<!doctype html><p>${htmlEntities(canary, true)}</p>`],
    ["base64, aligned", "404.html", `<!doctype html><img src="data:text/plain;base64,${btoa(canary)}">`],
    ["base64, offset 1", "404.html", `<!doctype html><img src="data:text/plain;base64,${btoa(`x${canary}`)}">`],
    ["base64, offset 2", "404.html", `<!doctype html><img src="data:text/plain;base64,${btoa(`xy${canary}`)}">`],
  ])(
    "T9 a canary planted %s in a fixture build fails with rule canary, naming the file",
    async (_form, path, content) => {
      const build = fixtureBuild({ [path]: content });
      expect(await scanBundle(build.root, { requirePublicMarker: true })).toEqual([{ path, rule: "canary" }]);
    },
  );

  test.each([
    ["inline", PR8_INLINE],
    ["external", PR8_EXTERNAL],
  ])(
    "T9 PR 8's real static output (%s) has no canary, email or local-path hit (no false positives)",
    async (_name, dir) => {
      expect(await scanBundle(dir)).toEqual([]);
    },
  );

  test.each([
    [
      "an email address",
      "bags/example-pack-30.html",
      `<!doctype html><p>write to ${at("someone", "example.com")}</p>`,
      "email",
    ],
    [
      "a macOS home path",
      "data/fit/example-pack-30.json",
      '{"src":"/Users/someone/code/carry-index/data"}',
      "local-path",
    ],
    ["a Linux home or CI path", "404.html", "<!doctype html><!-- /home/runner/work/carry-index -->", "local-path"],
    ["a Windows home path", "404.html", "<!doctype html><p>C:\\Users\\someone\\carry-index</p>", "local-path"],
  ])("T9 %s in a bundle fails the heuristic scan, naming the file", async (_name, path, content, rule) => {
    const build = fixtureBuild({ [path]: content });
    expect(await scanBundle(build.root)).toEqual([{ path, rule }]);
  });

  test("T9 a canary planted in a bundle fails the gate, which reports the rule and an opaque reference", async () => {
    const build = fixtureBuild({ "bags/example-pack-30.html": `<!doctype html><p>${canary}</p>` });
    const fake = fakeIo();
    const code = await main(["check", build.root], fake.io);
    expect(code).not.toBe(0);
    expectReportedPrivately(fake, fake.lines.join("\n"), "bags/example-pack-30.html", "canary", build.root);
  });

  test("T9 the clean fixture build passes the gate's check (positive control)", async () => {
    const fake = fakeIo();
    expect(await main(["check", fixtureBuild().root], fake.io)).toBe(0);
  });

  test.todo(
    "T9 the real build run on a fixture data root renders CJ-PUBLIC- and strips every CJ-CANARY- key (needs PR 8's build with a data-root parameter)",
  );
  test.todo("T9 the gate scans tracked files under data/ for the canary");
  test.todo(
    "T9 Kit minimum: the seed generator puts a unique marker in every private field; a field with no marker fails",
  );
  test.todo("T9 Kit minimum: the Kit Worker has no export or publish route");
});

describe("T9 check 2: the heuristic scan stays linear (security review r1, P3)", () => {
  test("T9 a 400 KB run of address characters, with and without an @, is scanned in seconds and reports nothing", {
    timeout: 5_000,
  }, async () => {
    const build = fixtureBuild({
      "assets/blob-AbCdEfGh.js": `export const a="${"a".repeat(400_000)}";`,
      "assets/blob-IjKlMnOp.js": `export const b="${"a".repeat(200_000)}@${"a.".repeat(100_000)}1";`,
    });
    expect(await scanBundle(build.root)).toEqual([]);
  });
});

describe("T9 check 2: the security headers in _headers (security review r2, P2)", () => {
  const GOOD = [
    "/*",
    "  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-AAAA'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(), geolocation=(), microphone=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-origin",
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
  const without = (name: string): string =>
    GOOD.split("\n")
      .filter((l) => !l.trimStart().startsWith(`${name}:`))
      .join("\n");
  const replaced = (from: string, to: string): string => GOOD.replace(from, to);

  test.each([
    ["inline", PR8_INLINE],
    ["external", PR8_EXTERNAL],
  ])("T9 PR 8's real _headers (%s) passes the header check (positive control)", (_name, dir) => {
    expect(checkHeaders(dir)).toEqual([]);
  });

  test("T9 a synthetic complete _headers passes (positive control)", () => {
    const dir = tempDir("cj-headers-");
    temps.push(dir);
    writeTree(dir.root, { _headers: GOOD });
    expect(checkHeaders(dir.root)).toEqual([]);
  });

  test.each([
    ["Content-Security-Policy"],
    ["Strict-Transport-Security"],
    ["X-Content-Type-Options"],
    ["Referrer-Policy"],
    ["Permissions-Policy"],
    ["Cross-Origin-Opener-Policy"],
    ["Cross-Origin-Resource-Policy"],
  ])("T9 a /* block without %s fails with rule headers-missing", (name) => {
    const dir = tempDir("cj-headers-");
    temps.push(dir);
    writeTree(dir.root, { _headers: without(name) });
    expect(checkHeaders(dir.root)).toEqual([{ path: "_headers", rule: "headers-missing" }]);
  });

  test("T9 a _headers with no /* block fails with rule headers-missing", () => {
    const dir = tempDir("cj-headers-");
    temps.push(dir);
    writeTree(dir.root, { _headers: "/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n" });
    expect(checkHeaders(dir.root)).toEqual([{ path: "_headers", rule: "headers-missing" }]);
  });

  test.each([
    ["'unsafe-inline' in script-src", replaced("script-src 'self'", "script-src 'self' 'unsafe-inline'")],
    ["'unsafe-eval' in script-src", replaced("script-src 'self'", "script-src 'self' 'unsafe-eval'")],
    ["a * source", replaced("default-src 'self'", "default-src *")],
    ["no frame-ancestors", replaced("; frame-ancestors 'none'", "")],
    ["a weaker CSP in another block", `${GOOD}\n/bags/*\n  Content-Security-Policy: script-src 'unsafe-inline'\n`],
    ["a removed CSP for a sub-path", `${GOOD}\n/bags/*\n  ! Content-Security-Policy\n`],
    ["X-Content-Type-Options other than nosniff", replaced("nosniff", "sniff")],
    ["a short HSTS max-age", replaced("max-age=31536000; includeSubDomains", "max-age=60")],
    ["Referrer-Policy unsafe-url", replaced("strict-origin-when-cross-origin", "unsafe-url")],
  ])("T9 _headers with %s fails with rule headers-weak", (_name, content) => {
    const dir = tempDir("cj-headers-");
    temps.push(dir);
    writeTree(dir.root, { _headers: content });
    expect(checkHeaders(dir.root)).toEqual([{ path: "_headers", rule: "headers-weak" }]);
  });

  test("T9 the gate's check fails on a weak _headers and names the file and rule", async () => {
    const build = fixtureBuild({ _headers: replaced("script-src 'self'", "script-src 'self' 'unsafe-inline'") });
    const fake = fakeIo();
    expect(await main(["check", build.root], fake.io)).not.toBe(0);
    expect(fake.lines.some((l) => l.includes("_headers") && l.includes("headers-weak"))).toBe(true);
  });
});

describe("T9 check 2: a required _headers file", () => {
  test("T9 with requireFile, a site without _headers fails with rule headers-missing", () => {
    const dir = tempDir("cj-headers-");
    temps.push(dir);
    writeTree(dir.root, { "404.html": "<!doctype html><title>Not found</title>" });
    expect(checkHeaders(dir.root, { requireFile: true })).toEqual([{ path: "_headers", rule: "headers-missing" }]);
  });
});

describe("T9 check 2: the gate requires _headers", () => {
  test("T9 a site without _headers fails the gate's check with rule headers-missing", async () => {
    const dir = tempDir("cj-no-headers-");
    temps.push(dir);
    writeTree(dir.root, { "404.html": "<!doctype html><title>Not found</title>" });
    const fake = fakeIo();
    expect(await main(["check", dir.root], fake.io)).not.toBe(0);
    expect(fake.lines.some((l) => l.includes("_headers") && l.includes("headers-missing"))).toBe(true);
  });
});

describe("T9 check 2: a required header set twice is weak (CI security review, P2)", () => {
  const headersIn = (content: string): ReturnType<typeof checkHeaders> => {
    const dir = tempDir("cj-headers-");
    temps.push(dir);
    writeTree(dir.root, { _headers: content });
    return checkHeaders(dir.root);
  };

  test("T9 the reviewer's /bags/* block repeating COOP, CORP and HSTS fails with rule headers-weak", () => {
    const extra = [
      "/bags/*",
      "  Cross-Origin-Opener-Policy: same-origin",
      "  Cross-Origin-Resource-Policy: same-site",
      "  Strict-Transport-Security: max-age=63072000",
      "",
    ].join("\n");
    expect(headersIn(`${MINIMAL_HEADERS}\n${extra}`)).toEqual([{ path: "_headers", rule: "headers-weak" }]);
  });

  test.each([
    ["Strict-Transport-Security: max-age=63072000; includeSubDomains"],
    ["X-Content-Type-Options: nosniff"],
    ["Referrer-Policy: no-referrer"],
    ["Permissions-Policy: camera=()"],
    ["Cross-Origin-Opener-Policy: same-origin"],
    ["Cross-Origin-Resource-Policy: same-origin"],
  ])("T9 %s set again in a second block fails with rule headers-weak", (line) => {
    expect(headersIn(`${MINIMAL_HEADERS}\n/bags/*\n  ${line}\n`)).toEqual([{ path: "_headers", rule: "headers-weak" }]);
  });

  test("T9 a required header set twice in the /* block itself fails with rule headers-weak", () => {
    const twice = MINIMAL_HEADERS.replace(
      "  X-Content-Type-Options: nosniff",
      "  X-Content-Type-Options: nosniff\n  X-Content-Type-Options: nosniff",
    );
    expect(headersIn(twice)).toEqual([{ path: "_headers", rule: "headers-weak" }]);
  });

  test("T9 a second strict CSP and a repeated non-required header still pass (positive control)", () => {
    const extra = [
      "/bags/*",
      "  Content-Security-Policy: default-src 'self'; frame-ancestors 'none'",
      "  X-Robots-Tag: noindex",
      "",
      "https://:version.:subdomain.workers.dev/*",
      "  X-Robots-Tag: noindex",
      "",
    ].join("\n");
    expect(headersIn(`${MINIMAL_HEADERS}\n${extra}`)).toEqual([]);
  });
});
