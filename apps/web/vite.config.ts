import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

// Builds the client entry only, with no index.html, so the scaffold emits no pages: the size and e2e gates
// switch on when spike PR 7 starts emitting prerendered HTML.
export default defineConfig({
  plugins: [solid()],
  // Loopback only: Vite 8.3.8 bundles a ws release open to a reply-flood DoS, and no fixed Vite 8 exists yet.
  server: { host: "localhost" },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: { input: "src/main.tsx" },
  },
});
