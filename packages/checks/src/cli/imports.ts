import { scanImports } from "../imports.ts";
import { TYPE_ONLY_DIRS, TYPE_ONLY_MODULES } from "../policy.ts";
import { REPO_ROOT } from "./run.ts";

let failures = 0;
for (const dir of TYPE_ONLY_DIRS) {
  for (const f of scanImports(REPO_ROOT, dir, TYPE_ONLY_MODULES)) {
    console.log(`${f.file}:${f.line} imports a value from ${f.specifier}; use \`import type\``);
    failures++;
  }
}
console.log(
  `imports: ${TYPE_ONLY_DIRS.join(", ")} checked for value imports of ${TYPE_ONLY_MODULES.join(", ")}: ${failures} found`,
);
process.exit(failures === 0 ? 0 : 1);
