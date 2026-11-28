import type { Stats } from "node:fs";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readlinkSync,
  readSync,
  realpathSync,
} from "node:fs";
import { dirname, join } from "node:path";

/**
 * One entry under a walked folder. Symbolic links are reported, never followed. A regular file with more than one
 * link is `hardlink`, never `file`: another name for it can sit anywhere on the same filesystem, so its path says
 * nothing about where its contents came from (security-sol r2, S2-3).
 */
export type WalkEntry =
  | { kind: "file"; path: string; abs: string; stat: Stats /** Where the file must really be. */; real: string }
  | { kind: "symlink"; path: string; abs: string }
  | { kind: "hardlink"; path: string; abs: string }
  | { kind: "special"; path: string; abs: string };

/** Sorts strings by UTF-16 code unit, the order every list the gate returns uses. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Test seam: runs between a folder's `lstat` and its `readdir`, so a swap race can be made deterministic. */
export interface WalkHooks {
  beforeReaddir?: (abs: string) => void;
}

/** Caps on one walk (security-sol r2, S2-9). */
export interface WalkLimits {
  /**
   * At most this many non-folder entries (files, links, special files), and at most this many folders; one folder's
   * listing longer than this stops while it is read. Unlimited by default.
   */
  maxEntries?: number;
}

/** Thrown by `walkTree` when a cap is passed: the walk stops there, without visiting the rest. */
export class WalkLimitExceeded extends Error {
  constructor() {
    super("the walk passed its entry cap");
    this.name = "WalkLimitExceeded";
  }
}

/** A folder's entry names, read one at a time so a listing over `max` stops early. */
function folderNames(abs: string, max: number): string[] {
  const names: string[] = [];
  const dir = opendirSync(abs);
  try {
    for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
      names.push(entry.name);
      if (names.length > max) throw new WalkLimitExceeded();
    }
  } finally {
    dir.closeSync();
  }
  return names.sort(byCodeUnit);
}

function sameNode(a: Stats, b: Stats): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

/**
 * Every file, symbolic link and special file (FIFO, socket, device) under `root`, with no skip list: dotfiles,
 * dot-folders and `node_modules` are walked like anything else. Each entry is `lstat`ed, so a link is never
 * followed and a FIFO is never opened. Directories are descended into and not reported. Paths are relative to
 * `root` with forward slashes, sorted by code unit. `root` itself must be a real directory: a link or special
 * file there is reported with path `.`.
 *
 * Node has no `openat`, so each folder is checked around its `readdir` instead: it must still be the same node
 * (device and inode) and still resolve, link-free, to the expected real path. A folder swapped for a link, or under
 * a swapped ancestor, is reported as a link and not descended into. Each file records its expected real path, which
 * `readWalkedFile` checks again.
 *
 * With `limits.maxEntries`, entries are counted as they are found and the walk throws `WalkLimitExceeded` as soon as
 * a count passes the cap, so an oversized tree is never walked in full.
 */
export function walkTree(root: string, hooks: WalkHooks = {}, limits: WalkLimits = {}): WalkEntry[] {
  const found: WalkEntry[] = [];
  const max = limits.maxEntries ?? Number.POSITIVE_INFINITY;
  let folders = 0;
  const visit = (abs: string, path: string, real: string): void => {
    const stat = lstatSync(abs);
    if (!stat.isDirectory() && found.length >= max) throw new WalkLimitExceeded();
    if (stat.isSymbolicLink()) found.push({ kind: "symlink", path, abs });
    else if (stat.isDirectory()) {
      if (path !== "." && ++folders > max) throw new WalkLimitExceeded();
      hooks.beforeReaddir?.(abs);
      const names = folderNames(abs, max);
      let after: Stats | undefined;
      let resolved: string | undefined;
      try {
        after = lstatSync(abs);
        resolved = realpathSync(abs);
      } catch {
        // Gone or unreadable since the lstat: treated as changed.
      }
      if (!after?.isDirectory() || !sameNode(after, stat) || resolved !== real) {
        found.push({ kind: "symlink", path, abs });
        return;
      }
      for (const name of names) visit(join(abs, name), path === "." ? name : `${path}/${name}`, join(real, name));
    } else if (stat.isFile() && stat.nlink > 1) found.push({ kind: "hardlink", path, abs });
    else if (stat.isFile()) found.push({ kind: "file", path, abs, stat, real });
    else found.push({ kind: "special", path, abs });
  };
  const rootStat = lstatSync(root);
  visit(root, ".", rootStat.isSymbolicLink() ? root : realpathSync(root));
  return found.sort((a, b) => byCodeUnit(a.path, b.path));
}

