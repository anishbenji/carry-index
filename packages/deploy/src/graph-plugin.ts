import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isPrivatePath } from "./private-roots.ts";
import { WalkLimitExceeded, walkTree } from "./walk.ts";

/**
 * The build-graph half of the import ban (security-sol r2, S2-4). The source scan (`imports.ts`) reads three fixed
 * folders, so a private module reached through a shared helper elsewhere in the repo escapes it. This Vite plugin
 * reads the module list the build itself resolved (`this.getModuleIds()`, every module loaded, tree-shaken or not)
 * and fails the build on any private one. It then writes a report beside the output folder (never inside it: the
 * seal copies only allow-listed files), which the gate's `deploy` and `triggers` require for the same build
 * (`graph-check.ts`): the report lists each output file with its SHA-256, so it vouches only for those exact bytes.
 *
 * Dependency-free (no Zod, no TypeScript), so the public build's Vite config can load it.
 */

export const GRAPH_REPORT_FORMAT = "cj-module-graph/1";

/** The report sits at `<outDir>.module-graph.json`, beside the output folder. */
export function graphReportPath(outDir: string): string {
  return `${resolve(outDir)}.module-graph.json`;
}

/** Recorded in place of a module path outside the repository: the build fails on it, and the path stays local. */
export const OUTSIDE_REPOSITORY = "(outside the repository)";

export interface GraphReport {
  format: typeof GRAPH_REPORT_FORMAT;
  /** Repo-relative module paths with forward slashes, or a plugin's virtual id (starting with NUL), sorted. */
  modules: string[];
  /** Every file the build emitted into the output folder, by path relative to it, sorted. */
  outputs: Array<{ path: string; sha256: string }>;
  /**
   * The check settings the build ran with. Every one must be true for the gate to accept the report: a check turned
   * off (only tests do) fails `graph-checks-disabled`, as does a report with no record of them.
   */
  checks?: { workerImports: boolean };
}

function isOutside(rel: string): boolean {
  return rel === ".." || rel.startsWith("../") || isAbsolute(rel);
}

function toSlashes(path: string): string {
  return path.split(sep).join("/");
}

/**
 * A worker import's query: `?worker`, `?sharedworker` or `&worker` (alone or with `inline`, `url` and the like), but
 * not Vite's own `?worker_file`, which exists only inside a worker's nested build (security r4, S4-1a).
 */
