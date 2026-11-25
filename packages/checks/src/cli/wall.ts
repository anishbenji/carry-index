import { evaluateWall, trackedFiles } from "../wall.ts";
import { REPO_ROOT } from "./root.ts";

const result = evaluateWall(trackedFiles(REPO_ROOT));
for (const line of result.lines) console.log(line);
process.exit(result.ok ? 0 : 1);
