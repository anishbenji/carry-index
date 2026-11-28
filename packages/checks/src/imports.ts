import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import {
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
} from "typescript/unstable/ast/is";
import { listFiles } from "./files.ts";
import { lineOf, walk, withParsedFiles } from "./parse.ts";

export interface ValueImport {
  line: number;
  specifier: string;
}

/** Stands in for the specifier of a dynamic import whose argument is not a literal. */
export const NON_LITERAL = "(non-literal dynamic import)";

/**
 * Finds every import, re-export, `require` or dynamic import of a banned module that is not type-only, using
 * TypeScript 7's parser. Only `import type`, `export type` and `import type x = require()` count as type-only:
 * an import whose specifiers are all inline `type` names still compiles to a side-effect import under
 * `verbatimModuleSyntax`, which would pull the module into the bundle. A dynamic import whose argument is not a
 * literal is reported too, because it could load anything. A specifier is banned when it equals a banned name or
 * is a subpath of it (`zod/v4`).
 */
export function findValueImportsIn(
  source: SourceFile,
  banned: readonly string[],
  isBannedPath: (specifier: string) => boolean = () => false,
): ValueImport[] {
  const isBanned = (specifier: string): boolean =>
    banned.some((name) => specifier === name || specifier.startsWith(`${name}/`)) || isBannedPath(specifier);
  const found: ValueImport[] = [];
  walk(source, (node) => {
    let specifier: string | undefined;
    if (isImportDeclaration(node)) {
      if (node.importClause?.phaseModifier === SyntaxKind.TypeKeyword) return;
      specifier = literalText(node.moduleSpecifier);
    } else if (isExportDeclaration(node)) {
      if (node.isTypeOnly || !node.moduleSpecifier) return;
      specifier = literalText(node.moduleSpecifier);
    } else if (isImportEqualsDeclaration(node)) {
      if (node.isTypeOnly || !isExternalModuleReference(node.moduleReference)) return;
      specifier = literalText(node.moduleReference.expression);
    } else if (isCallExpression(node)) {
      const callee = node.expression;
      const isDynamicImport = callee.kind === SyntaxKind.ImportKeyword;
      const isRequire = isIdentifier(callee) && callee.text === "require";
      if (!isDynamicImport && !isRequire) return;
      const arg = node.arguments[0];
      specifier = arg ? literalText(arg) : undefined;
      if (specifier === undefined && isDynamicImport) {
        found.push({ line: lineOf(source, node), specifier: NON_LITERAL });
      }
    }
    if (specifier !== undefined && isBanned(specifier)) found.push({ line: lineOf(source, node), specifier });
  });
  return found.sort((a, b) => a.line - b.line);
}

/** Parses source text held in memory (as a .tsx file) and reports its banned value imports. */
export function findValueImports(text: string, banned: readonly string[]): ValueImport[] {
  const file = "__cj_checks_source__.tsx";
  const [found] = withParsedFiles("/__cj_checks__", [file], (_file, source) => findValueImportsIn(source, banned), {
    [file]: text,
  });
  return found ?? [];
}

/** Scans every TypeScript and JavaScript source under `dir`, skipping node_modules and build output. */
export function scanImports(
  root: string,
  dir: string,
  banned: readonly string[],
  bannedPaths: readonly string[] = [],
): Array<ValueImport & { file: string }> {
  const files = listFiles(
    root,
    dir,
    (name) => /\.(m|c)?[jt]sx?$/.test(name),
    new Set(["dist", ".tsbuild", ".wrangler"]),
  );
  return withParsedFiles(root, files, (file, source) =>
    findValueImportsIn(source, banned, (specifier) => reachesBanned(root, file, specifier, banned, bannedPaths)).map(
      (f) => ({ file, ...f }),
    ),
  ).flat();
}

/**
 * Whether a relative or absolute specifier, resolved from the importing file, lands in a banned workspace folder
 * (`packages/schema`) or in a banned package's folder under any node_modules (Bun's `.bun/<pkg>@<v>` store too).
 */
function reachesBanned(
  root: string,
  file: string,
  specifier: string,
  banned: readonly string[],
  bannedPaths: readonly string[],
): boolean {
  if (!/^(\.|\/|file:)/.test(specifier)) return false;
  const path = specifier.startsWith("file:") ? fileURLToPath(specifier) : specifier;
  const rel = relative(root, resolve(root, dirname(file), path))
    .split(sep)
    .join("/");
  if (bannedPaths.some((p) => rel === p || rel.startsWith(`${p}/`))) return true;
  return banned.some((name) =>
    new RegExp(`(^|/)node_modules/(\\.bun/[^/]+/node_modules/)?${escapeRegExp(name)}(/|$)`).test(rel),
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function literalText(node: Node): string | undefined {
  return isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
}
