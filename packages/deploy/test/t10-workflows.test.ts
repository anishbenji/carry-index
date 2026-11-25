/**
 * T10: credentials stay where they belong (privacy-wall design v2, sections 7 and 8; ADR-0049). Reads every file
 * in `.github/workflows` and checks the structure that keeps the Cloudflare token away from the build: the build
 * job has no environment and no secret, the token and account id appear only in the gate step's `env:`, only
 * `deploy-kit.yml` may name `kit-production`, every action is pinned by a 40-character commit SHA, and every
 * install runs with `--ignore-scripts`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT, tempDir } from "./helpers.ts";

const WORKFLOWS = join(REPO_ROOT, ".github", "workflows");

/** Written here, not read from the workflows: the approved actions (director, user-delegated 2026-11-26). */
const APPROVED_ACTIONS = new Set([
  "actions/checkout",
  "actions/setup-node",
  "oven-sh/setup-bun",
  "astral-sh/setup-uv",
  "actions/upload-artifact",
  "actions/download-artifact",
  "gitleaks/gitleaks-action",
]);

/** The one command line the deploy job may give the token to. */
const GATE_DEPLOY = /^node packages\/deploy\/src\/bin\.ts deploy "?\$\{\{ runner\.temp \}\}\/[a-z-]+"?$/;

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

interface Job {
  if?: string;
  needs?: string | string[];
  environment?: string | { name?: string; url?: string };
  permissions?: Record<string, string> | string;
  env?: Record<string, unknown>;
  steps?: Step[];
}

interface Workflow {
  on?: Record<string, unknown>;
  permissions?: Record<string, string> | string;
  env?: Record<string, unknown>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean } | string;
  jobs: Record<string, Job>;
}

interface WorkflowFile {
  name: string;
  text: string;
  workflow: Workflow;
}

function loadWorkflows(): WorkflowFile[] {
  if (!existsSync(WORKFLOWS)) return [];
  return readdirSync(WORKFLOWS)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => {
      const text = readFileSync(join(WORKFLOWS, name), "utf8");
      const workflow: unknown = parse(text);
      const jobs = (workflow as { jobs?: unknown } | null)?.jobs;
      if (typeof jobs !== "object" || jobs === null || Object.keys(jobs).length === 0) {
        throw new Error(`.github/workflows/${name} has no jobs`);
      }
      return { name, text, workflow: workflow as Workflow };
    });
}

const FILES = loadWorkflows();

function file(name: string): WorkflowFile {
  const found = FILES.find((f) => f.name === name);
  if (found === undefined) throw new Error(`missing .github/workflows/${name}`);
  return found;
}

function job(fileName: string, name: string): Job {
  const found: Job | undefined = file(fileName).workflow.jobs[name];
  if (found === undefined) throw new Error(`${fileName} has no job ${name}`);
  return found;
}

/** A GitHub expression, written without a literal placeholder in a plain string. */
const expr = (inner: string): string => `\${{ ${inner} }}`;

const byName = (a: string, b: string): number => a.localeCompare(b);

/** Every key and string value in `value`, with its dotted path, so a reference cannot hide in a nested field. */
function strings(value: unknown, path = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${path}[${i}]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      const child = path === "" ? key : `${path}.${key}`;
      return [{ path: child, text: key }, ...strings(item, child)];
    });
  }
  return [];
}

function paths(value: unknown, pattern: RegExp): string[] {
  return strings(value)
    .filter((entry) => pattern.test(entry.text))
    .map((entry) => entry.path);
}

function allSteps(): { file: string; job: string; index: number; step: Step }[] {
  return FILES.flatMap((f) =>
    Object.entries(f.workflow.jobs).flatMap(([name, body]) =>
      (body.steps ?? []).map((step, index) => ({ file: f.name, job: name, index, step })),
    ),
  );
}

/** The index of the deploy job's single gate step, the step that runs `bin.ts deploy`. */
function gateStepIndex(): number {
  const steps = job("deploy-public.yml", "deploy").steps ?? [];
  const found = steps.flatMap((step, i) => (step.run !== undefined && /\bbin\.ts deploy\b/.test(step.run) ? [i] : []));
  expect(found).toHaveLength(1);
  return found[0] ?? -1;
}

const READ_ONLY = { contents: "read" };

