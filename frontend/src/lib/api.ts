// The ONLY module that calls fetch(). Everything goes through the server-side proxy at /api/proxy,
// which adds the backend API key, so no secret ever reaches the browser.
import type {
  AnalyzeResponse,
  FeedbackRequest,
  RunDetail,
  Sample,
  SampleInfo,
  Scenario,
  Stats,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
      else if (res.status === 422) message = "That input is not valid. Check the log size and try again.";
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 429) message = "Too many requests. Wait a few seconds and try again.";
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  // Explain mode
  analyze: (log: string, opts?: { source?: string; offline?: boolean }) =>
    post<AnalyzeResponse>(`analyze${opts?.offline ? "?offline=true" : ""}`, { log, source: opts?.source }),
  feedback: (body: FeedbackRequest) => post<{ ok: boolean }>("feedback", body),
  stats: () => request<Stats>("stats"),
  samples: () => request<SampleInfo[]>("samples"),
  sample: (name: string) => request<Sample>(`samples/${encodeURIComponent(name)}`),

  // Fix mode
  scenarios: () => request<Scenario[]>("demo/scenarios"),
  runAgent: (scenario: string, autoApprove = false) =>
    post<{ run_id: number }>("agent/run", { scenario, auto_approve: autoApprove }),
  run: (runId: number) => request<RunDetail>(`runs/${runId}`),
  decide: (patchId: number, approve: boolean) =>
    post<{ status: "approved" | "rejected" }>(`patches/${patchId}/decision`, { approve }),
};
