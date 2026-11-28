/**
 * Security round 4, S4-1a: a `?worker`, `?sharedworker` or `&worker` import is built in a nested Rolldown run that
 * the module-graph check does not see, so the public build refuses every worker import (`worker-import`), and the
 * gate refuses a report that lists one. Vite's own `?worker_file` ids live only inside a worker build and are not
 * worker imports. The real-Vite cases are in `sol-r4-worker.slow.test.ts`.
 */
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { GraphContext } from "../src/graph-plugin.ts";
import { classifyModules, moduleGraph } from "../src/graph-plugin.ts";
import { REPO_ROOT } from "./helpers.ts";

const W = join(REPO_ROOT, "packages/shared/src/w.js");

describe("worker imports are refused (S4-1a)", () => {
  test.each([
    "?worker",
    "?worker&inline",
    "?worker&url",
    "?sharedworker",
    "?sharedworker&inline",
    "?inline&worker",
    "?url&worker",
  ])("a module id with %s is a worker import", (query) => {
    expect(classifyModules([`${W}${query}`], REPO_ROOT).workerImports).toEqual([`packages/shared/src/w.js${query}`]);
  });

  test.each(["", "?worker_file&type=module", "?url", "?inline", "?raw", "?workerish"])(
    "a module id with %s is not",
    (query) => {
      expect(classifyModules([`${W}${query}`], REPO_ROOT).workerImports).toEqual([]);
    },
  );

  test("the plugin fails the build on a worker import, naming the rule and the module", () => {
    const plugin = moduleGraph({ repoRoot: REPO_ROOT });
    class Base {
      addWatchFile(_id: string): void {}
    }
    const ctx = Object.assign(new Base(), {
      getModuleIds: () => [join(REPO_ROOT, "apps/web/src/main.tsx"), `${W}?worker&inline`],
      error: (message: string): never => {
        throw new Error(message);
      },
    }) as unknown as GraphContext;
    plugin.buildStart.call(ctx);
    expect(() => plugin.generateBundle.call(ctx, { dir: "/tmp/cj-unused" }, {})).toThrow(
      /worker-import.*packages\/shared\/src\/w\.js\?worker&inline/,
    );
  });
});

/**
 * S4-1b: Rolldown gives each hook kind its own context class, and `LoadPluginContextImpl` defines an `addWatchFile`
 * that calls native code without its parent's. The plugin wraps, from every hook it defines, every class in the
 * context's prototype chain that defines its own `addWatchFile`, and fails the build when there is none.
 */
describe("watched files are recorded from every hook's context (S4-1b)", () => {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const kit = join(REPO_ROOT, "apps/kit/src/orders.json");

  function contexts() {
    class Minimal {
      addWatchFile(_id: string): void {}
    }
    class PluginContext extends Minimal {
      override addWatchFile(_id: string): void {}
    }
    // Like LoadPluginContextImpl: its own addWatchFile, which never calls the parent's.
    class LoadContext extends PluginContext {
      override addWatchFile(_id: string): void {}
    }
    const own = Object.assign(new PluginContext(), { getModuleIds: () => [], error: fail }) as unknown as GraphContext;
    return { own, load: new LoadContext(), minimal: new Minimal() };
  }

  test("a file watched from a load-hook context is recorded and fails the build", () => {
    const plugin = moduleGraph({ repoRoot: REPO_ROOT, checks: { workerImports: false } });
    const { own, load } = contexts();
    plugin.buildStart.call(own);
    plugin.load.call(load);
    load.addWatchFile(kit);
    expect(() => plugin.generateBundle.call(own, { dir: "/tmp/cj-unused" }, {})).toThrow(
      /apps\/kit\/src\/orders\.json/,
    );
  });

  test("every class in the chain that defines addWatchFile is wrapped, the base one included", () => {
    const plugin = moduleGraph({ repoRoot: REPO_ROOT });
    const { own, load, minimal } = contexts();
    plugin.buildStart.call(own);
    plugin.load.call(load);
    minimal.addWatchFile(kit);
    expect(() => plugin.generateBundle.call(own, { dir: "/tmp/cj-unused" }, {})).toThrow(
      /apps\/kit\/src\/orders\.json/,
    );
  });

  test.each(["buildStart", "resolveId", "load", "transform"] as const)(
    "%s fails closed on a context with no addWatchFile to wrap",
    (hook) => {
      const plugin = moduleGraph({ repoRoot: REPO_ROOT });
      const bare = { getModuleIds: () => [], error: fail } as GraphContext;
      expect(() => (plugin[hook] as (this: unknown) => unknown).call(bare)).toThrow(/addWatchFile|watched files/);
    },
  );

  test("the load and resolveId hooks change nothing about loading (positive control)", () => {
    const plugin = moduleGraph({ repoRoot: REPO_ROOT });
    const { load } = contexts();
    expect(plugin.load.call(load)).toBeUndefined();
    expect(plugin.resolveId.call(load)).toBeUndefined();
  });
});
