/**
 * Public-facing workspaces: they may use the schema's types but must never bundle Zod or a schema value. The
 * unified brief exempts only the private Worker (workers/kit), which validates input with the schemas.
 */
export const TYPE_ONLY_DIRS = ["apps/web", "workers/web"] as const;

/** Modules those workspaces may import with `import type` only: Zod and every workspace that carries it. */
export const TYPE_ONLY_MODULES = ["zod", "@cj/schema", "@cj/pipeline"] as const;

/** Workspace folders those modules live in, so a relative import of them counts as importing the module. */
export const TYPE_ONLY_PATHS = ["packages/schema", "packages/pipeline"] as const;