describe("T10 the workflow files exist and parse", () => {
  test("ci.yml and deploy-public.yml are present", () => {
    expect(FILES.map((f) => f.name)).toEqual(expect.arrayContaining(["ci.yml", "deploy-public.yml"]));
  });

  test("every workflow parses to an object with jobs", () => {
    expect(FILES.length).toBeGreaterThan(0);
    for (const f of FILES) expect(Object.keys(f.workflow.jobs).length, f.name).toBeGreaterThan(0);
  });
});

describe("T10 the build job never sees a credential", () => {
  test("deploy-public.yml has exactly the jobs build and deploy, and deploy needs build", () => {
    const { jobs } = file("deploy-public.yml").workflow;
    expect(Object.keys(jobs).sort(byName)).toEqual(["build", "deploy"]);
    expect([job("deploy-public.yml", "deploy").needs].flat()).toEqual(["build"]);
  });

  test("the build job names no environment and no secret", () => {
    const build = job("deploy-public.yml", "build");
    expect(build.environment).toBeUndefined();
    expect(paths(build, /\bsecrets\b/)).toEqual([]);
    expect(paths(build, /\bvars\b|CLOUDFLARE_/)).toEqual([]);
  });

  test("ci.yml names no environment, no secret and no variable", () => {
    const ci = file("ci.yml").workflow;
    for (const [name, body] of Object.entries(ci.jobs)) expect(body.environment, name).toBeUndefined();
    expect(paths(ci, /\bsecrets\b|\bvars\b|CLOUDFLARE_/)).toEqual([]);
  });

  test("the build job runs the gate's check on the site it uploads", () => {
    const steps = job("deploy-public.yml", "build").steps ?? [];
    const runs = steps.map((step) => step.run ?? "");
    const check = runs.findIndex((run) => /^node packages\/deploy\/src\/bin\.ts check \S+$/m.test(run));
    const upload = steps.findIndex((step) => step.uses?.startsWith("actions/upload-artifact@"));
    expect(check).toBeGreaterThanOrEqual(0);
    expect(upload).toBeGreaterThan(check);
  });
});

describe("T10 the token is only in the gate step's env", () => {
  test("the deploy job runs only on main, in environment public-production", () => {
    const deploy = job("deploy-public.yml", "deploy");
    const environment = typeof deploy.environment === "string" ? deploy.environment : deploy.environment?.name;
    expect(environment).toBe("public-production");
    expect(deploy.if?.replace(/\s+/g, " ").trim()).toBe("github.ref == 'refs/heads/main'");
  });

  test("the gate step runs the fixed deploy command line and nothing else", () => {
    const step = job("deploy-public.yml", "deploy").steps?.[gateStepIndex()];
    expect(step?.uses).toBeUndefined();
    expect(step?.run?.trim()).toMatch(GATE_DEPLOY);
  });

  test("the gate step's env holds exactly the token and the account id", () => {
    const step = job("deploy-public.yml", "deploy").steps?.[gateStepIndex()];
    expect(step?.env).toStrictEqual({
      CLOUDFLARE_API_TOKEN: expr("secrets.CLOUDFLARE_API_TOKEN"),
      CLOUDFLARE_ACCOUNT_ID: expr("vars.CLOUDFLARE_ACCOUNT_ID"),
    });
  });

  test("no other place in any workflow names a secret, a variable or a Cloudflare credential", () => {
    const gate = `jobs.deploy.steps[${gateStepIndex()}].env`;
    const allowed = new Set([`${gate}.CLOUDFLARE_API_TOKEN`, `${gate}.CLOUDFLARE_ACCOUNT_ID`]);
    for (const f of FILES) {
      const hits = paths(f.workflow, /\bsecrets\b|\bvars\b|CLOUDFLARE_|github\.token|GITHUB_TOKEN/);
      const outside = f.name === "deploy-public.yml" ? hits.filter((hit) => !allowed.has(hit)) : hits;
      // deploy-kit.yml (Kit Watch, not in Release 1) will carry its own token in its own environment.
      if (f.name === "deploy-kit.yml") continue;
      expect(outside, f.name).toEqual([]);
    }
  });

  test("the raw text names secrets exactly once in deploy-public.yml and never in other public workflows", () => {
    for (const f of FILES) {
      if (f.name === "deploy-kit.yml") continue;
      const count = f.text.match(/\bsecrets\b/g)?.length ?? 0;
      expect(count, f.name).toBe(f.name === "deploy-public.yml" ? 1 : 0);
    }
  });

  test("no workflow uses pull_request_target or workflow_run", () => {
    for (const f of FILES) {
      expect(Object.keys(f.workflow.on ?? {}), f.name).not.toContain("pull_request_target");
      expect(Object.keys(f.workflow.on ?? {}), f.name).not.toContain("workflow_run");
      expect(f.text, f.name).not.toMatch(/pull_request_target|workflow_run/);
    }
  });

  test("permissions are read-only contents for the workflow and for every job; no id-token", () => {
    for (const f of FILES) {
      expect(f.workflow.permissions, f.name).toStrictEqual(READ_ONLY);
      for (const [name, body] of Object.entries(f.workflow.jobs)) {
        expect(body.permissions, `${f.name} ${name}`).toStrictEqual(READ_ONLY);
      }
      expect(f.text, f.name).not.toMatch(/id-token/);
    }
  });

  test("checkout never leaves the repository token in the working copy", () => {
    const checkouts = allSteps().filter((s) => s.step.uses?.startsWith("actions/checkout@"));
    expect(checkouts.length).toBeGreaterThan(0);
    for (const { file: name, job, step } of checkouts) {
      expect(step.with?.["persist-credentials"], `${name} ${job}`).toBe(false);
    }
  });

  test("one deploy at a time, and a running deploy is never cancelled", () => {
    const { concurrency } = file("deploy-public.yml").workflow;
    expect(typeof concurrency).toBe("object");
    if (typeof concurrency !== "object") return;
    expect(concurrency.group).toMatch(/^[a-z-]+$/);
    expect(concurrency["cancel-in-progress"]).toBe(false);
  });

  test("deploy-public.yml runs on pushes to main, daily and by hand, and on nothing else", () => {
    const on = file("deploy-public.yml").workflow.on ?? {};
    expect(Object.keys(on).sort(byName)).toEqual(["push", "schedule", "workflow_dispatch"]);
    expect(on.push).toStrictEqual({ branches: ["main"] });
    const schedule = on.schedule as { cron?: string }[];
    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.cron).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });

  test("the deploy job downloads the build's artifact and fails on a digest mismatch", () => {
    const steps = job("deploy-public.yml", "deploy").steps ?? [];
    const download = steps.findIndex((step) => step.uses?.startsWith("actions/download-artifact@"));
    expect(download).toBeGreaterThanOrEqual(0);
    expect(download).toBeLessThan(gateStepIndex());
    expect(steps[download]?.with?.["digest-mismatch"]).toBe("error");
  });
});

