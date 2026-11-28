import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Component tests render Solid into happy-dom; plain logic tests run there too at no cost.
export default mergeConfig(viteConfig, defineConfig({ test: { environment: "happy-dom" } }));
