import { fileURLToPath } from "node:url";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import { moduleGraph } from "../../packages/deploy/src/graph-plugin.ts";
import { staticSite } from "./build/static-site.ts";

const app = fileURLToPath(new URL(".", import.meta.url).href);
const repo = fileURLToPath(new URL("../../", import.meta.url).href);

/**
 * The static-first public site (ADR-0015), built in two steps by `bun run build` (package.json):
 * 1. `packages/pipeline/src/cli/export.ts` validates the public catalogue and writes `dist/catalogue.json`;
 * 2. `vite build` builds the site stylesheet, and `staticSite` renders every page with it inlined into
 *    `dist/client`, the folder the deploy gate checks and seals. No script reaches the site.
 */
export default defineConfig({
  // moduleGraph: the build fails on any private module it resolved, and writes the report the deploy gate requires
  // beside the output folder (packages/deploy, security-sol r2 S2-4).
  plugins: [
    solid(),
    moduleGraph({ repoRoot: repo }),
    staticSite({ root: app, catalogue: `${app}dist/catalogue.json`, headers: `${app}public/_headers` }),
  ],
  // packages/deploy (privacy-wall design v2) copies only allow-listed files from the build into the sealed artifact.
  // Loopback only: Vite 8.3.8 bundles a ws release open to a reply-flood DoS, and no fixed Vite 8 exists yet.
  server: {
    host: "localhost",
    // No cross-origin reads: a page on another local port must not fetch from the dev server.
    cors: false,
    fs: {
      // Only this app, the workspace packages it imports and installed packages; not the rest of the checkout.
      allow: [app, `${repo}packages/schema`, `${repo}node_modules`],
      // A configured list replaces Vite's, so Vite 8.3.8's defaults come first; then Wrangler's local secrets.
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**",
        ".dev.vars",
        ".dev.vars.*",
      ],
    },
  },
  build: {
    // Nothing inlined as a data URL: every asset is emitted, so the module-graph check sees its original file (S3-1).
    assetsInlineLimit: 0,
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: { input: "src/styles.css" },
  },
});
