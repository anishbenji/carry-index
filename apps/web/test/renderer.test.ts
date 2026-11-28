// @vitest-environment node
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRenderer } from "../build/static-site.ts";

const app = fileURLToPath(new URL("../", import.meta.url));

describe("loadRenderer", () => {
  it("renders with Solid's production builds, never a development build (N6)", async () => {
    const { render, files } = await loadRenderer(app);
    expect(files.filter((file) => /\/dist\/dev\/|\.dev\.m?js$/.test(file))).toEqual([]);
    expect(render({ kind: "notFound" })).toContain("<h1>Page not found</h1>");
  }, 30_000);
});
