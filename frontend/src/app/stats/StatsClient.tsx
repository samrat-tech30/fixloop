"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/types";

const TARGET_USEFULNESS = 80; // TCS brief: 80%+ usefulness feedback

function Big({ value, unit, label, detail, bar, target }: { value: string; unit?: string; label: string; detail: string; bar?: number | null; target?: number }) {
  return (
    <div className="flex flex-col rounded-2xl border border-sx-line p-6 sm:p-8">
      <p className="text-[15px] font-medium">{label}</p>
      <p className="mt-6 font-serif text-6xl leading-none tracking-tight tabular-nums sm:text-7xl">
        {value}
        {unit && value !== "—" && <span className="ml-1 text-3xl text-sx-subtle sm:text-4xl">{unit}</span>}
      </p>
      {bar !== undefined && (
        <div className="relative mt-6 h-1.5 rounded-full bg-sx-soft">
          <div className="h-full rounded-full bg-sx-ink motion-safe:transition-[width] motion-safe:duration-[800ms]" style={{ width: `${bar ?? 0}%` }} />
          {target !== undefined && (
            <span aria-hidden className="absolute -top-1.5 h-[18px] w-0.5 rounded-full bg-sx-blue" style={{ left: `${target}%` }} />
          )}
        </div>
      )}
      <p className="mt-auto pt-4 text-sm leading-relaxed text-sx-mute">{detail}</p>
    </div>
  );
}

const fmtPct = (v: number | null) => (v === null ? "—" : String(Math.round(v)));

export function StatsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .stats()
        .then((s) => {
          if (!alive) return;
          setStats(s);
          setError(null);
          setUpdated(Date.now());
        })
        .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load stats."));
    load();
    const id = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  const ago = updated ? Math.max(0, Math.round((now - updated) / 1000)) : null;

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[2.5rem] leading-[1.05] sm:text-5xl">How useful is FixLoop?</h1>
          <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-sx-mute">Measured from real runs and the feedback people leave on each diagnosis.</p>
        </div>
        <p className="text-sm tabular-nums text-sx-subtle" aria-live="polite">
          {ago === null ? "Loading" : ago < 2 ? "Updated just now" : `Updated ${ago}s ago`}
        </p>
      </div>

      {error && (
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-sx-line p-4 text-sm" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-sx-critical" strokeWidth={2} aria-hidden />
          {error}
        </p>
      )}

      {!stats ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Big
              label="Found it useful"
              value={fmtPct(stats.usefulness_pct)}
              unit="%"
              bar={stats.usefulness_pct}
              target={TARGET_USEFULNESS}
              detail={stats.ratings ? `${stats.ratings} rating${stats.ratings === 1 ? "" : "s"} so far. The blue tick is the ${TARGET_USEFULNESS}% goal.` : "No ratings yet. Diagnose a log and answer “Was this useful?”"}
            />
            <Big
              label="Fixed by the agent"
              value={fmtPct(stats.auto_fix_rate_pct)}
              unit="%"
              bar={stats.auto_fix_rate_pct}
              detail={stats.fix_runs ? `Of ${stats.fix_runs} fix run${stats.fix_runs === 1 ? "" : "s"}, ending with a green build.` : "No fix runs yet."}
            />
            <Big
              label="Time to diagnosis"
              value={stats.avg_latency_ms === null ? "—" : (stats.avg_latency_ms / 1000).toFixed(1)}
              unit="s"
              detail="Average from paste to answer."
            />
            <Big
              label="Matched a known pattern"
              value={fmtPct(stats.pattern_hit_pct)}
              unit="%"
              bar={stats.pattern_hit_pct}
              detail="Known failures are answered instantly, without waiting on a model."
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 divide-sx-line rounded-2xl border border-sx-line sm:grid-cols-4 sm:divide-x">
            {[
              ["Runs", stats.total_runs, `${stats.explain_runs} explain, ${stats.fix_runs} fix`],
              ["Ratings", stats.ratings, "thumbs up or down"],
              ["Fixed", stats.fixed, "green build"],
              ["Handed off", stats.handed_off, `${stats.failed} failed`],
            ].map(([k, v, sub]) => (
              <div key={k as string} className="p-5">
                <dt className="text-sm text-sx-mute">{k}</dt>
                <dd className="mt-1 font-serif text-3xl tabular-nums">{v}</dd>
                <dd className="text-xs text-sx-subtle">{sub}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
