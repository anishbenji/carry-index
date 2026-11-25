import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GateResult } from "../gates.ts";

/** The repository root, found from this file's location rather than the caller's working directory. */
export const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** Prints a gate's lines, runs its command from the repo's node_modules/.bin if it has one, and exits. */
export function finishGate(result: GateResult): never {
  for (const line of result.lines) console.log(line);
  if (result.kind === "pass") process.exit(0);
  if (result.kind === "fail") process.exit(1);
  const [bin, ...args] = result.command;
  const child = Bun.spawnSync([join(REPO_ROOT, "node_modules", ".bin", bin ?? ""), ...args], {
    cwd: REPO_ROOT,
    stdio: ["inherit", "inherit", "inherit"],
  });
  process.exit(child.exitCode ?? 1);
}
