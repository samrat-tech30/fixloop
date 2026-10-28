"""Security helpers: API-key auth, secret redaction, safe file paths, npm name validation."""
import hmac
import re
from pathlib import Path

from fastapi import Header, HTTPException, status

from app.config import settings


# ---------------------------------------------------------------- auth
def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """FastAPI dependency. Enforced only when APP_API_KEY is set (empty = local dev)."""
    expected = settings.app_api_key
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing API key")


# ---------------------------------------------------------------- redaction
_MASK = "[REDACTED]"

# (pattern, replacement) — order matters: specific token shapes before generic key=value
_REDACTIONS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S), "[REDACTED PRIVATE KEY]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), _MASK),                                   # AWS access key id
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"), _MASK),                          # GitHub tokens
    (re.compile(r"\bgsk_[A-Za-z0-9]{20,}\b"), _MASK),                                # Groq
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b"), _MASK),                              # OpenAI-style
    (re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}\b"), _MASK),                             # Google API key
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b"), _MASK),  # JWT
    (re.compile(r"(?i)\b(bearer)\s+[A-Za-z0-9\-._~+/]{12,}=*"), r"\1 " + _MASK),
    (re.compile(r"\b([a-zA-Z][a-zA-Z0-9+.\-]*://[^:/\s@]+:)([^@\s/]+)(@)"), r"\1" + _MASK + r"\3"),  # user:pass@host
    (re.compile(
        r"(?i)\b([A-Z0-9_]*(?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key|private[_-]?key|client[_-]?secret)[A-Z0-9_]*)"
        r"(\s*[:=]\s*[\"']?)([^\s\"',;]{6,})"
    ), r"\1\2" + _MASK),
    (re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"), "[EMAIL]"),
]


def redact(text: str) -> tuple[str, int]:
    """Mask secrets in text. Returns (clean_text, number_of_redactions)."""
    total = 0
    for pattern, repl in _REDACTIONS:
        text, n = pattern.subn(repl, text)
        total += n
    return text, total


# ---------------------------------------------------------------- paths
BLOCKED_PARTS = {".git", "node_modules"}
BLOCKED_NAME_RE = re.compile(r"^(\.env.*|.*\.pem|.*\.key|id_rsa.*|package-lock\.json)$", re.I)


class UnsafePathError(ValueError):
    pass


def safe_join(root: Path, relative: str) -> Path:
    """Resolve `relative` under `root`; raise UnsafePathError if it escapes root or is blocked."""
    root = root.resolve()
    rel = relative.replace("\\", "/")
    if rel.startswith("/") or re.match(r"^[A-Za-z]:", rel):
        raise UnsafePathError(f"Absolute paths are not allowed: {relative}")
    target = (root / rel).resolve()
    if target != root and root not in target.parents:
        raise UnsafePathError(f"Path escapes sandbox: {relative}")
    parts = set(target.relative_to(root).parts)
    if parts & BLOCKED_PARTS or BLOCKED_NAME_RE.match(target.name):
        raise UnsafePathError(f"Path is blocked: {relative}")
    return target


# ---------------------------------------------------------------- npm names
NPM_NAME_RE = re.compile(r"^(@[a-z0-9\-~][a-z0-9\-._~]*/)?[a-z0-9\-~][a-z0-9\-._~]*$")


def is_valid_npm_name(name: str) -> bool:
    return 0 < len(name) <= 214 and bool(NPM_NAME_RE.match(name))
