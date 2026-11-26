import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import {
  isArrayLiteralExpression,
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isMetaProperty,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
} from "typescript/unstable/ast/is";
import { API } from "typescript/unstable/sync";
import { isPrivatePath, isPrivateRepoPath, PRIVATE_FILES, PRIVATE_FOLDERS, PRIVATE_PACKAGES } from "./private-roots.ts";
import { byCodeUnit } from "./walk.ts";

export interface PrivateImport {
  /** Repo-relative, forward slashes. */
  file: string;
  line: number;
  specifier: string;
}

/**
 * The import ban, grown for the privacy wall (design v2, section 5): the public side (`apps/web`, `workers/web`,
 * which holds the beacon, and `packages/pipeline`) never imports, even with `import type`, the private schemas
 * (`@cj/schema/private`, `packages/schema/src/private`) or anything in the private app or Worker (`@cj/kit`,
 * `@cj/worker-kit`, `apps/kit`, `workers/kit`). Returns every such import under `root`, sorted by file and line.
 */
export function findPrivateImports(root: string): PrivateImport[] {
  const base = resolve(root);
  const files = PUBLIC_SIDE.flatMap((dir) => sourceFiles(base, dir));
  const found = parseEach(base, files, (file, source) => [
    ...importsIn(source)
      .filter(({ specifier, glob }) => (glob ? globIsPrivate(base, file, specifier) : isPrivate(base, file, specifier)))
      .map(({ line, specifier }) => ({ file, line, specifier })),
    ...(VITE_CONFIG.test(file.split("/").pop() ?? "")
      ? viteAliases(source).map((line) => ({ file, line, specifier: alias("resolve.alias") }))
      : []),
  ]).flat();
  found.push(...PUBLIC_SIDE.flatMap((dir) => configAliases(base, dir)));
  return found.sort((a, b) => byCodeUnit(a.file, b.file) || a.line - b.line);
}

/** The public side: the site, its Worker (which holds the beacon) and the public pipeline. */
const PUBLIC_SIDE = ["apps/web", "workers/web", "packages/pipeline"];
/** Folders of build output and installed packages: not source the public side wrote. */
const SKIPPED = new Set(["node_modules", "dist", ".tsbuild", ".wrangler"]);
const SOURCE = /\.(?:m|c)?[jt]sx?$/;
/** Stands in for the specifier of a dynamic import whose argument is not a literal: it could load anything. */
export const NON_LITERAL = "(non-literal dynamic import)";

/** Source files under `root/dir`, repo-relative with forward slashes. Linked folders are not followed. */
function sourceFiles(root: string, dir: string): string[] {
  const found: string[] = [];
  const visit = (abs: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const full = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) visit(full);
      } else if ((entry.isFile() || entry.isSymbolicLink()) && SOURCE.test(entry.name)) {
        found.push(relative(root, full).split(sep).join("/"));
      }
    }
  };
  visit(join(root, dir));
  return found.sort(byCodeUnit);
}

/** Every module specifier in a file, type-only imports and `import("x")` types included. */
/** `import.meta`, the object Vite's `glob` and asset `new URL(..., import.meta.url)` hang off. */
function isImportMeta(node: Node): boolean {
  return isMetaProperty(node) && node.keywordToken === SyntaxKind.ImportKeyword && node.name.text === "meta";
}

function importsIn(source: SourceFile): Array<{ line: number; specifier: string; glob?: true }> {
  const found: Array<{ line: number; specifier: string; glob?: true }> = [];
  const add = (node: Node, specifier: string | undefined, glob?: true): void => {
    if (specifier !== undefined) found.push({ line: lineOf(source, node), specifier, ...(glob ? { glob } : {}) });
  };
  walk(source, (node) => {
    if (isImportDeclaration(node) || isExportDeclaration(node)) {
      if (node.moduleSpecifier) add(node, literalText(node.moduleSpecifier));
    } else if (isImportEqualsDeclaration(node)) {
      if (isExternalModuleReference(node.moduleReference)) add(node, literalText(node.moduleReference.expression));
    } else if (isImportTypeNode(node)) {
      const argument = node.argument;
      add(node, isLiteralTypeNode(argument) ? literalText(argument.literal) : NON_LITERAL);
    } else if (isNewExpression(node)) {
      // new URL("<path>", import.meta.url): Vite copies the file it names into the build.
      const [first, second] = node.arguments ?? [];
      const isAssetUrl =
        isIdentifier(node.expression) &&
        node.expression.text === "URL" &&
        second !== undefined &&
        isPropertyAccessExpression(second) &&
        isImportMeta(second.expression) &&
        second.name.text === "url";
      if (isAssetUrl) add(node, (first && literalText(first)) ?? NON_LITERAL);
    } else if (isCallExpression(node)) {
      const callee = node.expression;
      if (isPropertyAccessExpression(callee) && isImportMeta(callee.expression) && callee.name.text === "glob") {
        // import.meta.glob("<pattern>" | ["<pattern>", ...]): Vite bundles every match.
        const arg = node.arguments[0];
        const patterns = arg && isArrayLiteralExpression(arg) ? [...arg.elements] : arg ? [arg] : [];
        if (patterns.length === 0) add(node, NON_LITERAL);
        for (const pattern of patterns) add(node, literalText(pattern) ?? NON_LITERAL, true);
        // Vite resolves every pattern against `options.base` (Neon N2): an options argument must be a literal object
        // of named properties, none of them `base`; anything else could point the glob anywhere.
        const options = node.arguments[1];
        if (options !== undefined && !globOptionsSafe(options)) add(node, NON_LITERAL);
        return;
      }
      const isDynamicImport = callee.kind === SyntaxKind.ImportKeyword;
      const isRequire = isIdentifier(callee) && callee.text === "require";
      if (!isDynamicImport && !isRequire) return;
      const arg = node.arguments[0];
      const text = arg ? literalText(arg) : undefined;
      add(node, text ?? NON_LITERAL);
    }
  });
  return found;
}

