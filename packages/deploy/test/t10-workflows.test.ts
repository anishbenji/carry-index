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

/** The trusted gitleaks policy, relative to the checkout (security review, Sol round 1). */
const POLICY = ".github/gitleaks.toml";

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
  if?: string;
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

/** The index of the triggers job's single gate step, the step that runs `bin.ts triggers`. */
function triggersStepIndex(): number {
  const steps = job("deploy-public.yml", "triggers").steps ?? [];
  const found = steps.flatMap((step, i) =>
    step.run !== undefined && /\bbin\.ts triggers\b/.test(step.run) ? [i] : [],
  );
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
    // The one-time triggers job (after 92e548c) is the third; it is checked in its own describe below.
    expect(Object.keys(jobs).sort(byName)).toEqual(["build", "deploy", "triggers"]);
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
  test("the deploy job runs only on main, in environment public-production, and not on an apply_triggers run", () => {
    const deploy = job("deploy-public.yml", "deploy");
    const environment = typeof deploy.environment === "string" ? deploy.environment : deploy.environment?.name;
    expect(environment).toBe("public-production");
    // After 8586e55 the gate refuses an upload while preview URLs are on, so an apply_triggers run skips deploy.
    expect(deploy.if?.replace(/\s+/g, " ").trim()).toBe("github.ref == 'refs/heads/main' && !inputs.apply_triggers");
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
    const trig = `jobs.triggers.steps[${triggersStepIndex()}].env`;
    const allowed = new Set([
      `${gate}.CLOUDFLARE_API_TOKEN`,
      `${gate}.CLOUDFLARE_ACCOUNT_ID`,
      `${trig}.CLOUDFLARE_API_TOKEN`,
      `${trig}.CLOUDFLARE_ACCOUNT_ID`,
    ]);
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
      // One per gate step: the deploy job's and the triggers job's.
      expect(count, f.name).toBe(f.name === "deploy-public.yml" ? 2 : 0);
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
    // One group per ref (independent Fable review, P3): a run on another branch cannot displace a waiting main deploy.
    expect(concurrency.group).toBe(`deploy-public-${expr("github.ref")}`);
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
    expect(named).toEqual([
      "deploy-public.yml deploy public-production",
      "deploy-public.yml triggers public-production",
    ]);
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
    for (const f of FILES) {
      expect(f.text, f.name).not.toMatch(/GITLEAKS_CONFIG|\s-c\s|--gitleaks-ignore-path|\s-i\s/);
      // The one config allowed is the trusted policy under .github/ (security review, Sol round 1).
      for (const m of f.text.matchAll(/--config[=\s]+(\S+)/g)) expect(m[1], f.name).toBe(POLICY);
    }
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

describe("T10 a failing check fails its job (security review, Sol round 1, P0)", () => {
  test("no job or step continues on error", () => {
    for (const f of FILES) {
      for (const [name, body] of Object.entries(f.workflow.jobs)) {
        expect(Object.keys(body), `${f.name} ${name}`).not.toContain("continue-on-error");
        for (const step of body.steps ?? []) {
          expect(Object.keys(step), `${f.name} ${name}`).not.toContain("continue-on-error");
        }
      }
    }
  });

  test("no run step masks a failure", () => {
    for (const { file: name, job: jobName, step } of allSteps()) {
      expect(step.run ?? "", `${name} ${jobName}`).not.toMatch(/\|\|\s*(?:true\b|:|exit 0\b)|\bset \+e\b|\bset \+o\b/);
    }
  });

  test("the validator tests run unittest discovery as is, on a Python where finding no tests fails (3.12+)", () => {
    const steps = job("ci.yml", "data").steps ?? [];
    const discover = steps.filter((step) => /\bunittest discover\b/.test(step.run ?? ""));
    expect(discover).toHaveLength(1);
    expect(discover[0]?.run?.trim()).toMatch(/python -m unittest discover -s tools -p "test_validate_\*\.py"$/);
    const uv = steps.find((step) => step.uses?.startsWith("astral-sh/setup-uv@"));
    const [major, minor] = String(uv?.with?.["python-version"]).split(".").map(Number);
    expect((major ?? 0) * 100 + (minor ?? 0)).toBeGreaterThanOrEqual(312);
  });
});

describe("T10 the secret scan reads every change, with a trusted policy (security review, Sol round 1, P1)", () => {
  const scanStep = (): Step | undefined =>
    (job("ci.yml", "secret-scan").steps ?? []).find((step) => /\bgitleaks"? git\b/.test(step.run ?? ""));

  test("the scan uses the policy under .github/ and covers all refs, merges and binary-marked text", () => {
    const run = scanStep()?.run ?? "";
    expect(run).toContain(`--config ${POLICY}`);
    expect(POLICY.startsWith(".github/")).toBe(true);
    const logOpts = /--log-opts="([^"]*)"/.exec(run)?.[1]?.split(" ") ?? [];
    // Exact (independent Fable review, P2): `t` stays in, so a key added through a file type change is read.
    expect(logOpts).toEqual(["--full-history", "--all", "--diff-filter=uxdb", "--text", "--diff-merges=first-parent"]);
  });

  test("the scan's checkout has the whole history", () => {
    const checkout = (job("ci.yml", "secret-scan").steps ?? []).find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    );
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
  });

  /** The policy's global allowlist `paths`, as JavaScript regular expressions (Go's leading `(?i)` becomes a flag). */
  function policyPaths(): RegExp[] {
    const text = readFileSync(join(REPO_ROOT, POLICY), "utf8");
    expect(text).not.toMatch(/^\[extend\]/m);
    const block = /^\[allowlist\][\s\S]*?^paths = \[([\s\S]*?)^\]/m.exec(text)?.[1] ?? "";
    const patterns = [...block.matchAll(/'''(.*?)'''/g)].map((m) => m[1] ?? "");
    expect(patterns.length).toBeGreaterThan(0);
    return patterns.map((p) => (p.startsWith("(?i)") ? new RegExp(p.slice(4), "i") : new RegExp(p)));
  }

  test.each([
    "drawings/bag/sketch/front.svg",
    "bun.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "go.sum",
    "scene.gltf",
    "javascript.json",
    ".github/gitleaks.toml",
    "vendor/modules.txt",
    "assets/jquery-3.7.1.min.js",
    // Text files the default policy skipped by name (security review r2, C2-1).
    "docs/notes.pdf",
    "apps/web/notes.bin",
    "docs/report.DOCX",
    "docs/sheet.xlsx",
    "apps/web/tool.exe",
    "pkg-1.0.gem",
    "apps/web/src/vendor/github.com/x/conf.ts",
    "vendor/golang.org/x/a.go",
    "vendor/bundle/ruby/a.rb",
    "bower_components/x/a.js",
  ])("the policy scans the text file %s", (path) => {
    expect(policyPaths().filter((re) => re.test(path))).toEqual([]);
  });

  test("the global allowlist skips only images, fonts and installed-package folders (security review r2, C2-1)", () => {
    expect(policyPaths().map((re) => (re.flags.includes("i") ? `(?i)${re.source}` : re.source))).toStrictEqual([
      String.raw`(?i)\.(?:bmp|gif|jpe?g|png|tiff?)$`,
      String.raw`(?i)\.(?:eot|[ot]tf|woff2?)$`,
      String.raw`(?:^|\/)node_modules(?:\/.*)?$`,
      String.raw`(?i)(?:^|\/)(?:v?env|virtualenv)\/lib(?:64)?(?:\/.*)?$`,
      String.raw`(?i)(?:^|\/)(?:lib(?:64)?\/python[23](?:\.\d{1,2})+|python\/[23](?:\.\d{1,2})+\/lib(?:64)?)(?:\/.*)?$`,
      String.raw`(?i)(?:^|\/)[a-z0-9_.]+-[0-9.]+\.dist-info(?:\/.+)?$`,
      String.raw`(?:^|\/)\.git$`,
    ]);
  });

  test.each(["og/page.png", "fonts/a.woff2", "node_modules/x/index.js"])("the policy still skips %s", (path) => {
    expect(policyPaths().some((re) => re.test(path))).toBe(true);
  });
});

describe("T10 no email address in a tracked file (security review, Sol round 1, P2)", () => {
  const emailStep = (): string => {
    const run = (job("ci.yml", "secret-scan").steps ?? [])
      .map((step) => step.run ?? "")
      .find((r) => r.includes("git grep"));
    expect(run).toBeDefined();
    return run ?? "exit 1";
  };

  /** Runs the step in a fresh repository holding `files`, with the shell GitHub uses for `run:` on Linux. */
  function runIn(files: Readonly<Record<string, string>>): { status: number; output: string } {
    const dir = tempDir("cj-t10-email-");
    try {
      const git = (...args: string[]) => spawnSync("git", args, { cwd: dir.root, encoding: "utf8" });
      git("init", "-q");
      for (const [name, content] of Object.entries(files)) writeFileSync(join(dir.root, name), content);
      git("add", "-A");
      const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", emailStep()], {
        cwd: dir.root,
        encoding: "utf8",
      });
      return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
    } finally {
      dir.cleanup();
    }
  }

  // Built at run time, so no address literal sits in this file. Synthetic: the .test domain is reserved.
  const at = (local: string, domain: string): string => [local, domain].join("@");

  test("passes when the only addresses are noreply or example ones", () => {
    const text = `${at("someone", "users.noreply.github.com")}\n${at("someone", "example.com")}\nlogo@2x.png\n`;
    expect(runIn({ "readme.txt": text }).status).toBe(0);
  });

  test.each([
    ["a version", "pkg@1.2.3-beta\n"],
    ["an image density suffix", "logo@3x.webp\n"],
    ["a subdomain of example.org", `${at("someone", "mail.example.org")}\n`],
  ])("passes on %s", (_shape, text) => {
    expect(runIn({ "readme.txt": text }).status).toBe(0);
  });

  test.each([
    ["an upper-case address", "readme.txt", `${at("SYNTHETIC.PERSON", "MAIL-PROVIDER.TEST")}\n`],
    ["a domain that starts with a digit", "readme.txt", `${at("someone", "163mail.test")}\n`],
    ["noreply in the local part only", "readme.txt", `${at("noreply-person", "mail-provider.test")}\n`],
    ["a lock file other than bun.lock", "other.lock", `${at("someone", "mail-provider.test")}\n`],
    ["a file marked binary", "data.bin", `\u0000${at("someone", "mail-provider.test")}\n`],
  ])("fails on %s (independent Fable review, P3)", (_shape, name, text) => {
    const { status, output } = runIn({ ".gitattributes": "*.bin binary\n", [name]: text });
    expect(status).not.toBe(0);
    expect(output).toContain(name);
  });

  test.each([
    ["bun.lock", `${at("someone", "mail-provider.test")}\n`],
    ["icon.PNG", `${at("someone", "mail-provider.test")}\n`],
    ["font.woff2", `${at("someone", "mail-provider.test")}\n`],
  ])("skips %s", (name, text) => {
    expect(runIn({ [name]: text }).status).toBe(0);
  });

  test("passes on a repository with no address at all", () => {
    expect(runIn({ "readme.txt": "nothing here\n" }).status).toBe(0);
  });

  test("fails on an address in a tracked file, naming the path but never the address", () => {
    const address = at("synthetic.person", "mail-provider.test");
    const { status, output } = runIn({ "readme.txt": "clean\n", "notes.txt": `write to ${address}\n` });
    expect(status).not.toBe(0);
    expect(output).toContain("notes.txt");
    expect(output).not.toContain("readme.txt");
    expect(output).not.toContain(address);
    expect(output).not.toContain("synthetic.person");
  });
});

