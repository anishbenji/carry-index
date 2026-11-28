import { defineConfig, devices } from "@playwright/test";
import { COLOR_SCHEMES } from "./e2e/themes.ts";

/**
 * End-to-end, accessibility and header tests against the built site (`bun run build` first), sealed by the deploy
 * gate and served by `wrangler dev` (e2e/serve.ts). Every spec runs in both colour schemes, at desktop and phone
 * sizes. Chromium only: the only browser CI installs.
 */
const PORT = 8818;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: COLOR_SCHEMES.flatMap((colorScheme) => [
    { name: `desktop-${colorScheme}`, use: { ...devices["Desktop Chrome"], colorScheme } },
    { name: `phone-${colorScheme}`, use: { ...devices["Pixel 7"], colorScheme } },
  ]),
  webServer: {
    command: `bun e2e/serve.ts ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
