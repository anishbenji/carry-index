/**
 * T1: a public config cannot hold a binding (privacy-wall design v2, section 1). The compile-time half is proven by
 * `bun run typecheck`: every `@ts-expect-error` below must meet a type error, or the typecheck fails.
 */
import { describe, expect, test } from "vitest";
import type { AssetsOnlyWorker, BeaconWorker, PublicWorker } from "../src/workers.ts";
import { BEACON, emitConfig, PUBLIC_SITE } from "../src/workers.ts";

/** The exact configs Wrangler may receive. A change here is a never-auto-merge change the owner reviews. */
const EXPECTED_SITE = {
  name: "carry-journal",
  compatibility_date: "2026-11-01",
  assets: { directory: "./site", html_handling: "drop-trailing-slash", not_found_handling: "404-page" },
  workers_dev: true,
  preview_urls: false,
};

const EXPECTED_BEACON = {
  name: "carry-journal-beacon",
  main: "./beacon.js",
  compatibility_date: "2026-11-01",
  no_bundle: true,
  find_additional_modules: false,
  analytics_engine_datasets: [{ binding: "BEACON", dataset: "carry_journal_beacon" }],
  workers_dev: false,
  preview_urls: false,
};

const D1 = [{ binding: "DB", database_name: "kit", database_id: "00000000-0000-0000-0000-000000000000" }];

describe("T1 a public config cannot hold a binding", () => {
  test("T1 the site config Wrangler receives equals the exact expected object", () => {
    expect(JSON.parse(emitConfig(PUBLIC_SITE))).toStrictEqual(EXPECTED_SITE);
  });

  test("T1 the beacon config Wrangler receives equals the exact expected object, one Analytics Engine dataset and nothing else", () => {
    expect(JSON.parse(emitConfig(BEACON))).toStrictEqual(EXPECTED_BEACON);
  });

  test("T1 the site type refuses a binding, main, env, previews or a directory other than the sealed copy, and the emitter throws on the same keys smuggled through a cast", () => {
    // @ts-expect-error a public site definition cannot declare a D1 binding
    const withD1: AssetsOnlyWorker = { ...PUBLIC_SITE, d1_databases: D1 };
    // @ts-expect-error the public site has no code
    const withMain: AssetsOnlyWorker = { ...PUBLIC_SITE, main: "./worker.js" };
    // @ts-expect-error no environments: their bindings are not checked
    const withEnv: AssetsOnlyWorker = { ...PUBLIC_SITE, env: { staging: { d1_databases: D1 } } };
    // @ts-expect-error no previews block: it carries its own bindings
    const withPreviews: AssetsOnlyWorker = { ...PUBLIC_SITE, previews: { d1_databases: D1 } };
    // @ts-expect-error the assets directory is always the sealed copy
    const otherDir: AssetsOnlyWorker = { ...PUBLIC_SITE, assets: { ...PUBLIC_SITE.assets, directory: "../../data" } };
    expect(withD1 && withMain && withEnv && withPreviews && otherDir).toBeTruthy();

    // The same objects reach the emitter only through a cast; it must refuse each, naming the key.
    const smuggled: Array<[string, Record<string, unknown>]> = [
      ["d1_databases", { ...PUBLIC_SITE, d1_databases: D1 }],
      ["r2_buckets", { ...PUBLIC_SITE, r2_buckets: [{ binding: "PRIVATE", bucket_name: "kit-media" }] }],
      ["kv_namespaces", { ...PUBLIC_SITE, kv_namespaces: [{ binding: "KV", id: "0" }] }],
      ["services", { ...PUBLIC_SITE, services: [{ binding: "KIT", service: "kit-watch" }] }],
      ["unsafe", { ...PUBLIC_SITE, unsafe: { bindings: [{ name: "DB", type: "d1" }] } }],
      ["env", { ...PUBLIC_SITE, env: { staging: { d1_databases: D1 } } }],
      ["previews", { ...PUBLIC_SITE, previews: { d1_databases: D1 } }],
      ["main", { ...PUBLIC_SITE, main: "./worker.js" }],
      ["run_worker_first", { ...PUBLIC_SITE, assets: { ...PUBLIC_SITE.assets, run_worker_first: true } }],
      ["binding", { ...PUBLIC_SITE, assets: { ...PUBLIC_SITE.assets, binding: "ASSETS" } }],
    ];
    for (const [key, definition] of smuggled) {
      expect(() => emitConfig(definition as unknown as PublicWorker), key).toThrow(new RegExp(`\\b${key}\\b`));
    }
  });

  test("T1 the beacon type refuses a second dataset, any other binding, workers.dev or previews, and the emitter throws on extra keys smuggled through a cast", () => {
    const dataset = { binding: "BEACON", dataset: "carry_journal_beacon" };
    // @ts-expect-error exactly one Analytics Engine dataset
    const twoDatasets: BeaconWorker = { ...BEACON, analytics_engine_datasets: [dataset, dataset] };
    // @ts-expect-error the beacon may not bind D1
    const withD1: BeaconWorker = { ...BEACON, d1_databases: D1 };
    // @ts-expect-error the beacon is reached only through the site's /api/* route
    const onWorkersDev: BeaconWorker = { ...BEACON, workers_dev: true };
    // @ts-expect-error no preview URLs
    const withPreviewUrls: BeaconWorker = { ...BEACON, preview_urls: true };
    expect(twoDatasets && withD1 && onWorkersDev && withPreviewUrls).toBeTruthy();

    const smuggled: Array<[string, Record<string, unknown>]> = [
      ["d1_databases", { ...BEACON, d1_databases: D1 }],
      ["kv_namespaces", { ...BEACON, kv_namespaces: [{ binding: "KV", id: "0" }] }],
      ["tail_consumers", { ...BEACON, tail_consumers: [{ service: "kit-watch" }] }],
      ["routes", { ...BEACON, routes: ["kit.carryjournal.com/*"] }],
      ["unsafe", { ...BEACON, unsafe: { bindings: [{ name: "DB", type: "d1" }] } }],
      ["vars", { ...BEACON, vars: { TOKEN: "x" } }],
      ["database_id", { ...BEACON, analytics_engine_datasets: [{ ...dataset, database_id: "0" }] }],
    ];
    for (const [key, definition] of smuggled) {
      expect(() => emitConfig(definition as unknown as PublicWorker), key).toThrow(new RegExp(`\\b${key}\\b`));
    }
  });
});
