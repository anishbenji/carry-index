import { fileURLToPath } from "node:url";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import { moduleGraph } from "../../packages/deploy/src/graph-plugin.ts";

const app = fileURLToPath(new URL(".", import.meta.url).href);
const repo = fileURLToPath(new URL("../../", import.meta.url).href);

// Builds the client entry only, with no index.html, so the scaffold emits no pages: the size and e2e gates
// switch on when spike PR 7 starts emitting prerendered HTML.
export default defineConfig({
  // moduleGraph: the build fails on any private module it resolved, and writes the report the deploy gate requires
  // beside the output folder (packages/deploy, security-sol r2 S2-4).
  plugins: [solid(), moduleGraph({ repoRoot: repo })],
  // public/ stays (Vite's default) for spike PR 7's _headers; packages/deploy (privacy-wall design v2) will copy
  // only allow-listed files from it into the sealed deploy artifact.
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
    rollupOptions: { input: "src/main.tsx" },
  },
});
