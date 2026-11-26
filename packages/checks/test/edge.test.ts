import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateEdgeSizes } from "../src/edge.ts";
import { makeTree } from "./helpers.ts";

let cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups) c();
  cleanups = [];
});

const code = Array.from({ length: 400 }, (_, i) => `export const v${i} = ${i * 7919} % ${i + 3};`).join("\n");
const gzip8 = gzipSync(code, { level: 8 }).length;
const brotli4 = brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length;

function root(limit: string): string {
  const targets = [{ path: "apps/web/dist/client/assets/*.js", limit }];
  const t = makeTree({
    "package.json": JSON.stringify({ "size-limit": targets }),
    "apps/web/dist/client/assets/main.js": code,
  });
  cleanups.push(t.cleanup);
  return t.root;
}

describe("evaluateEdgeSizes", () => {
  it("reports gzip level 8 and Brotli quality 4 for each target and passes under the limit", () => {
    const result = evaluateEdgeSizes(root("1 MB"));
    expect(result.ok).toBe(true);
    expect(result.lines.join("\n")).toContain(`gzip 8: ${gzip8} B`);
    expect(result.lines.join("\n")).toContain(`brotli 4: ${brotli4} B`);
  });

  it("gates on the larger of the two edge sizes", () => {
    const larger = Math.max(gzip8, brotli4);
    expect(evaluateEdgeSizes(root(`${larger} B`)).ok).toBe(true);
    expect(evaluateEdgeSizes(root(`${larger - 1} B`)).ok).toBe(false);
  });

  it("fails when a target matches no files", () => {
    const t = makeTree({ "package.json": JSON.stringify({ "size-limit": [{ path: "nothing/*.js", limit: "1 MB" }] }) });
    cleanups.push(t.cleanup);
    expect(evaluateEdgeSizes(t.root).ok).toBe(false);
  });
});
