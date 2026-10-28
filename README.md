# FixLoop — Deployment Troubleshooting Agent

TCS Technology Day hackathon, BMSCE, 28 Oct 2026. Problem statement: *IT Application Maintenance — Deployment Issue Troubleshooting Assistant*.

FixLoop is a **single-agent** troubleshooting assistant. Paste a failed deployment log and it explains the root cause in plain English and recommends fixes (**Explain mode**). Point it at a broken project and it runs the build, diagnoses, proposes a code change, applies it after human approval, and re-runs the build until it passes or hands off to a human (**Fix mode**).

Full architecture and build plan (shared doc): https://claude.ai/artifact/WCvPfrkBfNiTwMkDaEVxEa

## Repo layout

One GitHub repo, two independently deployable apps:

```
fixloop/
  CLAUDE.md                 # rules for Claude Code (read first)
  .claude/skills/           # skills Claude Code loads automatically
  docs/                     # architecture, plan, API, DB, security, deploy, prompts
  backend/                  # FastAPI + SQLite + LLM router + agent  -> deploy to Render/Railway/any VM
  frontend/                 # Next.js + Tailwind, Sky Ink design     -> deploy to Vercel
```

The frontend never talks to an LLM and never holds LLM keys. It calls the backend through its own server-side proxy route, which adds the backend API key.

## Quick start (local)

Requirements: Python 3.12.8, Node 20+, npm. Optional: Ollama with a Qwen 2.5 coder model.

```bash
# 1. Backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then paste your GROQ_API_KEY and GEMINI_API_KEY
cd demo/template && npm install && cd ../..   # installs TypeScript for the demo project once
uvicorn app.main:app --reload --port 8000
# open http://localhost:8000/docs

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local    # BACKEND_URL=http://localhost:8000, same APP_API_KEY as backend
npm run dev
# open http://localhost:3000
```

## Building with Claude Code

Open the **repo root** in Claude Code so it reads `CLAUDE.md` and the skills in `.claude/skills/`. Then paste the prompts from `docs/PROMPTS.md` in order. Each prompt names its owner, files and a "done when" check.

## What already works in this starter

| Part | State |
|---|---|
| Config, security helpers, SQLite schema + seeding | Working |
| LLM router (Groq → Gemini → Ollama) | Working, needs keys |
| Preprocessor, pattern matcher (13 patterns), diagnoser | Working |
| `POST /analyze`, `POST /feedback`, `GET /stats`, `GET /patterns`, `GET /health` | Working |
| Sample logs (8) + demo project with 5 bug scenarios | Ready |
| Sandbox runner, agent loop, Fix-mode routes | Stubs with contracts — build with `docs/PROMPTS.md` |
| Frontend | Config, tokens, API client and proxy ready; screens to build |

## Docs

- `docs/ARCHITECTURE.md` — components and data flow
- `docs/IMPLEMENTATION_PLAN.md` — schedule, roles, checkpoints, demo script
- `docs/API.md` — every route with request/response
- `docs/DATABASE.md` — tables and stats queries
- `docs/SECURITY.md` — threat model and controls
- `docs/DEPLOYMENT.md` — deploy backend and frontend separately from one repo
- `docs/PROMPTS.md` — copy-paste prompts for Claude Code
