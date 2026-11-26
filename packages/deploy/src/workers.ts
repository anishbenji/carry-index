import { z } from "zod";

/**
 * Public Worker definitions as code (privacy-wall design v2, section 1). No `wrangler.*` file is tracked: the gate
 * emits each config from these constants into a sealed folder. The types are closed, so a binding, `env`,
 * `previews`, `unsafe` or (for the site) `main` cannot be written without a type error.
 */

/** The public site: assets only, so no code runs and a binding could not be used even if one were attached. */
export interface AssetsOnlyWorker {
  readonly name: string;
  readonly compatibility_date: string;
  readonly assets: {
    /** Always the sealed copy, never a folder in the checkout. */
    readonly directory: "./site";
    readonly html_handling: "drop-trailing-slash";
    readonly not_found_handling: "404-page";
  };
  readonly workers_dev: boolean;
  readonly preview_urls: false;
}

/** The metrics beacon: one pre-bundled module and exactly one Analytics Engine dataset (section 6). */
export interface BeaconWorker {
  readonly name: string;
  /** The one file the sealed folder holds beside `wrangler.json`. */
  readonly main: "./beacon.js";
  readonly compatibility_date: string;
  readonly no_bundle: true;
  /** With `no_bundle`, Wrangler 4.168 otherwise uploads other `.txt`, `.html` and `.bin` files beside `main`. */
  readonly find_additional_modules: false;
  readonly analytics_engine_datasets: readonly [{ readonly binding: string; readonly dataset: string }];
  /** With no routes declared, Wrangler would otherwise turn workers.dev on. */
  readonly workers_dev: false;
  readonly preview_urls: false;
}

export type PublicWorker = AssetsOnlyWorker | BeaconWorker;

export const PUBLIC_SITE = {
  name: "carry-journal",
  compatibility_date: "2026-11-01",
  assets: { directory: "./site", html_handling: "drop-trailing-slash", not_found_handling: "404-page" },
  workers_dev: true,
  preview_urls: false,
} as const satisfies AssetsOnlyWorker;

export const BEACON = {
  name: "carry-journal-beacon",
  main: "./beacon.js",
  compatibility_date: "2026-11-01",
  no_bundle: true,
  find_additional_modules: false,
  analytics_engine_datasets: [{ binding: "BEACON", dataset: "carry_journal_beacon" }],
  workers_dev: false,
  preview_urls: false,
} as const satisfies BeaconWorker;

const workerName = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDate = z.iso.date();

/** The runtime twin of `AssetsOnlyWorker`: strict at every depth, fixed values as literals. */
const assetsOnlyWorkerSchema = z.strictObject({
  name: workerName,
  compatibility_date: isoDate,
  assets: z.strictObject({
    directory: z.literal("./site"),
    html_handling: z.literal("drop-trailing-slash"),
    not_found_handling: z.literal("404-page"),
  }),
  workers_dev: z.boolean(),
  preview_urls: z.literal(false),
});

/** The runtime twin of `BeaconWorker`. */
const beaconWorkerSchema = z.strictObject({
  name: workerName,
  main: z.literal("./beacon.js"),
  compatibility_date: isoDate,
  no_bundle: z.literal(true),
  find_additional_modules: z.literal(false),
  analytics_engine_datasets: z.tuple([
    z.strictObject({ binding: z.string().regex(/^[A-Z][A-Z0-9_]*$/), dataset: z.string().regex(/^[a-z0-9_]+$/) }),
  ]),
  workers_dev: z.literal(false),
  preview_urls: z.literal(false),
});

/** Whether a definition is the site (it has `assets`) rather than the beacon. */
export function isAssetsOnly(worker: PublicWorker): worker is AssetsOnlyWorker {
  return Object.hasOwn(worker, "assets");
}

/**
 * Writes a definition as `wrangler.json` text with `JSON.stringify`. Throws, naming the key, on any key outside the
 * definition's type at any depth (an unknown key can only arrive through a cast), and on a fixed value changed the
 * same way.
 */
export function emitConfig(worker: PublicWorker): string {
  const schema = isAssetsOnly(worker) ? assetsOnlyWorkerSchema : beaconWorkerSchema;
  const parsed = schema.safeParse(worker);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const where = issue.path.map(String).join(".") || "(root)";
      const keys = issue.code === "unrecognized_keys" ? issue.keys.join(", ") : "";
      return keys ? `${where}: unknown key ${keys}` : `${where}: ${issue.code}`;
    });
    throw new Error(`refusing to emit the ${String(worker.name)} config: ${issues.join("; ")}`);
  }
  return `${JSON.stringify(worker, null, 2)}\n`;
}
