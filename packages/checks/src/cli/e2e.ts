import { evaluateE2eGate } from "../gates.ts";
import { finishGate, REPO_ROOT } from "./run.ts";

finishGate(evaluateE2eGate(REPO_ROOT));
