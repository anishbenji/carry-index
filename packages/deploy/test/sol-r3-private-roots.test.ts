/**
 * Security round 3, S3-5 (independent review): the private roots named only folders in the code and paths outside the
 * repository, while `.gitignore` keeps private files inside the checkout (the owner's ownership notes in `data/`) and
 * names the never-public folders (handoffs, research, reports, backups, old mocks, local Claude settings). A build
 * run from the owner's checkout could read them unflagged. Every path in those two `.gitignore` sections must be
 * private to the build-graph check and the import ban; this test reads the sections, so the lists stay in sync.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { classifyModules } from "../src/graph-plugin.ts";
import { findPrivateImports } from "../src/imports.ts";
import { isPrivatePath } from "../src/private-roots.ts";
import type { TempDir } from "./helpers.ts";
import { REPO_ROOT, tempDir, writeTree } from "./helpers.ts";

const GITIGNORE = readFileSync(join(REPO_ROOT, ".gitignore"), "utf8").split("\n");

/** The ignored paths of the "Catalogue data (public). Private ownership notes ..." section, up to the blank line. */
function privateDataPaths(): string[] {
  const start = GITIGNORE.findIndex((l) => l.startsWith("# Catalogue data") && l.includes("Private ownership notes"));
  expect(start, "the private data section of .gitignore").toBeGreaterThan(-1);
  const end = GITIGNORE.findIndex((l, i) => i > start && l.trim() === "");
  return GITIGNORE.slice(start + 1, end).filter((l) => l.startsWith("/"));
}

/**
 * The ignored paths of the "Tools: code only. Run state, logs, reports and installed packages stay out." section
 * (security r4, S4-3), except installed packages and bytecode caches, which are rebuilt from public code.
 */
function toolsPaths(): string[] {
  const start = GITIGNORE.findIndex((l) => l.startsWith("# Tools: code only"));
  expect(start, "the tools section of .gitignore").toBeGreaterThan(-1);
  const end = GITIGNORE.findIndex((l, i) => i > start && l.trim() === "");
  return GITIGNORE.slice(start + 1, end)
    .filter((l) => l.startsWith("/"))
    .filter((l) => !/(?:^|\/)(?:node_modules|__pycache__)\/$/.test(l));
}

/** The folders on the "#   /handoffs/ ..." line under "Never public". */
function neverPublicFolders(): string[] {
  const heading = GITIGNORE.findIndex((l) => l.startsWith("# Never public"));
  expect(heading, "the never-public section of .gitignore").toBeGreaterThan(-1);
  const listed = GITIGNORE.slice(heading).find((l) => /^#\s+\/\S+\//.test(l)) ?? "";
  return listed.replace(/^#\s+/, "").split(/\s+/).filter(Boolean);
}

/** A concrete repo-relative path the `.gitignore` entry covers: each `*` becomes `x`, a folder gets a file. */
const example = (entry: string): string => {
  const path = entry.replace(/^\//, "").replaceAll("*", "x");
  return path.endsWith("/") ? `${path}file.json` : path;
};

describe("the private roots cover .gitignore's private paths (S3-5)", () => {
  test("the sections are found and hold what the review named", () => {
    expect(toolsPaths()).toEqual(
      expect.arrayContaining(["/tools/airline-checker/state/", "/tools/airline-checker/reports/", "/tools/_backup*/"]),
    );
    expect(privateDataPaths()).toEqual(expect.arrayContaining(["/data/my-bags.yaml", "/data/my-notes.yaml"]));
    expect(neverPublicFolders()).toEqual(expect.arrayContaining(["/handoffs/", "/research/", "/_backup-*/"]));
  });

  test.each([...privateDataPaths(), ...neverPublicFolders(), ...toolsPaths()])("%s is a private path", (entry) => {
    expect(isPrivatePath(example(entry))).toBe(true);
  });

  test("the build-graph check flags the owner's notes read from the checkout", () => {
    const ids = [join(REPO_ROOT, "data/my-bags.yaml"), join(REPO_ROOT, "data/my-notes.yaml")];
    expect(classifyModules(ids, REPO_ROOT).privateModules).toEqual(["data/my-bags.yaml", "data/my-notes.yaml"]);
  });

  test("the import ban flags a public import of the owner's notes", () => {
    const repo: TempDir = tempDir("cj-private-roots-");
    try {
      writeTree(repo.root, {
        "apps/web/src/main.ts": 'import notes from "../../../data/my-notes.yaml";\nconsole.log(notes);\n',
        "data/my-notes.yaml": "synthetic: true\n",
      });
      expect(findPrivateImports(repo.root).map((i) => i.specifier)).toEqual(["../../../data/my-notes.yaml"]);
    } finally {
      repo.cleanup();
    }
  });

  test("the public catalogue data stays public (positive control)", () => {
    for (const path of [
      "data/brands.yaml",
      "data/bags/example.yaml",
      "data/airlines/airlines.yaml",
      "docs/brief/x.md",
      "tools/airline-checker/check.ts",
      "tools/validate.py",
    ]) {
      expect(isPrivatePath(path)).toBe(false);
    }
  });
});
