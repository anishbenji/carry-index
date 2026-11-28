import { createHash } from "node:crypto";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GRAPH_REPORT_FORMAT, graphReportPath } from "../src/graph-plugin.ts";

export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** PR 8's real static output (spike/08-static-csp at b0f40c4), both variant folders, copied unchanged. */
export const PR8_INLINE = join(FIXTURES, "pr8-static", "inline");
export const PR8_EXTERNAL = join(FIXTURES, "pr8-static", "external");

/** The only valid site the rejection tests start from: one page that passes every row. */
export const MINIMAL_PAGE = "<!doctype html><html lang=en><title>Not found</title><p>Not found</p></html>\n";

export interface TempDir {
  root: string;
  cleanup: () => void;
}

/** A fresh folder in the system temp folder, outside the checkout. */
export function tempDir(prefix = "cj-deploy-test-"): TempDir {
  const root = mkdtempSync(join(tmpdir(), prefix));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Writes `files` (relative path to content) under `root`. */
export function writeTree(root: string, files: Readonly<Record<string, string | Uint8Array>>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

/** A `_headers` that passes every header rule, in the shape of PR 8's (synthetic hashes). */
export const MINIMAL_HEADERS = [
  "/*",
  "  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), geolocation=(), microphone=()",
  "  Cross-Origin-Opener-Policy: same-origin",
  "  Cross-Origin-Resource-Policy: same-origin",
  "",
  "/assets/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "",
].join("\n");

/** A temp site folder holding `404.html` and `_headers` plus `files`. */
export function minimalSite(files: Readonly<Record<string, string | Uint8Array>> = {}): TempDir {
  const dir = tempDir("cj-site-");
  writeTree(dir.root, { "404.html": MINIMAL_PAGE, _headers: MINIMAL_HEADERS, ...files });
  return dir;
}

/** A temp copy of a fixture folder, so a test can add to it. */
export function copyOf(source: string): TempDir {
  const dir = tempDir("cj-site-");
  cpSync(source, dir.root, { recursive: true });
  return dir;
}

export interface Entry {
  path: string;
  kind: "file" | "dir" | "symlink" | "other";
}

/** Every entry under `root` (no skip list, symlinks not followed), sorted, forward slashes. */
export function listEntries(root: string): Entry[] {
  const found: Entry[] = [];
  const walk = (abs: string): void => {
    for (const name of readdirSync(abs)) {
      const full = join(abs, name);
      const stat = lstatSync(full);
      const path = relative(root, full).split(sep).join("/");
      if (stat.isSymbolicLink()) found.push({ path, kind: "symlink" });
      else if (stat.isDirectory()) {
        found.push({ path, kind: "dir" });
        walk(full);
      } else if (stat.isFile()) found.push({ path, kind: "file" });
      else found.push({ path, kind: "other" });
    }
  };
  walk(root);
  return found.sort((a, b) => byCodeUnit(a.path, b.path));
}

/** Sorts strings by UTF-16 code unit, the order every list the gate returns uses. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Regular files under `root`, sorted. */
export function listFiles(root: string): string[] {
  return listEntries(root)
    .filter((e) => e.kind === "file")
    .map((e) => e.path);
}

export function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Whether `path` is `dir` or inside it. */
export function isInside(path: string, dir: string): boolean {
  const rel = relative(dir, path);
  return rel === "" || !(rel.startsWith("..") || rel.startsWith(sep));
}

/**
 * The `workers/tag` the gate gives a version uploaded from `siteDir` (S5-5): the manifest tag of the site as the seal
 * copies it. Tests set it on the fake's live version so `triggers` sees the version this build sealed.
 */
export async function sealedTag(siteDir: string): Promise<string> {
  const { seal, manifestTag } = await import("../src/seal.ts");
  const { PUBLIC_SITE } = await import("../src/workers.ts");
  const result = await seal(siteDir, PUBLIC_SITE);
  if (!result.ok) throw new Error(`sealedTag: the site does not seal: ${JSON.stringify(result.problems)}`);
  rmSync(result.bundle.dir, { recursive: true, force: true });
  return manifestTag(result.bundle.manifest);
}

/**
 * Writes the build-graph report the public build writes beside its output (`<siteDir>.module-graph.json`), listing
 * every page and `assets/` file now in `siteDir` with its SHA-256 and one public module: what `deploy` and `triggers`
 * require of a site that holds either (N2).
 */
export function writeGraphReport(siteDir: string): void {
  const outputs = listEntries(siteDir)
    .filter((e) => e.kind === "file" && (e.path.startsWith("assets/") || e.path.endsWith(".html")))
    .map((e) => ({
      path: e.path,
      sha256: createHash("sha256")
        .update(readFileSync(join(siteDir, e.path)))
        .digest("hex"),
    }));
  const report = {
    format: GRAPH_REPORT_FORMAT,
    modules: ["apps/web/src/render.tsx"],
    outputs,
    checks: { workerImports: true },
  };
  writeFileSync(graphReportPath(siteDir), JSON.stringify(report));
}

/**
 * `minimalSite` as the public build leaves it: with its build-graph report beside it (`writeGraphReport`), removed
 * again by `cleanup`. Tests of later gate stages start from this; a test that adds a page afterwards calls
 * `writeGraphReport` again.
 */
export function builtSite(files: Readonly<Record<string, string | Uint8Array>> = {}): TempDir {
  const site = minimalSite(files);
  writeGraphReport(site.root);
  return {
    root: site.root,
    cleanup: () => {
      rmSync(graphReportPath(site.root), { force: true });
      site.cleanup();
    },
  };
}
