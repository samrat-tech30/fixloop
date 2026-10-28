# Implementation plan

**Hard rule:** Explain mode works end-to-end in the UI by **2:15**. Fix mode is built on top and frozen at **2:55** whatever its state.

## Roles

| Person | Owns | Folders / files | Claude Code prompts |
|---|---|---|---|
| P1 — Data & demo | Sample logs, pattern quality, demo scenarios, run the demo project by hand | `backend/data/`, `backend/demo/` | 1, 9 |
| P2 — Agent | Sandbox runner, agent loop, tools, guardrails | `backend/app/core/sandbox.py`, `core/agent.py` | 5, 6 |
| P3 — AI | LLM router, diagnosis prompt quality, fallback, offline mode | `backend/app/core/llm.py`, `core/diagnose.py`, `core/preprocess.py` | 2, 8 |
| P4 — App | Fix-mode routes + the whole frontend | `backend/app/routes/fix.py`, `frontend/` | 3, 4, 7 |
| P5 — Pitch | Tests, score sheet, docs, slides, video, rehearsal | `docs/`, `README.md` | 10 |

## Schedule

| Time | Goal | Done when |
|---|---|---|
| Now → +15 min | Everyone: clone repo, backend runs, `/docs` opens, one `/analyze` call works with a real key | `curl` or `/docs` returns a diagnosis |
| → 2:15 | Explain UI (P4), prompt tuning on 8 samples (P3), sandbox runner (P2), sample/scenario checks (P1), score sheet template (P5) | **Checkpoint 1:** paste OOMKilled sample → card → 👍 saved, stats update |
| 2:15 → 2:55 | Agent loop (P2), fix routes + live run screen + approve (P4), test all scenarios (P1, P5) | `missing-package` goes red → approve → green in the UI |
| **2:55** | **Feature freeze** | Only crash fixes after this |
| 2:55 → 3:10 | Run all 8 samples + 5 scenarios, rate each honestly, fill score sheet, stats screen | Numbers for the pitch |
| 3:10 → 3:25 | Record 2-min demo video (screen recorder) + README polish | Video saved on 2 devices |
| 3:25 → 3:30 | Submit, rehearse once | Submitted |

**If behind:** at 2:15 without Explain UI → drop Fix mode, polish Explain + stats. At 2:55 without a full loop → demo Fix mode on `missing-package` only with `auto_approve` and describe the rest.

## Test matrix (P5 fills)

| Case | Correct cause? | Useful? 👍/👎 | Auto-fixed / handed off correctly? | Seconds |
|---|---|---|---|---|
| sample: npm-missing-module | | | n/a | |
| sample: crashloop | | | n/a | |
| sample: imagepull | | | n/a | |
| sample: oomkilled | | | n/a | |
| sample: port-in-use | | | n/a | |
| sample: db-refused | | | n/a | |
| sample: docker-copy | | | n/a | |
| sample: eresolve | | | n/a | |
| scenario: missing-package | | | | |
| scenario: wrong-import | | | | |
| scenario: type-error | | | | |
| scenario: syntax-error | | | | |
| scenario: missing-env (hand-off) | | | | |

Target from the brief: **80%+ useful**.

## Judging criteria → what we show

| Criterion | Marks | Evidence |
|---|---|---|
| Relevance | 30 | Every brief item: logs in, readable summary, recommendations, UI, usefulness feedback, docs, video; founder's own deployment pain |
| Innovation | 15 | Agent fixes and *proves* it by rebuilding; knows when to stop and hand off |
| Feasibility & scalability | 15 | Runs on a laptop; separate deployable frontend/backend; SQLite → Postgres; patterns are data |
| AI/ML/GenAI | 20 | Hybrid regex + LLM, confidence, tool-calling agent, provider fallback, offline local model, feedback loop |
| Teamwork | 20 | Each person presents what they built (one line each) |

## 2-minute demo script
1. **15 s — story:** "I deploy my own startup. Every failed build meant copy-pasting logs into AI again and again."
2. **30 s — Explain:** pick the OOMKilled sample → card with cause, severity, confidence, steps → 👍. Point at "2 secrets masked" when using the sample with a token.
3. **45 s — Fix:** run `missing-package` → live steps → approve the install → build turns green.
4. **15 s — Hand-off:** run `missing-env` → "I can't fix this safely; here's exactly what to do."
5. **15 s — Stats:** usefulness %, auto-fix rate, avg seconds. Close: "From 30 minutes of copy-paste to 30 seconds."
