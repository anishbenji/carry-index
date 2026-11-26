import { existsSync, readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";
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
 * it holds either, so built code is never left unmeasured. Once pages exist, every
 * built page must match the glob of some target.
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
  const globs = targets.flatMap((target: unknown) => {
    const path = typeof target === "object" && target !== null ? (target as { path?: unknown }).path : undefined;
    return (Array.isArray(path) ? path : [path]).filter((p): p is string => typeof p === "string");
  });
  const unmeasured = pages.filter((page) => !globs.some((glob) => matchesGlob(page, glob)));
  if (unmeasured.length > 0) {
    return {
      kind: "fail",
      lines: [
        `size: ${unmeasured.length} of ${pages.length} built HTML page(s) fall outside every "size-limit" target:`,
        ...unmeasured.map((page) => `  ${page}`),
        "Every page needs an N2 HTML budget; add or widen a size-limit target.",
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
 * `bun run test:e2e`: passes with a "no pages yet" line while there is neither a page nor a Playwright config.
 * Once either exists it needs both: a config without pages means the build was skipped, so it fails rather than
 * skipping the end-to-end, axe, header and bfcache runs; pages without a config fail too. Then runs Playwright.
 */
export function evaluateE2eGate(root: string): GateResult {
  const pages = findBuiltPages(root);
  const configured = existsSync(join(root, "playwright.config.ts"));
  if (pages.length === 0 && configured) {
    return {
      kind: "fail",
      lines: ["test:e2e: playwright.config.ts exists but apps/web/dist has no pages; run `bun run build` first"],
    };
  }
  if (pages.length === 0)
    return { kind: "pass", lines: ["test:e2e: no pages yet (apps/web/dist has no HTML); nothing to test"] };
  if (!configured) {
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
