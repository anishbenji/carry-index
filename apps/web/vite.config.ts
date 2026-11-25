import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

// Builds the client entry only, with no index.html, so the scaffold emits no pages: the size and e2e gates
// switch on when spike PR 7 starts emitting prerendered HTML.
export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: { input: "src/main.tsx" },
  },
});
