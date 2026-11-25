import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
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
import { listFiles } from "./files.ts";
import { parseJsonc } from "./jsonc.ts";
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

const DEPLOY_REDIRECT = /(^|\/)\.wrangler\/deploy\/config\.json$/;
const VITE_CONFIG = /^vite\.config\.(c|m)?[jt]s$/;
const CLOUDFLARE_PLUGIN = "@cloudflare/vite-plugin";

/**
 * Which files the wall reads as Wrangler configs: any `wrangler*.json(c)` or `wrangler*.toml`, any other
 * `.jsonc` or `.toml` (Wrangler accepts any name through `--config`) except the tool configs named here, and
 * the Vite plugin's `.wrangler/deploy/config.json` redirect. Generated configs under dist/ are included.
 */
function isWranglerConfig(name: string, path: string): boolean {
  if (DEPLOY_REDIRECT.test(path)) return true;
  if (/^wrangler.*\.(json|jsonc|toml)$/i.test(name)) return true;
  if (name.endsWith(".jsonc")) return !/^(biome|tsconfig.*)\.jsonc$/.test(name);
  if (name.endsWith(".toml")) return name !== "bunfig.toml";
  return false;
}

/**
 * Prints each wall check's status and fails if any Wrangler config in the repo declares a binding while a
 * check is still pending. Fails closed on TOML (it cannot read it), on unparseable configs, on a deploy
 * redirect that points at a config the wall did not check, and on a Vite config that hands the Cloudflare plugin
 * a config the wall cannot see (`config`, `configPath`, or options it cannot read).
 */
export function evaluateWall(root: string, checks: readonly WallCheck[] = WALL_CHECKS): WallResult {
  const lines = checks.map((c) => `${c.id}: ${c.status === "pending" ? `pending: ${c.milestone}` : "implemented"}`);
  const anyPending = checks.some((c) => c.status === "pending");
  const problems: string[] = [];
  const configs = listFiles(root, ".", isWranglerConfig);
  const checked = new Set(configs);
  for (const file of configs) {
    if (file.endsWith(".toml")) {
      problems.push(`${file}: TOML is not allowed for Wrangler configs; use wrangler.jsonc so this check can read it`);
      continue;
    }
    let config: unknown;
    try {
      config = parseJsonc(readFileSync(join(root, file), "utf8"));
    } catch (error) {
      problems.push(`${file}: cannot be parsed (${(error as Error).message}); failing closed`);
      continue;
    }
    const bindings = declaredBindings(config);
    if (anyPending && bindings.length > 0) {
      problems.push(`${file} declares ${bindings.join(", ")} while a privacy-wall check is still pending`);
    }
    if (DEPLOY_REDIRECT.test(file)) problems.push(...checkRedirect(root, file, config, checked));
  }
  const viteConfigs = listFiles(root, ".", (name) => VITE_CONFIG.test(name));
  problems.push(...withParsedFiles(root, viteConfigs, (file, source) => checkViteConfig(file, source)).flat());
  lines.push(`wrangler configs checked: ${configs.length}`);
  lines.push(`vite configs checked: ${viteConfigs.length}`);
  for (const p of problems) lines.push(`FAIL ${p}`);
  return { ok: problems.length === 0, lines };
}

/** The deploy redirect must point only at configs inside the repo that this run checked. */
function checkRedirect(root: string, file: string, config: unknown, checked: ReadonlySet<string>): string[] {
  if (!isRecord(config)) return [`${file}: not an object`];
  const targets: unknown[] = [config.configPath];
  if (Array.isArray(config.auxiliaryWorkers)) {
    for (const aux of config.auxiliaryWorkers) targets.push(isRecord(aux) ? aux.configPath : aux);
  }
  const problems: string[] = [];
  for (const target of targets) {
    if (typeof target !== "string") {
      problems.push(`${file}: a configPath is missing or not a string; failing closed`);
      continue;
    }
    const resolved = relative(root, join(root, dirname(file), target))
      .split(sep)
      .join("/");
    if (resolved.startsWith("../") || !existsSync(join(root, resolved)) || !checked.has(resolved)) {
      problems.push(`${file} points at ${target}, a config this check did not read; failing closed`);
    }
  }
  return problems;
}

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
