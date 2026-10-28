// Mirrors backend/app/models.py and docs/API.md. Change all three together.

export type Severity = "critical" | "warning" | "info";
export type RunStatus = "running" | "awaiting_approval" | "diagnosed" | "fixed" | "handed_off" | "failed";
export type Provider = "groq" | "gemini" | "openrouter" | "ollama" | "pattern" | string;

export interface Diagnosis {
  id: number | null;
  summary: string;
  category: string;
  root_cause: string;
  confidence: number; // 0..1
  severity: Severity;
  evidence_lines: string[];
  fix_steps: string[];
  auto_fixable: boolean;
  files_to_change: string[];
  pattern_id: string | null;
  pattern_name: string | null;
  provider: Provider;
  model: string | null;
  latency_ms: number | null;
  redactions: number;
}

export interface AnalyzeResponse {
  run_id: number;
  diagnosis: Diagnosis;
}

export interface FeedbackRequest {
  run_id: number;
  diagnosis_id: number | null;
  rating: 1 | -1;
  comment?: string;
}

export interface Stats {
  usefulness_pct: number | null;
  ratings: number;
  total_runs: number;
  explain_runs: number;
  fix_runs: number;
  fixed: number;
  handed_off: number;
  failed: number;
  auto_fix_rate_pct: number | null;
  avg_latency_ms: number | null;
  pattern_hit_pct: number | null;
}

export interface SampleInfo {
  name: string;
  title: string;
}

export interface Sample extends SampleInfo {
  log: string;
}

export interface Scenario {
  id: string;
  title: string;
  expected: "auto-fix" | "hand-off";
  description: string;
}

export interface Step {
  step_no: number;
  action: string;
  summary: string | null;
  output_excerpt: string | null;
  ok: boolean;
  created_at: string;
}

export interface Patch {
  id: number;
  kind: "edit" | "install";
  file_path: string | null;
  package: string | null;
  diff: string;
  status: "pending" | "approved" | "rejected" | "applied" | "failed";
}

export interface RunDetail {
  id: number;
  mode: "explain" | "fix";
  scenario: string | null;
  status: RunStatus;
  attempts: number;
  steps: Step[];
  patches: Patch[];
  diagnoses: Diagnosis[];
  handoff_steps: string[];
}
