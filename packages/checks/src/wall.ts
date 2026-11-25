import type { Dirent } from "node:fs";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import {
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNamespaceImport,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isStringLiteral,
} from "typescript/unstable/ast/is";
import { experimental_readRawConfig, unstable_readConfig } from "wrangler";
import { listFiles } from "./files.ts";
import { lineOf, walk, withParsedFiles } from "./parse.ts";

export interface WallCheck {
  id: string;
  description: string;
  status: "pending" | "implemented";
  /** When the check is due to be implemented. */
  milestone: string;
}

/**
 * The three privacy-wall checks. None exists yet; while any is pending, no Worker may declare a binding,
 * so no private store can be wired to anything before the wall that guards it is tested.
 */
export const WALL_CHECKS: readonly WallCheck[] = [
  {
    id: "schema-never-public",
    description: "a test that no never-public schema field reaches the public build",
    status: "pending",
    milestone: "Phase 2 data model (packages/schema)",
  },
  {
    id: "canary-export",
    description: "a canary record in the private store that the publish export must never emit",
    status: "pending",
    milestone: "publish export (Phase 2)",
  },
  {
    id: "public-worker-bindings",
    description: "the public Worker's wrangler.jsonc declares no D1 or R2 binding",
    status: "pending",
    milestone: "spike PR 7 (public Worker deploy)",
  },
];

/**
 * Wrangler config keys that configure a Worker without wiring it to a resource, taken from wrangler 4.168's
 * config schema (`RawConfig` and `RawEnvironment` in wrangler/config-schema.json), plus the bookkeeping keys
 * `@cloudflare/vite-plugin` 1.70.1 writes into its generated config and deploy redirect. Every other key with a
 * non-empty value counts as a binding, so a binding type added in a later wrangler release fails the wall until
 * someone looks at it. Left off on purpose although some are not strictly bindings: durable_objects,
 * migrations, exports, workflows, containers, cloudchamber, secrets, site and the legacy *_modules/*_blobs
 * (they all bring in storage, code or credentials), addresses, connect, tail_consumers and logfwdr.
 * `assets` is allowed except for `assets.binding`; `env` and `previews` are checked recursively.
 */
export const NON_BINDING_KEYS: ReadonlySet<string> = new Set([
  "$schema",
  "name",
  "account_id",
  "compatibility_date",
  "compatibility_flags",
  "main",
  "find_additional_modules",
  "preserve_file_names",
  "base_dir",
  "workers_dev",
  "preview_urls",
  "routes",
  "route",
  "tsconfig",
  "jsx_factory",
  "jsx_fragment",
  "triggers",
  "limits",
  "rules",
  "build",
  "no_bundle",
  "minify",
  "keep_names",
  "first_party_worker",
  "logpush",
  "upload_source_maps",
  "placement",
  "observability",
  "access",
  "cache",
  "compliance_region",
  "python_modules",
  "define",
  "vars",
  "pages_build_output_dir",
  "send_metrics",
  "dependencies_instrumentation",
  "dev",
  "alias",
  "keep_vars",
  "legacy_env",
  // Written by @cloudflare/vite-plugin into dist/<worker>/wrangler.json and .wrangler/deploy/config.json.
  "configPath",
  "userConfigPath",
  "topLevelName",
  "definedEnvironments",
  "auxiliaryWorkers",
  "targetEnvironment",
]);

/** Keys checked recursively rather than as bindings. */
const NESTED_KEYS = new Set(["env", "previews", "assets"]);

/**
 * Lists the bindings a parsed wrangler config declares: every non-empty key not on the allow-list, plus
 * `assets.binding`, at the top level, under `previews`, and under each `env.<name>` and its `previews`.
 */
