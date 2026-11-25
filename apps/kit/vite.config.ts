import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

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
