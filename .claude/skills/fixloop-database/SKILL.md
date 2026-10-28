---
name: fixloop-database
description: Rules for FixLoop's SQLite database (backend/app/schema.sql and backend/app/db.py). Use before adding or changing tables or columns, writing any query, computing stats, or seeding error patterns.
---

# FixLoop database rules

Source of truth: `backend/app/schema.sql` and `docs/DATABASE.md`.

1. **All SQL lives in `backend/app/db.py`.** Routes and core modules call functions like `db.create_run(...)`, never `conn.execute` directly.
2. **Parameterised queries only** (`?` placeholders). Never build SQL with f-strings or `%`.
3. **Schema changes are additive** during the hackathon: add tables or nullable columns with `ALTER TABLE ... ADD COLUMN` guarded in `db.init_db()`; never drop or rename (teammates have local DB files). If you must reset: delete `fixloop.db` and restart.
4. JSON columns (`fix_steps`, `evidence_lines`, `files_to_change`, `input`) are `TEXT` written with `json.dumps` and decoded in `db.py` before returning dicts.
5. **Never store raw logs or secrets.** Store `log_chars` and the redacted evidence only. `agent_steps.output_excerpt` is truncated to 4,000 chars and passed through `security.redact` first.
6. Timestamps are UTC ISO strings from `datetime('now')`.
7. `error_patterns` is seeded from `backend/data/patterns.json` on every startup with an upsert — edit the JSON, not the table.
8. Stats: implement new metrics as a single SQL query inside `db.stats()`; return `None` (JSON null) when the denominator is 0.
9. Production path: Postgres/Supabase with the same tables (`BIGSERIAL`, `JSONB`, `timestamptz`). Keep column names identical so the move is mechanical.