export function declaredBindings(config: unknown, prefix = ""): string[] {
  if (!isRecord(config)) return isEmpty(config) ? [] : [`${prefix || "(root)"}: not an object`];
  const found: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (NON_BINDING_KEYS.has(key) || NESTED_KEYS.has(key) || isEmpty(value)) continue;
    found.push(`${prefix}${key}`);
  }
  const assets = config.assets;
  if (isRecord(assets) && !isEmpty(assets.binding)) found.push(`${prefix}assets.binding`);
  if (!isEmpty(config.previews)) found.push(...declaredBindings(config.previews, `${prefix}previews.`));
  const env = config.env;
  if (isRecord(env)) {
    for (const [name, sub] of Object.entries(env)) found.push(...declaredBindings(sub, `${prefix}env.${name}.`));
  } else if (!isEmpty(env)) {
    found.push(`${prefix}env`);
  }
  return found;
}

export interface WallResult {
  ok: boolean;
  lines: string[];
}

const VITE_CONFIG = /^vite\.config\.(c|m)?[jt]s$/;
const CLOUDFLARE_PLUGIN = "@cloudflare/vite-plugin";

/** The folders a Worker may be configured in. Wrangler run from any of them finds only that folder's config. */
export const WORKER_DIRS = ["apps/web", "apps/kit", "workers/web", "workers/kit"] as const;
/** The only source Worker configs allowed: `wrangler.jsonc` in each Worker folder. */
const FIXED_CONFIG = /^(apps|workers)\/(web|kit)\/wrangler\.jsonc$/;
/** What `@cloudflare/vite-plugin` writes: one config per Worker under dist/, and the deploy redirect. */
const GENERATED_CONFIG = /^(apps|workers)\/(web|kit)\/dist\/[^/]+\/wrangler\.json$/;
const DEPLOY_REDIRECT = /^(apps|workers)\/(web|kit)\/\.wrangler\/deploy\/config\.json$/;

/**
 * Files Wrangler (or its experimental config) could load as a Worker config, wherever they are: any name
 * starting `wrangler`, any `cloudflare.config.*`, any `.wrangler/deploy/config.json`, and, to be safe, any other
 * `.jsonc` (except biome and tsconfig files) and any `.toml` except `bunfig.toml`.
 */
