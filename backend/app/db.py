"""SQLite access. ALL SQL lives in this file (see fixloop-database skill)."""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from app.config import settings

SCHEMA_FILE = Path(__file__).with_name("schema.sql")

_RUN_FIELDS = {"status", "attempts", "duration_ms", "handoff_steps", "scenario"}
_JSON_COLS = {"fix_steps", "evidence_lines", "files_to_change", "input", "handoff_steps"}


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(settings.db_file, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    d = dict(row)
    for k in _JSON_COLS & d.keys():
        if isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except json.JSONDecodeError:
                pass
    for k in ("auto_fixable", "ok"):
        if k in d and d[k] is not None:
            d[k] = bool(d[k])
    return d


def _rows(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [_row(r) for r in rows]  # type: ignore[misc]


# ------------------------------------------------------------------ setup
def init_db() -> None:
    settings.db_file.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))


def seed_patterns(patterns: list[dict[str, Any]]) -> None:
    with get_conn() as conn:
        conn.executemany(
            """INSERT INTO error_patterns (id, name, regex, category, severity, root_cause, fix_steps, auto_fixable)
               VALUES (:id, :name, :regex, :category, :severity, :root_cause, :fix_steps, :auto_fixable)
               ON CONFLICT(id) DO UPDATE SET name=excluded.name, regex=excluded.regex, category=excluded.category,
                 severity=excluded.severity, root_cause=excluded.root_cause, fix_steps=excluded.fix_steps,
                 auto_fixable=excluded.auto_fixable""",
            [{**p, "fix_steps": json.dumps(p["fix_steps"]), "auto_fixable": int(p["auto_fixable"])} for p in patterns],
        )


def list_patterns() -> list[dict[str, Any]]:
    with get_conn() as conn:
        return _rows(conn.execute(
            "SELECT id, name, category, severity, auto_fixable FROM error_patterns ORDER BY category, id").fetchall())


# ------------------------------------------------------------------ runs
def create_run(mode: str, *, source: str | None = None, scenario: str | None = None,
               log_chars: int | None = None, status: str = "running") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO runs (mode, source, scenario, log_chars, status) VALUES (?, ?, ?, ?, ?)",
            (mode, source, scenario, log_chars, status))
        return int(cur.lastrowid)


def update_run(run_id: int, **fields: Any) -> None:
    bad = set(fields) - _RUN_FIELDS
    if bad:
        raise ValueError(f"Unknown run fields: {bad}")
    if not fields:
        return
    vals = [json.dumps(v) if k in _JSON_COLS else v for k, v in fields.items()]
    cols = ", ".join(f"{k} = ?" for k in fields)  # keys come from the whitelist above
    with get_conn() as conn:
        conn.execute(f"UPDATE runs SET {cols} WHERE id = ?", (*vals, run_id))


def get_run(run_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        return _row(conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone())


def active_fix_run() -> dict[str, Any] | None:
    with get_conn() as conn:
        return _row(conn.execute(
            "SELECT * FROM runs WHERE mode='fix' AND status IN ('running','awaiting_approval') "
            "ORDER BY id DESC LIMIT 1").fetchone())


# ------------------------------------------------------------------ diagnoses
def save_diagnosis(run_id: int, d: dict[str, Any], attempt: int = 0) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO diagnoses (run_id, attempt, pattern_id, summary, category, root_cause, confidence, severity,
                 evidence_lines, fix_steps, auto_fixable, files_to_change, provider, model, latency_ms, redactions)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, attempt, d.get("pattern_id"), d["summary"], d["category"], d["root_cause"], d["confidence"],
             d["severity"], json.dumps(d["evidence_lines"]), json.dumps(d["fix_steps"]), int(d["auto_fixable"]),
             json.dumps(d.get("files_to_change", [])), d["provider"], d.get("model"), d.get("latency_ms"),
             d.get("redactions", 0)))
        return int(cur.lastrowid)


