import { evaluateSizeGate } from "../gates.ts";
import { finishGate, REPO_ROOT } from "./run.ts";

finishGate(evaluateSizeGate(REPO_ROOT));
