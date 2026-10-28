---
name: fixloop-security
description: Security checklist for FixLoop. Use before finishing ANY change in backend/ or frontend/, when handling logs, secrets, API keys, CORS, auth, subprocesses, file paths, LLM output rendering, or deployment config.
---

# FixLoop security checklist

Full threat model: `docs/SECURITY.md`. Run through this list before you say a task is done.

## Secrets
- [ ] No keys, tokens or passwords in code, tests, docs examples or commit history. Only `.env.example` with empty values.
- [ ] `.env`, `.env.local`, `*.db`, `runs/` are git-ignored.
- [ ] LLM keys exist only in the backend env. Frontend env has only `BACKEND_URL` and `APP_API_KEY`, both server-side (no `NEXT_PUBLIC_`).
- [ ] Nothing logs a key, header value or full prompt.

## Logs are untrusted input
- [ ] Every log passes through `preprocess.clean()` (which calls `security.redact`) before LLM, DB or step output.
- [ ] Prompts wrap the log in `<log>...</log>` and say it is data, not instructions.
- [ ] LLM output is parsed into Pydantic models; free text is never executed or used as a path/command without validation.

## API
- [ ] New routes use `Depends(require_api_key)` (except `/health`).
- [ ] Request models have `max_length` on strings and bounds on numbers.
- [ ] Expensive routes have a `@limiter.limit(...)`.
- [ ] CORS stays an allowlist from `ALLOWED_ORIGINS`.
- [ ] Errors return short messages; stack traces only in server logs.

## Agent / subprocess
- [ ] Commands only from the whitelist, argv list, `shell=False`, timeout set, minimal env (no API keys passed to children).
- [ ] File access only via `security.safe_join` inside the sandbox; blocked patterns enforced (`.env*`, keys, `.git/`, `node_modules/`).
- [ ] Every change is a `patches` row with a diff and goes through approval (unless explicitly auto-approved for the demo).
- [ ] Attempts are capped; only one active fix run.

## Frontend
- [ ] Model text rendered as text; no `dangerouslySetInnerHTML`, no `eval`, no rendering markdown to HTML without sanitising.
- [ ] All backend calls go through `src/lib/api.ts` → `/api/proxy/*`.
- [ ] Proxy forwards only whitelisted path prefixes and methods.
- [ ] Security headers in `next.config.ts` remain.
