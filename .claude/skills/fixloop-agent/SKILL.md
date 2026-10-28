---
name: fixloop-agent
description: How to build FixLoop's single Fix-mode agent — the sandbox runner (backend/app/core/sandbox.py), the agent loop and its two tools (backend/app/core/agent.py), patches and approval, the demo scenarios, and the fix routes. Use for any Fix-mode or agent work.
---

# FixLoop agent

## Shape
ONE agent, a plain Python loop. No frameworks (no LangChain/LangGraph/CrewAI), no sub-agents.

```
attempt = 0
while attempt < settings.agent_max_attempts:
    result = sandbox.run_build(sb)                 # npm run build (npm install first time)
    step("run_build", ok=result.exit_code == 0)
    if result.exit_code == 0: finish("fixed"); return
    diag = diagnose(clean(result.output))          # reuse Explain-mode diagnoser
    if not diag.auto_fixable: finish("handed_off", handoff_steps=diag.fix_steps); return
    action = llm.chat_tools(messages, TOOLS)       # exactly one tool call
    patch = create_patch(action)                   # validated, diff stored, status pending
    if not wait_for_approval(patch): finish("failed"); return
    apply(patch); attempt += 1
finish("failed")
```

## Tools the LLM may call (only these two)
| Tool | Args | Validation |
|---|---|---|
| `propose_edit` | `path`, `old`, `new` | `safe_join` inside sandbox; not a blocked path; `old` must occur **exactly once** in the file; `new` ≤ 5,000 chars |
| `install_package` | `name` | npm name regex from `docs/SECURITY.md`; no `@version`, URLs or paths |

The agent itself (not the LLM) runs `run_build` and `read_file`. Give the LLM the failing file contents in the prompt: parse file paths from the diagnosis `files_to_change` and from `src/...ts(line,col)` patterns in the build log, read up to 3 files (≤ 6,000 chars total).

## Sandbox (`core/sandbox.py`)
- `create_sandbox(run_id, scenario)`: `shutil.copytree(demo/template, runs/<run_id>, symlinks=True)` (include `node_modules` if present — saves time and network; `symlinks=True` is required or `node_modules/.bin/tsc` breaks), then overlay `demo/scenarios/<scenario>/` (files there replace template files; `scenario.json` is metadata and is not copied).
- `run_command(sb, argv)`: allowed argv shapes only: `["npm","install"]`, `["npm","install",<pkg>]`, `["npm","run","build"]`. Resolve `npm` with `shutil.which("npm")` (Windows: `npm.cmd`). `subprocess.run(argv, cwd=sb, shell=False, capture_output=True, text=True, timeout=settings.build_timeout_seconds, env=minimal_env)`. `minimal_env` = PATH, HOME/USERPROFILE, SYSTEMROOT/APPDATA on Windows, `CI=1` — **not** the backend's env (keeps API keys out of child processes).
- Blocked paths: `.env*`, `*.pem`, `*.key`, `.git/`, `node_modules/`, `package-lock.json` (edits), anything outside the sandbox.

## Approval
- `patches.status`: `pending` → `approved`/`rejected` → `applied`/`failed`.
- Run status `awaiting_approval` while a patch is pending. The loop polls the DB every 0.5 s (timeout 10 min → `failed`).
- `auto_approve=True` (request) or `AUTO_APPROVE=true` (env) approves immediately — demo convenience only.

## Hand-off rules (never auto-fix)
Missing env vars/secrets, memory/CPU limits, registry auth, cloud permissions, DNS/network, quota/billing, anything outside the repo. Return the diagnoser's `fix_steps` as `handoff_steps`.

## Demo scenarios (`backend/demo/scenarios/*`)
`missing-package`, `wrong-import`, `type-error`, `syntax-error` (auto-fix) and `missing-env` (hand-off). `GET /demo/scenarios` reads each `scenario.json`.

## Testing
Use the `fake_llm` fixture to return a scripted tool call; run the `missing-package` scenario end-to-end only if `npm` is on PATH (`pytest.mark.skipif`).