describe("T10 the one-time triggers job (after 92e548c: versions deploy applies no triggers)", () => {
  const GATE_TRIGGERS = /^node packages\/deploy\/src\/bin\.ts triggers "?\$\{\{ runner\.temp \}\}\/public-site"?$/;

  test("runs only on a manual run from main with apply_triggers on, after build and without deploy", () => {
    const triggers = job("deploy-public.yml", "triggers");
    // Triggers come before the first deploy (8586e55: no upload while preview URLs are on).
    expect([triggers.needs].flat().map(String).sort(byName)).toEqual(["build"]);
    expect(triggers.if?.replace(/\s+/g, " ").trim()).toBe(
      "github.event_name == 'workflow_dispatch' && inputs.apply_triggers && github.ref == 'refs/heads/main'",
    );
  });

  test("its input is one boolean that defaults to false", () => {
    const dispatch = file("deploy-public.yml").workflow.on?.workflow_dispatch as {
      inputs?: Record<string, { type?: string; default?: unknown }>;
    };
    expect(Object.keys(dispatch.inputs ?? {})).toEqual(["apply_triggers"]);
    expect(dispatch.inputs?.apply_triggers?.type).toBe("boolean");
    expect(dispatch.inputs?.apply_triggers?.default).toBe(false);
  });

  test("its gate step runs the fixed triggers command line with only the token and the account id", () => {
    const step = job("deploy-public.yml", "triggers").steps?.[triggersStepIndex()];
    expect(step?.uses).toBeUndefined();
    expect(step?.run?.trim()).toMatch(GATE_TRIGGERS);
    expect(step?.env).toStrictEqual({
      CLOUDFLARE_API_TOKEN: expr("secrets.CLOUDFLARE_API_TOKEN"),
      CLOUDFLARE_ACCOUNT_ID: expr("vars.CLOUDFLARE_ACCOUNT_ID"),
    });
  });

  test("it gates the build's own artifact, downloaded with a digest check, before the gate step", () => {
    const steps = job("deploy-public.yml", "triggers").steps ?? [];
    const download = steps.findIndex((step) => step.uses?.startsWith("actions/download-artifact@"));
    expect(download).toBeGreaterThanOrEqual(0);
    expect(download).toBeLessThan(triggersStepIndex());
    expect(steps[download]?.with?.name).toBe("public-site");
    expect(steps[download]?.with?.["digest-mismatch"]).toBe("error");
  });
});