function isConfigCandidate(name: string, path: string): boolean {
  if (/^wrangler/i.test(name) || /^cloudflare\.config\./i.test(name)) return true;
  if (/(^|\/)\.wrangler\/deploy\//.test(path) && name === "config.json") return true;
  if (name.endsWith(".jsonc")) return !/^(biome|tsconfig.*)\.jsonc$/.test(name);
  if (name.endsWith(".toml")) return name !== "bunfig.toml";
  return false;
}

/**
 * Prints each wall check's status and fails if Wrangler would load a binding while a check is still pending.
 *
 * Worker configs may exist only as `wrangler.jsonc` in the four Worker folders, plus the Cloudflare plugin's
 * generated `dist/<worker>/wrangler.json` and `.wrangler/deploy/config.json` redirect there; any other file
 * Wrangler could pick up fails, as does a symlink at or on the way to a config. Every allowed config is read by
 * Wrangler itself (`experimental_readRawConfig` for the file as written, `unstable_readConfig` for the
 * top level and each environment as Wrangler normalises them), and a config Wrangler rejects fails closed. For
 * each Worker folder the check then asks Wrangler which config it would load from there (its own find-up and
 * redirect rules) and requires that file to be one it checked. A Vite config that hands the Cloudflare plugin
 * anything beyond a short list of known-safe options also fails.
 */
export function evaluateWall(root: string, checks: readonly WallCheck[] = WALL_CHECKS): WallResult {
  const lines = checks.map((c) => `${c.id}: ${c.status === "pending" ? `pending: ${c.milestone}` : "implemented"}`);
  const anyPending = checks.some((c) => c.status === "pending");
  const problems: string[] = [];
  const canonicalRoot = realpathSync(root);
  const candidates = listFiles(canonicalRoot, ".", isConfigCandidate);
  const checked = new Set<string>();
  let accepted = 0;
  for (const file of candidates) {
    if (!FIXED_CONFIG.test(file) && !GENERATED_CONFIG.test(file) && !DEPLOY_REDIRECT.test(file)) {
      problems.push(
        `${file}: Wrangler could load this as a Worker config; configs live only at ${WORKER_DIRS.map((d) => `${d}/wrangler.jsonc`).join(", ")}`,
      );
      continue;
    }
    const link = symlinkOnPath(canonicalRoot, file);
    if (link) {
      problems.push(`${file}: ${link} is a symlink; Wrangler would follow it, so the wall does not allow it`);
      continue;
    }
    accepted++;
    if (DEPLOY_REDIRECT.test(file)) continue;
    checked.add(file);
    const read = wranglerBindings(join(canonicalRoot, file));
    if (read === undefined) {
      problems.push(`${file}: Wrangler rejects this config; failing closed`);
      continue;
    }
    if (anyPending && read.bindings.length > 0) {
      problems.push(`${file} declares ${read.bindings.join(", ")} while a privacy-wall check is still pending`);
    }
    problems.push(...assetsProblems(canonicalRoot, file, read.raw));
  }
  problems.push(...uploadFolderProblems(canonicalRoot));
  for (const dir of WORKER_DIRS) {
    const link = symlinkOnPath(canonicalRoot, dir);
    if (link) problems.push(`${dir}: ${link} is a symlink; Wrangler would follow it, so the wall does not allow it`);
  }
  // Wrangler's own discovery reads whatever it finds, so it runs only once every path above passed.
  if (problems.length === 0) {
    for (const dir of WORKER_DIRS) problems.push(...checkDiscovery(canonicalRoot, dir, checked));
  }
  const viteConfigs = listFiles(canonicalRoot, ".", (name) => VITE_CONFIG.test(name));
  problems.push(...withParsedFiles(canonicalRoot, viteConfigs, (file, source) => checkViteConfig(file, source)).flat());
  lines.push(`wrangler configs checked: ${accepted}`);
  lines.push(`vite configs checked: ${viteConfigs.length}`);
  for (const p of problems) lines.push(`FAIL ${p}`);
  return { ok: problems.length === 0, lines };
}

/**
 * Bindings in a config as Wrangler reads it: the raw file (so `previews` and every `env.*` are seen as written)
 * and Wrangler's normalised config for the top level and each environment. Returns undefined if Wrangler rejects
 * the file. Wrangler's diagnostics quote file contents, so they are never passed on.
 */
function wranglerBindings(path: string): { bindings: string[]; raw: Record<string, unknown> } | undefined {
  try {
    const { rawConfig } = experimental_readRawConfig({ config: path });
    const found = new Set(declaredBindings(rawConfig));
    const envs = isRecord(rawConfig.env) ? Object.keys(rawConfig.env) : [];
    for (const env of [undefined, ...envs]) {
      const config = unstable_readConfig(
        { config: path, ...(env === undefined ? {} : { env }) },
        { hideWarnings: true },
      );
      for (const binding of declaredBindings(config, env === undefined ? "" : `env.${env}.`)) found.add(binding);
    }
    return { bindings: [...found], raw: rawConfig as Record<string, unknown> };
  } catch {
    return undefined;
  }
}

/**
 * Every `assets.directory` (top level, `previews`, each `env.<name>` and its `previews`) must resolve, as Wrangler
 * resolves it from the config's folder, to the Worker folder's own build output, `dist/client`, with no symlink on
 * the way, so Wrangler can upload nothing else. A Pages output directory fails outright.
 */
function assetsProblems(root: string, file: string, raw: Record<string, unknown>): string[] {
  const folder = file.split("/").slice(0, 2).join("/");
  const approved = `${folder}/dist/client`;
  const scopes: Array<[string, unknown]> = [["", raw]];
  if (isRecord(raw.env)) for (const [name, env] of Object.entries(raw.env)) scopes.push([`env.${name}.`, env]);
  for (const [prefix, scope] of [...scopes]) {
    if (isRecord(scope) && isRecord(scope.previews)) scopes.push([`${prefix}previews.`, scope.previews]);
  }
  const problems: string[] = [];
  for (const [prefix, scope] of scopes) {
    if (!isRecord(scope)) continue;
    if (!isEmpty(scope.pages_build_output_dir)) {
      problems.push(`${file}: ${prefix}pages_build_output_dir is not allowed; Workers assets come from ${approved}`);
    }
    if (!isRecord(scope.assets) || scope.assets.directory === undefined) continue;
    const directory = scope.assets.directory;
    const rel =
      typeof directory === "string" ? insideCheckout(root, resolve(root, dirname(file), directory)) : undefined;
    if (rel !== approved) {
      problems.push(`${file}: ${prefix}assets.directory must be ${approved}, the app's build output`);
    } else if (symlinkOnPath(root, approved)) {
      problems.push(`${file}: ${prefix}assets.directory ${approved} is or passes through a symlink`);
    } else if (existsSync(join(root, approved)) && realpathSync(join(root, approved)) !== join(root, approved)) {
      problems.push(`${file}: ${prefix}assets.directory ${approved} does not resolve to itself`);
    }
  }
  return problems;
}

/**
 * Checks which config Wrangler would load when run from `dir`. The deploy redirect there, and every path it names
 * (`configPath` and each auxiliary Worker's), are first validated without Wrangler: plain JSON, no symlink on the
 * way, resolved with `path.resolve` as Wrangler does, inside the checkout and among the configs checked. Only then
 * is Wrangler's own discovery (find-up plus redirect) asked, and its answer must be one of those configs.
 * Messages name paths and rules only, never file contents.
 */
function checkDiscovery(root: string, dir: string, checked: ReadonlySet<string>): string[] {
  if (!existsSync(join(root, dir))) return [];
  const redirect = `${dir}/.wrangler/deploy/config.json`;
  const allowedTargets = new Set<string>();
  if (existsSync(join(root, redirect))) {
    const redirectLink = symlinkOnPath(root, redirect);
    if (redirectLink) return [`${redirect}: ${redirectLink} is a symlink; not read`];
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(root, redirect), "utf8"));
    } catch {
      return [`${redirect}: not plain JSON as the Cloudflare plugin writes it; not passed to Wrangler`];
    }
    if (!isRecord(parsed) || typeof parsed.configPath !== "string") {
      return [`${redirect}: has no configPath string; not passed to Wrangler`];
    }
    const paths: unknown[] = [parsed.configPath];
    if (Array.isArray(parsed.auxiliaryWorkers)) {
      for (const worker of parsed.auxiliaryWorkers) paths.push(isRecord(worker) ? worker.configPath : undefined);
    } else if (parsed.auxiliaryWorkers !== undefined) {
      return [`${redirect}: auxiliaryWorkers is not a list; not passed to Wrangler`];
    }
    for (const path of paths) {
      const target =
        typeof path === "string" ? insideCheckout(root, resolve(join(root, dirname(redirect)), path)) : undefined;
      if (target === undefined || !checked.has(target) || symlinkOnPath(root, target)) {
        return [`${redirect}: points outside the configs the wall checked; not passed to Wrangler`];
      }
      if (!target.startsWith(`${dir}/dist/`)) {
        return [`${redirect}: points at another Worker's config; a redirect may target only ${dir}/dist/`];
      }
      allowedTargets.add(target);
    }
  }
  let found: { configPath?: string | undefined };
  try {
    found = experimental_readRawConfig(
      { script: join(root, dir, "__wall_probe__.js") },
      { useRedirectIfAvailable: true },
    );
  } catch {
    return [`${dir}: Wrangler cannot resolve a config from here; failing closed`];
  }
  if (found.configPath === undefined) return [];
  let canonical: string;
  try {
    canonical = realpathSync(found.configPath);
  } catch {
    return [`${dir}: Wrangler would load a config that does not exist; failing closed`];
  }
  const rel = insideCheckout(root, canonical);
  if (rel === undefined || !checked.has(rel) || (allowedTargets.size > 0 && !allowedTargets.has(rel))) {
    return [`${dir}: Wrangler would load ${rel ?? "a file outside the checkout"}, a config the wall did not check`];
  }
  if (allowedTargets.size > 0) {
    // `wrangler deploy` with no flags follows the redirect and validates more than an explicit --config read does.
    try {
      unstable_readConfig(
        { script: join(root, dir, "__wall_probe__.js") },
        { useRedirectIfAvailable: true, hideWarnings: true },
      );
    } catch {
      return [`${dir}: Wrangler rejects ${rel} when it follows the deploy redirect; failing closed`];
    }
  }
  return [];
}

