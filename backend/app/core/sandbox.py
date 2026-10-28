"""Sandbox for Fix mode.

A sandbox is a throwaway copy of backend/demo/template with one scenario overlaid, at backend/runs/<run_id>/.
Nothing here may touch files outside that folder, and child processes never receive the backend's env.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from app.config import settings
from app.security import is_valid_npm_name, safe_join

# The ONLY command shapes the agent may run. "<pkg>" is validated with security.is_valid_npm_name.
ALLOWED_COMMANDS: tuple[tuple[str, ...], ...] = (
    ("npm", "install"),
    ("npm", "install", "<pkg>"),
    ("npm", "run", "build"),
)
_NPM_FLAGS = ["--no-audit", "--no-fund"]   # appended to installs; fixed by us, never by the LLM
_MAX_LINES = 200


@dataclass
class CommandResult:
    argv: list[str]
    exit_code: int
    output: str          # combined stdout+stderr, last 200 lines
    duration_ms: int
    timed_out: bool = False


def scenarios_dir() -> Path:
    return settings.demo_dir / "scenarios"


def create_sandbox(run_id: int, scenario: str) -> Path:
    """Copy demo/template (incl. node_modules if present) to runs/<run_id>/ with
    shutil.copytree(..., symlinks=True) — without it node_modules/.bin/tsc breaks — then overlay
    demo/scenarios/<scenario>/ (every file except scenario.json replaces the template file).
    Raise ValueError for an unknown scenario. Return the sandbox path."""
    names = {p.name for p in scenarios_dir().iterdir() if p.is_dir()}
    if scenario not in names:                      # whitelist lookup, so "../x" can never match
        raise ValueError(f"Unknown scenario: {scenario}")
    src = scenarios_dir() / scenario
    sb = settings.runs_dir / str(int(run_id))
    if sb.exists():
        shutil.rmtree(sb)
    sb.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(settings.demo_dir / "template", sb, symlinks=True,
                    ignore=shutil.ignore_patterns(".claude", ".git"))
    for f in src.rglob("*"):
        if f.is_file() and f.name != "scenario.json":
            dest = sb / f.relative_to(src)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dest)
    return sb


def _check_argv(argv: list[str]) -> None:
    for shape in ALLOWED_COMMANDS:
        if len(argv) != len(shape):
            continue
        if all(is_valid_npm_name(a) if s == "<pkg>" else s == a for s, a in zip(shape, argv)):
            return
    raise ValueError(f"Command not allowed: {argv!r}")


def _npm() -> str:
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm") or shutil.which("npm")
    if not npm:
        raise FileNotFoundError("npm not found on PATH")
    return npm


def _tail(text: str, n: int = _MAX_LINES) -> str:
    return "\n".join(text.splitlines()[-n:])


def run_command(sandbox: Path, argv: list[str]) -> CommandResult:
    """Run one whitelisted command inside the sandbox.
    - reject anything not matching ALLOWED_COMMANDS (ValueError)
    - resolve npm with shutil.which('npm') (Windows: npm.cmd)
    - subprocess.run(list, cwd=sandbox, shell=False, capture_output=True, text=True,
      timeout=settings.build_timeout_seconds, env=_minimal_env())
    - on TimeoutExpired return exit_code=124, timed_out=True"""
    argv = list(argv)
    _check_argv(argv)
    real = [_npm(), *argv[1:]] + (_NPM_FLAGS if argv[1] == "install" else [])
    start = time.perf_counter()
    try:
        proc = subprocess.run(real, cwd=sandbox, shell=False, capture_output=True, text=True,
                              timeout=settings.build_timeout_seconds, env=_minimal_env())
        out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
        code, timed_out = proc.returncode, False
    except subprocess.TimeoutExpired as exc:
        out = _as_text(exc.stdout) + "\n" + _as_text(exc.stderr)
        out += f"\n[fixloop] command timed out after {settings.build_timeout_seconds}s"
        code, timed_out = 124, True
    return CommandResult(argv, code, _tail(out), int((time.perf_counter() - start) * 1000), timed_out)


def _as_text(v: str | bytes | None) -> str:
    if v is None:
        return ""
    return v.decode("utf-8", "replace") if isinstance(v, bytes) else v


def run_build(sandbox: Path) -> CommandResult:
    """`npm install` if node_modules is missing, then `npm run build`. Return the build result
    (prepend the install output if install failed)."""
    install: CommandResult | None = None
    if not (sandbox / "node_modules").exists():
        install = run_command(sandbox, ["npm", "install"])
    build = run_command(sandbox, ["npm", "run", "build"])
    if install and install.exit_code != 0:
        build.output = _tail(f"$ npm install (exit {install.exit_code})\n{install.output}\n\n"
                             f"$ npm run build\n{build.output}")
        build.duration_ms += install.duration_ms
    return build


def read_file(sandbox: Path, rel_path: str, max_chars: int = 6000) -> str:
    """Read a text file via security.safe_join (blocked paths raise UnsafePathError)."""
    path = safe_join(sandbox, rel_path)
    return path.read_text(encoding="utf-8", errors="replace")[:max_chars]


def write_file(sandbox: Path, rel_path: str, content: str) -> None:
    """Write a text file via security.safe_join (blocked paths raise UnsafePathError)."""
    path = safe_join(sandbox, rel_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _minimal_env() -> dict[str, str]:
    """PATH, HOME/USERPROFILE, SYSTEMROOT, APPDATA, TEMP/TMP (Windows), CI=1, NO_COLOR=1.
    Never pass the backend's own environment (it holds API keys)."""
    keep = ["PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "APPDATA", "TEMP", "TMP", "TMPDIR",
            # network config only, so `npm install` works behind a proxy; no app keys
            "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy",
            "NODE_EXTRA_CA_CERTS"]
    env = {k: os.environ[k] for k in keep if os.environ.get(k)}
    env.update({"CI": "1", "NO_COLOR": "1", "npm_config_update_notifier": "false",
                # shared, git-ignored cache under runs/ instead of ~/.npm
                "npm_config_cache": str(settings.runs_dir / ".npm-cache")})
    return env
