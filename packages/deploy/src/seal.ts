import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { allowListRow } from "./allow-list.ts";
import type { Problem } from "./problems.ts";
import type { ReadRefusal, WalkEntry } from "./walk.ts";
import { byCodeUnit, readWalkedEntry, WalkLimitExceeded, walkTree } from "./walk.ts";
import type { AssetsOnlyWorker } from "./workers.ts";
import { emitConfig } from "./workers.ts";

/**
 * The largest file the allow-list copies. PR 8's largest file is a 409 KiB drawing (`slite-sketch-back.svg`,
 * 418,582 bytes); Cloudflare's own per-asset limit is 25 MiB. A planned Open Graph image or a hashed bundle stays
 * well under this.
 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** One copied file: the deploy log. */
export interface ManifestEntry {
  /** Relative to the site folder, forward slashes (`bags/ula-cicada-22l.html`). */
  path: string;
  size: number;
  /** Lowercase hex SHA-256 of the copied bytes. */
  sha256: string;
}

/**
 * The tag every uploaded version carries (`wrangler versions upload --tag`, sol security r3 S5-5): the first 12 hex
 * characters of the SHA-256 of the manifest, one `<sha256> <size> <path>` line per file in path order. Two seals of
 * the same site give the same tag, and any change to any file's bytes or name gives another, so `triggers` can tell
 * whether the live version is the site it has just sealed.
 */
export function manifestTag(manifest: readonly ManifestEntry[]): string {
  const lines = manifest.map((e) => `${e.sha256} ${e.size} ${e.path}\n`).join("");
  return createHash("sha256").update(lines).digest("hex").slice(0, 12);
}

/** A folder outside the checkout holding exactly `wrangler.json` (from the emitter) and `site/` (the copy). */
export interface SealedBundle {
  dir: string;
  /** `<dir>/wrangler.json`. */
  configPath: string;
  /** `<dir>/site`. */
  siteDir: string;
  /** Sorted by path. */
  manifest: readonly ManifestEntry[];
}

/** At most this many files: well under Cloudflare's 20,000 assets a version, far above today's 79. */
export const MAX_SITE_FILES = 10_000;
/** At most this many bytes in all: today's site is under 5 MiB. */
export const MAX_SITE_BYTES = 200 * 1024 * 1024;

export interface SealOptions {
  /** Where to create the sealed folder; the system temp folder by default. */
  parent?: string;
  /** Lower the file-count limit (tests); never raises it above `MAX_SITE_FILES`. */
  maxFiles?: number;
  /** Lower the total-size limit (tests); never raises it above `MAX_SITE_BYTES`. */
  maxTotalBytes?: number;
  /** Test seam: runs once between the walk and the first read, so a change made in that gap is deterministic. */
  afterWalk?: () => void;
}

export type SealResult = { ok: true; bundle: SealedBundle } | { ok: false; problems: readonly Problem[] };

/**
 * Seals `siteDir` (one variant folder of the static build) for `worker` (privacy-wall design v2, section 2). Its own
 * walker `lstat`s every entry with no skip list; a symlink, hard link (a file with more than one link, checked by
 * the walk and again on the opened file), FIFO, socket or device fails with its path; a file that
 * matches no allow-list row, fails its row's content check or exceeds `MAX_FILE_BYTES` fails. Nothing is skipped
 * quietly and the source folder is never changed.
 *
 * The walk counts entries as it goes and stops at the file-count cap; the total size (from the walk's sizes) is
 * checked before anything is read, and each read is bounded by its walked size and the bytes left in the budget, so a
 * file that changed size since the walk fails with `file-changed` without being read to its end (security-sol r2,
 * S2-9). Files are then read,
 * checked, copied and hashed one at a time, so memory holds at most one file; a failed seal removes its folder.
 */