/** The `with.path` of a step, one entry per non-empty line. */
function withPaths(step: Step | undefined): string[] {
  return String(step?.with?.path ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

describe("T10 the gate jobs get the build's module-graph report with the site (security-sol r2, S2-4)", () => {
  const buildSteps = (): Step[] => job("deploy-public.yml", "build").steps ?? [];
  /** The folder the build job's `check` step checks. */
  const checkedSite = (): string => {
    const dirs = buildSteps().flatMap(
      (step) => /^node packages\/deploy\/src\/bin\.ts check (\S+)$/m.exec(step.run ?? "")?.[1] ?? [],
    );
    expect(dirs).toHaveLength(1);
    return dirs[0] ?? "";
  };
  const siteName = (): string => checkedSite().split("/").at(-1) ?? "";

  test("the build job checks the site after the build and uploads it with the report beside it, in one artifact", () => {
    const steps = buildSteps();
    const build = steps.findIndex((step) => (step.run ?? "").trim() === "bun run build");
    const check = steps.findIndex((step) => /\bbin\.ts check\b/.test(step.run ?? ""));
    const uploads = steps.flatMap((step, i) => (step.uses?.startsWith("actions/upload-artifact@") ? [i] : []));
    expect(build).toBeGreaterThanOrEqual(0);
    expect(check).toBeGreaterThan(build);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toBeGreaterThan(check);
    const upload = steps[uploads[0] ?? -1];
    expect(upload?.with?.name).toBe("public-site");
    // The gate reads `<siteDir>.module-graph.json` (graph-plugin.ts), so the report must sit beside the folder.
    expect(withPaths(upload)).toStrictEqual([checkedSite(), `${checkedSite()}.module-graph.json`]);
  });

  test.each([
    ["deploy", "deploy"],
    ["triggers", "triggers"],
  ])("the %s job downloads that artifact to the folder above the site its gate step reads", (jobName, command) => {
    const steps = job("deploy-public.yml", jobName).steps ?? [];
    const download = steps.find((step) => step.uses?.startsWith("actions/download-artifact@"));
    expect(download?.with?.name).toBe("public-site");
    expect(withPaths(download)).toStrictEqual([expr("runner.temp")]);
    const gate = steps.find((step) => new RegExp(`\\bbin\\.ts ${command}\\b`).test(step.run ?? ""));
    expect(gate?.run?.trim()).toBe(`node packages/deploy/src/bin.ts ${command} "${expr("runner.temp")}/${siteName()}"`);
  });

  test.each(["deploy", "triggers"])(
    "the %s job never builds: build code does not run where the token is",
    (jobName) => {
      for (const step of job("deploy-public.yml", jobName).steps ?? []) {
        expect(step.run ?? "", jobName).not.toMatch(/\bbun run build\b|\bvite\b|\bbun x\b|\bbunx\b|\bnpx\b/);
      }
    },
  );
});

describe("T10 the gate's private diagnostics never leave the runner (security-sol r2, S2-10)", () => {
  /** Jobs that run the gate, which writes full paths to `cj-gate-diagnostics-*` in RUNNER_TEMP on a failure. */
  const gateJobs = (): { file: string; job: string; body: Job }[] =>
    FILES.flatMap((f) =>
      Object.entries(f.workflow.jobs)
        .filter(([, body]) =>
          (body.steps ?? []).some((step) => /\bpackages\/deploy\/src\/bin\.ts\b/.test(step.run ?? "")),
        )
        .map(([name, body]) => ({ file: f.name, job: name, body })),
    );
  const TEMP = /runner\.temp|RUNNER_TEMP|\bTMPDIR\b|\/tmp\b|cj-gate-diagnostics|diagnostics\.txt/;

  test("the gate runs in ci.yml's checks and in every deploy-public job", () => {
    expect(gateJobs().map((g) => `${g.file} ${g.job}`)).toEqual(
      expect.arrayContaining([
        "ci.yml checks",
        "deploy-public.yml build",
        "deploy-public.yml deploy",
        "deploy-public.yml triggers",
      ]),
    );
  });

  test("the one artifact upload in any workflow names only repository-relative build paths", () => {
    const uploads = allSteps().filter((s) => s.step.uses?.startsWith("actions/upload-artifact@"));
    expect(uploads.map((s) => `${s.file} ${s.job}`)).toEqual(["deploy-public.yml build"]);
    for (const { step } of uploads) {
      // An upload on failure is how a diagnostics file would leave the runner.
      expect(step.if).toBeUndefined();
      for (const path of withPaths(step)) {
        expect(path).not.toMatch(TEMP);
        expect(path).toMatch(/^apps\/web\/dist\/[\w.-]+$/);
      }
    }
  });

  test("no workflow caches anything or sets the temp folder", () => {
    for (const f of FILES) {
      expect(f.text, f.name).not.toMatch(/actions\/cache\b/);
      for (const env of [
        f.workflow.env,
        ...Object.values(f.workflow.jobs).flatMap((b) => [b.env, ...(b.steps ?? []).map((s) => s.env)]),
      ]) {
        expect(Object.keys(env ?? {}), f.name).not.toEqual(expect.arrayContaining(["RUNNER_TEMP"]));
        expect(Object.keys(env ?? {}), f.name).not.toEqual(expect.arrayContaining(["TMPDIR"]));
      }
    }
    for (const { file: name, job: jobName, step } of allSteps()) {
      const where = `${name} ${jobName} ${step.uses ?? step.name ?? ""}`;
      if (step.uses?.startsWith("actions/setup-node@")) expect(step.with?.["package-manager-cache"], where).toBe(false);
      if (step.uses?.startsWith("astral-sh/setup-uv@")) expect(step.with?.["enable-cache"], where).toBe(false);
    }
  });

  test("in a job that runs the gate, only the download and the gate step name the temp folder", () => {
    for (const { file: name, job: jobName, body } of gateJobs()) {
      for (const step of body.steps ?? []) {
        const where = `${name} ${jobName} ${step.uses ?? step.name ?? ""}`;
        const isGate =
          /^node packages\/deploy\/src\/bin\.ts (?:check [\w./-]+|(?:deploy|triggers) "\$\{\{ runner\.temp \}\}\/[\w.-]+")$/.test(
            step.run?.trim() ?? "",
          );
        const isDownload = step.uses?.startsWith("actions/download-artifact@") === true;
        if (isGate || isDownload) continue;
        expect(paths(step, TEMP), where).toEqual([]);
      }
    }
  });

  test("no workflow names the diagnostics folder or file at all", () => {
    for (const f of FILES) expect(f.text, f.name).not.toMatch(/cj-gate-diagnostics|diagnostics\.txt/);
  });
});

describe("T10 no workflow step makes links or writes into the public folder (security r4, S4-2)", () => {
  test("no run step creates a symbolic or hard link, or names apps/web/public", () => {
    for (const { file: name, job: jobName, step } of allSteps()) {
      const run = step.run ?? "";
      const where = `${name} ${jobName} ${step.name ?? ""}`;
      expect(run, where).not.toMatch(/(?:^|[\s;&|(])(?:ln|link)\s|\bcp\s+-\S*[lsa]|\brsync\b|\bmklink\b/m);
      expect(run, where).not.toMatch(/apps\/web\/public/);
    }
  });
});

describe("T10 a file named as an image or font must be binary (security review r2, C2-1)", () => {
  /** Every extension the scan's policy or the email check skips as an image or font. */
  const MEDIA = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "avif",
    "ico",
    "bmp",
    "tif",
    "tiff",
    "woff",
    "woff2",
    "ttf",
    "otf",
    "eot",
  ];
  /** Synthetic binary content: a PNG signature and a NUL-bearing chunk header, as every real image and font has. */
  const BINARY = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48]);
  /** A made-up token, built at run time so no token-shaped literal is tracked. */
  const TOKEN = `token = ${["ghp", "SYNTHETICsyntheticSYNTHETICsynthetic00"].join("_")}\n`;

  const mediaStep = (): string => {
    const steps = job("ci.yml", "secret-scan").steps ?? [];
    const found = steps.filter((step) => (step.run ?? "").includes("image or font"));
    expect(found).toHaveLength(1);
    return found[0]?.run ?? "exit 1";
  };

  /** Runs the step in a fresh repository holding `files`, with the shell GitHub uses for `run:` on Linux. */
  function runIn(files: Readonly<Record<string, string | Buffer>>): { status: number; output: string } {
    const dir = tempDir("cj-t10-media-");
    try {
      const git = (...args: string[]) => spawnSync("git", args, { cwd: dir.root, encoding: "utf8" });
      git("init", "-q");
      for (const [name, content] of Object.entries(files)) writeFileSync(join(dir.root, name), content);
      git("add", "-A");
      const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", mediaStep()], {
        cwd: dir.root,
        encoding: "utf8",
      });
      return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
    } finally {
      dir.cleanup();
    }
  }

  test("the step runs in the secret-scan job, which reads the whole checkout", () => {
    expect(mediaStep()).toContain("git ls-files -z");
  });

  test("passes when every image and font is binary", () => {
    expect(runIn({ "page.png": BINARY, "a.woff2": BINARY, "readme.txt": "text\n" }).status).toBe(0);
  });

  test("passes on a repository with no image or font", () => {
    expect(runIn({ "readme.txt": "text\n" }).status).toBe(0);
  });

  test.each(MEDIA)("fails on a text file named *.%s, naming its path", (ext) => {
    const { status, output } = runIn({ [`token.${ext}`]: TOKEN, "page.png": BINARY });
    expect(status).not.toBe(0);
    expect(output).toContain(`token.${ext}`);
    expect(output).not.toContain("page.png");
    expect(output).not.toContain("SYNTHETIC");
  });

  test("fails on an upper-case extension", () => {
    expect(runIn({ "TOKEN.PNG": TOKEN }).status).not.toBe(0);
  });

  test("fails when .gitattributes marks the text file binary", () => {
    const { status, output } = runIn({ ".gitattributes": "*.png binary\n", "token.png": TOKEN });
    expect(status).not.toBe(0);
    expect(output).toContain("token.png");
  });
});

