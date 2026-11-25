/**
 * The few Node and Bun APIs these checks use, declared by hand because neither @types/node nor @types/bun is
 * on the approved dependency list yet. Replace this file with the real types once one is approved.
 */

declare module "node:fs" {
  export interface Dirent {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }
  export function lstatSync(path: string): { isSymbolicLink(): boolean };
  export function realpathSync(path: string): string;
  export function symlinkSync(target: string, path: string): void;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function mkdtempSync(prefix: string): string;
  export function writeFileSync(path: string, data: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

declare module "node:child_process" {
  export function execFileSync(file: string, args: string[], options: { cwd: string; encoding: "utf8" }): string;
}

declare module "node:path" {
  export const sep: string;
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
  export function dirname(path: string): string;
  export function resolve(...parts: string[]): string;
  export function isAbsolute(path: string): boolean;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:url" {
  export function fileURLToPath(url: URL | string): string;
}

declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
  }
}

declare const process: { exit(code?: number): never };

declare const console: { log(...data: unknown[]): void };

declare class URL {
  constructor(url: string, base?: string | URL);
  readonly href: string;
}

interface ImportMeta {
  readonly url: string;
}

declare const Bun: {
  spawnSync(
    cmd: string[],
    options: { cwd: string; stdio: ["inherit", "inherit", "inherit"] },
  ): { exitCode: number | null };
};
