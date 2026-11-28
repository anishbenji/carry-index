import type { Node, SourceFile } from "typescript/unstable/ast";
import { API } from "typescript/unstable/sync";

/**
 * Parses files with TypeScript 7's own parser and hands each syntax tree to `visit`.
 *
 * TypeScript 7 has no in-process `createSourceFile`: its JavaScript API drives the native compiler over a pipe.
 * The files are opened as a project through a virtual tsconfig that lists exactly them, with module resolution
 * and the default library off, so nothing else is read. The API reaches into Node's stream internals, so this
 * runs under Node (Vitest, or `node` for the CLIs), not under Bun's runtime.
 *
 * @param root absolute directory the relative `files` are under
 * @param files repo-relative paths with forward slashes
 * @param contents optional in-memory text for some of `files`, served instead of the disk
 */
export function withParsedFiles<T>(
  root: string,
  files: readonly string[],
  visit: (file: string, source: SourceFile) => T,
  contents: Readonly<Record<string, string>> = {},
): T[] {
  if (files.length === 0) return [];
  const absolute = files.map((f) => `${root.replace(/\/$/, "")}/${f}`);
  const configPath = `${root.replace(/\/$/, "")}/__cj_checks_virtual__/tsconfig.json`;
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
  const virtual = new Map<string, string>([[configPath, config]]);
  files.forEach((file, i) => {
    const text = contents[file];
    if (text !== undefined) virtual.set(absolute[i] ?? "", text);
  });
  const api = new API({
    cwd: root,
    fs: {
      readFile: (name: string) => virtual.get(name),
      fileExists: (name: string) => (virtual.has(name) ? true : undefined),
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

/** Calls `visit` on every node of a syntax tree, depth first. */
export function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
    return undefined;
  });
}

/** One-based line of a node's first token. */
export function lineOf(source: SourceFile, node: Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}
