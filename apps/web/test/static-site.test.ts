// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { staticSite } from "../build/static-site.ts";

const app = fileURLToPath(new URL("../", import.meta.url));
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Hook = (this: unknown, ...args: unknown[]) => unknown;
type Bundle = Record<string, { type: "asset"; fileName: string; source: string } | { type: "chunk"; code: string }>;

/** The plugin after its build-start step, with a stand-in context that records emitted files. */
async function started() {
  const out = mkdtempSync(join(tmpdir(), "cj-static-site-"));
  dirs.push(out);
  const plugin = staticSite({
    root: app,
    exporter: `${repo}packages/pipeline/src/cli/export.ts`,
    headers: `${app}public/_headers`,
  });
  const emitted: string[] = [];
  const context = {
    addWatchFile() {},
    emitFile(file: { fileName: string }) {
      emitted.push(file.fileName);
    },
    error(message: string): never {
      throw new Error(message);
    },
  };
  (plugin.configResolved as Hook).call(context, { root: app, build: { outDir: join(out, "client") } });
  await (plugin.buildStart as Hook).call(context);
  const generate = (bundle: Bundle) => (plugin.generateBundle as Hook).call(context, {}, bundle);
  return { emitted, generate };
}

const sheet = { type: "asset" as const, fileName: "assets/styles-AbCdEfGh.css", source: "p{margin:0}" };

describe("staticSite", () => {
  it("refuses a bundle with any script chunk: the site ships no script (N2 JavaScript budgets)", async () => {
    const { emitted, generate } = await started();
    const bundle: Bundle = { [sheet.fileName]: sheet, "assets/main-AbCdEfGh.js": { type: "chunk", code: "go();\n" } };
    expect(() => generate(bundle)).toThrow(/ships no script/);
    expect(emitted).toEqual([]);
  }, 30_000);

  it("emits the pages, _headers and _redirects for a stylesheet-only bundle (positive control)", async () => {
    const { emitted, generate } = await started();
    const bundle: Bundle = { [sheet.fileName]: sheet, "assets/styles-AbCdEfGh.js": { type: "chunk", code: "" } };
    generate(bundle);
    expect(Object.keys(bundle)).toEqual([]);
    expect(emitted).toContain("uhmwpe-backpacks.html");
    expect(emitted).toContain("404.html");
    expect(emitted.some((file) => /^bags\/[a-z0-9-]+\.html$/.test(file))).toBe(true);
    expect(emitted).toContain("_headers");
    expect(emitted).toContain("_redirects");
  }, 30_000);
});
