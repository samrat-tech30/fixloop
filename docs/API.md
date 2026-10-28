# Backend API

Base URL: `BACKEND_URL` (local `http://localhost:8000`). Interactive docs at `/docs`.

**Auth:** every route except `GET /health` requires header `X-API-Key: <APP_API_KEY>` when `APP_API_KEY` is set in the backend env. The frontend adds it in its server-side proxy; browsers never see it.

**Errors:** `{ "detail": "<message>" }` with 400/401/404/409/413/422/429/500/503.

## Explain mode (working)

### `POST /analyze`
```json
// request
{ "log": "string, 1..MAX_LOG_BYTES chars", "source": "optional label, e.g. 'vercel' (max 50)" }
// 200 response
{
  "run_id": 12,
  "diagnosis": {
    "id": 31,
    "summary": "The build failed because the package 'axios' is imported but not installed.",
    "category": "dependency",
    "root_cause": "...",
    "severity": "critical",            // critical | warning | info
    "confidence": 0.92,                 // 0..1
    "evidence_lines": ["Module not found: Can't resolve 'axios'"],
    "fix_steps": ["Run `npm install axios`", "Commit package.json and package-lock.json", "Redeploy"],
    "auto_fixable": true,
    "files_to_change": ["package.json"],
    "pattern_id": "missing-npm-module", // null when AI-only
    "pattern_name": "Missing npm module",
    "provider": "groq",                 // groq | gemini | ollama | openrouter | pattern
    "model": "openai/gpt-oss-120b",
    "latency_ms": 1840,
    "redactions": 0                     // how many secrets were masked before the LLM saw the log
  }
}
```
Header `X-LLM-Offline: true` is never needed; `provider: "ollama"` tells the UI to show the "running offline" badge.

### `POST /feedback`
```json
{ "run_id": 12, "diagnosis_id": 31, "rating": 1, "comment": "optional, max 500" }   // rating: 1 or -1
→ { "ok": true }
```

### `GET /stats`
```json
{ "usefulness_pct": 87.5, "ratings": 16, "total_runs": 22, "explain_runs": 15, "fix_runs": 7,
  "fixed": 5, "handed_off": 1, "failed": 1, "auto_fix_rate_pct": 71.4,
  "avg_latency_ms": 2100, "pattern_hit_pct": 80.0 }
```
Percentages are `null` when there is no data yet.

### `GET /patterns` → `[{ "id", "name", "category", "severity", "auto_fixable" }]`
### `GET /samples` → `[{ "name": "oomkilled", "title": "Kubernetes OOMKilled" }]`
### `GET /samples/{name}` → `{ "name", "title", "log" }`
### `GET /health` (no auth) → `{ "status": "ok", "providers": ["groq", "gemini"] }`

## Fix mode (to build — contracts are fixed)

### `GET /demo/scenarios`
→ `[{ "id": "missing-package", "title": "Missing npm package", "expected": "auto-fix" }, ...]`

### `POST /agent/run`
```json
{ "scenario": "missing-package", "auto_approve": false }
→ 202 { "run_id": 40 }
```
Creates a fresh sandbox from the template + scenario and starts the agent as a FastAPI background task. 409 if another fix run is still `running`/`awaiting_approval` (one at a time keeps the demo stable).

### `GET /runs/{run_id}`
```json
{
  "id": 40, "mode": "fix", "scenario": "missing-package",
  "status": "awaiting_approval",      // running | awaiting_approval | fixed | handed_off | failed | diagnosed
  "attempts": 1,
  "steps": [ { "step_no": 1, "action": "run_build", "ok": false, "summary": "Build failed (exit 2)", "output_excerpt": "...", "created_at": "..." } ],
  "patches": [ { "id": 7, "file_path": "package.json", "kind": "install", "diff": "...", "status": "pending" } ],
  "diagnoses": [ /* Diagnosis objects as in /analyze */ ],
  "handoff_steps": []                  // filled when status = handed_off
}
```
UI polls every 1 s while status is `running` or `awaiting_approval`.

### `POST /patches/{patch_id}/decision`
```json
{ "approve": true } → { "status": "approved" }    // or "rejected"
```
Approve → agent applies the patch and re-runs the build. Reject → run ends `failed` with the recommendations shown.
