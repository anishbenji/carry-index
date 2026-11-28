import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { seal } from "../packages/deploy/src/seal.ts";
import { PUBLIC_SITE } from "../packages/deploy/src/workers.ts";

/**
 * Serves the built site for the end-to-end tests exactly as it would deploy: the deploy gate's own `seal` copies
 * `apps/web/dist/client` by its allow-list into a fresh folder in the system temp folder, beside the config it emits
 * from `PUBLIC_SITE`, and `wrangler dev` serves that sealed folder locally (assets only: `html_handling`,
 * `not_found_handling` and `_headers` behave as on Workers Static Assets). Nothing leaves this machine.
 * `bun e2e/serve.ts <port>`; Playwright starts and stops it (playwright.config.ts).
 */
const port = process.argv[2];
if (!port || !/^\d{4,5}$/.test(port)) {
  console.error("usage: serve.ts <port>");
  process.exit(2);
}
const repo = fileURLToPath(new URL("../", import.meta.url));
const sealed = await seal(`${repo}apps/web/dist/client`, PUBLIC_SITE, { parent: tmpdir() });
if (!sealed.ok) {
  for (const problem of sealed.problems) console.error(`seal: ${problem.rule}`);
  process.exit(1);
}
const { dir, configPath } = sealed.bundle;
const wrangler = Bun.spawn(
  [
    `${repo}node_modules/.bin/wrangler`,
    "dev",
    "--config",
    configPath,
    "--ip",
    "127.0.0.1",
    "--port",
    port,
    "--inspector-port",
    String(Number(port) + 1000),
  ],
  { cwd: dir, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "inherit", "inherit"] },
);
const stop = (): void => {
  wrangler.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const code = await wrangler.exited;
rmSync(dir, { recursive: true, force: true });
process.exit(code);