describe("T10 a re-run of an older run never deploys an older commit (security review r2, C2-2)", () => {
  const LS_REMOTE = 'git ls-remote "https://github.com/$GITHUB_REPOSITORY" refs/heads/main';
  const SHA_A = "a".repeat(40);
  const SHA_B = "b".repeat(40);

  /** The job's one tip-of-main guard, and where it sits. */
  function guard(jobName: string): { index: number; run: string } {
    const steps = job("deploy-public.yml", jobName).steps ?? [];
    const found = steps.flatMap((step, i) => ((step.run ?? "").includes("git ls-remote") ? [i] : []));
    expect(found, jobName).toHaveLength(1);
    const index = found[0] ?? -1;
    return { index, run: steps[index]?.run ?? "exit 1" };
  }

  /** Runs the guard with a stub `git` that prints `remote` (or fails), as GitHub's Linux shell would. */
  function runGuard(run: string, remote: string | undefined, sha: string): number {
    const dir = tempDir("cj-t10-tip-");
    try {
      const stub =
        remote === undefined
          ? "#!/bin/sh\necho 'fatal: unable to access' >&2\nexit 128\n"
          : `#!/bin/sh\n[ "$1" = ls-remote ] || exit 99\n[ "$2" = "https://github.com/synthetic-owner/synthetic-repo" ] || exit 98\n[ "$3" = refs/heads/main ] || exit 97\nprintf '%s' '${remote}'\n`;
      writeFileSync(join(dir.root, "git"), stub, { mode: 0o755 });
      const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", run], {
        cwd: dir.root,
        env: {
          PATH: `${dir.root}:${process.env.PATH ?? ""}`,
          GITHUB_REPOSITORY: "synthetic-owner/synthetic-repo",
          GITHUB_SHA: sha,
        },
        encoding: "utf8",
      });
      return result.status ?? -1;
    } finally {
      dir.cleanup();
    }
  }

  test.each([
    ["deploy", "deploy"],
    ["triggers", "triggers"],
  ])("the %s job checks the tip of main in the step just before its gate", (jobName, command) => {
    const steps = job("deploy-public.yml", jobName).steps ?? [];
    const gate = steps.findIndex((step) => new RegExp(`\\bbin\\.ts ${command}\\b`).test(step.run ?? ""));
    const { index, run } = guard(jobName);
    expect(index).toBe(gate - 1);
    expect(run).toContain(LS_REMOTE);
    expect(run).toContain("$GITHUB_SHA");
    // Environment variables only: no expression is expanded into the script.
    expect(run).not.toContain("${{");
    expect(steps[index]?.env).toBeUndefined();
    expect(steps[index]?.if).toBeUndefined();
  });

  test.each(["deploy", "triggers"])("the %s guard passes when the run's commit is the tip of main", (jobName) => {
    expect(runGuard(guard(jobName).run, `${SHA_A}\trefs/heads/main\n`, SHA_A)).toBe(0);
  });

  test.each(["deploy", "triggers"])("the %s guard stops a run whose commit is no longer the tip", (jobName) => {
    expect(runGuard(guard(jobName).run, `${SHA_B}\trefs/heads/main\n`, SHA_A)).not.toBe(0);
  });

  test.each(["deploy", "triggers"])("the %s guard stops when main cannot be read", (jobName) => {
    expect(runGuard(guard(jobName).run, undefined, SHA_A)).not.toBe(0);
  });

  test.each(["deploy", "triggers"])("the %s guard stops when the remote has no main", (jobName) => {
    expect(runGuard(guard(jobName).run, "", SHA_A)).not.toBe(0);
  });

  test.each(["deploy", "triggers"])("the %s guard stops when GITHUB_SHA is empty", (jobName) => {
    expect(runGuard(guard(jobName).run, "\trefs/heads/main\n", "")).not.toBe(0);
  });
});

