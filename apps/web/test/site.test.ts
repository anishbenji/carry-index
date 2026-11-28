import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assembleSite, documentHtml, sitePages } from "../build/site.ts";
import type { StaticPage } from "../src/render.tsx";
import { CATALOGUE } from "./fixtures.ts";

const hash = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
const HEADERS = "# source\n/*\n  Content-Security-Policy: default-src 'none'\n  X-Content-Type-Options: nosniff\n";
const fakeRender = (page: StaticPage) => `<main>${page.kind}</main>`;

describe("sitePages", () => {
  it("lists the listing, one page per model and the 404 page, each with its own title and description", () => {
    const pages = sitePages(CATALOGUE);
    expect(pages.map((p) => p.file)).toEqual([
      "uhmwpe-backpacks.html",
      "bags/example-pack-30l.html",
      "bags/test-bag-20l.html",
      "404.html",
    ]);
    expect(pages.map((p) => p.title)).toEqual([
      "Backpacks · Carry Journal",
      "Example Maker Example Pack 30L · Carry Journal",
      'Second Maker Test Bag <20L> & "Co" · Carry Journal',
      "Page not found · Carry Journal",
    ]);
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
    expect(pages[1]?.page).toEqual({ kind: "bag", model: CATALOGUE.models[0] });
  });

  it("throws when two models share a slug", () => {
    const twice = { models: [CATALOGUE.models[0], CATALOGUE.models[0]].filter((m) => m !== undefined) };
    expect(() => sitePages(twice)).toThrow(/example-pack-30l/);
  });
});

describe("documentHtml", () => {
  it("wraps a body in a complete document with escaped metadata, the inline stylesheet and no script", () => {
    const html = documentHtml({ title: 'A <b> & "c"', description: "d < e", body: "<main>x</main>", css: "p{}" });
    expect(html.startsWith('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">')).toBe(true);
    expect(html).toContain("<title>A &lt;b&gt; &amp; &quot;c&quot;</title>");
    expect(html).toContain('<meta name="description" content="d &lt; e">');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain("<style>p{}</style>");
    expect(html).toContain("<body><main>x</main></body></html>");
    expect(html).not.toContain("<script");
  });
});

describe("assembleSite", () => {
  it("writes every page, _redirects and a _headers whose CSP holds the one stylesheet hash shared by all pages", () => {
    const site = assembleSite({ pages: sitePages(CATALOGUE), renderBody: fakeRender, css: "p{}", headers: HEADERS });
    expect([...site.files.keys()]).toEqual([
      "uhmwpe-backpacks.html",
      "bags/example-pack-30l.html",
      "bags/test-bag-20l.html",
      "404.html",
      "_headers",
      "_redirects",
    ]);
    expect(site.files.get("_redirects")).toBe("/ /uhmwpe-backpacks 302\n");
    expect(site.policy).toContain(`style-src ${hash("p{}")}`);
    expect(site.policy).toContain("script-src 'none'");
    expect(site.files.get("_headers")).toContain(`  Content-Security-Policy: ${site.policy}\n`);
    expect(site.files.get("bags/test-bag-20l.html")).toContain("<main>bag</main>");
  });

  it("throws when pages would need different hash sets", () => {
    const render = (page: StaticPage) => (page.kind === "notFound" ? "<script>x()</script>" : "<main></main>");
    expect(() =>
      assembleSite({ pages: sitePages(CATALOGUE), renderBody: render, css: "p{}", headers: HEADERS }),
    ).toThrow(/hash/);
  });

  it("throws when the stylesheet is over the 10 KB whole-site CSS budget compressed", () => {
    let css = "";
    let seed = 1;
    while (css.length < 40_000) {
      seed = (seed * 48271) % 2147483647;
      css += seed.toString(36);
    }
    expect(() => assembleSite({ pages: sitePages(CATALOGUE), renderBody: fakeRender, css, headers: HEADERS })).toThrow(
      /10 KB/,
    );
  });
});
