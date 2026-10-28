"use client";

import { AlertCircle, CheckCircle2, ChevronRight, Hand, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { darkBtn, outlineBtn, primaryBtn, RichText, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import type { Patch, RunDetail, RunStatus, Scenario, Step } from "@/lib/types";

const ACTIVE: RunStatus[] = ["running", "awaiting_approval"];

const ACTION_LABEL: Record<string, string> = {
  run_build: "Run build",
  diagnose: "Diagnose",
  propose_edit: "Propose edit",
  install_package: "Propose install",
  apply_patch: "Apply change",
  hand_off: "Hand off",
  rejected: "Change rejected",
};

const BANNER: Record<RunStatus, { title: string; body: string }> = {
  running: { title: "The agent is working", body: "Running the build in a sandbox copy and reading the output." },
  awaiting_approval: { title: "Waiting for your approval", body: "Review the change on the right. Nothing is applied until you approve it." },
  fixed: { title: "Build passed", body: "The change was applied in the sandbox and the build is green." },
  handed_off: { title: "Handed to you", body: "This needs access the agent doesn't have. The steps below are yours to run." },
  failed: { title: "Not fixed", body: "The run stopped without a green build. Follow the recommendations below." },
  diagnosed: { title: "Diagnosed", body: "The failure was explained, but no change was proposed." },
};

function StatusIcon({ status, className = "size-6" }: { status: RunStatus; className?: string }) {
  if (status === "fixed") return <CheckCircle2 className={`${className} text-sx-good`} strokeWidth={2} aria-hidden />;
  if (status === "handed_off") return <Hand className={`${className} text-sx-warning`} strokeWidth={2} aria-hidden />;
  if (status === "failed") return <XCircle className={`${className} text-sx-critical`} strokeWidth={2} aria-hidden />;
  if (status === "awaiting_approval") return <span aria-hidden className={`${className} breathe grid place-items-center`}><span className="size-2.5 rounded-full bg-sx-blue" /></span>;
  return <Loader2 className={`${className} text-sx-ink motion-safe:animate-spin`} strokeWidth={2} aria-hidden />;
}

function StepRow({ step, last }: { step: Step; last: boolean }) {
  const handoff = step.action === "hand_off";
  const icon = handoff ? (
    <Hand className="size-4 text-sx-warning" strokeWidth={2} aria-hidden />
  ) : step.ok ? (
    <CheckCircle2 className="size-4 text-sx-good" strokeWidth={2} aria-hidden />
  ) : (
    <XCircle className="size-4 text-sx-critical" strokeWidth={2} aria-hidden />
  );
  return (
    <li className="rise relative flex gap-4 pb-6">
      {!last && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-sx-line" />}
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-sx-line bg-sx-page">{icon}</span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
          <span className="font-medium">{ACTION_LABEL[step.action] ?? step.action}</span>
          <span className="text-sm tabular-nums text-sx-subtle">step {step.step_no}</span>
        </p>
        {step.summary && <p className="mt-0.5 text-sm text-sx-mute">{step.summary}</p>}
        {step.output_excerpt && (
          <details className="group mt-2">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-full pr-3 text-sm text-sx-mute hover:text-sx-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" strokeWidth={2} aria-hidden />
              Output
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-sx-soft p-4 font-mono text-[12.5px] leading-6">{step.output_excerpt}</pre>
          </details>
        )}
      </div>
    </li>
  );
}

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-sx-soft py-3 font-mono text-[12.5px] leading-6" aria-label="Proposed change">
      {diff.split("\n").map((l, i) => {
        const cls = l.startsWith("+++") || l.startsWith("---")
          ? "text-sx-subtle"
          : l.startsWith("+")
            ? "text-sx-good"
            : l.startsWith("-")
              ? "text-sx-critical"
              : l.startsWith("@@")
                ? "text-sx-blue"
                : "text-sx-mute";
        return (
          <div key={i} className={`px-4 ${cls}`}>
            {l || " "}
          </div>
        );
      })}
    </pre>
  );
}

function PatchPanel({ patch, onDecide, busy }: { patch: Patch; onDecide: (approve: boolean) => void; busy: boolean }) {
  const pending = patch.status === "pending";
  const statusText: Record<Patch["status"], string> = {
    pending: "Needs your review",
    approved: "Approved, applying",
    applied: "Applied",
    rejected: "Rejected",
    failed: "Failed to apply",
  };
  return (
    <section className={`rise rounded-2xl border p-5 sm:p-6 ${pending ? "border-sx-ink" : "border-sx-line"}`} aria-label="Proposed change">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl">{patch.kind === "install" ? `Install ${patch.package}` : `Edit ${patch.file_path}`}</h3>
          <p className="mt-1 text-sm text-sx-mute">
            {patch.kind === "install" ? `Adds the package to ${patch.file_path ?? "package.json"}` : "One edit, shown as a diff"}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-sm ${
            patch.status === "applied" ? "border-sx-good text-sx-good" : patch.status === "rejected" || patch.status === "failed" ? "border-sx-critical text-sx-critical" : "border-sx-line text-sx-mute"
          }`}
        >
          {statusText[patch.status]}
        </span>
      </div>
      <div className="mt-5">
        <DiffView diff={patch.diff} />
      </div>
      {pending && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={darkBtn} disabled={busy} onClick={() => onDecide(true)}>
            {busy ? <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={2} aria-hidden /> : <CheckCircle2 className="size-4" strokeWidth={2} aria-hidden />}
            Approve change
          </button>
          <button type="button" className={outlineBtn} disabled={busy} onClick={() => onDecide(false)}>
            Reject
          </button>
        </div>
      )}
    </section>
  );
}

export function FixClient() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [selected, setSelected] = useState<string>("missing-package");
  const [autoApprove, setAutoApprove] = useState(false);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [starting, setStarting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef<number | null>(null);

  useEffect(() => {
    api
      .scenarios()
      .then((s) => {
        setScenarios(s);
        if (s.length && !s.some((x) => x.id === "missing-package")) setSelected(s[0].id);
      })
      .catch((e) => {
        setScenarios([]);
        setError(e instanceof Error ? e.message : "Could not load scenarios.");
      });
  }, []);

  const poll = useCallback(async () => {
    if (runId.current === null) return;
    try {
      const r = await api.run(runId.current);
      if (r.id === runId.current) setRun(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lost track of the run.");
    }
  }, []);

  const active = run ? ACTIVE.includes(run.status) : false;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [active, poll]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const { run_id } = await api.runAgent(selected, autoApprove);
      runId.current = run_id;
      setRun({ id: run_id, mode: "fix", scenario: selected, status: "running", attempts: 1, steps: [], patches: [], diagnoses: [], handoff_steps: [] });
      poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the agent.");
    } finally {
      setStarting(false);
    }
  }

  async function decide(patchId: number, approve: boolean) {
    setDeciding(true);
    try {
      await api.decide(patchId, approve);
      await poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision was not saved.");
    } finally {
      setDeciding(false);
    }
  }

  const scenario = scenarios?.find((s) => s.id === (run?.scenario ?? selected));
  const banner = run ? BANNER[run.status] : null;
  const patch = run?.patches.at(-1);
  const diagnosis = run?.diagnoses.at(-1);

  return (
    <div className="mt-10">
      <h1 className="text-[2.5rem] leading-[1.05] sm:text-5xl">Let the agent fix the build</h1>
      <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-sx-mute">
        Pick a broken demo project. The agent builds it in a sandbox, finds the cause and proposes one change. You approve it before anything is applied.
      </p>

      <section className="mt-8 rounded-2xl border border-sx-line p-4 sm:p-6" aria-label="Run setup">
        <fieldset disabled={active || starting}>
          <legend className="text-sm font-medium">Broken project</legend>
          {scenarios === null ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
              {scenarios.map((s) => {
                const on = s.id === selected;
                return (
                  <label
                    key={s.id}
                    className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sx-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                      on ? "border-sx-ink bg-sx-panel" : "border-sx-line hover:border-sx-field-line"
                    }`}
                  >
                    <input type="radio" name="scenario" value={s.id} checked={on} onChange={() => setSelected(s.id)} className="sr-only" />
                    <span aria-hidden className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-sx-ink" : "border-sx-field-line"}`}>
                      {on && <span className="size-2 rounded-full bg-sx-ink" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                        {s.title}
                        <span className={`rounded-full border px-2 text-xs font-normal ${s.expected === "hand-off" ? "border-sx-warning text-sx-warning" : "border-sx-line text-sx-mute"}`}>
                          {s.expected === "hand-off" ? "needs a human" : "auto-fixable"}
                        </span>
                      </span>
                      {s.description && <span className="mt-0.5 block text-sm leading-snug text-sx-mute">{s.description}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <div className="mt-5 flex flex-col gap-4 border-t border-sx-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            role="switch"
            aria-checked={autoApprove}
            disabled={active}
            onClick={() => setAutoApprove((v) => !v)}
            className="flex min-h-11 items-center gap-3 rounded-full pr-2 text-left text-sm disabled:opacity-50"
          >
            <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${autoApprove ? "bg-sx-ink" : "bg-sx-field-line"}`}>
              <span className={`absolute top-0.5 size-5 rounded-full bg-sx-page transition-transform duration-200 ${autoApprove ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </span>
            <span>
              <span className="block font-medium">Auto-approve</span>
              <span className="block text-sx-subtle">Apply the change without asking</span>
            </span>
          </button>
          {run && !active ? (
            <button type="button" onClick={start} disabled={starting} className={primaryBtn}>
              <RotateCcw className="size-4" strokeWidth={2} aria-hidden /> Run again
            </button>
          ) : (
            <button type="button" onClick={start} disabled={active || starting || !scenarios?.length} className={primaryBtn}>
              {starting || active ? <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={2} aria-hidden /> : <Play className="size-4" strokeWidth={2} aria-hidden />}
              {active ? "Agent running" : "Run agent"}
            </button>
          )}
        </div>
      </section>

      {error && (
        <p className="rise mt-6 flex items-start gap-2 rounded-xl border border-sx-line p-4 text-sm" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-sx-critical" strokeWidth={2} aria-hidden />
          {error}
        </p>
      )}

      {!run && !error && (
        <div className="mt-6 rounded-2xl border border-dashed border-sx-field-line px-6 py-12 text-center">
          <p className="font-serif text-2xl">Each step will appear here as it happens.</p>
          <p className="mt-2 text-sm text-sx-mute">Build, diagnose, propose, apply, rebuild. At most a few attempts, and nothing touches your real code.</p>
        </div>
      )}

      {run && banner && (
        <div aria-live="polite">
          <section className="rise mt-6 flex flex-col gap-4 rounded-2xl bg-sx-sky p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-sx-page">
                <StatusIcon status={run.status} />
              </span>
              <div>
                <h2 className="text-3xl sm:text-4xl">{banner.title}</h2>
                <p className="mt-2 max-w-[56ch] text-sx-ink/75">{banner.body}</p>
              </div>
            </div>
            <dl className="flex gap-6 text-sm sm:text-right">
              <div>
                <dt className="text-sx-ink/60">Project</dt>
                <dd className="mt-0.5 font-medium">{scenario?.title ?? run.scenario}</dd>
              </div>
              <div>
                <dt className="text-sx-ink/60">Attempt</dt>
                <dd className="mt-0.5 font-serif text-2xl leading-none tabular-nums">{run.attempts}</dd>
              </div>
            </dl>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="rounded-2xl border border-sx-line p-5 sm:p-6" aria-label="Agent steps">
              <h3 className="text-xl">What the agent did</h3>
              <ol className="mt-5">
                {run.steps.map((s, i) => (
                  <StepRow key={s.step_no} step={s} last={i === run.steps.length - 1 && !active} />
                ))}
                {active && run.status === "running" && (
                  <li className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-sx-line">
                      <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="breathe pt-1.5 text-sm text-sx-mute">Working</p>
                  </li>
                )}
                {run.status === "awaiting_approval" && (
                  <li className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-sx-blue">
                      <span className="breathe size-2 rounded-full bg-sx-blue" />
                    </span>
                    <p className="pt-1.5 text-sm text-sx-mute">Paused until you decide</p>
                  </li>
                )}
              </ol>
            </section>

            <div className="flex flex-col gap-6">
              {patch && <PatchPanel patch={patch} busy={deciding} onDecide={(a) => decide(patch.id, a)} />}

              {run.handoff_steps.length > 0 && (
                <section className="rise rounded-2xl border border-sx-line p-5 sm:p-6">
                  <h3 className="text-xl">{run.status === "handed_off" ? "Your steps" : "Fix it by hand"}</h3>
                  <ol className="mt-4 space-y-3">
                    {run.handoff_steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                        <span className="font-serif text-lg tabular-nums text-sx-subtle">{i + 1}</span>
                        <span><RichText text={s} /></span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {diagnosis && (
                <section className="rise rounded-2xl bg-sx-soft p-5 sm:p-6">
                  <h3 className="text-lg">Diagnosis</h3>
                  <p className="mt-2 leading-relaxed">{diagnosis.summary}</p>
                  <p className="mt-2 text-sm leading-relaxed text-sx-mute">{diagnosis.root_cause}</p>
                  <p className="mt-3 text-sm tabular-nums text-sx-subtle">{Math.round(diagnosis.confidence * 100)}% confident</p>
                </section>
              )}

              {!patch && !diagnosis && run.handoff_steps.length === 0 && (
                <div className="rounded-2xl border border-dashed border-sx-field-line p-6 text-sm text-sx-mute">
                  The proposed change will show up here for review.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
