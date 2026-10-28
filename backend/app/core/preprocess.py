"""Turn a raw deployment log into a short, redacted excerpt the LLM can read cheaply."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.config import settings
from app.security import redact

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")
TIMESTAMP_RE = re.compile(
    r"^\s*(\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?|\[?\d{2}:\d{2}:\d{2}(?:\.\d+)?\]?)\s*")
ERROR_RE = re.compile(
    r"(?i)(\berror\b|\berr!|\bfailed\b|\bfailure\b|\bfatal\b|exception|traceback|exit code|exited with|"
    r"cannot find|can't resolve|not found|denied|refused|killed|oomkilled|crashloopbackoff|imagepullbackoff|"
    r"errimagepull|eaddrinuse|econnrefused|eresolve|panic|segmentation fault|unexpected token|is not defined|"
    r"type error|ts\d{4}|syntaxerror|incompatible)")
WINDOW = 12          # lines kept before/after each error line
MAX_ERROR_LINES = 20


@dataclass
class CleanLog:
    text: str                       # redacted excerpt sent to the LLM
    error_lines: list[str] = field(default_factory=list)
    redactions: int = 0
    total_lines: int = 0
    truncated: bool = False


def _normalise(raw: str) -> list[str]:
    raw = ANSI_RE.sub("", raw.replace("\r\n", "\n").replace("\r", "\n"))
    lines = [TIMESTAMP_RE.sub("", ln).rstrip() for ln in raw.split("\n")]
    out: list[str] = []
    repeat = 0
    for ln in lines:
        if out and ln == out[-1]:
            repeat += 1
            continue
        if repeat:
            out.append(f"... (previous line repeated {repeat} more times)")
            repeat = 0
        out.append(ln)
    if repeat:
        out.append(f"... (previous line repeated {repeat} more times)")
    return [ln for ln in out if ln.strip()]


def clean(raw: str, max_chars: int | None = None) -> CleanLog:
    max_chars = max_chars or settings.max_llm_log_chars
    redacted, n_red = redact(raw)
    lines = _normalise(redacted)
    err_idx = [i for i, ln in enumerate(lines) if ERROR_RE.search(ln)]
    error_lines = [lines[i].strip()[:300] for i in err_idx][:MAX_ERROR_LINES]

    if not err_idx:
        keep = set(range(max(0, len(lines) - 60), len(lines)))       # no obvious error: keep the tail
    else:
        keep = set()
        for i in err_idx:
            keep.update(range(max(0, i - WINDOW), min(len(lines), i + WINDOW + 1)))
        keep.update(range(max(0, len(lines) - 10), len(lines)))      # tail usually holds the exit status

    parts: list[str] = []
    prev = -1
    for i in sorted(keep):
        if prev != -1 and i != prev + 1:
            parts.append("...")
        parts.append(lines[i])
        prev = i
    text = "\n".join(parts)

    truncated = False
    if len(text) > max_chars:                                        # keep head + tail, drop the middle
        half = max_chars // 2
        text = text[:half] + "\n...[truncated]...\n" + text[-half:]
        truncated = True
    return CleanLog(text=text, error_lines=error_lines, redactions=n_red, total_lines=len(lines), truncated=truncated)
