import { scanImports } from "../imports.ts";
import { publicDirs, TYPE_ONLY_MODULES, TYPE_ONLY_PATHS } from "../policy.ts";
import { REPO_ROOT } from "./root.ts";

const dirs = publicDirs(REPO_ROOT);
let failures = 0;
for (const dir of dirs) {
  for (const f of scanImports(REPO_ROOT, dir, TYPE_ONLY_MODULES, TYPE_ONLY_PATHS)) {
    console.log(`${f.file}:${f.line} imports a value from ${f.specifier}; use \`import type\``);
    failures++;
  }
}
console.log(
  `imports: ${dirs.join(", ")} checked for value imports of ${TYPE_ONLY_MODULES.join(", ")}: ${failures} found`,
);
process.exit(failures === 0 ? 0 : 1);
