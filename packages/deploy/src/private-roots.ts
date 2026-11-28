/**
 * The private side of the privacy wall, shared by the source import ban (`imports.ts`) and the build-graph check
 * (`graph-plugin.ts`, security-sol r2 S2-4). Dependency-free, so the Vite config can load it.
 */

/** Private packages by name; a subpath of one (`@cj/kit/x`) is private too. */
export const PRIVATE_PACKAGES = ["@cj/schema/private", "@cj/schema/src/private", "@cj/kit", "@cj/worker-kit"];
/**
 * Private folders, repo-relative; a path import that lands in one is private. Besides the private app, Worker and
 * schemas: the never-public folders `.gitignore` names ("Never public: handoffs ..., research and report dumps, ...
 * old page mocks ..., local Claude settings"), which can sit in the owner's checkout (security r3, S3-5).
 */
export const PRIVATE_FOLDERS = [
  "packages/schema/src/private",
  "apps/kit",
  "workers/kit",
  "handoffs",
  "research",
  "reports",
  "design",
  ".claude",
  // `.gitignore`'s "Tools: code only. Run state, logs, reports ... stay out" (security r4, S4-3).
  "tools/airline-checker/state",
  "tools/airline-checker/reports",
];

/**
 * Private files inside the checkout, repo-relative: `.gitignore`'s "Private ownership notes and third-party seed
 * data stay out" entries (security r3, S3-5). `test/sol-r3-private-roots.test.ts` keeps this list in step with it.
 */
export const PRIVATE_FILES = [
  "data/my-bags.yaml",
  "data/my-notes.yaml",
  "data/airlines/willmybagfit-seed.psv",
  // The airline checker's ignored local config, from the same Tools section.
  "tools/airline-checker/search.config.json",
];

/**
 * Private folders named by pattern: `.gitignore`'s backup folders, top-level `_backup-` and `tools/_backup` with any
 * suffix.
 */
const PRIVATE_FOLDER_PATTERNS = [/^_backup-[^/]*(?:\/|$)/, /^tools\/_backup[^/]*(?:\/|$)/];

/** Whether a repo-relative path lies in a private folder or is a private file (not counting installed packages). */
export function isPrivateRepoPath(rel: string): boolean {
  return (
    PRIVATE_FOLDERS.some((folder) => rel === folder || rel.startsWith(`${folder}/`)) ||
    PRIVATE_FILES.includes(rel) ||
    PRIVATE_FOLDER_PATTERNS.some((pattern) => pattern.test(rel))
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const INSTALLED_PRIVATE = PRIVATE_PACKAGES.map(
  (name) => new RegExp(`(^|/)node_modules/(\\.bun/[^/]+/node_modules/)?${escapeRegExp(name)}(/|$)`),
);

/**
 * Whether a repo-relative path (forward slashes) is private: in a private folder, a private file, in an installed
 * copy of a private package, or outside the repository altogether (private data lives outside it, unified brief "privacy wall").
 */
export function isPrivatePath(rel: string): boolean {
  if (rel === ".." || rel.startsWith("../") || rel.startsWith("/") || /^[A-Za-z]:/.test(rel)) return true;
  if (isPrivateRepoPath(rel)) return true;
  return INSTALLED_PRIVATE.some((pattern) => pattern.test(rel));
}
