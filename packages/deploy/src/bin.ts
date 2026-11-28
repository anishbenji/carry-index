/**
 * Runs the public deploy gate: `node packages/deploy/src/bin.ts check|deploy|triggers <siteDir>`. Uses the pinned Wrangler in the repository's node_modules, the real process environment, a child
 * process per Wrangler run and the platform `fetch`. Every line goes to stdout; the exit code is the gate's.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { withTimeout } from "./check3.ts";
import { main } from "./cli.ts";
import { spawnProcess } from "./runner.ts";

// The pinned Wrangler's JavaScript entry, resolved from the launcher link; the spawner runs it under this Node.
const WRANGLER = realpathSync(fileURLToPath(new URL("../../../node_modules/.bin/wrangler", import.meta.url)));

process.exitCode = await main(process.argv.slice(2), {
  log: (line) => console.log(line),
  env: process.env,
  spawn: spawnProcess,
  // Every Cloudflare API call gets 30 seconds, then fails as a live-api-error.
  fetch: withTimeout((url, init) => fetch(url, init), 30_000),
  wrangler: WRANGLER,
});
