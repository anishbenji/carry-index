import { fileURLToPath } from "node:url";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

const app = fileURLToPath(new URL(".", import.meta.url).href);
const repo = fileURLToPath(new URL("../../", import.meta.url).href);

export default defineConfig({
  plugins: [solid()],
  // No static assets yet; a public folder would be copied into the build past server.fs.deny.
  publicDir: false,
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