def list_diagnoses(run_id: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT d.*, p.name AS pattern_name FROM diagnoses d
               LEFT JOIN error_patterns p ON p.id = d.pattern_id WHERE d.run_id = ? ORDER BY d.id""",
            (run_id,)).fetchall()
        return _rows(rows)


# ------------------------------------------------------------------ agent steps
def add_step(run_id: int, action: str, *, summary: str = "", input: Any = None,
             output_excerpt: str = "", ok: bool = True) -> int:
    with get_conn() as conn:
        n = conn.execute("SELECT COALESCE(MAX(step_no), 0) + 1 FROM agent_steps WHERE run_id = ?",
                         (run_id,)).fetchone()[0]
        cur = conn.execute(
            "INSERT INTO agent_steps (run_id, step_no, action, input, summary, output_excerpt, ok) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (run_id, n, action, json.dumps(input) if input is not None else None, summary,
             output_excerpt[-4000:], int(ok)))
        return int(cur.lastrowid)


def list_steps(run_id: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        return _rows(conn.execute(
            "SELECT step_no, action, input, summary, output_excerpt, ok, created_at FROM agent_steps "
            "WHERE run_id = ? ORDER BY step_no", (run_id,)).fetchall())


# ------------------------------------------------------------------ patches
def create_patch(run_id: int, *, kind: str, diff: str, file_path: str | None = None,
                 before_text: str | None = None, after_text: str | None = None,
                 package: str | None = None) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO patches (run_id, kind, file_path, before_text, after_text, package, diff) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (run_id, kind, file_path, before_text, after_text, package, diff))
        return int(cur.lastrowid)


def get_patch(patch_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        return _row(conn.execute("SELECT * FROM patches WHERE id = ?", (patch_id,)).fetchone())


def set_patch_status(patch_id: int, status: str) -> None:
    with get_conn() as conn:
        conn.execute("UPDATE patches SET status = ? WHERE id = ?", (status, patch_id))


def list_patches(run_id: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        return _rows(conn.execute(
            "SELECT id, kind, file_path, package, diff, status, created_at FROM patches "
            "WHERE run_id = ? ORDER BY id", (run_id,)).fetchall())


# ------------------------------------------------------------------ feedback + stats
def add_feedback(run_id: int, diagnosis_id: int | None, rating: int, comment: str | None) -> bool:
    """Returns False when the run/diagnosis pair does not exist."""
    with get_conn() as conn:
        if diagnosis_id is not None:
            ok = conn.execute("SELECT 1 FROM diagnoses WHERE id = ? AND run_id = ?",
                              (diagnosis_id, run_id)).fetchone()
        else:
            ok = conn.execute("SELECT 1 FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not ok:
            return False
        conn.execute("INSERT INTO feedback (run_id, diagnosis_id, rating, comment) VALUES (?, ?, ?, ?)",
                     (run_id, diagnosis_id, rating, comment))
        return True


def stats() -> dict[str, Any]:
    with get_conn() as conn:
        q = lambda sql: conn.execute(sql).fetchone()  # noqa: E731
        ratings, positive = q("SELECT COUNT(*), COALESCE(SUM(rating = 1), 0) FROM feedback")
        total, explain, fix = q(
            "SELECT COUNT(*), COALESCE(SUM(mode='explain'),0), COALESCE(SUM(mode='fix'),0) FROM runs")
        fixed, handed, failed = q(
            "SELECT COALESCE(SUM(status='fixed'),0), COALESCE(SUM(status='handed_off'),0), "
            "COALESCE(SUM(status='failed'),0) FROM runs WHERE mode='fix'")
        diag_n, avg_lat, hits = q(
            "SELECT COUNT(*), AVG(latency_ms), COALESCE(SUM(pattern_id IS NOT NULL),0) FROM diagnoses")

    pct = lambda a, b: round(100 * a / b, 1) if b else None  # noqa: E731
    finished = fixed + handed + failed
    return {
        "usefulness_pct": pct(positive, ratings),
        "ratings": ratings,
        "total_runs": total,
        "explain_runs": explain,
        "fix_runs": fix,
        "fixed": fixed,
        "handed_off": handed,
        "failed": failed,
        "auto_fix_rate_pct": pct(fixed, finished),
        "avg_latency_ms": round(avg_lat) if avg_lat is not None else None,
        "pattern_hit_pct": pct(hits, diag_n),
    }
