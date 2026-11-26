/**
 * Security round 3, S3-1: files the public build reads as assets (`new URL(..., import.meta.url)`, CSS `@import` and
 * `url()`) never become modules, so the module list alone misses them. The plugin also checks every file the build
 * watched and every output asset's `originalFileNames`, and forces `build.assetsInlineLimit: 0` so nothing is inlined
 * out of sight. Vite 8.3.8 runs on Rolldown 1.2.19, whose plugin context has `addWatchFile` but no `getWatchFiles`,
 * so the plugin records the `addWatchFile` calls instead (Vite's CSS plugin reports each `@import` there). The real
 * Vite cases are in `sol-r3-graph.slow.test.ts`.
 */
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { GraphContext } from "../src/graph-plugin.ts";
import { moduleGraph } from "../src/graph-plugin.ts";
import { REPO_ROOT } from "./helpers.ts";

const WEB = join(REPO_ROOT, "apps", "web");
const fail = (message: string): never => {
  throw new Error(message);
};

/** A plugin context like Rolldown's: `addWatchFile` lives on a shared prototype that every plugin's context uses. */
class FakeContextBase {
  readonly watched: string[] = [];
  addWatchFile(id: string): void {
    this.watched.push(id);
  }
}

function contexts(ids: string[] = [join(WEB, "src/main.tsx")]) {
  class Base extends FakeContextBase {}
  const own = Object.assign(new Base(), { getModuleIds: () => ids, error: fail });
  const other = new Base();
  return { own: own as unknown as GraphContext & FakeContextBase, other };
}

function started(ids?: string[]) {
  const plugin = moduleGraph({ repoRoot: REPO_ROOT });
  plugin.configResolved({ root: WEB, build: { assetsInlineLimit: 0 } });
  const { own, other } = contexts(ids);
  plugin.buildStart.call(own);
  return { plugin, own, other };
}

describe("the moduleGraph plugin checks asset routes (S3-1)", () => {
  test("it sets build.assetsInlineLimit to 0, and refuses a build that resolves another limit", () => {
    const plugin = moduleGraph({ repoRoot: REPO_ROOT });
    expect(plugin.config()).toEqual({ build: { assetsInlineLimit: 0 } });
    expect(() => plugin.configResolved({ root: WEB, build: { assetsInlineLimit: 4096 } })).toThrow(/assetsInlineLimit/);
  });

  test("a private file another plugin watched (a CSS @import) fails the build", () => {
    const { plugin, own, other } = started();
    other.addWatchFile(join(REPO_ROOT, "apps/kit/src/private.css"));
    expect(() => plugin.generateBundle.call(own, { dir: "/tmp/cj-unused" }, {})).toThrow(
      /apps\/kit\/src\/private\.css/,
    );
  });

  test("a file watched from a transform-hook context, whose class has its own addWatchFile, fails the build", () => {
    const { plugin, own } = started();
    // Rolldown's TransformPluginContextImpl defines addWatchFile itself and forwards it to a native binding.
    class TransformContext {
      readonly forwarded: string[] = [];
      addWatchFile(id: string): void {
        this.forwarded.push(id);
      }
    }
    const first = new TransformContext();
    const css = new TransformContext();
    plugin.transform.call(first);
    css.addWatchFile(join(REPO_ROOT, "apps/kit/src/private.css"));
    expect(css.forwarded).toEqual([join(REPO_ROOT, "apps/kit/src/private.css")]);
    expect(() => plugin.generateBundle.call(own, { dir: "/tmp/cj-unused" }, {})).toThrow(
      /apps\/kit\/src\/private\.css/,
    );
  });

  test("the plugin runs before Vite's own plugins, so its transform hook sees the first module first", () => {
    expect(moduleGraph({ repoRoot: REPO_ROOT }).enforce).toBe("pre");
  });

  test("watched files are still passed on to the real addWatchFile", () => {
    const { other } = started();
    other.addWatchFile(join(WEB, "src/style.css"));
    expect(other.watched).toEqual([join(WEB, "src/style.css")]);
  });

  test("an emitted asset whose original file is private fails the build", () => {
    const { plugin, own } = started();
    const bundle = {
      "assets/orders-AbCdEfGh.json": {
        type: "asset" as const,
        source: "{}",
        originalFileNames: ["../kit/src/orders.json"],
      },
    };
    expect(() => plugin.generateBundle.call(own, { dir: "/tmp/cj-unused" }, bundle)).toThrow(
      /apps\/kit\/src\/orders\.json/,
    );
  });

  test("an emitted asset whose original file is outside the repository fails the build", () => {
    const { plugin, own } = started();
    const bundle = {
      "assets/x-AbCdEfGh.json": {
        type: "asset" as const,
        source: "{}",
        originalFileNames: ["/synthetic-outside/export.json"],
      },
    };
    expect(() => plugin.generateBundle.call(own, { dir: "/tmp/cj-unused" }, bundle)).toThrow(/outside the repository/);
  });

  test("a context with no addWatchFile to observe fails closed", () => {
    const plugin = moduleGraph({ repoRoot: REPO_ROOT });
    const bare = { getModuleIds: () => [], error: fail } as GraphContext;
    expect(() => plugin.buildStart.call(bare)).toThrow(/watched files/);
  });

  test("public watched files and public assets pass (positive control)", () => {
    const { plugin, own, other } = started();
    other.addWatchFile(join(WEB, "src/style.css"));
    const bundle = {
      "assets/mark-AbCdEfGh.svg": { type: "asset" as const, source: "<svg/>", originalFileNames: ["src/mark.svg"] },
    };
    expect(() => plugin.generateBundle.call(own, { dir: "/tmp/cj-unused" }, bundle)).not.toThrow();
  });
});
