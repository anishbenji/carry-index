import { brotliCompressSync, constants } from "node:zlib";
import type { CatalogueExport } from "@cj/schema";
import type { StaticPage } from "../src/render.tsx";
import { bagFile, LISTING_FILE, NOT_FOUND_FILE } from "../src/routes.ts";
import { cspPolicy, inlineHashes, withCsp } from "./csp.ts";

/** N2 (ADR-0017): the whole site's CSS under 10 KB compressed, read as 10,000 bytes of Brotli at quality 11. */
export const CSS_BUDGET_BYTES = 10_000;

const SITE = "Carry Journal";

export interface PageSpec {
  file: string;
  title: string;
  description: string;
  page: StaticPage;
}

/** Every page of the site: the listing, one page per model, and the 404 page. Throws on a slug used twice. */
export function sitePages(catalogue: CatalogueExport): PageSpec[] {
  const slugs = new Set<string>();
  const bags = catalogue.models.map((model): PageSpec => {
    if (slugs.has(model.slug)) throw new Error(`two models share the slug ${model.slug}`);
    slugs.add(model.slug);
    return {
      file: bagFile(model.slug),
      title: `${model.brand} ${model.name} · ${SITE}`,
      description: `Weight, capacity and fabric of every build of the ${model.brand} ${model.name}.`,
      page: { kind: "bag", model },
    };
  });
  return [
    {
      file: LISTING_FILE,
      title: `Backpacks · ${SITE}`,
      description: "Every backpack in the Carry Journal catalogue, with each build's weight, capacity and fabric.",
      page: { kind: "listing", models: catalogue.models },
    },
    ...bags,
    {
      file: NOT_FOUND_FILE,
      title: `Page not found · ${SITE}`,
      description: "There is no Carry Journal page at this address.",
      page: { kind: "notFound" },
    },
  ];
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A complete page: metadata, the site stylesheet inlined (ADR-0018), and the rendered body. No script. */
export function documentHtml(options: { title: string; description: string; body: string; css: string }): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    `<title>${escapeHtml(options.title)}</title>`,
    `<meta name="description" content="${escapeHtml(options.description)}">`,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    `<style>${options.css}</style>`,
  ].join("");
  return `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${options.body}</body></html>`;
}

/**
 * Renders every page into its document, checks that one CSP hash set covers them all (the build fails otherwise:
 * `_headers` cannot give a page its own policy, and the 404 page is served for every unknown path), and writes
 * `_headers` with that policy. Fails if the stylesheet is over the CSS budget.
 */
export function assembleSite(options: {
  pages: readonly PageSpec[];
  renderBody: (page: StaticPage) => string;
  css: string;
  headers: string;
}): { files: Map<string, string>; policy: string } {
  const cssBytes = brotliCompressSync(options.css, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
  if (cssBytes > CSS_BUDGET_BYTES) {
    throw new Error(`the stylesheet is ${cssBytes} B in Brotli, over the 10 KB whole-site CSS budget (N2)`);
  }
  const files = new Map<string, string>();
  const sets = new Set<string>();
  let hashes = { scripts: [] as string[], styles: [] as string[] };
  for (const spec of options.pages) {
    if (files.has(spec.file)) throw new Error(`two pages write ${spec.file}`);
    const html = documentHtml({ ...spec, body: options.renderBody(spec.page), css: options.css });
    files.set(spec.file, html);
    hashes = inlineHashes(html);
    sets.add(JSON.stringify(hashes));
  }
  if (sets.size !== 1) throw new Error(`pages need different CSP hash sets: ${[...sets].join(" | ")}`);
  const policy = cspPolicy(hashes);
  files.set("_headers", withCsp(options.headers, policy));
  return { files, policy };
}
