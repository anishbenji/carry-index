import { afterEach, describe, expect, it } from "vitest";
import { evaluateE2eGate, evaluateSizeGate, findBuiltPages } from "../src/gates.ts";
import { makeTree } from "./helpers.ts";

let cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups) c();
  cleanups = [];
});
function tree(files: Record<string, string>): string {
  const t = makeTree(files);
  cleanups.push(t.cleanup);
  return t.root;
}

const ROOT_PKG = JSON.stringify({ name: "carry-index", private: true });

describe("findBuiltPages", () => {
  it("lists HTML files under apps/web/dist only", () => {
    const root = tree({
      "package.json": ROOT_PKG,
      "apps/web/dist/client/index.html": "<!doctype html>",
      "apps/web/dist/client/bags/a/index.html": "<!doctype html>",
      "apps/web/dist/server/entry.js": "",
      "apps/web/src/index.html": "<!doctype html>",
    });
    expect(findBuiltPages(root)).toEqual(["apps/web/dist/client/bags/a/index.html", "apps/web/dist/client/index.html"]);
  });

  it("returns nothing when apps/web has not been built", () => {
    expect(findBuiltPages(tree({ "package.json": ROOT_PKG }))).toEqual([]);
  });
});

describe("evaluateSizeGate", () => {
  it("passes with a 'no pages yet' line while apps/web emits no HTML", () => {
    const result = evaluateSizeGate(tree({ "package.json": ROOT_PKG, "apps/web/dist/server/entry.js": "" }));
    expect(result.kind).toBe("pass");
    expect(result.lines.join("\n")).toMatch(/no pages yet/);
  });

  it("fails once apps/web emits a page and no size-limit targets are configured", () => {
    const result = evaluateSizeGate(tree({ "package.json": ROOT_PKG, "apps/web/dist/client/index.html": "x" }));
    expect(result.kind).toBe("fail");
    expect(result.lines.join("\n")).toMatch(/size-limit/);
  });

  it("treats an empty size-limit list as not configured", () => {
    const pkg = JSON.stringify({ name: "carry-index", "size-limit": [] });
    expect(evaluateSizeGate(tree({ "package.json": pkg, "apps/web/dist/client/index.html": "x" })).kind).toBe("fail");
  });

  it("runs size-limit once pages and targets both exist", () => {
    const pkg = JSON.stringify({
      name: "carry-index",
      "size-limit": [{ path: "apps/web/dist/client/**/*.js", limit: "8 KB" }],
    });
    const result = evaluateSizeGate(tree({ "package.json": pkg, "apps/web/dist/client/index.html": "x" }));
    expect(result).toMatchObject({ kind: "run", command: ["size-limit"] });
  });
});

describe("evaluateE2eGate", () => {
  it("passes with a 'no pages yet' line while apps/web emits no HTML", () => {
    const result = evaluateE2eGate(tree({ "package.json": ROOT_PKG }));
    expect(result.kind).toBe("pass");
    expect(result.lines.join("\n")).toMatch(/no pages yet/);
  });

  it("fails once apps/web emits a page and no Playwright config exists", () => {
    const result = evaluateE2eGate(tree({ "package.json": ROOT_PKG, "apps/web/dist/client/index.html": "x" }));
    expect(result.kind).toBe("fail");
    expect(result.lines.join("\n")).toMatch(/playwright\.config\.ts/);
  });

  it("runs Playwright once pages and playwright.config.ts both exist", () => {
    const result = evaluateE2eGate(
      tree({
        "package.json": ROOT_PKG,
        "playwright.config.ts": "export default {};",
        "apps/web/dist/client/index.html": "x",
      }),
    );
    expect(result).toMatchObject({ kind: "run", command: ["playwright", "test"] });
  });
});
