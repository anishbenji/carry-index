import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "./files.ts";
import { parseJsonc } from "./jsonc.ts";

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
 * Wrangler config keys that wire a Worker to a resource. A bare `assets.directory` serves static files
 * and is not a binding; `assets.binding` exposes them to code and counts.
 */
const BINDING_KEYS = [
  "ai",
  "analytics_engine_datasets",
  "browser",
  "d1_databases",
  "dispatch_namespaces",
  "durable_objects",
  "hyperdrive",
  "images",
  "kv_namespaces",
  "mtls_certificates",
  "pipelines",
  "queues",
  "r2_buckets",
  "secrets_store_secrets",
  "send_email",
  "services",
  "tail_consumers",
  "unsafe",
  "vectorize",
  "version_metadata",
  "workflows",
];

/** Lists the binding keys a parsed wrangler config declares, including those under `env.<name>`. */
export function declaredBindings(config: unknown, prefix = ""): string[] {
  if (!isRecord(config)) return [];
  const found: string[] = [];
  for (const key of BINDING_KEYS) {
    if (key in config && !isEmpty(config[key])) found.push(`${prefix}${key}`);
  }
  const assets = config.assets;
  if (isRecord(assets) && typeof assets.binding === "string") found.push(`${prefix}assets.binding`);
  const env = config.env;
  if (isRecord(env)) {
    for (const [name, sub] of Object.entries(env)) found.push(...declaredBindings(sub, `${prefix}env.${name}.`));
  }
  return found;
}

export interface WallResult {
  ok: boolean;
  lines: string[];
}

/**
 * Prints each wall check's status and fails if any wrangler config in the repo declares a binding while a
 * check is still pending. Unreadable configs and wrangler.toml fail closed: the check cannot see inside them.
 */
export function evaluateWall(root: string, checks: readonly WallCheck[] = WALL_CHECKS): WallResult {
  const lines = checks.map((c) => `${c.id}: ${c.status === "pending" ? `pending: ${c.milestone}` : "implemented"}`);
  const anyPending = checks.some((c) => c.status === "pending");
  const problems: string[] = [];
  const configs = listFiles(root, ".", (name) => /^wrangler\.(jsonc?|toml)$/.test(name));
  for (const file of configs) {
    if (file.endsWith(".toml")) {
      problems.push(`${file}: wrangler.toml is not allowed; use wrangler.jsonc so this check can read it`);
      continue;
    }
    let bindings: string[];
    try {
      bindings = declaredBindings(parseJsonc(readFileSync(join(root, file), "utf8")));
    } catch (error) {
      problems.push(`${file}: cannot be parsed (${(error as Error).message}); failing closed`);
      continue;
    }
    if (anyPending && bindings.length > 0) {
      problems.push(`${file} declares ${bindings.join(", ")} while a privacy-wall check is still pending`);
    }
  }
  lines.push(`wrangler configs checked: ${configs.length}`);
  for (const p of problems) lines.push(`FAIL ${p}`);
  return { ok: problems.length === 0, lines };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}