/** Vite copies apps/web/public into the build as is, past `server.fs.deny`. */
const PUBLIC_DIR = "apps/web/public";
/** The only files apps/web/public may hold: Cloudflare's headers file (spike PR 7) and the favicon. */
const PUBLIC_FILES: ReadonlySet<string> = new Set(["_headers", "favicon.ico", "favicon.svg"]);
const LOCAL_SECRETS = /^\.dev\.vars(\..*)?$/;

/**
 * Folders whose files end up uploaded: apps/web/public (copied into the build) may hold only the allow-listed
 * files, no folder and no symlink; each Worker folder's dist/client may hold no symlink and no Wrangler local-secrets file (the
 * plugin's own `.assetsignore` is allowed there). Paths only, never contents.
 */
function uploadFolderProblems(root: string): string[] {
  const problems: string[] = [];
  const scan = (folder: string, bad: (name: string, isDirectory: boolean) => boolean, rule: string): void => {
    const link = symlinkOnPath(root, folder);
    if (link) {
      problems.push(`${folder}: ${link} is a symlink; ${rule}`);
      return;
    }
    const walk = (rel: string): void => {
      let entries: Dirent[];
      try {
        entries = readdirSync(join(root, rel), { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const path = `${rel}/${entry.name}`;
        if (entry.isSymbolicLink()) problems.push(`${path}: symlinks are not allowed here; ${rule}`);
        else if (bad(entry.name, entry.isDirectory())) problems.push(`${path}: not allowed here; ${rule}`);
        else if (entry.isDirectory()) walk(path);
      }
    };
    walk(folder);
  };
  scan(
    PUBLIC_DIR,
    (name, isDirectory) => isDirectory || !PUBLIC_FILES.has(name),
    `apps/web/public is copied into the public build, so it may hold only ${[...PUBLIC_FILES].join(", ")}`,
  );
  for (const dir of WORKER_DIRS) {
    scan(`${dir}/dist/client`, (name) => LOCAL_SECRETS.test(name), "dist/client is what Wrangler uploads");
  }
  return problems;
}

/** `path` relative to the checkout with forward slashes, or undefined if it lies outside. */
function insideCheckout(root: string, path: string): string | undefined {
  const rel = relative(root, path).split(sep).join("/");
  return rel === "" || isAbsolute(rel) || rel === ".." || rel.startsWith("../") ? undefined : rel;
}

/** The first path component (from the root down to `path`) that is a symbolic link, if any. */
function symlinkOnPath(root: string, path: string): string | undefined {
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const prefix = parts.slice(0, i).join("/");
    try {
      if (lstatSync(join(root, prefix)).isSymbolicLink()) return prefix;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Cloudflare plugin options (from @cloudflare/vite-plugin 1.70.1's PluginConfig) that cannot bring in another
 * Worker, another config or a public tunnel. `auxiliaryWorkers`, `experimental` (its prerender Worker carries a
 * config), `tunnel`, `config` and `configPath` fail, as does any option added later.
 */
const SAFE_PLUGIN_OPTIONS: ReadonlySet<string> = new Set([
  "viteEnvironment",
  "persistState",
  "inspectorPort",
  "remoteBindings",
  "assetsOnly",
]);

/**
 * Finds every use of the Cloudflare Vite plugin in a Vite config and fails on `config` or `configPath`, and on
 * any use whose options it cannot read: a non-literal argument, a spread, a computed key, or the plugin
 * passed around rather than called.
 */
function checkViteConfig(file: string, source: SourceFile): string[] {
  const problems: string[] = [];
  const callables = new Set<string>();
  const namespaces = new Set<string>();
  const bindings = new Set<Node>();
  for (const statement of source.statements) {
    if (!isImportDeclaration(statement) || !isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== CLOUDFLARE_PLUGIN) continue;
    const clause = statement.importClause;
    if (clause?.name) {
      callables.add(clause.name.text);
      bindings.add(clause.name);
    }
    const named = clause?.namedBindings;
    if (named && isNamespaceImport(named)) {
      namespaces.add(named.name.text);
      bindings.add(named.name);
    } else if (named && isNamedImports(named)) {
      for (const element of named.elements) {
        if ((element.propertyName ?? element.name).text === "cloudflare") callables.add(element.name.text);
        bindings.add(element.name);
      }
    }
  }
  const pluginCallees = new Set<Node>();
  walk(source, (node) => {
    if (isCallExpression(node) && node.expression.kind === SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      const text = arg && (isStringLiteral(arg) || isNoSubstitutionTemplateLiteral(arg)) ? arg.text : undefined;
      if (text === undefined || text === CLOUDFLARE_PLUGIN) {
        problems.push(`${file}:${lineOf(source, node)} imports the Cloudflare plugin dynamically; failing closed`);
      }
      return;
    }
    if (!isCallExpression(node)) return;
    const callee = node.expression;
    const isPlugin =
      (isIdentifier(callee) && callables.has(callee.text)) ||
      (isPropertyAccessExpression(callee) && isIdentifier(callee.expression) && namespaces.has(callee.expression.text));
    if (!isPlugin) return;
    pluginCallees.add(isPropertyAccessExpression(callee) ? callee.expression : callee);
    const where = `${file}:${lineOf(source, node)}`;
    const options = node.arguments[0];
    if (node.arguments.length === 0) return;
    if (node.arguments.length > 1 || !options || !isObjectLiteralExpression(options)) {
      problems.push(`${where} passes Cloudflare plugin options this check cannot read; failing closed`);
      return;
    }
    for (const property of options.properties) {
      let key: string | undefined;
      if (isPropertyAssignment(property)) {
        const name = property.name;
        if (isIdentifier(name) || isStringLiteral(name)) key = name.text;
      } else if (isShorthandPropertyAssignment(property)) {
        const name = property.name;
        if (isIdentifier(name)) key = name.text;
      }
      if (key === undefined) {
        problems.push(`${where} passes a Cloudflare plugin option this check cannot read; failing closed`);
      } else if (key === "config" || key === "configPath") {
        problems.push(
          `${where} passes ${key} to the Cloudflare plugin; keep the Worker config in a wrangler.jsonc the wall reads`,
        );
      } else if (!SAFE_PLUGIN_OPTIONS.has(key)) {
        problems.push(
          `${where} passes ${key} to the Cloudflare plugin; the wall allows only ${[...SAFE_PLUGIN_OPTIONS].join(", ")}`,
        );
      }
    }
  });
  walk(source, (node) => {
    if (!isIdentifier(node) || bindings.has(node) || pluginCallees.has(node)) return;
    const parent = node.parent;
    if (isPropertyAccessExpression(parent) && parent.name === node) return;
    if (isPropertyAssignment(parent) && parent.name === node) return;
    if (callables.has(node.text) || namespaces.has(node.text)) {
      problems.push(
        `${file}:${lineOf(source, node)} uses the Cloudflare plugin other than by calling it; failing closed`,
      );
    }
  });
  return problems;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Null and undefined are empty; an object or array is empty when every value in it is empty. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.every(isEmpty);
  if (isRecord(value)) return Object.values(value).every(isEmpty);
  return false;
}
