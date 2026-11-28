import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * Writes `text` to `target` through a temporary file in the same folder and a rename, so a reader sees either the
 * old file or the whole new one, never a part (two builds may export at once). Creates missing folders.
 */
export function writeAtomically(target: string, text: string): void {
  const dir = dirname(target);
  mkdirSync(dir, { recursive: true });
  const temporary = join(dir, `.${basename(target)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(temporary, text, { flag: "wx" });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}
