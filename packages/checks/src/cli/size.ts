import { evaluateEdgeSizes } from "../edge.ts";
import { evaluateSizeGate } from "../gates.ts";
import { finishGate, REPO_ROOT } from "./run.ts";

finishGate(evaluateSizeGate(REPO_ROOT), () => {
  const edge = evaluateEdgeSizes(REPO_ROOT);
  for (const line of edge.lines) console.log(line);
  return edge.ok;
});
