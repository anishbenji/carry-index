import { zodInBuild } from "../bundle.ts";
import { defaultConfigsOnDisk, evaluateWall, repoFiles } from "../wall.ts";
import { REPO_ROOT } from "./root.ts";

// Git-visible files, plus Wrangler's default config names on disk even where git ignores them.
const files = [...new Set([...repoFiles(REPO_ROOT), ...defaultConfigsOnDisk(REPO_ROOT)])];
const result = evaluateWall(files);
for (const line of result.lines) console.log(line);
// Runs after the build in CI, so it checks the public bundle the import ban is meant to keep Zod out of.
const zod = zodInBuild(REPO_ROOT);
console.log(`apps/web build checked for Zod: ${zod.length} file(s) contain it`);
for (const file of zod) console.log(`FAIL ${file}: contains Zod; apps/web may import schema types only`);
process.exit(result.ok && zod.length === 0 ? 0 : 1);
