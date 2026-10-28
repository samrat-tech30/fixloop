# FixLoop — Deployment Troubleshooting Agent

TCS Technology Day hackathon, BMSCE, 28 Oct 2026 · *IT Application Maintenance — Deployment Issue Troubleshooting Assistant*.

## Problem

A failed deploy produces hundreds of noisy log lines. Engineers lose time finding the one line that matters, working out why it failed, and deciding what to change — and the same handful of failures (missing packages, bad imports, OOM kills, missing env vars, port clashes) repeat across teams.

## Solution

FixLoop is a **single-agent** troubleshooting assistant with two modes:

- **Explain** — paste a log, get a plain-English summary, root cause, severity, confidence, the evidence lines and concrete fix steps, with 👍/👎 feedback.
- **Fix** — FixLoop runs a project's build in a sandbox, diagnoses the failure, proposes one patch (file edit or `npm install`), applies it after approval, and rebuilds until it passes. Anything it must not touch (secrets, env vars, infra) is handed to a human with steps.

## How to run

Requirements: Python 3.12, Node 20+, npm. Optional: Ollama for offline mode.

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # add at least one key: OPENAI_API_KEY, GEMINI_API_KEY or GROQ_API_KEY
(cd demo/template && npm install) # once, for Fix mode
uvicorn app.main:app --reload --port 8000     # API docs: http://localhost:8000/docs
pytest -q                                     # 84 tests, no network needed

# frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local        # BACKEND_URL=http://localhost:8000, APP_API_KEY = backend's
npm run dev                       # http://localhost:3000
```

Re-check diagnosis quality on the bundled samples: `cd backend && python -m app.tools.eval_samples`.

## Input formats

- **Any plain-text build or deploy log** up to 200 KB: npm / Next.js / TypeScript builds, Docker builds, Kubernetes events and pod logs, Node runtime output, CI output (GitHub Actions, Render, Vercel…).
- Paste it in the UI, pick one of the 8 bundled samples, or `POST /analyze` with `{"log": "...", "source": "vercel"}` (`?offline=true` forces the local model).
- ANSI colours, timestamps and repeated lines are stripped; secrets (API keys, tokens, passwords, DB URLs, private keys, emails) are redacted **before** anything is stored or sent to an LLM.
- Fix mode runs on the bundled TypeScript demo project with 5 broken scenarios (`missing-package`, `wrong-import`, `type-error`, `syntax-error`, `missing-env`).

## AI approach

1. **Regex + LLM.** A preprocessor keeps the error lines plus context. 13 regex patterns give a fast, deterministic hint (category, known cause, known fix, whether it is safe to auto-fix). One LLM call turns hint + log into a strict JSON diagnosis, validated with Pydantic. A known hand-off pattern always overrides the LLM's `auto_fixable`.
2. **Fallback chain.** Groq → OpenAI → Gemini → OpenRouter → Ollama (local). Providers without a key are skipped; if every LLM fails, the pattern answer is returned, so Explain mode never goes blank. The response says which provider answered.
3. **Single agent, two tools.** One plain Python loop (no frameworks, no sub-agents): build → diagnose → hand off *or* one tool call → patch → approval → apply → rebuild, capped at `AGENT_MAX_ATTEMPTS`. The LLM can only call `propose_edit(path, old, new)` or `install_package(name)`.
4. **Guardrails.**
   - Logs are untrusted data: redacted, wrapped in `<log>` tags, never executed.
   - Builds run in a throwaway copy of the project; only `npm install`, `npm install <pkg>` and `npm run build` are allowed, as argv lists with `shell=False`, a timeout and a minimal env (no API keys reach child processes).
   - File access goes through `safe_join`: no path escapes, no `.env*`, keys, `.git/`, `node_modules/` or lock files.
   - Edits must match exactly once; package names are validated; every change is stored as a diff and needs approval.
   - LLM keys live only in the backend; the browser talks to a Next.js server proxy that adds the backend API key.

## Results

Full table with every diagnosis: [`docs/RESULTS.md`](docs/RESULTS.md).

| | Result |
|---|---|
| Explain, 8 sample logs | 8/8 correct pattern, all diagnosed by the LLM (OpenAI), avg 5.2 s |
| Fix, 4 auto-fix scenarios | 4/4 `fixed` on the first attempt, 16–22 s per full run |
| Fix, `missing-env` | handed off to a human with steps (never auto-fixed) |
| Tests | 84 passing (sandbox whitelist, path traversal, `.env` blocking, agent loop, routes, LLM fallback) |

## Repo layout

```
backend/    FastAPI + SQLite + LLM router + agent   (deploys on its own)
frontend/   Next.js + Tailwind, Sky Ink design      (deploys to Vercel)
docs/       ARCHITECTURE, API, DATABASE, SECURITY, DEPLOYMENT, RESULTS
```

Backend and frontend share nothing but HTTP (`docs/API.md`). See `CLAUDE.md` for the team's build rules and `docs/PROMPTS.md` for the Claude Code prompts. Architecture and build plan (shared doc): https://claude.ai/artifact/WCvPfrkBfNiTwMkDaEVxEa