export async function seal(siteDir: string, worker: AssetsOnlyWorker, options: SealOptions = {}): Promise<SealResult> {
  const config = emitConfig(worker);
  const source = resolve(siteDir);
  const maxFiles = Math.min(options.maxFiles ?? MAX_SITE_FILES, MAX_SITE_FILES);
  const maxBytes = Math.min(options.maxTotalBytes ?? MAX_SITE_BYTES, MAX_SITE_BYTES);
  let entries: WalkEntry[];
  try {
    entries = walkTree(source, {}, { maxEntries: maxFiles });
  } catch (error) {
    if (error instanceof WalkLimitExceeded) return { ok: false, problems: [{ path: ".", rule: "too-many-files" }] };
    throw error;
  }
  options.afterWalk?.();
  const files = entries.filter((e) => e.kind === "file");
  const problems: Problem[] = [];
  if (files.length > maxFiles) problems.push({ path: ".", rule: "too-many-files" });
  if (files.reduce((n, f) => n + f.stat.size, 0) > maxBytes) problems.push({ path: ".", rule: "total-too-large" });
  const readContents = problems.length === 0;

  const parent = resolve(options.parent ?? tmpdir());
  if (isInside(realpathSync(parent), realpathSync(source))) {
    throw new Error("seal: the parent folder must not be inside the site folder");
  }
  const dir = mkdtempSync(join(parent, "cj-sealed-"));
  const siteCopy = join(dir, "site");
  try {
    mkdirSync(siteCopy);
    // "wx": the folder is fresh, so every write creates a new file and never follows anything already there.
    writeFileSync(join(dir, "wrangler.json"), config, { flag: "wx" });
    const manifest: ManifestEntry[] = [];
    let total = 0;
    for (const entry of entries) {
      if (entry.kind === "symlink") problems.push({ path: entry.path, rule: "symlink" });
      else if (entry.kind === "hardlink") problems.push({ path: entry.path, rule: "hard-link" });
      else if (entry.kind === "special") problems.push({ path: entry.path, rule: "special-file" });
      else {
        const row = allowListRow(entry.path);
        if (!row) problems.push({ path: entry.path, rule: "no-matching-row" });
        else if (entry.stat.size > MAX_FILE_BYTES) problems.push({ path: entry.path, rule: "too-large" });
        else if (readContents) {
          const read = readWalkedEntry(entry, maxBytes - total);
          const bytes = read.ok ? read.bytes : new Uint8Array();
          total += bytes.length;
          // A file that gained a second link since the walk is refused like one the walk found; a file replaced by
          // a link or a special file since the walk is no longer the file that was listed.
          if (!read.ok) problems.push(refusal(entry.path, read.reason));
          else if (bytes.length > MAX_FILE_BYTES) problems.push({ path: entry.path, rule: "too-large" });
          else if (total > maxBytes) problems.push({ path: ".", rule: "total-too-large" });
          else if (!row.accepts(bytes)) problems.push({ path: entry.path, rule: "bad-content" });
          else if (row.validate && !row.validate.accepts(bytes))
            problems.push({ path: entry.path, rule: row.validate.rule });
          else if (problems.length === 0) {
            const target = join(siteCopy, ...entry.path.split("/"));
            mkdirSync(dirname(target), { recursive: true });
            // A row with a canonical form (fit data) ships exactly the value it validated (S5-1).
            const copied = row.canonical ? row.canonical(bytes) : bytes;
            writeFileSync(target, copied, { flag: "wx" });
            manifest.push({
              path: entry.path,
              size: copied.length,
              sha256: createHash("sha256").update(copied).digest("hex"),
            });
          }
        }
      }
    }
    if (problems.length > 0) {
      rmSync(dir, { recursive: true, force: true });
      const unique = new Map(problems.map((p) => [`${p.path}\u0000${p.rule}`, p]));
      return { ok: false, problems: [...unique.values()].sort((a, b) => byCodeUnit(a.path, b.path)) };
    }
    return { ok: true, bundle: { dir, configPath: join(dir, "wrangler.json"), siteDir: siteCopy, manifest } };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

/** The problem for a file `readWalkedEntry` refused. */
function refusal(path: string, reason: ReadRefusal): Problem {
  switch (reason) {
    case "hard-link":
      return { path, rule: "hard-link" };
    case "resized":
      return { path, rule: "file-changed" };
    case "over-budget":
      return { path: ".", rule: "total-too-large" };
    case "changed":
      return { path, rule: "special-file" };
  }
}

function isInside(path: string, dir: string): boolean {
  const rel = relative(dir, path);
  return rel === "" || !(rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith(sep));
}
