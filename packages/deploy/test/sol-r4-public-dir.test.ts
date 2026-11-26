/**
 * Security round 4, S4-2: Vite copies `public/` into the output following links (`copyDir` uses `statSync` and
 * `copyFileSync`), so a symlink there deploys its target as an ordinary file that the seal's own walk cannot tell
 * apart. The plugin walks `config.publicDir` with `lstat` in `configResolved` and fails the build on any link, any
 * file with more than one link, any special file and any private path.
 */
import { linkSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { moduleGraph } from "../src/graph-plugin.ts";
import type { TempDir } from "./helpers.ts";
import { MINIMAL_PAGE, REPO_ROOT, tempDir, writeTree } from "./helpers.ts";

const temps: TempDir[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) t.cleanup();
});

/** A temp repository with an `apps/web/public` folder holding `files`; returns its root. */
function repo(files: Record<string, string> = {}): string {
  const dir = tempDir("cj-public-dir-repo-");
  temps.push(dir);
  writeTree(dir.root, { "apps/web/public/_headers": "/*\n  X-Content-Type-Options: nosniff\n", ...files });
  return dir.root;
}

function resolveWith(root: string, publicDir: string) {
  const plugin = moduleGraph({ repoRoot: root });
  return () => plugin.configResolved({ root: join(root, "apps/web"), publicDir, build: { assetsInlineLimit: 0 } });
}

describe("the public folder is copied only as plain, public files (S4-2)", () => {
  test("a symlinked file in public/ fails the build", () => {
    const root = repo({ "design/old-mock.html": MINIMAL_PAGE });
    symlinkSync(join(root, "design/old-mock.html"), join(root, "apps/web/public/preview.html"));
    expect(resolveWith(root, join(root, "apps/web/public"))).toThrow(/symlink.*apps\/web\/public\/preview\.html/);
  });

  test("a symlinked folder in public/ fails the build", () => {
    const root = repo({ "research/notes.html": MINIMAL_PAGE });
    symlinkSync(join(root, "research"), join(root, "apps/web/public/notes"));
    expect(resolveWith(root, join(root, "apps/web/public"))).toThrow(/symlink.*apps\/web\/public\/notes/);
  });

  test("a hard-linked file in public/ fails the build", () => {
    const root = repo({ "data/my-notes.yaml": "synthetic: true\n" });
    linkSync(join(root, "data/my-notes.yaml"), join(root, "apps/web/public/notes.yaml"));
    expect(resolveWith(root, join(root, "apps/web/public"))).toThrow(/hard-link.*apps\/web\/public\/notes\.yaml/);
  });

  test("a public folder inside a private folder fails the build", () => {
    const root = repo({ "apps/kit/public/index.html": MINIMAL_PAGE });
    expect(resolveWith(root, join(root, "apps/kit/public"))).toThrow(/private.*apps\/kit\/public\/index\.html/);
  });

  test("a public folder outside the repository fails the build", () => {
    const root = repo();
    const outside = tempDir("cj-public-dir-outside-");
    temps.push(outside);
    writeTree(outside.root, { "export.html": MINIMAL_PAGE });
    expect(resolveWith(root, outside.root)).toThrow(/outside the repository/);
  });

  test("plain files, no public folder, or a missing one pass (positive control)", () => {
    const root = repo({ "apps/web/public/favicon.svg": "<svg/>", "apps/web/public/fonts/a.woff2": "x" });
    mkdirSync(join(root, "apps/web/public/empty"));
    expect(resolveWith(root, join(root, "apps/web/public"))).not.toThrow();
    expect(resolveWith(root, "")).not.toThrow();
    expect(resolveWith(root, join(root, "apps/web/missing"))).not.toThrow();
  });

  test("the real apps/web public folder passes (positive control)", () => {
    expect(resolveWith(REPO_ROOT, join(REPO_ROOT, "apps/web/public"))).not.toThrow();
  });
});
