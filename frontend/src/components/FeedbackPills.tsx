"use client";

import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";

import { outlineBtn } from "./ui";

export function FeedbackPills({ runId, diagnosisId }: { runId: number; diagnosisId: number | null }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [choice, setChoice] = useState<1 | -1 | null>(null);

  async function send(rating: 1 | -1) {
    setChoice(rating);
    setState("sending");
    try {
      await api.feedback({ run_id: runId, diagnosis_id: diagnosisId, rating });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rise inline-flex h-11 items-center gap-2 text-sm text-sx-mute" role="status">
        <Check className="size-4 text-sx-good" strokeWidth={2} aria-hidden />
        Thanks. {choice === 1 ? "Glad it helped." : "We'll use this to improve the diagnosis."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-sx-mute">Was this useful?</span>
      <div className="flex gap-2">
        <button type="button" className={outlineBtn} disabled={state === "sending"} onClick={() => send(1)} aria-label="Yes, this was useful">
          <ThumbsUp className="size-4" strokeWidth={1.8} aria-hidden /> Yes
        </button>
        <button type="button" className={outlineBtn} disabled={state === "sending"} onClick={() => send(-1)} aria-label="No, this was not useful">
          <ThumbsDown className="size-4" strokeWidth={1.8} aria-hidden /> No
        </button>
      </div>
      {state === "error" && <span className="text-sm text-sx-critical">Feedback was not saved. Try again.</span>}
    </div>
  );
}
