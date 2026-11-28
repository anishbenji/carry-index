import { describe, expect, it } from "vitest";
import { bagFile, bagPath, LISTING_FILE, LISTING_PATH, NOT_FOUND_FILE } from "../src/routes.ts";

describe("routes", () => {
  it("serves the listing at / from index.html and the 404 page from 404.html", () => {
    expect(LISTING_PATH).toBe("/");
    expect(LISTING_FILE).toBe("index.html");
    expect(NOT_FOUND_FILE).toBe("404.html");
  });

  it("puts a bag at /bags/<slug>, written as bags/<slug>.html (drop-trailing-slash serves it there)", () => {
    expect(bagPath("example-pack-30l")).toBe("/bags/example-pack-30l");
    expect(bagFile("example-pack-30l")).toBe("bags/example-pack-30l.html");
  });

  it("refuses a slug that is not lowercase kebab-case, so no slug can name another path", () => {
    for (const slug of ["", "../index", "a/b", "Example", "a--b", "-a", "a-", "a.html", "a b"]) {
      expect(() => bagPath(slug)).toThrow(/slug/);
      expect(() => bagFile(slug)).toThrow(/slug/);
    }
  });
});
