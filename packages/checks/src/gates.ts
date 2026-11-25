import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "./files.ts";

/** Where `apps/web` writes its build. Pages are the HTML files under it. */
export const WEB_DIST = "apps/web/dist";

export type GateResult =
  | { kind: "pass"; lines: string[] }
  | { kind: "fail"; lines: string[] }
  | { kind: "run"; lines: string[]; command: string[] };

/** Lists the built HTML pages under apps/web/dist, sorted, as repo-relative paths. */
export function findBuiltPages(root: string): string[] {
  return listFiles(root, WEB_DIST, (name) => name.endsWith(".html"));
}

/**
 * `bun run size`: passes with a "no pages yet" line until apps/web emits a page, then requires a non-empty
 * `size-limit` list in the root package.json and runs size-limit against it.
 */
export function evaluateSizeGate(root: string): GateResult {
  const pages = findBuiltPages(root);
  if (pages.length === 0) return { kind: "pass", lines: ["size: no pages yet (apps/web/dist has no HTML); nothing to measure"] };
  const targets = readRootPackage(root)["size-limit"];
  if (!Array.isArray(targets) || targets.length === 0) {
    return {
      kind: "fail",
      lines: [
        `size: apps/web emits ${pages.length} page(s) but the root package.json has no "size-limit" targets.`,
        "Add the N2 budgets as size-limit entries before building pages.",
      ],
    };
  }
  return { kind: "run", lines: [`size: ${pages.length} page(s), ${targets.length} size-limit target(s)`], command: ["size-limit"] };
}

/**
 * `bun run test:e2e`: passes with a "no pages yet" line until apps/web emits a page, then requires a root
 * playwright.config.ts and runs Playwright.
 */
export function evaluateE2eGate(root: string): GateResult {
  const pages = findBuiltPages(root);
  if (pages.length === 0) return { kind: "pass", lines: ["test:e2e: no pages yet (apps/web/dist has no HTML); nothing to test"] };
  if (!existsSync(join(root, "playwright.config.ts"))) {
    return {
      kind: "fail",
      lines: [
        `test:e2e: apps/web emits ${pages.length} page(s) but there is no playwright.config.ts at the repo root.`,
        "Add the Playwright config and end-to-end tests before building pages.",
      ],
    };
  }
  return { kind: "run", lines: [`test:e2e: ${pages.length} page(s); running Playwright`], command: ["playwright", "test"] };
}

function readRootPackage(root: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}
