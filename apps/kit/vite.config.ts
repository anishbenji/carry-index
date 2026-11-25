import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [solid()],
  // Loopback only: Vite 8.3.8 bundles a ws release open to a reply-flood DoS, and no fixed Vite 8 exists yet.
  server: {
    host: "localhost",
    fs: {
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
