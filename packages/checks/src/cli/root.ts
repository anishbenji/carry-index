import { fileURLToPath } from "node:url";

/** The repository root, found from this file's location rather than the caller's working directory. */
export const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url).href);
