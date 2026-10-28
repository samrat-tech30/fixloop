# Prompts for Claude Code

Open the **repo root** in Claude Code (so it reads `CLAUDE.md` and `.claude/skills/`). Paste one prompt at a time. Each person can run their own Claude Code session on their own laptop — the prompts touch different files, so merge conflicts stay small. Pull/commit often.

---

## Prompt 0 — everyone, first 10 minutes
```
Read CLAUDE.md, docs/ARCHITECTURE.md and docs/API.md. Then help me run the backend locally:
create the venv, install backend/requirements.txt, copy backend/.env.example to backend/.env
(I will paste my keys), run `cd backend && pytest -q`, start uvicorn, and call POST /analyze
with backend/data/logs/oomkilled.log. Do not change any code. Report what worked.
```

## Prompt 1 — P1 (data & demo)
```
Load the fixloop-backend skill. Run `python -m app.tools.check_patterns` from backend/ and show
which sample logs in backend/data/logs/ match which pattern. Then:
1) add one more realistic sample log for "Vercel/Next.js build: Type error" and one for
   "Node version mismatch" to backend/data/logs/ with a title line in samples.json,
2) make sure every pattern in backend/data/patterns.json matches at least one sample,
3) run `cd backend/demo/template && npm install`, then from backend/ run
   `python demo/try_scenario.py <scenario>` for each scenario and confirm the build fails with
   the expected error (missing-package TS2307 axios, wrong-import TS2307 ./componets, type-error
   TS2322, syntax-error TS1005, missing-env "API_KEY is not defined").
Keep patterns.json valid JSON. Do not touch app/ code.
```

## Prompt 2 — P3 (AI quality)
```
Load the fixloop-backend skill. Start the backend and run every sample in backend/data/logs/
through POST /analyze (write a small script backend/app/tools/eval_samples.py that prints
pattern_id, provider, confidence, latency_ms and the summary for each). Improve the prompt in
app/core/diagnose.py so summaries are 1–2 plain sentences, fix_steps are concrete commands,
and auto_fixable is true ONLY for code/dependency problems inside the repo. Keep the JSON
schema identical. Test the Groq→Gemini fallback by setting a wrong GROQ_API_KEY once.
```

## Prompt 3 — P4 (frontend, Explain mode) — the 2:15 checkpoint
```
Load the fixloop-frontend-sky-ink skill and read frontend/CLAUDE.md and docs/API.md.
Build the Explain screen at frontend/src/app/page.tsx:
- header with the FixLoop wordmark and a nav: Explain, Fix, Stats
- a large textarea to paste a log, a "Try a sample" select (GET /samples via lib/api.ts),
  and ONE blue primary button "Diagnose"
- the result card: severity pill, category chip, confidence bar, summary (Newsreader),
  root cause, evidence lines in a mono <pre>, numbered fix steps with copy buttons,
  "N secrets masked" note when redactions > 0, an "offline" badge when provider is ollama,
  and 👍/👎 feedback pills that POST /feedback and then show "Thanks".
- loading and error states. Render all model text as plain text.
Use only lib/api.ts for calls. Run `npm run build` and fix all errors.
```

## Prompt 4 — P4 (stats page)
```
Load the fixloop-frontend-sky-ink skill. Build frontend/src/app/stats/page.tsx that calls
GET /stats and shows four big Newsreader numbers: usefulness %, auto-fix rate %, avg seconds,
pattern hit %, plus totals (runs, ratings, fixed, handed off). Show "—" for null values.
Refresh every 5 seconds. npm run build must pass.
```

## Prompt 5 — P2 (sandbox runner)
```
Load the fixloop-agent and fixloop-security skills. Implement backend/app/core/sandbox.py exactly
per its docstrings: create_sandbox(run_id, scenario) copies backend/demo/template (including
node_modules if present) and overlays backend/demo/scenarios/<scenario>/ into runs/<run_id>/;
run_command(sandbox, cmd) only allows the whitelisted argv forms, uses shutil.which("npm")
(works on Windows npm.cmd), shell=False, timeout from settings, returns exit code + combined
output (last 200 lines); read_file / write_file use security.safe_join and refuse blocked paths.
Add tests in backend/tests/test_sandbox.py for whitelist, path traversal and blocked files.
Run pytest.
```

## Prompt 6 — P2 (agent loop)
```
Load the fixloop-agent skill. Implement backend/app/core/agent.py per its docstrings and the
loop in docs/ARCHITECTURE.md: run_build → diagnose (reuse core.diagnose) → if not auto_fixable
→ handed_off with fix steps → else one LLM tool call choosing propose_edit(path, old, new) or
install_package(name) → create a patches row (with unified diff) → wait for approval (poll DB,
or apply immediately when auto_approve) → apply → rebuild. Max attempts from settings. Log every
step to agent_steps. Use llm.chat_tools with ONLY those two tools. Validate tool arguments
before acting. Add a test that runs the missing-package scenario with a fake LLM.
```

## Prompt 7 — P4 (Fix screen)
```
Load the fixloop-frontend-sky-ink skill. Implement backend/app/routes/fix.py per docs/API.md
using core.sandbox and core.agent (background task, one active run at a time, 409 otherwise).
Then build frontend/src/app/fix/page.tsx: scenario picker (GET /demo/scenarios), ONE blue
"Run agent" button, auto-approve toggle, live step timeline polling GET /runs/{id} every 1s
(icons for running/ok/failed), patch diff view in <pre> with Approve (black pill) and Reject
(outlined pill), final status banner: Fixed (build green) / Handed off (show manual steps) /
Failed. npm run build and pytest must pass.
```

## Prompt 8 — P3 (offline + robustness)
```
Load the fixloop-backend skill. Make sure that when Groq and Gemini both fail, /analyze uses
Ollama (OLLAMA_MODEL from `ollama list`) and the response provider is "ollama"; if Ollama is
also down, return the pattern-only diagnosis (provider "pattern") instead of a 500. Add a
?offline=true query flag on /analyze that forces Ollama for the demo. Add tests with a fake
router. Run pytest.
```

## Prompt 9 — P1 (demo rehearsal)
```
Start backend and frontend. For each scenario in GET /demo/scenarios run the agent through the
UI flow using the API (POST /agent/run, poll /runs/{id}, approve patches) and write the result
table into docs/RESULTS.md: scenario, final status, attempts, seconds. Fix only data/scenario
problems; report code bugs to me instead of changing app code.
```

## Prompt 10 — P5 (docs and submission)
```
Load the fixloop-security skill and run its checklist over the repo; report anything failing.
Then update README.md with: problem, solution, screenshots placeholders, how to run, input
formats (plain text logs up to MAX_LOG_BYTES; build output from npm/Next.js/Docker/Kubernetes),
AI approach (hybrid regex + LLM, fallback chain, agent tools, guardrails), results from
docs/RESULTS.md and the stats screen. Keep it under 2 pages.
```

---
**If something breaks near a checkpoint:** "We have N minutes until <checkpoint>. Give me the smallest change that makes <feature> work end-to-end; skip everything else."
