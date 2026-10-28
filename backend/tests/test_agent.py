import json
import shutil
import threading
import time

import pytest

from app import db
from app.config import settings
from app.core import agent, patterns, sandbox


@pytest.fixture(autouse=True)
def _db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "runs_dir", tmp_path / "runs")
    monkeypatch.setattr(settings, "agent_max_attempts", 2)
    db.init_db()
    db.seed_patterns(patterns.public_patterns())


def _diag(auto_fixable=True, **extra):
    return {"summary": "Build failed", "category": "dependency", "root_cause": "Something is missing.",
            "confidence": 0.9, "severity": "critical", "evidence_lines": [], "fix_steps": ["Fix it"],
            "auto_fixable": auto_fixable, "files_to_change": [], **extra}


def _script(tool_name=None, args=None, auto_fixable=True):
    """fake_llm reply: diagnosis JSON for chat_json, one tool call for chat_tools."""
    def reply(_provider, kwargs):
        if "tools" in kwargs:
            return "", [{"name": tool_name, "arguments": json.dumps(args)}]
        return _diag(auto_fixable)
    return reply


def _fake_build(monkeypatch, outputs):
    """Replace run_build with scripted results (exit 1 with the given text, or 0 for None)."""
    seq = iter(outputs)

    def run_build(_sb):
        out = next(seq)
        return sandbox.CommandResult(["npm", "run", "build"], 0 if out is None else 1, out or "", 5)
    monkeypatch.setattr(sandbox, "run_build", run_build)


TS_ERR = "src/index.ts(2,30): error TS2307: Cannot find module './componets/header'"


def test_edit_fixes_build(fake_llm, monkeypatch):
    _fake_build(monkeypatch, [TS_ERR, None])
    fake_llm.reply = _script("propose_edit", {"path": "src/index.ts", "old": "./componets/header",
                                              "new": "./components/header"})
    run_id = db.create_run("fix", scenario="wrong-import")
    agent.run_agent(run_id, "wrong-import", auto_approve=True)

    run = db.get_run(run_id)
    assert run["status"] == "fixed" and run["attempts"] == 1 and run["duration_ms"] is not None
    [patch] = db.list_patches(run_id)
    assert patch["status"] == "applied" and '+import { renderHeader } from "./components/header";' in patch["diff"]
    assert "./componets/" not in (settings.runs_dir / str(run_id) / "src" / "index.ts").read_text()
    actions = [s["action"] for s in db.list_steps(run_id)]
    assert actions == ["run_build", "diagnose", "propose_edit", "apply_patch", "run_build", "finish"]
    # the tool prompt contained the failing file
    tool_msgs = [k for _, k in fake_llm.calls if "tools" in k][0]["messages"]
    assert '<file path="src/index.ts">' in tool_msgs[1]["content"]


def test_hand_off(fake_llm, monkeypatch):
    _fake_build(monkeypatch, ["Error: Missing required environment variable API_KEY"])
    fake_llm.reply = _script(auto_fixable=False)
    run_id = db.create_run("fix", scenario="missing-env")
    agent.run_agent(run_id, "missing-env")
    run = db.get_run(run_id)
    assert run["status"] == "handed_off" and run["handoff_steps"]
    assert db.list_patches(run_id) == []
    assert not any("tools" in k for _, k in fake_llm.calls)


@pytest.mark.parametrize("tool,args", [
    ("propose_edit", {"path": "src/index.ts", "old": "not in the file", "new": "x"}),
    ("propose_edit", {"path": ".env", "old": "a", "new": "b"}),
    ("propose_edit", {"path": "../../app/config.py", "old": "a", "new": "b"}),
    ("install_package", {"name": "axios@latest"}),
    ("install_package", {"name": "https://evil.example/x.tgz"}),
    ("rm_rf", {}),
])
def test_invalid_tool_calls_are_rejected_and_capped(fake_llm, monkeypatch, tool, args):
    _fake_build(monkeypatch, [TS_ERR] * 5)
    fake_llm.reply = _script(tool, args)
    run_id = db.create_run("fix", scenario="wrong-import")
    agent.run_agent(run_id, "wrong-import", auto_approve=True)
    run = db.get_run(run_id)
    assert run["status"] == "failed" and run["attempts"] == settings.agent_max_attempts
    assert db.list_patches(run_id) == []
    assert any(s["action"] in (tool, "propose_edit") and not s["ok"] for s in db.list_steps(run_id))


def _wait_for_patch(run_id, timeout=5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        patches = db.list_patches(run_id)
        if patches and db.get_run(run_id)["status"] == "awaiting_approval":
            return patches[0]
        time.sleep(0.05)
    raise AssertionError("no pending patch")


@pytest.mark.parametrize("approve,final", [(True, "fixed"), (False, "failed")])
def test_manual_approval(fake_llm, monkeypatch, approve, final):
    _fake_build(monkeypatch, [TS_ERR, None])
    fake_llm.reply = _script("propose_edit", {"path": "src/index.ts", "old": "./componets/header",
                                              "new": "./components/header"})
    run_id = db.create_run("fix", scenario="wrong-import")
    t = threading.Thread(target=agent.run_agent, args=(run_id, "wrong-import"))
    t.start()
    patch = _wait_for_patch(run_id)
    assert patch["status"] == "pending"
    assert agent.decide_patch(patch["id"], approve) == ("approved" if approve else "rejected")
    t.join(timeout=5)
    assert db.get_run(run_id)["status"] == final
    with pytest.raises(ValueError):
        agent.decide_patch(patch["id"], True)       # no longer pending


def test_decide_unknown_patch():
    with pytest.raises(LookupError):
        agent.decide_patch(9999, True)


def test_run_agent_never_raises():
    run_id = db.create_run("fix", scenario="does-not-exist")
    agent.run_agent(run_id, "does-not-exist")
    assert db.get_run(run_id)["status"] == "failed"
    assert db.list_steps(run_id)[-1]["action"] == "finish"


@pytest.mark.skipif(shutil.which("npm") is None, reason="npm not on PATH")
def test_missing_package_end_to_end(fake_llm, monkeypatch):
    monkeypatch.setattr(settings, "build_timeout_seconds", 60)
    if not (settings.demo_dir / "template" / "node_modules").exists():
        pytest.skip("run `npm install` in demo/template first")
    fake_llm.reply = _script("install_package", {"name": "axios"})
    run_id = db.create_run("fix", scenario="missing-package")
    agent.run_agent(run_id, "missing-package", auto_approve=True)
    steps = db.list_steps(run_id)
    apply = [s for s in steps if s["action"] == "apply_patch"]
    if apply and not apply[0]["ok"] and any(
            m in apply[0]["output_excerpt"] for m in ("ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "timed out")):
        pytest.skip("npm registry not reachable")
    assert db.get_run(run_id)["status"] == "fixed", steps
    pkg = json.loads((settings.runs_dir / str(run_id) / "package.json").read_text())
    assert "axios" in pkg["dependencies"]


def test_no_llm_fails_without_counting_an_attempt(fake_llm, monkeypatch):
    from app.core import llm
    _fake_build(monkeypatch, [TS_ERR])
    fake_llm.reply = llm.LLMError("down")
    run_id = db.create_run("fix", scenario="wrong-import")
    agent.run_agent(run_id, "wrong-import", auto_approve=True)
    run = db.get_run(run_id)
    assert run["status"] == "failed" and run["attempts"] == 0
    assert "No LLM" in db.list_steps(run_id)[-1]["summary"]
