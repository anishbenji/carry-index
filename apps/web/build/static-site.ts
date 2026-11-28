import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { CatalogueExport } from "@cj/schema";
import solid from "@solidjs/vite-plugin";
import type { Plugin } from "vite";
import { runnerImport } from "vite";
import type { renderBody } from "../src/render.tsx";
import { assembleSite, cataloguePath, sitePages } from "./site.ts";

export interface StaticSiteOptions {
  /** The Vite root, `apps/web`. */
  root: string;
  /** That export script; the build runs it with Bun (apps/web may not import the pipeline's code). */
  exporter: string;
  /** The `_headers` source, `public/_headers`; the build replaces its CSP line. */
  headers: string;
}

/**
 * The static-first site (ADR-0015's fallback, as spike PR 8 built it), written by the client build itself so the
 * build-graph report (`moduleGraph`) lists every page with its SHA-256.
 *
 * - `buildStart` runs the pipeline's catalogue export, then loads `src/render.tsx` through Vite's module runner, compiled by the Solid plugin for the server in
 *   its non-hydratable mode, and passes it and every file it loaded to `addWatchFile`: `moduleGraph` records watched files,
 *   so the build fails if the page code reached anything private, as it does for the bundle's own modules.
 * - The build's only input is the site stylesheet. `generateBundle` takes Vite's processed CSS out of the bundle,
 *   renders every page with it inlined (ADR-0018), and emits the pages, `_redirects`, and `_headers` with the one CSP hash set the
 *   pages share. The site ships no script: a chunk with code fails the build.
 */
export function staticSite(options: StaticSiteOptions): Plugin {
  let catalogue: CatalogueExport | undefined;
  let render: typeof renderBody | undefined;
  let headers = "";
  let exportPath = "";
  return {
    name: "cj-static-site",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      exportPath = cataloguePath(resolve(config.root, config.build.outDir));
    },
    async buildStart() {
      // A fresh export for every build, beside this build's output folder (N4), read once and removed, so a page can
      // never be made from a stale, shared or hand-edited file.
      const exported = spawnSync("bun", [options.exporter, exportPath], { stdio: "inherit" });
      if (exported.status !== 0) this.error("cj-static-site: the catalogue export failed (see above)");
      try {
        catalogue = JSON.parse(readFileSync(exportPath, "utf8")) as CatalogueExport;
      } finally {
        rmSync(exportPath, { force: true });
      }
      const entry = `${options.root}src/render.tsx`;
      const loaded = await runnerImport<{ renderBody: typeof renderBody }>(entry, {
        configFile: false,
        root: options.root,
        mode: "production",
        logLevel: "warn",
        plugins: [solid()],
      });
      render = loaded.module.renderBody;
      for (const file of [entry, ...loaded.dependencies, options.headers]) this.addWatchFile(file);
      headers = readFileSync(options.headers, "utf8");
    },
    generateBundle(_output, bundle) {
      if (!catalogue || !render) this.error("cj-static-site: buildStart did not load the catalogue and renderer");
      const sheets = Object.values(bundle).filter((file) => file.type === "asset" && file.fileName.endsWith(".css"));
      const [sheet] = sheets;
      if (sheets.length !== 1 || sheet?.type !== "asset") {
        this.error(`cj-static-site: expected one stylesheet in the bundle, found ${sheets.length}`);
      }
      const css = (typeof sheet.source === "string" ? sheet.source : new TextDecoder().decode(sheet.source)).trim();
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === "chunk" && file.code.trim() !== "") {
          this.error(`cj-static-site: the public build ships no script, but it emitted ${name}`);
        }
        // The stylesheet is inlined into every page, and an empty chunk is only the stylesheet entry's shell.
        delete bundle[name];
      }
      const site = assembleSite({ pages: sitePages(catalogue), renderBody: render, css, headers });
      for (const [fileName, source] of site.files) this.emitFile({ type: "asset", fileName, source });
    },
  };
}
