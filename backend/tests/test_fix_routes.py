import pytest

from app import db
from app.config import settings
from app.core import agent


@pytest.fixture
def started(monkeypatch):
    """Replace the agent loop so route tests don't run npm; records calls."""
    calls = []
    monkeypatch.setattr(agent, "run_agent", lambda *a: calls.append(a))
    return calls


def test_start_agent_runs_in_background(client, started, monkeypatch):
    monkeypatch.setattr(settings, "auto_approve", False)
    r = client.post("/agent/run", json={"scenario": "missing-package", "auto_approve": True})
    assert r.status_code == 202
    run_id = r.json()["run_id"]
    assert started == [(run_id, "missing-package", True)]
    run = db.get_run(run_id)
    assert run["mode"] == "fix" and run["scenario"] == "missing-package"


def test_start_agent_unknown_scenario(client, started):
    assert client.post("/agent/run", json={"scenario": "nope"}).status_code == 404
    assert client.post("/agent/run", json={"scenario": "../template"}).status_code == 422
    assert started == []


def test_start_agent_conflict(client, started):
    db.create_run("fix", scenario="wrong-import", status="awaiting_approval")
    assert client.post("/agent/run", json={"scenario": "missing-package"}).status_code == 409
    assert started == []


def test_start_agent_disabled(client, started, monkeypatch):
    monkeypatch.setattr(settings, "enable_fix_mode", False)
    assert client.post("/agent/run", json={"scenario": "missing-package"}).status_code == 403


def test_get_fix_run(client):
    run_id = db.create_run("fix", scenario="wrong-import")
    db.add_step(run_id, "run_build", summary="exit 2", output_excerpt="error TS2307", ok=False)
    db.create_patch(run_id, kind="edit", diff="--- a\n+++ b\n", file_path="src/index.ts")
    db.update_run(run_id, status="handed_off", attempts=1, handoff_steps=["Ask a human"])
    body = client.get(f"/runs/{run_id}").json()
    assert body["status"] == "handed_off" and body["attempts"] == 1
    assert body["steps"][0]["action"] == "run_build" and body["steps"][0]["ok"] is False
    assert body["patches"][0]["status"] == "pending"
    assert body["handoff_steps"] == ["Ask a human"]


def test_get_explain_run(client, fake_llm):
    fake_llm.reply = {"summary": "s", "category": "build", "root_cause": "r", "confidence": 0.8,
                      "severity": "warning", "evidence_lines": [], "fix_steps": ["a"], "auto_fixable": False}
    run_id = client.post("/analyze", json={"log": "npm ERR! missing script: build"}).json()["run_id"]
    body = client.get(f"/runs/{run_id}").json()
    assert body["mode"] == "explain" and body["steps"] == [] and body["patches"] == []
    assert len(body["diagnoses"]) == 1 and body["handoff_steps"] == []


def test_get_unknown_run(client):
    assert client.get("/runs/9999").status_code == 404


def test_patch_decision(client):
    run_id = db.create_run("fix", scenario="wrong-import")
    patch_id = db.create_patch(run_id, kind="install", diff="+ axios", package="axios")
    r = client.post(f"/patches/{patch_id}/decision", json={"approve": False})
    assert r.status_code == 200 and r.json() == {"status": "rejected"}
    assert db.get_patch(patch_id)["status"] == "rejected"
    assert client.post(f"/patches/{patch_id}/decision", json={"approve": True}).status_code == 409
    assert client.post("/patches/9999/decision", json={"approve": True}).status_code == 404


def test_fix_routes_need_api_key(client, monkeypatch):
    monkeypatch.setattr(settings, "app_api_key", "k" * 20)
    assert client.get("/runs/1").status_code == 401
    assert client.post("/agent/run", json={"scenario": "missing-package"}).status_code == 401
