---
name: fixloop-backend
description: Conventions for FixLoop's FastAPI backend in backend/. Use whenever writing or changing Python in backend/app — routes, Pydantic models, config, the LLM router, preprocessor, pattern matcher, diagnoser, tests or tooling scripts.
---

# FixLoop backend conventions

Python 3.12.8, FastAPI, Pydantic v2, pydantic-settings, SQLite (stdlib `sqlite3`), OpenAI Python SDK pointed at OpenAI-compatible providers.

## Layout
```
backend/app/
  main.py        app factory: CORS, rate limit, routers, startup
  config.py      Settings (env) -> `from app.config import settings`
  security.py    require_api_key, redact, safe_join
  db.py          connection + all SQL (no SQL anywhere else)
  schema.sql     DDL
  models.py      Pydantic request/response models (match docs/API.md exactly)
  core/          pure-ish logic, no FastAPI imports
  routes/        thin HTTP layer: validate -> call core -> store via db -> return model
  tools/         CLI scripts (python -m app.tools.<name>)
backend/tests/   pytest, fake LLM, no network
```

## Rules
1. **Contracts are fixed** by `docs/API.md`. If you must change one, update the doc and `frontend/src/lib/types.ts` in the same change.
2. Routes stay thin. Business logic lives in `core/`. SQL lives only in `db.py`.
3. Every LLM call goes through `core/llm.py` (`chat_json` or `chat_tools`). Never instantiate an OpenAI client elsewhere. The router handles Groq → Gemini → Ollama fallback and returns which provider answered.
4. Every log goes through `core/preprocess.clean()` **before** pattern matching, LLM calls or storage (it redacts secrets).
5. Never raise raw provider errors to the client. Catch, log `logger.warning(...)` without secrets, degrade (pattern-only answer) or return 503 with a short message.
6. Validate LLM JSON with Pydantic (`models.DiagnosisLLM`). Clamp confidence to 0..1, severity to the enum, lists to ≤ 8 items.
7. Use `settings` for every limit (sizes, timeouts, attempts). No magic numbers in routes.
8. Tests use `tests/conftest.py`'s `fake_llm` fixture — never call real APIs in tests. Run `pytest -q` before finishing.
9. Keep the dependency list short; add new ones to `requirements.txt` with a version floor.
10. Before finishing, run the `fixloop-security` checklist.

## LLM usage tips (Groq free tier: ~30 req/min, ~8K tokens/min on gpt-oss-120b)
- Keep each request under ~2,500 input tokens: the preprocessor caps the log at `MAX_LLM_LOG_CHARS`.
- `temperature=0.1` for diagnosis; `response_format={"type":"json_object"}` where supported (the router retries without it if a provider rejects it).
- One diagnosis = one LLM call. One agent attempt ≤ 2 calls.
