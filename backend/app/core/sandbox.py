"""Sandbox for Fix mode — STUB. Build with docs/PROMPTS.md prompt 5 and the fixloop-agent skill.

A sandbox is a throwaway copy of backend/demo/template with one scenario overlaid, at backend/runs/<run_id>/.
Nothing here may touch files outside that folder, and child processes never receive the backend's env.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.config import settings

# The ONLY command shapes the agent may run. "<pkg>" is validated with security.is_valid_npm_name.
ALLOWED_COMMANDS: tuple[tuple[str, ...], ...] = (
    ("npm", "install"),
    ("npm", "install", "<pkg>"),
    ("npm", "run", "build"),
)


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
    raise NotImplementedError("Prompt 5: implement create_sandbox")


def run_command(sandbox: Path, argv: list[str]) -> CommandResult:
    """Run one whitelisted command inside the sandbox.
    - reject anything not matching ALLOWED_COMMANDS (ValueError)
    - resolve npm with shutil.which('npm') (Windows: npm.cmd)
    - subprocess.run(list, cwd=sandbox, shell=False, capture_output=True, text=True,
      timeout=settings.build_timeout_seconds, env=_minimal_env())
    - on TimeoutExpired return exit_code=124, timed_out=True"""
    raise NotImplementedError("Prompt 5: implement run_command")


def run_build(sandbox: Path) -> CommandResult:
    """`npm install` if node_modules is missing, then `npm run build`. Return the build result
    (prepend the install output if install failed)."""
    raise NotImplementedError("Prompt 5: implement run_build")


def read_file(sandbox: Path, rel_path: str, max_chars: int = 6000) -> str:
    """Read a text file via security.safe_join (blocked paths raise UnsafePathError)."""
    raise NotImplementedError("Prompt 5: implement read_file")


def write_file(sandbox: Path, rel_path: str, content: str) -> None:
    """Write a text file via security.safe_join (blocked paths raise UnsafePathError)."""
    raise NotImplementedError("Prompt 5: implement write_file")


def _minimal_env() -> dict[str, str]:
    """PATH, HOME/USERPROFILE, SYSTEMROOT, APPDATA, TEMP/TMP (Windows), CI=1, NO_COLOR=1.
    Never pass the backend's own environment (it holds API keys)."""
    raise NotImplementedError("Prompt 5: implement _minimal_env")