/** Where an open descriptor really points, where the platform says (Linux `/proc`); undefined elsewhere. */
function descriptorPath(fd: number): string | undefined {
  try {
    return readlinkSync(`/proc/self/fd/${fd}`);
  } catch {
    return undefined;
  }
}

/**
 * Why `readWalkedEntry` refused a file: it is no longer the file the walk listed (`changed`), it gained a second
 * link (`hard-link`), its size differs from the walk's (`resized`), or it is larger than the byte budget left
 * (`over-budget`, refused unread).
 */
export type ReadRefusal = "changed" | "hard-link" | "resized" | "over-budget";

export type ReadResult = { ok: true; bytes: Uint8Array } | { ok: false; reason: ReadRefusal };

/** `readWalkedEntry`'s bytes, or undefined when it refused the file for any reason. */
export function readWalkedFile(entry: { abs: string; stat: Stats; real?: string }): Uint8Array | undefined {
  const result = readWalkedEntry(entry);
  return result.ok ? result.bytes : undefined;
}

/**
 * Reads a file the walker found, refusing to follow a link or block on a FIFO swapped in since the `lstat`: the
 * file is opened with `O_NOFOLLOW | O_NONBLOCK` and must still be the same regular file (device and inode), at the
 * walked real path (`changed` otherwise), and the opened file must still have exactly one link (`hard-link`: a link
 * made since the walk). The read is bounded (security-sol r2, S2-9): a file larger than `maxBytes` is refused
 * unread, and at most the walked size plus one byte is ever read, so a file that grew is refused (`resized`)
 * without being read to its end.
 */
export function readWalkedEntry(
  entry: { abs: string; stat: Stats; real?: string },
  maxBytes: number = Number.POSITIVE_INFINITY,
): ReadResult {
  if (entry.stat.size > maxBytes) return { ok: false, reason: "over-budget" };
  const changed: ReadResult = { ok: false, reason: "changed" };
  let fd: number;
  try {
    fd = openSync(entry.abs, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    return changed;
  }
  try {
    const now = fstatSync(fd);
    if (!now.isFile() || !sameNode(now, entry.stat)) return changed;
    if (now.nlink !== 1) return { ok: false, reason: "hard-link" };
    if (entry.real !== undefined) {
      // The open file must be the one at the walked real path: by the descriptor where the platform can say, and
      // by the parent folder resolving to the walked parent either way.
      const viaFd = descriptorPath(fd);
      if (viaFd !== undefined && viaFd !== entry.real) return changed;
      let parent: string | undefined;
      try {
        parent = realpathSync(dirname(entry.abs));
      } catch {
        return changed;
      }
      if (parent !== dirname(entry.real)) return changed;
    }
    const size = entry.stat.size;
    if (now.size !== size) return { ok: false, reason: "resized" };
    const buffer = new Uint8Array(size + 1);
    let read = 0;
    while (read < buffer.length) {
      const n = readSync(fd, buffer, read, buffer.length - read, null);
      if (n === 0) break;
      read += n;
    }
    return read === size ? { ok: true, bytes: buffer.subarray(0, size) } : { ok: false, reason: "resized" };
  } finally {
    closeSync(fd);
  }
}
