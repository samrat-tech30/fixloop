"use client";

import { useEffect, useMemo, useRef } from "react";

/** The pasted log with the evidence lines marked, so the diagnosis can be checked against the source. */
export function AnnotatedLog({ log, evidence }: { log: string; evidence: string[] }) {
  const lines = useMemo(() => log.replace(/\s+$/, "").split("\n"), [log]);
  const hits = useMemo(() => {
    // Compare without leading timestamps / build prefixes so a bare "2026-...Z" line never matches.
    const core = (s: string) => s.trim().replace(/^(\[?[\d\-T:.Z ]+\]?|#\d+ [\d.]+)\s*/, "").trim();
    const ev = evidence.map(core).filter((e) => e.length > 4);
    return lines.map((l) => {
      const t = core(l);
      return t.length > 4 && ev.some((e) => t.includes(e) || e.includes(t));
    });
  }, [lines, evidence]);
  const count = hits.filter(Boolean).length;
  const firstRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const first = firstRef.current;
    if (box && first) box.scrollTo({ top: Math.max(0, first.offsetTop - 72), behavior: "smooth" });
  }, [hits]);

  let order = 0;
  return (
    <figure className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-sx-line">
      <figcaption className="flex items-center justify-between border-b border-sx-line px-4 py-3 text-sm">
        <span className="font-medium">Your log</span>
        <span className="text-sx-mute">
          {count ? `${count} evidence line${count > 1 ? "s" : ""} marked` : "No exact evidence match"}
        </span>
      </figcaption>
      <div ref={boxRef} className="relative max-h-[30rem] overflow-auto bg-sx-page py-3 font-mono text-[12.5px] leading-6">
        {lines.map((line, i) => {
          const hit = hits[i];
          const isFirst = hit && order === 0;
          const delay = hit ? 300 + order++ * 140 : 0;
          return (
            <div
              key={i}
              ref={isFirst ? firstRef : undefined}
              className={`flex gap-4 pr-4 ${hit ? "text-sx-ink" : "text-sx-subtle"}`}
            >
              <span aria-hidden className={`w-10 shrink-0 select-none pr-1 text-right tabular-nums ${hit ? "text-sx-ink" : "text-sx-field-line"}`}>
                {i + 1}
              </span>
              <span className="whitespace-pre-wrap break-all">
                {hit ? (
                  <mark className="marker bg-transparent text-sx-ink" style={{ ["--marker-delay" as string]: `${delay}ms` }}>
                    {line}
                  </mark>
                ) : (
                  line || " "
                )}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
