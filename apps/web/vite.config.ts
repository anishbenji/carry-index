import { fileURLToPath } from "node:url";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

const app = fileURLToPath(new URL(".", import.meta.url).href);
const repo = fileURLToPath(new URL("../../", import.meta.url).href);

// Builds the client entry only, with no index.html, so the scaffold emits no pages: the size and e2e gates
// switch on when spike PR 7 starts emitting prerendered HTML.
export default defineConfig({
  plugins: [solid()],
  // public/ stays (Vite's default) for spike PR 7's _headers; `bun run wall` fails on any dotfile or symlink in it.
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
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: { input: "src/main.tsx" },
  },
});
