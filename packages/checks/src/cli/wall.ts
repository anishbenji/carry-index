import { evaluateWall, repoFiles } from "../wall.ts";
import { REPO_ROOT } from "./root.ts";

const result = evaluateWall(repoFiles(REPO_ROOT));
for (const line of result.lines) console.log(line);
process.exit(result.ok ? 0 : 1);
