/** Workspaces that may use the schema's types but must never bundle Zod or a schema value. */
export const TYPE_ONLY_DIRS = ["apps/web"] as const;

/** Modules those workspaces may import with `import type` only. */
export const TYPE_ONLY_MODULES = ["zod", "@cj/schema"] as const;

/** Workspace folders those modules live in, so a relative import of them counts as importing the module. */
export const TYPE_ONLY_PATHS = ["packages/schema"] as const;
