import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeAtomically } from "../src/write.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "cj-write-"));
  dirs.push(dir);
  return dir;
};

describe("writeAtomically", () => {
  it("writes the text, creating missing folders, and leaves no temporary file behind", () => {
    const dir = fresh();
    const target = join(dir, "a", "b", "out.json");
    writeAtomically(target, '{"x":1}\n');
    expect(readFileSync(target, "utf8")).toBe('{"x":1}\n');
    expect(readdirSync(join(dir, "a", "b"))).toEqual(["out.json"]);
  });

  it("replaces an existing file whole", () => {
    const dir = fresh();
    const target = join(dir, "out.json");
    writeFileSync(target, "x".repeat(10_000));
    writeAtomically(target, "{}\n");
    expect(readFileSync(target, "utf8")).toBe("{}\n");
    expect(readdirSync(dir)).toEqual(["out.json"]);
  });
});
