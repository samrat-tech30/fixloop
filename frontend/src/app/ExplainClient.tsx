"use client";

import { AlertCircle, Loader2, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ResultCard } from "@/components/ResultCard";
import { Skeleton, outlineBtn, primaryBtn } from "@/components/ui";
import { api } from "@/lib/api";
import type { AnalyzeResponse, SampleInfo } from "@/lib/types";

const STAGES = ["Reading the log", "Masking secrets", "Matching known failures", "Writing the fix"];

export function ExplainClient() {
  const [log, setLog] = useState("");
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ res: AnalyzeResponse; log: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.samples().then(setSamples).catch(() => setSamples([]));
  }, []);

  useEffect(() => {
    if (!loading) return;
    setStage(0);
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 650);
    return () => clearInterval(id);
  }, [loading]);

  async function loadSample(name: string) {
    setActiveSample(name);
    setError(null);
    try {
      const s = await api.sample(name);
      setLog(s.log);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that sample.");
    }
  }

  async function diagnose() {
    if (!log.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const res = await api.analyze(log, activeSample ? { source: "sample" } : undefined);
      setResult({ res, log });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnosis failed.");
    } finally {
      setLoading(false);
    }
  }

  const lineCount = log ? log.split("\n").length : 0;

  return (
    <>
      <section className="mt-8 rounded-[28px] bg-sx-sky px-5 pb-5 pt-10 sm:px-10 sm:pb-10 sm:pt-14">
        <h1 className="max-w-[16ch] text-[2.75rem] leading-[1.02] [text-wrap:balance] sm:text-[4rem]">Paste a failed deploy log. Get the fix.</h1>
        <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-sx-ink/75">
          FixLoop reads build and deployment output, points at the lines that matter, and tells you what to change.
          Secrets are masked before anything is analysed.
        </p>

        <div className="mt-9 rounded-2xl bg-sx-page p-2 shadow-sm">
          <label htmlFor="log" className="sr-only">
            Deployment log
          </label>
          <textarea
            id="log"
            value={log}
            onChange={(e) => {
              setLog(e.target.value);
              setActiveSample(null);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                diagnose();
              }
            }}
            spellCheck={false}
            placeholder={"Paste output from Vercel, Docker, Kubernetes, npm or your CI here.\n\nModule not found: Can't resolve 'razorpay'\n> Build failed because of webpack errors"}
            className="block min-h-56 w-full resize-y rounded-xl border border-sx-field-line bg-sx-page p-4 font-mono text-[13px] leading-6 text-sx-ink placeholder:text-sx-subtle focus:border-sx-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-sx-ring"
          />
          <div className="flex flex-col gap-3 px-2 pb-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm tabular-nums text-sx-subtle" aria-live="polite">
              {log ? `${lineCount} line${lineCount === 1 ? "" : "s"}, ${log.length.toLocaleString()} characters` : "Nothing pasted yet"}
              {log && (
                <button
                  type="button"
                  onClick={() => {
                    setLog("");
                    setActiveSample(null);
                    setResult(null);
                  }}
                  className="ml-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sx-mute hover:bg-sx-soft hover:text-sx-ink"
                >
                  <X className="size-3.5" strokeWidth={2} aria-hidden /> Clear
                </button>
              )}
            </p>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-sx-subtle sm:inline">
                <kbd className="rounded-md border border-sx-line px-1.5 py-0.5 font-sans text-xs">Ctrl</kbd>{" "}
                <kbd className="rounded-md border border-sx-line px-1.5 py-0.5 font-sans text-xs">Enter</kbd>
              </span>
              <button type="button" onClick={diagnose} disabled={!log.trim() || loading} className={`${primaryBtn} w-full sm:w-auto`}>
                {loading && <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={2} aria-hidden />}
                {loading ? "Diagnosing" : "Diagnose"}
              </button>
            </div>
          </div>
        </div>

        {samples.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-sx-ink/70">No log handy? Try a real failure:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {samples.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => loadSample(s.name)}
                  aria-pressed={activeSample === s.name}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-ring ${
                    activeSample === s.name
                      ? "border-sx-ink bg-sx-ink text-white"
                      : "border-sx-ink/15 bg-sx-page/60 text-sx-ink hover:border-sx-ink/40 hover:bg-sx-page"
                  }`}
                >
                  {s.title.replace(/ \(contains secrets\)$/, "")}
                  {/secrets/.test(s.title) && <span className="ml-2 rounded-full bg-sx-marker px-2 text-xs">has secrets</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div ref={resultRef} className="scroll-mt-20" aria-live="polite">
        {loading && (
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" aria-busy="true">
            <div className="rounded-2xl border border-sx-line p-6 sm:p-8">
              <p className="flex items-center gap-2 text-sm text-sx-mute">
                <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={2} aria-hidden />
                {STAGES[stage]}
              </p>
              <ol className="mt-4 flex gap-1.5" aria-hidden>
                {STAGES.map((_, i) => (
                  <li key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${i <= stage ? "bg-sx-ink" : "bg-sx-soft"}`} />
                ))}
              </ol>
              <Skeleton className="mt-8 h-8 w-11/12" />
              <Skeleton className="mt-3 h-8 w-2/3" />
              <Skeleton className="mt-8 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
              <Skeleton className="mt-8 h-32 w-full rounded-xl" />
            </div>
            <Skeleton className="hidden h-96 rounded-2xl lg:block" />
          </div>
        )}

        {error && !loading && (
          <div className="rise mt-10 flex flex-col gap-4 rounded-2xl border border-sx-line p-6 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-sx-critical" strokeWidth={2} aria-hidden />
              <span>
                <span className="font-medium">The diagnosis did not finish.</span>{" "}
                <span className="text-sx-mute">{error}</span>
              </span>
            </p>
            <button type="button" onClick={diagnose} className={outlineBtn}>
              <RotateCcw className="size-4" strokeWidth={1.8} aria-hidden /> Try again
            </button>
          </div>
        )}

        {result && !loading && <ResultCard result={result.res} log={result.log} />}
      </div>
    </>
  );
}