const WORKER_QUERY = /[?&](?:shared)?worker(?=[&=#]|$)/;

/** Whether a report module key is a worker import (the key keeps the query for those). */
export function isWorkerImport(key: string): boolean {
  const query = key.indexOf("?");
  return query !== -1 && WORKER_QUERY.test(key.slice(query));
}

/**
 * Each module id as the report records it, the private ones, and the worker imports (recorded with their query). A virtual id (NUL-prefixed, made by a plugin in
 * the config) is kept as it is. Any other id must be an absolute path: its query is dropped, and both the path and,
 * when it exists, its real path are checked, so a linked folder cannot hide a private target. An id of any other
 * shape is private: the check cannot say where it came from.
 */
export function classifyModules(
  ids: Iterable<string>,
  repoRoot: string,
): { modules: string[]; privateModules: string[]; workerImports: string[] } {
  const root = resolve(repoRoot);
  const realRoot = realpathSync(root);
  // Repo-relative, against the real root first (module ids are usually real paths), then the root as given.
  const inRepo = (path: string): string => {
    const fromReal = toSlashes(relative(realRoot, path));
    return isOutside(fromReal) ? toSlashes(relative(root, path)) : fromReal;
  };
  const modules = new Set<string>();
  const privateModules = new Set<string>();
  const workerImports = new Set<string>();
  for (const id of ids) {
    if (id.startsWith("\0")) {
      modules.add(id);
      continue;
    }
    const path = id.replace(/[?#].*$/s, "");
    if (!isAbsolute(path)) {
      modules.add(OUTSIDE_REPOSITORY);
      privateModules.add(OUTSIDE_REPOSITORY);
      continue;
    }
    const asWritten = inRepo(path);
    const real = existsSync(path) ? inRepo(realpathSync(path)) : asWritten;
    const isPrivate = isPrivatePath(asWritten) || isPrivatePath(real);
    // Where the file really is decides: a link inside the repository to a folder outside it is outside.
    const key = isOutside(real) ? OUTSIDE_REPOSITORY : real;
    const query = id.slice(path.length);
    const queryStart = query.indexOf("?");
    if (queryStart !== -1 && WORKER_QUERY.test(query.slice(queryStart))) {
      const workerKey = `${key}${query}`;
      workerImports.add(workerKey);
      modules.add(workerKey);
    } else modules.add(key);
    if (isPrivate) privateModules.add(key);
  }
  const sorted = (set: Set<string>): string[] => [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { modules: sorted(modules), privateModules: sorted(privateModules), workerImports: sorted(workerImports) };
}

/** The parts of Rollup's plugin context and output bundle the plugin uses (structural: no Vite types here). */
export interface GraphContext {
  getModuleIds(): Iterable<string>;
  error(message: string): never;
}
type OutputFile =
  | { type: "chunk"; code: string }
  | { type: "asset"; source: string | Uint8Array; originalFileNames?: readonly string[] };
export type OutputBundle = Readonly<Record<string, OutputFile>>;

function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

/** At most this many entries in the public folder: the seal's own file cap. */
const MAX_PUBLIC_ENTRIES = 10_000;

/**
 * Problems with the public folder Vite copies into the output (security r4, S4-2). Vite's copy follows links
 * (`statSync`, `copyFileSync`), so a link there would deploy its target as an ordinary file the seal cannot tell
 * apart. Walked with `lstat`: every link (`symlink`), file with more than one link (`hard-link`), special file
 * (`special-file`) and private path (`private`), each with its repo-relative path.
 */
export function publicDirProblems(publicDir: string, repoRoot: string): string[] {
  const root = resolve(repoRoot);
  const realRoot = realpathSync(root);
  const shown = (abs: string): string => {
    const rel = toSlashes(relative(realRoot, abs));
    const fallback = toSlashes(relative(root, abs));
    if (!isOutside(rel)) return rel;
    return isOutside(fallback) ? OUTSIDE_REPOSITORY : fallback;
  };
  // The root itself first, by lstat: a public folder that is a link is followed by Vite's copy, so it is refused
  // like any link the walk finds, before realpathSync resolves it (final gate, G4).
  if (lstatSync(publicDir).isSymbolicLink()) return [`symlink ${shown(publicDir)}`];
  let entries: ReturnType<typeof walkTree>;
  try {
    entries = walkTree(realpathSync(publicDir), {}, { maxEntries: MAX_PUBLIC_ENTRIES });
  } catch (error) {
    if (error instanceof WalkLimitExceeded) return [`too-many-files ${shown(publicDir)}`];
    throw error;
  }
  const problems: string[] = [];
  const folder = classifyModules([publicDir], repoRoot);
  if (folder.privateModules.length > 0) problems.push(`private ${folder.privateModules.join(", ")}`);
  for (const entry of entries) {
    if (entry.kind === "symlink") problems.push(`symlink ${shown(entry.abs)}`);
    else if (entry.kind === "hardlink") problems.push(`hard-link ${shown(entry.abs)}`);
    else if (entry.kind === "special") problems.push(`special-file ${shown(entry.abs)}`);
    else if (classifyModules([entry.abs], repoRoot).privateModules.length > 0) {
      problems.push(`private ${shown(entry.abs)}`);
    }
  }
  return problems;
}

/** A context method this plugin can wrap: Rolldown keeps `addWatchFile` on a prototype every plugin's context shares. */
type WatchHolder = { addWatchFile?: (this: unknown, id: string) => void };

/**
 * The Vite plugin (security-sol r2 S2-4, security r3 S3-1). Files a build reads as assets never become modules:
 * `new URL("<file>", import.meta.url)` and CSS `url()` emit or inline the file, and CSS `@import` merges it into a
 * stylesheet. So besides the module list the plugin checks:
 * - every file any plugin watched: Vite's CSS plugin reports each `@import` and `url()` dependency through
 *   `this.addWatchFile` (vite 8.3.8 `node.js:29954`), and the asset-URL plugin reports each `new URL` file the same
 *   way. Rolldown 1.2.19's plugin context has no `getWatchFiles`, so the plugin wraps `addWatchFile` on the context
 *   prototypes and records each call: from every hook the plugin defines while files are read (`buildStart`,
 *   `resolveId`, `load`, `transform`), every class in that hook's context chain that defines its own `addWatchFile`
 *   (the load and transform contexts are separate classes whose `addWatchFile` goes straight to a native binding).
 *   A context with a native `getWatchFiles` is read instead; one with neither fails the build;
 * - every output asset's `originalFileNames` (relative to the Vite root);
 * - and it sets `build.assetsInlineLimit: 0`, refusing a build that resolves another value, so no file is inlined
 *   into a chunk where only the watch list would see it.
 * In `generateBundle` (before anything is written) it removes any earlier report and fails the build on anything
 * private; in `writeBundle` it writes the report for the files just written.
 */
export interface ModuleGraphOptions {
  repoRoot: string;
  /**
   * Tests only: `{ workerImports: false }` turns off the worker-import refusal, to prove that the watched-file check
   * catches a worker's private files on its own. The public build's config never sets it.
   */
  checks?: { workerImports?: boolean };
}

export function moduleGraph(options: ModuleGraphOptions) {
  let modules: string[] = [];
  let root: string | undefined;
  const watched = new Set<string>();
  let nativeWatch: (() => Iterable<string>) | undefined;
  const restores = new Map<WatchHolder, (this: unknown, id: string) => void>();
  const stopWatching = (): void => {
    for (const [holder, original] of restores) holder.addWatchFile = original;
    restores.clear();
  };
  /** Wraps `addWatchFile` on `context`'s prototype once, recording each call; false when there is none to wrap. */
  /**
   * Wraps `addWatchFile` on every class in `context`'s prototype chain that defines its own, each once, recording
   * every call (security r4, S4-1b): Rolldown gives each hook kind its own context class, and a subclass's
   * `addWatchFile` (LoadPluginContextImpl's, TransformPluginContextImpl's) need not call its parent's. False when the
   * chain holds none, so the caller fails the build.
   */
  const watch = (context: object): boolean => {
    let found = false;
    for (let holder = Object.getPrototypeOf(context) as WatchHolder | null; holder; ) {
      if (holder !== Object.prototype && Object.hasOwn(holder, "addWatchFile")) {
        const original = holder.addWatchFile;
        if (typeof original === "function") {
          found = true;
          if (!restores.has(holder)) {
            restores.set(holder, original);
            holder.addWatchFile = function (this: unknown, id: string): void {
              watched.add(id);
              original.call(this, id);
            };
          }
        }
      }
      holder = Object.getPrototypeOf(holder) as WatchHolder | null;
    }
    return found;
  };
  /** Every hook that runs while the build reads files wraps its own context's chain, or fails the build. */
  const watchOrFail = (context: object, hook: string): void => {
    if (nativeWatch === undefined && !watch(context)) {
      throw new Error(`cj-module-graph: a ${hook} context has no addWatchFile to observe; refusing to build`);
    }
  };
  return {
    name: "cj-module-graph",
    apply: "build" as const,
    // Before Vite's own plugins, so the first module's transform hook runs here first.
    enforce: "pre" as const,
    config(): { build: { assetsInlineLimit: 0 } } {
      return { build: { assetsInlineLimit: 0 } };
    },
    configResolved(config: { root: string; publicDir?: string | false; build: { assetsInlineLimit?: unknown } }): void {
      if (config.build.assetsInlineLimit !== 0) {
        throw new Error("cj-module-graph: the public build must set build.assetsInlineLimit to 0");
      }
      root = config.root;
      // Vite resolves `publicDir: false` to "", and a folder that does not exist is simply not copied.
      if (typeof config.publicDir === "string" && config.publicDir !== "" && existsSync(config.publicDir)) {
        const problems = publicDirProblems(config.publicDir, options.repoRoot);
        if (problems.length > 0) {
          throw new Error(
            `cj-module-graph: the public folder holds ${problems.length} problem(s): ${problems.join("; ")}`,
          );
        }
      }
    },
    buildStart(this: GraphContext): void {
      watched.clear();
      const context = this as GraphContext & { getWatchFiles?: () => Iterable<string> };
      if (typeof context.getWatchFiles === "function") {
        nativeWatch = () => context.getWatchFiles?.() ?? [];
        return;
      }
      if (!watch(this)) {
        this.error(
          "cj-module-graph: this Vite version gives no way to see the build's watched files; refusing to build",
        );
      }
    },
    resolveId(this: object): undefined {
      watchOrFail(this, "resolveId");
      return undefined;
    },
    load(this: object): undefined {
      // A load hook's context (Rolldown's LoadPluginContextImpl) has its own addWatchFile: vite:worker reports a
      // nested worker build's files through it (vite 8.3.8 node.js:26269).
      watchOrFail(this, "load");
      return undefined;
    },
    transform(this: object): undefined {
      // A transform hook's context (Rolldown's TransformPluginContextImpl) has its own addWatchFile, the one Vite's
      // CSS and asset-URL plugins call; wrapped on the first transform, before any of Vite's own plugins run.
      watchOrFail(this, "transform");
      return undefined;
    },
    buildEnd(): void {
      // The build's own files are all read by now; a failed build ends here without generateBundle.
      stopWatching();
    },
    generateBundle(this: GraphContext, output: { dir?: string | undefined }, bundle: OutputBundle = {}): void {
      stopWatching();
      if (output.dir === undefined) this.error("cj-module-graph: the build has no output folder");
      rmSync(graphReportPath(output.dir), { force: true });
      const base = root ?? process.cwd();
      const assetFiles = Object.values(bundle).flatMap((file) =>
        file.type === "asset" ? (file.originalFileNames ?? []).map((name) => resolve(base, name)) : [],
      );
      const watchFiles = [...watched, ...(nativeWatch?.() ?? [])].filter((id) => !id.startsWith("\0"));
      const found = classifyModules([...this.getModuleIds(), ...watchFiles, ...assetFiles], options.repoRoot);
      // A worker import is built in a nested Rolldown run this plugin does not see (security r4, S4-1a).
      if (options.checks?.workerImports !== false && found.workerImports.length > 0) {
        this.error(
          `cj-module-graph: worker-import: the public build imports ${found.workerImports.length} worker(s), which ` +
            `it builds where this check cannot see: ${found.workerImports.map((m) => JSON.stringify(m)).join(", ")}`,
        );
      }
      if (found.privateModules.length > 0) {
        this.error(
          `cj-module-graph: the public build reached ${found.privateModules.length} private file(s): ` +
            found.privateModules.map((m) => JSON.stringify(m)).join(", "),
        );
      }
      modules = found.modules;
    },
    writeBundle(this: GraphContext, output: { dir?: string | undefined }, bundle: OutputBundle): void {
      if (output.dir === undefined) this.error("cj-module-graph: the build has no output folder");
      const outputs = Object.entries(bundle)
        .map(([path, file]) => ({ path, sha256: sha256(file.type === "chunk" ? file.code : file.source) }))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      const checks = { workerImports: options.checks?.workerImports !== false };
      const report: GraphReport = { format: GRAPH_REPORT_FORMAT, modules, outputs, checks };
      writeFileSync(graphReportPath(output.dir), `${JSON.stringify(report, null, 2)}\n`);
    },
  };
}