/**
 * The glob options the import ban accepts (Neon N2, tightened after the automated review): `eager`, `import` and
 * `query`, each a plain property with a literal string or boolean value. `base` moves where patterns resolve,
 * `exhaustive` walks into `node_modules` and dot folders, and any other name or a computed, shorthand or spread
 * property could do either, so all are refused.
 */
const SAFE_GLOB_OPTIONS: ReadonlySet<string> = new Set(["eager", "import", "query"]);

function globOptionsSafe(options: Node): boolean {
  if (!isObjectLiteralExpression(options)) return false;
  return options.properties.every((property) => {
    if (!isPropertyAssignment(property)) return false;
    const name = property.name;
    const text =
      isIdentifier(name) || isStringLiteral(name) || isNoSubstitutionTemplateLiteral(name) ? name.text : undefined;
    const value = property.initializer;
    const literal =
      isStringLiteral(value) ||
      isNoSubstitutionTemplateLiteral(value) ||
      value.kind === SyntaxKind.TrueKeyword ||
      value.kind === SyntaxKind.FalseKeyword;
    return text !== undefined && SAFE_GLOB_OPTIONS.has(text) && literal;
  });
}

function isPrivate(root: string, file: string, written: string): boolean {
  if (written === NON_LITERAL) return true;
  // Vite's `?raw`, `?url` and `#...` suffixes name the same file: strip them before every check, as the
  // build-graph check does (Neon N11).
  const specifier = written.replace(/[?#].*$/s, "");
  if (PRIVATE_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`))) return true;
  if (!/^(?:\.|\/|file:)/.test(specifier)) return false;
  const path = specifier.startsWith("file:") ? fileURLToPath(specifier) : specifier;
  const target = resolve(root, dirname(file), path);
  // Both the path as written and, when it exists, where it really lands (a linked folder could hide the target).
  const candidates = [target];
  if (existsSync(target)) candidates.push(realpathSync(target));
  const realRoot = realpathSync(root);
  return candidates.some((candidate) => {
    const rel = relative(candidate === target ? root : realRoot, candidate)
      .split(sep)
      .join("/");
    if (isPrivateRepoPath(rel)) return true;
    return PRIVATE_PACKAGES.some((name) =>
      new RegExp(`(^|/)node_modules/(\\.bun/[^/]+/node_modules/)?${escapeRegExp(name)}(/|$)`).test(rel),
    );
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function literalText(node: Node): string | undefined {
  return isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
    return undefined;
  });
}

function lineOf(source: SourceFile, node: Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/**
 * Parses files with TypeScript 7's own parser, the same way as `packages/checks` (`parse.ts`): a virtual tsconfig
 * lists exactly the files, with module resolution and the default library off, so nothing else is read. Runs
 * under Node (Vitest), not Bun.
 */
function parseEach<T>(root: string, files: readonly string[], visit: (file: string, source: SourceFile) => T): T[] {
  if (files.length === 0) return [];
  const absolute = files.map((f) => join(root, f));
  const configPath = join(root, "__cj_deploy_virtual__", "tsconfig.json");
  const config = JSON.stringify({
    files: absolute,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noResolve: true,
      noLib: true,
      types: [],
      jsx: "preserve",
      module: "preserve",
      target: "esnext",
    },
  });
  const api = new API({
    cwd: root,
    fs: {
      readFile: (name: string) => (name === configPath ? config : undefined),
      fileExists: (name: string) => (name === configPath ? true : undefined),
    },
  });
  try {
    const project = api.updateSnapshot({ openProject: configPath }).getProject(configPath);
    if (!project) throw new Error("TypeScript did not open the virtual project");
    return files.map((file, i) => {
      const source = project.program.getSourceFile(absolute[i] ?? "");
      if (!source) throw new Error(`TypeScript could not parse ${file}`);
      return visit(file, source);
    });
  } finally {
    api.close();
  }
}

const VITE_CONFIG = /^vite\.config\.[cm]?[jt]s$/;
const alias = (kind: string): string => `(alias configuration: ${kind})`;

/**
 * Lines of a Vite config that mention `alias` at all: a property, a computed key, a member assignment or a string.
 * Stricter than resolving the config, and none is needed today.
 */
function viteAliases(source: SourceFile): number[] {
  const lines = new Set<number>();
  walk(source, (node) => {
    if (
      (isIdentifier(node) || isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) &&
      node.text === "alias"
    ) {
      lines.add(lineOf(source, node));
    }
  });
  return [...lines].sort((a, b) => a - b);
}

/**
 * Specifier aliases in public-side config files: `paths` or `baseUrl` in any `tsconfig*.json`, and `imports` in a
 * `package.json`. They are refused outright: an alias could point anywhere, and none is needed today.
 */
function configAliases(root: string, dir: string): PrivateImport[] {
  const found: PrivateImport[] = [];
  const visit = (abs: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) visit(full);
        continue;
      }
      const isTsconfig = /^(?:ts|js)config.*\.json$/.test(entry.name);
      const keys = isTsconfig ? ["paths", "baseUrl"] : entry.name === "package.json" ? ["imports"] : [];
      if (keys.length === 0) continue;
      const lines = readFileSync(full, "utf8").split("\n");
      const file = relative(root, full).split(sep).join("/");
      for (const key of keys) {
        const at = lines.findIndex((l) => new RegExp(`"${key}"\\s*:`).test(l));
        if (at !== -1) found.push({ file, line: at + 1, specifier: alias(key) });
        else if (isTsconfig) {
          // Inherited through `extends`: reported at the `extends` line.
          const inherited = extendedKeys(full, new Set());
          const line = lines.findIndex((l) => /"extends"\s*:/.test(l));
          if (inherited.has(key) && line !== -1) found.push({ file, line: line + 1, specifier: alias(key) });
        }
      }
    }
  };
  visit(join(root, dir));
  return found;
}

/**
 * Whether a glob pattern can match inside a private folder. Its fixed directory (the whole path segments before the
 * first `*`, `?`, `{` or `[`), resolved from the file (or, for a pattern starting with `/`, from its public
 * workspace), and that directory's real path when it exists, must neither lie in a private folder nor contain one;
 * a fixed directory through `node_modules` is refused outright.
 */
function globIsPrivate(root: string, file: string, pattern: string): boolean {
  if (pattern === NON_LITERAL) return true;
  const positive = pattern.startsWith("!") ? pattern.slice(1) : pattern;
  // Vite leaves `**` unanchored and resolves bare specifiers as packages (Neon N2): only anchored patterns are read.
  if (!/^(?:\.\.?\/|\/)/.test(positive)) return true;
  const fixed = positive.split(/[*?{[]/)[0] ?? "";
  const directory = fixed.slice(0, fixed.lastIndexOf("/") + 1);
  // Vite joins the pattern with posix.join, which collapses a wildcard segment followed by `..`, so the fixed folder
  // says nothing about where such a pattern lands (Neon N10). No `..` after the first metacharacter, and no
  // `node_modules` segment anywhere.
  if (/(?:^|\/)\.\.(?:\/|$)/.test(positive.slice(fixed.length))) return true;
  if (/(^|\/)node_modules(\/|$)/.test(positive)) return true;
  const workspace = PUBLIC_SIDE.find((d) => file === d || file.startsWith(`${d}/`)) ?? dirname(file);
  const from = directory.startsWith("/") ? join(root, workspace) : join(root, dirname(file));
  const target = resolve(from, `./${directory.replace(/^\/+/, "")}`);
  const candidates = [relative(root, target)];
  if (existsSync(target)) candidates.push(relative(realpathSync(root), realpathSync(target)));
  return candidates.some((candidate) => {
    const rel = candidate.split(sep).join("/");
    // isPrivatePath also refuses a target at or outside the repository root (`..`, Neon N10).
    return (
      isPrivatePath(rel) ||
      rel === "" ||
      [...PRIVATE_FOLDERS, ...PRIVATE_FILES].some((private_) => private_.startsWith(`${rel}/`))
    );
  });
}

/** The alias keys (`paths`, `baseUrl`) a tsconfig inherits through relative `extends`, followed to the end. */
function extendedKeys(file: string, seen: Set<string>): Set<string> {
  const keys = new Set<string>();
  if (seen.has(file)) return keys;
  seen.add(file);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return keys;
  }
  const parent = /"extends"\s*:\s*"([^"]+)"/.exec(text)?.[1];
  if (!parent || !/^\.{1,2}\//.test(parent)) return keys;
  const target = resolve(dirname(file), parent.endsWith(".json") ? parent : `${parent}.json`);
  const parentText = existsSync(target) ? readFileSync(target, "utf8") : "";
  for (const key of ["paths", "baseUrl"]) if (new RegExp(`"${key}"\\s*:`).test(parentText)) keys.add(key);
  for (const key of extendedKeys(target, seen)) keys.add(key);
  return keys;
}