describe("T10 only deploy-kit.yml may name kit-production", () => {
  test("no other workflow names the Kit environment", () => {
    for (const f of FILES) {
      if (f.name === "deploy-kit.yml") continue;
      expect(f.text, f.name).not.toMatch(/kit-production/);
    }
  });

  test("the only environment any public workflow names is public-production, on the deploy job", () => {
    const named = FILES.filter((f) => f.name !== "deploy-kit.yml").flatMap((f) =>
      Object.entries(f.workflow.jobs).flatMap(([name, body]) => {
        const env = typeof body.environment === "string" ? body.environment : body.environment?.name;
        return env === undefined ? [] : [`${f.name} ${name} ${env}`];
      }),
    );
    expect(named).toEqual(["deploy-public.yml deploy public-production"]);
  });
});

describe("T10 actions are pinned and approved", () => {
  test("every action is an approved action pinned by a full commit SHA with its version in a comment", () => {
    const steps = allSteps().filter((s) => s.step.uses !== undefined);
    expect(steps.length).toBeGreaterThan(0);
    for (const { file: name, job, step } of steps) {
      const uses = step.uses ?? "";
      const where = `${name} ${job} ${uses}`;
      const match = /^([\w.-]+\/[\w.-]+)@([0-9a-f]{40})$/.exec(uses);
      expect(match, where).not.toBeNull();
      expect(APPROVED_ACTIONS.has(match?.[1] ?? ""), where).toBe(true);
      const line = file(name)
        .text.split("\n")
        .find((l) => l.includes(`uses: ${uses}`));
      expect(line, where).toMatch(/uses: \S+ # v\d+\.\d+\.\d+$/);
    }
  });

  test("no job uses a container, a service or a reusable workflow", () => {
    for (const f of FILES) {
      for (const [name, body] of Object.entries(f.workflow.jobs)) {
        const keys = Object.keys(body);
        expect(keys, `${f.name} ${name}`).not.toContain("container");
        expect(keys, `${f.name} ${name}`).not.toContain("services");
        expect(keys, `${f.name} ${name}`).not.toContain("uses");
      }
    }
  });
});

describe("T10 installs run no package scripts", () => {
  test("every install is bun install --frozen-lockfile --ignore-scripts", () => {
    const installs = allSteps().flatMap(({ file: name, job, step }) =>
      (step.run ?? "")
        .split("\n")
        .filter((line) => /\b(?:bun|npm|pnpm|yarn)\s+(?:install|i|ci|add)\b/.test(line))
        .map((line) => ({ where: `${name} ${job}`, line: line.trim() })),
    );
    expect(installs.length).toBeGreaterThan(0);
    for (const { where, line } of installs) {
      expect(line, where).toBe("bun install --frozen-lockfile --ignore-scripts");
    }
  });

  test("every job that runs bun installs first", () => {
    for (const f of FILES) {
      for (const [name, body] of Object.entries(f.workflow.jobs)) {
        const runs = (body.steps ?? []).map((step) => step.run ?? "");
        const usesBun = runs.findIndex((run) => /\bbun (?:run|x)\b|\bnode packages\//.test(run));
        if (usesBun < 0) continue;
        const install = runs.findIndex((run) => run.includes("bun install"));
        expect(install, `${f.name} ${name}`).toBeGreaterThanOrEqual(0);
        expect(install, `${f.name} ${name}`).toBeLessThan(usesBun);
      }
    }
  });

  test("Node comes from .node-version wherever it is set up", () => {
    const setups = allSteps().filter((s) => s.step.uses?.startsWith("actions/setup-node@"));
    expect(setups.length).toBeGreaterThan(0);
    for (const { file: name, job, step } of setups) {
      expect(step.with?.["node-version-file"], `${name} ${job}`).toBe(".node-version");
      expect(step.with?.["node-version"], `${name} ${job}`).toBeUndefined();
    }
  });
});

describe("T10 the secret scan cannot be silenced from inside a change (security review r1)", () => {
  const scanJob = (): Job => job("ci.yml", "secret-scan");
  const runs = (): string[] => (scanJob().steps ?? []).map((step) => step.run ?? "");
  const scanIndex = (): number => runs().findIndex((run) => /\bgitleaks"? git\b/.test(run));
  /** The step that refuses gitleaks config files, run with the shell GitHub uses for `run:` on Linux. */
  const runGuard = (cwd: string): number => {
    const guard = runs().find((run) => run.includes(".gitleaksignore"));
    expect(guard).toBeDefined();
    return (
      spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", guard ?? "exit 0"], { cwd }).status ?? -1
    );
  };

  test("the scan ignores gitleaks:allow comments", () => {
    expect(scanIndex()).toBeGreaterThanOrEqual(0);
    expect(runs()[scanIndex()]).toMatch(/\s--ignore-gitleaks-allow(?:\s|'|$)/);
  });

  test("a step before the scan refuses .gitleaksignore and .gitleaks.toml", () => {
    const guard = runs().findIndex((run) => run.includes(".gitleaksignore") && run.includes(".gitleaks.toml"));
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(scanIndex());
  });

  test.each([".gitleaksignore", ".gitleaks.toml"])("the guard fails when %s is in the checkout", (name) => {
    const dir = tempDir("cj-t10-guard-");
    try {
      writeFileSync(join(dir.root, name), "synthetic\n");
      expect(runGuard(dir.root)).not.toBe(0);
    } finally {
      dir.cleanup();
    }
  });

  test("the guard passes when neither file is there", () => {
    const dir = tempDir("cj-t10-guard-");
    try {
      expect(runGuard(dir.root)).toBe(0);
    } finally {
      dir.cleanup();
    }
  });

  test("no workflow points gitleaks at another config", () => {
    for (const f of FILES)
      expect(f.text, f.name).not.toMatch(/GITLEAKS_CONFIG|--config\b|\s-c\s|--gitleaks-ignore-path|\s-i\s/);
  });
});

describe("T10 the validator's PyPI packages are pinned (security review r1)", () => {
  test("every uv --with names an exact version", () => {
    const withs = allSteps().flatMap(({ file: name, job: jobName, step }) =>
      [...(step.run ?? "").matchAll(/--with[=\s]+(\S+)/g)].map((m) => ({ where: `${name} ${jobName}`, spec: m[1] })),
    );
    expect(withs.length).toBeGreaterThan(0);
    for (const { where, spec } of withs) expect(spec, where).toMatch(/^[A-Za-z0-9_.-]+==\d+(?:\.\d+)*$/);
  });
});
