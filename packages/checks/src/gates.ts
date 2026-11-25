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
 * `bun run size`: runs size-limit whenever the root package.json has `size-limit` targets. Without targets it
 * passes with a "no pages yet" line only while apps/web/dist holds neither HTML nor JavaScript, and fails once
 * it holds either, so built code is never left unmeasured. Once pages exist, some target must measure HTML.
 */
export function evaluateSizeGate(root: string): GateResult {
  const targets = readRootPackage(root)["size-limit"];
  const hasTargets = Array.isArray(targets) && targets.length > 0;
  const output = listFiles(root, WEB_DIST, (name) => /\.(html|m?js)$/.test(name));
  if (!hasTargets) {
    if (output.length === 0) {
      return {
        kind: "pass",
        lines: ["size: no pages yet (apps/web/dist has no HTML or JavaScript); nothing to measure"],
      };
    }
    return {
      kind: "fail",
      lines: [
        `size: apps/web emits ${output.length} HTML or JavaScript file(s) but the root package.json has no "size-limit" targets.`,
        "Add the N2 budgets as size-limit entries before building.",
      ],
    };
  }
  const pages = output.filter((file) => file.endsWith(".html"));
  const measuresHtml = targets.some((target: unknown) => {
    const path = typeof target === "object" && target !== null ? (target as { path?: unknown }).path : undefined;
    const paths = Array.isArray(path) ? path : [path];
    return paths.some((p) => typeof p === "string" && p.includes(".html"));
  });
  if (pages.length > 0 && !measuresHtml) {
    return {
      kind: "fail",
      lines: [
        `size: apps/web emits ${pages.length} HTML page(s) but no "size-limit" target measures HTML.`,
        "Add the N2 HTML budgets as size-limit entries before building pages.",
      ],
    };
  }
  return {
    kind: "run",
    lines: [`size: ${targets.length} size-limit target(s)`],
    command: ["size-limit"],
  };
}

/**
 * `bun run test:e2e`: passes with a "no pages yet" line until apps/web emits a page, then requires a root
 * playwright.config.ts and runs Playwright.
 */
export function evaluateE2eGate(root: string): GateResult {
  const pages = findBuiltPages(root);
  if (pages.length === 0)
    return { kind: "pass", lines: ["test:e2e: no pages yet (apps/web/dist has no HTML); nothing to test"] };
  if (!existsSync(join(root, "playwright.config.ts"))) {
    return {
      kind: "fail",
      lines: [
        `test:e2e: apps/web emits ${pages.length} page(s) but there is no playwright.config.ts at the repo root.`,
        "Add the Playwright config and end-to-end tests before building pages.",
      ],
    };
  }
  return {
    kind: "run",
    lines: [`test:e2e: ${pages.length} page(s); running Playwright`],
    command: ["playwright", "test"],
  };
}

function readRootPackage(root: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}
