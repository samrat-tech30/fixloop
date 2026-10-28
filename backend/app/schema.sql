PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS error_patterns (
    id            TEXT PRIMARY KEY,               -- slug, e.g. 'missing-npm-module'
    name          TEXT NOT NULL,
    regex         TEXT NOT NULL,
    category      TEXT NOT NULL,                  -- dependency | build | runtime | config | infra | network
    severity      TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),
    root_cause    TEXT NOT NULL,
    fix_steps     TEXT NOT NULL,                  -- JSON list of strings
    auto_fixable  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    mode         TEXT NOT NULL CHECK (mode IN ('explain','fix')),
    scenario     TEXT,
    source       TEXT,
    log_chars    INTEGER,
    status       TEXT NOT NULL DEFAULT 'running',
                 -- running | awaiting_approval | diagnosed | fixed | handed_off | failed
    attempts     INTEGER NOT NULL DEFAULT 0,
    duration_ms  INTEGER,
    handoff_steps TEXT                           -- JSON list, set when handed_off
);

CREATE TABLE IF NOT EXISTS diagnoses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    attempt         INTEGER NOT NULL DEFAULT 0,
    pattern_id      TEXT REFERENCES error_patterns(id),
    summary         TEXT NOT NULL,
    category        TEXT NOT NULL,
    root_cause      TEXT NOT NULL,
    confidence      REAL NOT NULL,
    severity        TEXT NOT NULL,
    evidence_lines  TEXT NOT NULL,                -- JSON list
    fix_steps       TEXT NOT NULL,                -- JSON list
    auto_fixable    INTEGER NOT NULL DEFAULT 0,
    files_to_change TEXT NOT NULL DEFAULT '[]',   -- JSON list
    provider        TEXT NOT NULL,
    model           TEXT,
    latency_ms      INTEGER,
    redactions      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_steps (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    step_no         INTEGER NOT NULL,
    action          TEXT NOT NULL,                -- run_build | diagnose | propose_edit | install_package | apply_patch | hand_off | finish
    input           TEXT,                         -- JSON
    summary         TEXT,
    output_excerpt  TEXT,                         -- redacted, max 4000 chars
    ok              INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patches (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('edit','install')),
    file_path    TEXT,
    before_text  TEXT,
    after_text   TEXT,
    package      TEXT,
    diff         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | applied | failed
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id        INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    diagnosis_id  INTEGER REFERENCES diagnoses(id) ON DELETE CASCADE,
    rating        INTEGER NOT NULL CHECK (rating IN (-1, 1)),
    comment       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diag_run ON diagnoses(run_id);
CREATE INDEX IF NOT EXISTS idx_steps_run ON agent_steps(run_id, step_no);
CREATE INDEX IF NOT EXISTS idx_patches_run ON patches(run_id);
CREATE INDEX IF NOT EXISTS idx_feedback_run ON feedback(run_id);
