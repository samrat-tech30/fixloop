// Demo fallback used ONLY when the backend is unreachable or a route is not built yet (502/501).
// Every response here is clearly labelled in the UI ("Demo data") and stats are computed from what
// happened in this browser session, never invented.
import { MOCK_SAMPLES } from "./mockSamples";
import type {
  AnalyzeResponse,
  Diagnosis,
  FeedbackRequest,
  Patch,
  RunDetail,
  Scenario,
  Severity,
  Stats,
  Step,
} from "./types";

// ---- demo-mode flag (tiny subscribable store) -------------------------------------------------
let demo = false;
const listeners = new Set<() => void>();
export const demoMode = {
  get: () => demo,
  set(v: boolean) {
    if (v === demo) return;
    demo = v;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

// ---- Explain: pattern rules mirroring backend/data/patterns.json -----------------------------
interface Rule {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  test: RegExp;
  evidence: RegExp;
  confidence: number;
  auto_fixable: boolean;
  files: string[];
  summary: (m: RegExpMatchArray) => string;
  root_cause: (m: RegExpMatchArray) => string;
  steps: (m: RegExpMatchArray) => string[];
}

const RULES: Rule[] = [
  {
    id: "missing-npm-module",
    name: "Missing npm module",
    category: "dependency",
    severity: "critical",
    test: /(?:Can't resolve|Cannot find module) '([^'./][^']*)'/,
    evidence: /Module not found|Can't resolve|Cannot find module|Build failed|exited with/,
    confidence: 0.94,
    auto_fixable: true,
    files: ["package.json"],
    summary: (m) => `The build failed because the package '${m[1]}' is imported but not installed.`,
    root_cause: (m) =>
      `Code imports '${m[1]}', but it is missing from package.json, so the bundler cannot resolve it during the production build.`,
    steps: (m) => [
      `Run \`npm install ${m[1]}\` in the project root`,
      "Commit package.json and package-lock.json",
      "Redeploy",
    ],
  },
  {
    id: "k8s-oomkilled",
    name: "Container out of memory",
    category: "resources",
    severity: "critical",
    test: /OOMKilled|Exit Code:\s*137/,
    evidence: /OOMKilled|Exit Code:\s*137|memory:|heap out of memory/,
    confidence: 0.91,
    auto_fixable: false,
    files: ["deployment.yaml"],
    summary: () => "The container was killed for using more memory than its limit (exit 137).",
    root_cause: () =>
      "The pod's memory limit is lower than what the process needs at peak, so the kernel kills it and Kubernetes restarts it in a loop.",
    steps: () => [
      "Check peak usage with `kubectl top pod -n <namespace>`",
      "Raise resources.limits.memory in the deployment (for example 512Mi)",
      "Apply the change and watch the rollout with `kubectl rollout status`",
    ],
  },
  {
    id: "port-in-use",
    name: "Port already in use",
    category: "runtime",
    severity: "warning",
    test: /EADDRINUSE[^\n]*?:(\d+)/,
    evidence: /EADDRINUSE|address already in use|errored|restarts:/,
    confidence: 0.9,
    auto_fixable: false,
    files: [],
    summary: (m) => `The server could not start because port ${m[1]} is already in use.`,
    root_cause: (m) =>
      `Another process (often the previous instance that never stopped) is still bound to port ${m[1]}, so the new process fails on listen().`,
    steps: (m) => [
      `Find the process with \`sudo lsof -i :${m[1]}\``,
      "Stop the old instance or change PORT for the new one",
      "Restart the service and confirm it stays up",
    ],
  },
  {
    id: "db-connection-refused",
    name: "Database connection refused",
    category: "network",
    severity: "critical",
    test: /ECONNREFUSED\s+([\d.]+:\d+)/,
    evidence: /ECONNREFUSED|could not connect|attempt 5\/5|Exited with status/,
    confidence: 0.88,
    auto_fixable: false,
    files: [],
    summary: (m) => `The service shut down because the database at ${m[1]} refused the connection.`,
    root_cause: () =>
      "DATABASE_URL points at localhost, which inside a hosted service is the container itself. No database is listening there.",
    steps: () => [
      "Set DATABASE_URL to the managed database's internal host, not localhost",
      "Confirm the database accepts connections from this service",
      "Rotate the credentials that appeared in this log",
      "Redeploy",
    ],
  },
  {
    id: "k8s-imagepull",
    name: "Image pull failed",
    category: "registry",
    severity: "critical",
    test: /ImagePullBackOff|ErrImagePull/,
    evidence: /ImagePullBackOff|ErrImagePull|pull access denied|authorization failed/,
    confidence: 0.89,
    auto_fixable: false,
    files: [],
    summary: () => "Pods cannot start because the cluster is not allowed to pull the container image.",
    root_cause: () =>
      "The registry denied the pull: the image tag does not exist or the cluster has no imagePullSecret for this private repository.",
    steps: () => [
      "Check the tag exists in the registry",
      "Create an imagePullSecret with `kubectl create secret docker-registry`",
      "Reference it under spec.imagePullSecrets and roll out again",
    ],
  },
  {
    id: "k8s-crashloop",
    name: "CrashLoopBackOff",
    category: "runtime",
    severity: "critical",
    test: /CrashLoopBackOff/,
    evidence: /CrashLoopBackOff|Cannot find module|Exit Code|Back-off/,
    confidence: 0.84,
    auto_fixable: false,
    files: ["Dockerfile"],
    summary: () => "The container crashes on start-up, so Kubernetes keeps restarting it.",
    root_cause: () =>
      "The start command points at a file that is not in the image, which usually means the build output was not copied in the Dockerfile.",
    steps: () => [
      "Run the image locally and list /app/dist",
      "Make sure the Dockerfile runs the build and copies dist/",
      "Rebuild, push a new tag and redeploy",
    ],
  },
  {
    id: "docker-copy-failed",
    name: "Docker COPY failed",
    category: "build",
    severity: "critical",
    test: /COPY ([^\s]+) /,
    evidence: /ERROR|>>>|not found|failed to compute/,
    confidence: 0.87,
    auto_fixable: false,
    files: ["Dockerfile", ".dockerignore"],
    summary: (m) => `The image build stopped because '${m[1]}' is not in the build context.`,
    root_cause: () =>
      "The file is either missing from the repository or excluded by .dockerignore, so Docker cannot copy it.",
    steps: () => [
      "Check the file exists at that path in the repo",
      "Remove it from .dockerignore if it is listed there",
      "Rebuild the image",
    ],
  },
  {
    id: "npm-eresolve",
    name: "npm dependency conflict",
    category: "dependency",
    severity: "warning",
    test: /ERESOLVE[\s\S]*?from ([\w@./-]+@[\d.]+)/,
    evidence: /ERESOLVE|Found:|peer |Could not resolve/,
    confidence: 0.86,
    auto_fixable: false,
    files: ["package.json"],
    summary: (m) => `npm install failed because ${m[1]} does not support the installed React version.`,
    root_cause: () =>
      "A package declares a peer dependency range that excludes the React version in package.json, so npm refuses to build the tree.",
    steps: () => [
      "Upgrade or replace the package with one that supports your React version",
      "As a short-term workaround, install with `--legacy-peer-deps`",
      "Commit the updated lockfile",
    ],
  },
];

const SECRET = /(:\/\/[^:\s]+:)[^@\s]+@|\b(?:sk|pk|rk)[-_](?:live|test)?[-_]?[A-Za-z0-9]{16,}|\b[A-Z_]*(?:SECRET|TOKEN|PASSWORD)[A-Z_]*=\S+/g;

let runSeq = 100;
let diagSeq = 500;

interface Session {
  explain: { pattern: boolean; latency: number }[];
  ratings: number[];
  fix: RunDetail[];
}
const session: Session = { explain: [], ratings: [], fix: [] };

function diagnose(log: string): Diagnosis {
  const latency = 900 + Math.round(Math.random() * 700);
  const lines = log.split("\n");
  for (const r of RULES) {
    const m = log.match(r.test);
    if (!m) continue;
    const evidence = lines.filter((l) => r.evidence.test(l)).map((l) => l.trim()).slice(0, 5);
    return {
      id: ++diagSeq,
      summary: r.summary(m),
      category: r.category,
      root_cause: r.root_cause(m),
      confidence: r.confidence,
      severity: r.severity,
      evidence_lines: evidence.length ? evidence : [m[0]],
      fix_steps: r.steps(m),
      auto_fixable: r.auto_fixable,
      files_to_change: r.files,
      pattern_id: r.id,
      pattern_name: r.name,
      provider: "pattern",
      model: null,
      latency_ms: latency,
      redactions: (log.match(SECRET) ?? []).length,
    };
  }
  const errLines = lines.filter((l) => /error|fail|fatal|exception/i.test(l)).map((l) => l.trim());
  return {
    id: ++diagSeq,
    summary: errLines.length
      ? "The log reports an error, but it does not match a known pattern."
      : "No clear failure was found in this log.",
    category: "unknown",
    root_cause:
      "Demo mode only recognises common patterns. Connect the backend to get an AI diagnosis for this log.",
    confidence: errLines.length ? 0.42 : 0.2,
    severity: errLines.length ? "warning" : "info",
    evidence_lines: errLines.slice(0, 4),
    fix_steps: ["Start the FixLoop backend and diagnose again", "Check the first error line in the log"],
    auto_fixable: false,
    files_to_change: [],
    pattern_id: null,
    pattern_name: null,
    provider: "pattern",
    model: null,
    latency_ms: latency,
    redactions: (log.match(SECRET) ?? []).length,
  };
}

// ---- Fix: a simulated agent run that advances with wall-clock time ---------------------------
const SCENARIOS: Scenario[] = [
  { id: "missing-package", title: "Missing npm package", expected: "auto-fix", description: "src/index.ts imports axios, but axios is not in package.json." },
  { id: "wrong-import", title: "Wrong import path", expected: "auto-fix", description: "src/index.ts imports ./componets/header (typo) instead of ./components/header." },
  { id: "type-error", title: "TypeScript type error", expected: "auto-fix", description: 'src/config.ts assigns the string "5" to a number.' },
  { id: "syntax-error", title: "Syntax error", expected: "auto-fix", description: "src/utils.ts is missing the closing brace of formatPrice." },
  { id: "missing-env", title: "Missing environment variable", expected: "hand-off", description: "The build checks API_KEY, which only exists on the developer's laptop. The agent must hand this to a human." },
];

interface Script {
  buildError: string;
  diagnosis: Omit<Diagnosis, "id" | "latency_ms" | "redactions" | "provider" | "model">;
  patch?: Omit<Patch, "id" | "status">;
  handoff?: string[];
}

const BUILD_HEAD = "> demo-app@1.0.0 build\n> tsc -p .\n\n";
const SCRIPTS: Record<string, Script> = {
  "missing-package": {
    buildError: BUILD_HEAD + "src/index.ts(1,19): error TS2307: Cannot find module 'axios' or its corresponding type declarations.\n\nnpm ERR! code 2",
    diagnosis: {
      summary: "The build failed because 'axios' is imported but not installed.",
      category: "dependency", root_cause: "src/index.ts imports axios, but package.json does not list it.",
      confidence: 0.95, severity: "critical", evidence_lines: ["error TS2307: Cannot find module 'axios'"],
      fix_steps: ["Run `npm install axios`", "Rebuild"], auto_fixable: true, files_to_change: ["package.json"],
      pattern_id: "missing-npm-module", pattern_name: "Missing npm module",
    },
    patch: {
      kind: "install", file_path: "package.json", package: "axios",
      diff: '--- a/package.json\n+++ b/package.json\n@@ -6,6 +6,9 @@\n   "scripts": {\n     "build": "tsc -p ."\n   },\n+  "dependencies": {\n+    "axios": "^1.7.7"\n+  },\n   "devDependencies": {\n     "@types/node": "^20.14.0",',
    },
  },
  "wrong-import": {
    buildError: BUILD_HEAD + "src/index.ts(1,30): error TS2307: Cannot find module './componets/header' or its corresponding type declarations.\n\nnpm ERR! code 2",
    diagnosis: {
      summary: "The build failed because the import path './componets/header' has a typo.",
      category: "build", root_cause: "The folder is named components, but the import says componets.",
      confidence: 0.93, severity: "critical", evidence_lines: ["error TS2307: Cannot find module './componets/header'"],
      fix_steps: ["Change the import to ./components/header", "Rebuild"], auto_fixable: true, files_to_change: ["src/index.ts"],
      pattern_id: "ts-module-not-found", pattern_name: "Module path not found",
    },
    patch: {
      kind: "edit", file_path: "src/index.ts", package: null,
      diff: '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,3 @@\n-import { renderHeader } from "./componets/header";\n+import { renderHeader } from "./components/header";\n import { retries } from "./config";\n import { formatPrice } from "./utils";',
    },
  },
  "type-error": {
    buildError: BUILD_HEAD + "src/config.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n\nnpm ERR! code 2",
    diagnosis: {
      summary: "The build failed because a string is assigned to a number in src/config.ts.",
      category: "types", root_cause: 'retries is typed as number but set to the string "5".',
      confidence: 0.92, severity: "critical", evidence_lines: ["error TS2322: Type 'string' is not assignable to type 'number'."],
      fix_steps: ['Change "5" to 5 in src/config.ts', "Rebuild"], auto_fixable: true, files_to_change: ["src/config.ts"],
      pattern_id: "ts-type-error", pattern_name: "TypeScript type error",
    },
    patch: {
      kind: "edit", file_path: "src/config.ts", package: null,
      diff: '--- a/src/config.ts\n+++ b/src/config.ts\n@@ -1 +1 @@\n-export const retries: number = "5";\n+export const retries: number = 5;',
    },
  },
  "syntax-error": {
    buildError: BUILD_HEAD + "src/utils.ts(3,1): error TS1005: '}' expected.\n\nnpm ERR! code 2",
    diagnosis: {
      summary: "The build failed because formatPrice in src/utils.ts is missing its closing brace.",
      category: "syntax", root_cause: "The function body opens on line 1 but never closes.",
      confidence: 0.9, severity: "critical", evidence_lines: ["src/utils.ts(3,1): error TS1005: '}' expected."],
      fix_steps: ["Add a closing } after the return statement", "Rebuild"], auto_fixable: true, files_to_change: ["src/utils.ts"],
      pattern_id: "ts-syntax", pattern_name: "Syntax error",
    },
    patch: {
      kind: "edit", file_path: "src/utils.ts", package: null,
      diff: "--- a/src/utils.ts\n+++ b/src/utils.ts\n@@ -1,2 +1,3 @@\n export function formatPrice(amount: number): string {\n   return `Rs. ${amount.toFixed(2)}`;\n+}",
    },
  },
  "missing-env": {
    buildError: BUILD_HEAD + "> node dist/checkEnv.js\n\nError: API_KEY is not set. Add it to your environment before building.\n\nnpm ERR! code 1",
    diagnosis: {
      summary: "The build needs API_KEY, which is not set in this environment.",
      category: "config", root_cause: "checkEnv.js exits when API_KEY is missing. The value is a secret the agent must not create or read.",
      confidence: 0.91, severity: "critical", evidence_lines: ["Error: API_KEY is not set."],
      fix_steps: [], auto_fixable: false, files_to_change: [".env"],
      pattern_id: "missing-env-var", pattern_name: "Missing environment variable",
    },
    handoff: [
      "Add API_KEY to the deployment's environment variables (not to the repo)",
      "Keep a placeholder in .env.example so teammates know it is required",
      "Run the build again",
    ],
  },
};

interface Sim {
  run: RunDetail;
  script: Script;
  t0: number;
  autoApprove: boolean;
  decidedAt: number | null;
  approved: boolean | null;
}
const sims = new Map<number, Sim>();
let patchSeq = 70;

const at = (sim: Sim, ms: number, base = sim.t0) => Date.now() - base >= ms;

function advance(sim: Sim) {
  const { run, script } = sim;
  const add = (action: string, ok: boolean, summary: string, output_excerpt: string | null = null) => {
    run.steps.push({ step_no: run.steps.length + 1, action, ok, summary, output_excerpt, created_at: new Date().toISOString() } as Step);
  };
  const n = run.steps.length;
  if (n === 0 && at(sim, 900)) add("run_build", false, "Build failed (exit 2)", script.buildError);
  if (n <= 1 && run.steps.length === 1 && at(sim, 2300)) {
    add("diagnose", true, script.diagnosis.summary);
    run.diagnoses.push({ ...script.diagnosis, id: ++diagSeq, provider: "pattern", model: null, latency_ms: 1180, redactions: 0 });
  }
  if (run.steps.length === 2 && at(sim, 3600)) {
    if (script.handoff) {
      add("hand_off", true, "Handed to you: this needs access the agent doesn't have");
      run.handoff_steps = script.handoff;
      run.status = "handed_off";
      return;
    }
    const p = script.patch!;
    add(p.kind === "install" ? "install_package" : "propose_edit", true,
      p.kind === "install" ? `Proposed: install ${p.package}` : `Proposed an edit to ${p.file_path}`);
    run.patches.push({ ...p, id: ++patchSeq, status: "pending" });
    run.status = "awaiting_approval";
    if (sim.autoApprove) decide(sim, true);
  }
  if (sim.decidedAt === null) return;
  const patch = run.patches[0];
  if (sim.approved === false) return;
  if (run.steps.length === 3 && at(sim, 700, sim.decidedAt)) {
    patch.status = "applied";
    add("apply_patch", true, patch.kind === "install" ? `Installed ${patch.package}` : `Applied edit to ${patch.file_path}`);
    run.status = "running";
  }
  if (run.steps.length === 4 && at(sim, 2200, sim.decidedAt)) {
    run.attempts = 2;
    add("run_build", true, "Build passed (exit 0)", "> demo-app@1.0.0 build\n> tsc -p .\n\nDone in 1.9s.");
    run.status = "fixed";
  }
}

function decide(sim: Sim, approve: boolean) {
  sim.decidedAt = Date.now();
  sim.approved = approve;
  const patch = sim.run.patches[0];
  if (approve) {
    patch.status = "approved";
    sim.run.status = "running";
  } else {
    patch.status = "rejected";
    sim.run.steps.push({
      step_no: sim.run.steps.length + 1, action: "rejected", ok: false,
      summary: "You rejected the change. Follow the recommendations to fix it by hand.",
      output_excerpt: null, created_at: new Date().toISOString(),
    });
    sim.run.handoff_steps = sim.script.diagnosis.fix_steps;
    sim.run.status = "failed";
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

// ---- route table ----------------------------------------------------------------------------
export function mockRequest(path: string, init?: RequestInit): unknown {
  const [route] = path.split("?");
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const seg = route.split("/");

  switch (seg[0]) {
    case "samples":
      if (seg[1]) {
        const s = MOCK_SAMPLES.find((x) => x.name === decodeURIComponent(seg[1]));
        if (!s) throw new Error("Sample not found");
        return s;
      }
      return MOCK_SAMPLES.map(({ name, title }) => ({ name, title }));
    case "analyze": {
      const diagnosis = diagnose(String(body.log ?? ""));
      session.explain.push({ pattern: diagnosis.pattern_id !== null, latency: diagnosis.latency_ms ?? 0 });
      return { run_id: ++runSeq, diagnosis } satisfies AnalyzeResponse;
    }
    case "feedback":
      session.ratings.push((body as FeedbackRequest).rating);
      return { ok: true };
    case "stats": {
      const runs = session.explain.length + session.fix.length;
      const fixed = session.fix.filter((r) => r.status === "fixed").length;
      const handed = session.fix.filter((r) => r.status === "handed_off").length;
      const failed = session.fix.filter((r) => r.status === "failed").length;
      const lat = session.explain.map((e) => e.latency);
      return {
        usefulness_pct: pct(session.ratings.filter((r) => r > 0).length, session.ratings.length),
        ratings: session.ratings.length,
        total_runs: runs,
        explain_runs: session.explain.length,
        fix_runs: session.fix.length,
        fixed, handed_off: handed, failed,
        auto_fix_rate_pct: pct(fixed, fixed + handed + failed),
        avg_latency_ms: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
        pattern_hit_pct: pct(session.explain.filter((e) => e.pattern).length, session.explain.length),
      } satisfies Stats;
    }
    case "demo":
      return SCENARIOS;
    case "agent": {
      const active = [...sims.values()].find((s) => s.run.status === "running" || s.run.status === "awaiting_approval");
      if (active) throw new Error("Another fix run is still in progress");
      const script = SCRIPTS[body.scenario];
      if (!script) throw new Error("Unknown scenario");
      const run: RunDetail = { id: ++runSeq, mode: "fix", scenario: body.scenario, status: "running", attempts: 1, steps: [], patches: [], diagnoses: [], handoff_steps: [] };
      sims.set(run.id, { run, script, t0: Date.now(), autoApprove: !!body.auto_approve, decidedAt: null, approved: null });
      session.fix.push(run);
      return { run_id: run.id };
    }
    case "runs": {
      const sim = sims.get(Number(seg[1]));
      if (!sim) throw new Error("Run not found");
      advance(sim);
      return clone(sim.run);
    }
    case "patches": {
      const id = Number(seg[1]);
      const sim = [...sims.values()].find((s) => s.run.patches.some((p) => p.id === id));
      if (!sim) throw new Error("Patch not found");
      decide(sim, !!body.approve);
      return { status: body.approve ? "approved" : "rejected" };
    }
  }
  throw new Error("Not available in demo mode");
}
