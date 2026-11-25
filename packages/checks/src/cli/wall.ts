import { evaluateWall } from "../wall.ts";
import { REPO_ROOT } from "./run.ts";

const result = evaluateWall(REPO_ROOT);
for (const line of result.lines) console.log(line);
process.exit(result.ok ? 0 : 1);
