"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import type { Severity } from "@/lib/types";

export const pillBase =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-ring disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.98]";
export const primaryBtn = `${pillBase} bg-sx-blue px-6 text-white hover:bg-sx-blue-hover`;
export const darkBtn = `${pillBase} bg-sx-ink text-white hover:bg-sx-ink/85`;
export const outlineBtn = `${pillBase} border border-sx-line bg-sx-page text-sx-ink hover:border-sx-field-line hover:bg-sx-soft`;

export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-sx-line px-3 py-1 text-sm text-sx-mute ${className}`}>
      {children}
    </span>
  );
}

const SEVERITY: Record<Severity, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "border-sx-critical text-sx-critical" },
  warning: { label: "Warning", cls: "border-sx-warning text-sx-warning" },
  info: { label: "Info", cls: "text-sx-mute" },
};

export function SeverityPill({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity] ?? SEVERITY.info;
  return (
    <Chip className={`bg-sx-soft font-medium ${s.cls}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {s.label}
    </Chip>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 w-28 overflow-hidden rounded-full bg-sx-soft"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Confidence"
      >
        <div className="h-full rounded-full bg-sx-ink motion-safe:transition-[width] motion-safe:duration-[800ms] motion-safe:ease-out" style={{ width: `${w}%` }} />
      </div>
      <span className="text-sm tabular-nums text-sx-mute">{pct}% confident</span>
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sx-subtle transition-colors duration-200 hover:bg-sx-soft hover:text-sx-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-ring"
    >
      {done ? <Check className="size-4 text-sx-good" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.8} />}
    </button>
  );
}

/** Inline `code` spans from model text, rendered as text (never HTML). */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded-md bg-sx-soft px-1.5 py-0.5 font-mono text-[0.9em] text-sx-ink">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`breathe rounded-lg bg-sx-soft ${className}`} />;
}
