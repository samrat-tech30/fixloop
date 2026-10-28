"""Regex signatures for known errors (backend/data/patterns.json)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from app.config import settings

SEVERITY_RANK = {"critical": 3, "warning": 2, "info": 1}


@dataclass(frozen=True)
class PatternHit:
    id: str
    name: str
    category: str
    severity: str
    root_cause: str
    fix_steps: tuple[str, ...]
    auto_fixable: bool
    matched_line: str
    groups: dict[str, str]


_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def _fill(step: str, groups: dict[str, str]) -> str:
    """Replace {name} with the captured group; unknown placeholders become a neutral phrase."""
    return _PLACEHOLDER.sub(lambda m: groups.get(m.group(1), "the value shown in the log"), step)


@lru_cache(maxsize=1)
def load_patterns() -> list[dict[str, Any]]:
    """Regexes are case-sensitive by default; use (?i) inside a regex to ignore case."""
    data = json.loads((settings.data_dir / "patterns.json").read_text(encoding="utf-8"))
    for p in data:
        p["_re"] = re.compile(p["regex"], re.M)
    return data


def public_patterns() -> list[dict[str, Any]]:
    """Patterns without the compiled regex, for seeding the DB."""
    return [{k: v for k, v in p.items() if not k.startswith("_")} for p in load_patterns()]


def match(text: str) -> list[PatternHit]:
    """All matching patterns, best first (severity, then earliest in the log)."""
    hits: list[tuple[int, int, PatternHit]] = []
    for p in load_patterns():
        m = p["_re"].search(text)
        if not m:
            continue
        line_start = text.rfind("\n", 0, m.start()) + 1
        line_end = text.find("\n", m.end())
        line = text[line_start: line_end if line_end != -1 else len(text)].strip()[:300]
        groups = {k: v for k, v in m.groupdict().items() if v}
        steps = tuple(_fill(s, groups) for s in p["fix_steps"])
        hit = PatternHit(p["id"], p["name"], p["category"], p["severity"], p["root_cause"], steps,
                         bool(p["auto_fixable"]), line, groups)
        hits.append((-SEVERITY_RANK[p["severity"]], m.start(), hit))
    hits.sort(key=lambda t: (t[0], t[1]))
    return [h for _, _, h in hits]


def best(text: str) -> PatternHit | None:
    hits = match(text)
    return hits[0] if hits else None
