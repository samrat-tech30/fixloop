# Database

SQLite file at `DB_PATH` (default `backend/fixloop.db`), created on startup from `backend/app/schema.sql`. Error patterns are seeded from `backend/data/patterns.json` on every start (upsert), so editing the JSON and restarting is enough.

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `error_patterns` | Known error signatures → cause + fixes | `id` (slug), `name`, `regex`, `category`, `severity`, `root_cause`, `fix_steps` (JSON), `auto_fixable` |
| `runs` | One row per request | `id`, `created_at`, `mode` (explain/fix), `scenario`, `source`, `log_chars`, `status`, `attempts`, `duration_ms` |
| `diagnoses` | Every answer given | `id`, `run_id`, `attempt`, `pattern_id`, `summary`, `category`, `root_cause`, `confidence`, `severity`, `evidence_lines` (JSON), `fix_steps` (JSON), `auto_fixable`, `files_to_change` (JSON), `provider`, `model`, `latency_ms`, `redactions` |
| `agent_steps` | Fix-mode audit trail | `id`, `run_id`, `step_no`, `action`, `input` (JSON), `summary`, `output_excerpt`, `ok`, `created_at` |
| `patches` | Proposed changes awaiting approval | `id`, `run_id`, `kind` (edit/install), `file_path`, `before_text`, `after_text`, `package`, `diff`, `status` (pending/approved/rejected/applied/failed) |
| `feedback` | 👍/👎 usefulness | `id`, `run_id`, `diagnosis_id`, `rating` (+1/−1), `comment`, `created_at` |

## Privacy choice
We **do not store raw logs** — only the cleaned, redacted log excerpt inside the diagnosis evidence and the character count. Logs from real deployments can contain secrets; the redactor masks them before storage and before any LLM call.

## Stats queries (implemented in `db.stats()`)
- usefulness % = `100 * SUM(rating=1) / COUNT(*)` from `feedback`
- auto-fix rate % = fix runs with `status='fixed'` / fix runs that finished
- average latency = `AVG(latency_ms)` from `diagnoses`
- pattern hit % = diagnoses with `pattern_id IS NOT NULL` / all diagnoses

## Rules
- Always parameterised queries (`?`), never f-strings into SQL.
- JSON columns are written with `json.dumps` and read with `json.loads` in `db.py` only.
- One connection per request (`check_same_thread=False`, WAL mode) — fine for a demo.

## Moving to production
Same schema runs on Postgres (Supabase/Neon): change `INTEGER PRIMARY KEY AUTOINCREMENT` to `BIGSERIAL`, `TEXT` JSON to `JSONB`, and swap `sqlite3` for `psycopg`. Add row-level ownership (`org_id`) when multi-tenant.
