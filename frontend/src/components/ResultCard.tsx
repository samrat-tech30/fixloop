"use client";

import { FileCode2, ShieldCheck, WifiOff, Zap } from "lucide-react";

import type { AnalyzeResponse } from "@/lib/types";

import { AnnotatedLog } from "./AnnotatedLog";
import { FeedbackPills } from "./FeedbackPills";
import { Chip, ConfidenceBar, CopyButton, RichText, SeverityPill } from "./ui";

/** Split the summary so the key phrase (a quoted name, or the reason after "because") gets the highlighter. */
function splitKey(summary: string): [string, string, string] {
  const q = summary.match(/'[^']+'/);
  if (q && q.index !== undefined) return [summary.slice(0, q.index), q[0], summary.slice(q.index + q[0].length)];
  const b = summary.match(/because (.+?)(\.?)$/);
  if (b && b.index !== undefined) {
    const start = b.index + "because ".length;
    return [summary.slice(0, start), b[1], b[2]];
  }
  return [summary, "", ""];
}

export function ResultCard({ result, log }: { result: AnalyzeResponse; log: string }) {
  const d = result.diagnosis;
  const [pre, key, post] = splitKey(d.summary);
  const source = d.provider === "pattern" ? "Matched a known pattern" : `Diagnosed by ${d.model ?? d.provider}`;

  return (
    <article className="rise mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" aria-label="Diagnosis">
      <div className="rounded-2xl border border-sx-line p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityPill severity={d.severity} />
          <Chip>{d.category}</Chip>
          {d.pattern_name && <Chip>{d.pattern_name}</Chip>}
          {d.provider === "ollama" && (
            <Chip>
              <WifiOff className="size-3.5" strokeWidth={2} aria-hidden /> Running offline (local model)
            </Chip>
          )}
        </div>

        <h2 className="mt-6 text-[1.75rem] leading-[1.2] sm:text-[2rem]">
          {pre}
          {key && <span className="marker">{key}</span>}
          {post}
        </h2>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <ConfidenceBar value={d.confidence} />
          <span className="inline-flex items-center gap-1.5 text-sm text-sx-subtle">
            <Zap className="size-3.5" strokeWidth={2} aria-hidden />
            {source}
            {d.latency_ms ? ` in ${(d.latency_ms / 1000).toFixed(1)}s` : ""}
          </span>
        </div>

        {d.redactions > 0 && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-sx-good">
            <ShieldCheck className="size-4" strokeWidth={2} aria-hidden />
            {d.redactions} secret{d.redactions > 1 ? "s" : ""} masked before analysis
          </p>
        )}

        <section className="mt-8">
          <h3 className="text-lg">Why it happened</h3>
          <p className="mt-2 max-w-prose leading-relaxed text-sx-mute">
            <RichText text={d.root_cause} />
          </p>
        </section>

        {d.fix_steps.length > 0 && (
          <section className="mt-8">
            <h3 className="text-lg">How to fix it</h3>
            <ol className="mt-3 divide-y divide-sx-line rounded-xl border border-sx-line">
              {d.fix_steps.map((step, i) => (
                <li key={i} className="flex items-center gap-4 py-1 pl-4 pr-1">
                  <span className="font-serif text-lg tabular-nums text-sx-subtle">{i + 1}</span>
                  <span className="flex-1 py-2.5 text-[15px] leading-relaxed">
                    <RichText text={step} />
                  </span>
                  <CopyButton text={step.replace(/`/g, "")} label={`Copy step ${i + 1}`} />
                </li>
              ))}
            </ol>
          </section>
        )}

        {d.files_to_change.length > 0 && (
          <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-sx-mute">
            <FileCode2 className="size-4" strokeWidth={1.8} aria-hidden />
            Files to change:
            {d.files_to_change.map((f) => (
              <code key={f} className="rounded-md bg-sx-soft px-1.5 py-0.5 font-mono text-[13px] text-sx-ink">
                {f}
              </code>
            ))}
          </p>
        )}

        <div className="mt-8 border-t border-sx-line pt-6">
          <FeedbackPills key={result.run_id} runId={result.run_id} diagnosisId={d.id} />
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <AnnotatedLog log={log} evidence={d.evidence_lines} />
      </div>
    </article>
  );
}