describe("T10 the dependency audit runs on its own (independent review r2, C2-3)", () => {
  /** The one Bun version every workflow pins. */
  const BUN = "1.4.2";

  test("ci.yml has a dependency-audit job, named for branch protection, that runs bun audit with the pinned Bun", () => {
    const audit = job("ci.yml", "dependency-audit") as Job & { name?: string };
    expect(audit.name).toBe("dependency audit");
    const steps = audit.steps ?? [];
    const setup = steps.filter((step) => step.uses?.startsWith("oven-sh/setup-bun@"));
    expect(setup).toHaveLength(1);
    expect(setup[0]?.with?.["bun-version"]).toBe(BUN);
    const audits = steps.filter((step) => /\bbun audit\b/.test(step.run ?? ""));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.run?.trim()).toBe("bun audit");
    expect(audit.needs).toBeUndefined();
    expect(audit.if).toBeUndefined();
  });

  test("the audit is not part of the script contract job", () => {
    for (const step of job("ci.yml", "checks").steps ?? []) expect(step.run ?? "").not.toMatch(/\bbun audit\b/);
  });

  test("every setup-bun step pins the same Bun", () => {
    const setups = allSteps().filter((s) => s.step.uses?.startsWith("oven-sh/setup-bun@"));
    expect(setups.length).toBeGreaterThan(0);
    for (const { file: name, job: jobName, step } of setups) {
      expect(step.with?.["bun-version"], `${name} ${jobName}`).toBe(BUN);
    }
  });
});
