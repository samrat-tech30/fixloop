# backend/ — FastAPI service

Load the `fixloop-backend` skill (and `fixloop-agent` for Fix mode, `fixloop-database` for SQL). Contracts: `../docs/API.md`.

Run: `uvicorn app.main:app --reload --port 8000` · Test: `pytest -q` · Check patterns: `python -m app.tools.check_patterns`

Working: config, security, db, preprocess, patterns, diagnose, llm router, `/analyze`, `/feedback`, `/stats`, `/patterns`, `/samples`, `/demo/scenarios`.
Stubs to build: `app/core/sandbox.py`, `app/core/agent.py`, the rest of `app/routes/fix.py` (they raise `NotImplementedError` / return 501).

This folder deploys on its own (Dockerfile here). Never import from `../frontend`.
