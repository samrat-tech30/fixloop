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
import { demoMode, mockRequest } from "./mock";

export { demoMode };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Backend down (502) or route not built yet (501): answer from local demo fixtures and flag it,
// so the UI can say "Demo data" instead of pretending the result is real.
const DEMO_STATUSES = [501, 502];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fromMock<T>(path: string, init?: RequestInit): Promise<T> {
  demoMode.set(true);
  if (path.startsWith("analyze")) await wait(1400);
  try {
    return mockRequest(path, init) as T;
  } catch (e) {
    throw new ApiError(409, e instanceof Error ? e.message : "Demo request failed");
  }
}

// After the backend is seen offline, skip it for a few seconds so polling doesn't spam 502s.
let offlineUntil = 0;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (Date.now() < offlineUntil) return fromMock<T>(path, init);
  let res: Response;
  try {
    res = await fetch(`/api/proxy/${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    offlineUntil = Date.now() + 10_000;
    return fromMock<T>(path, init);
  }
  if (res.status === 502) offlineUntil = Date.now() + 10_000;
  if (DEMO_STATUSES.includes(res.status)) return fromMock<T>(path, init);
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
  demoMode.set(false);
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
