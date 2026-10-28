from app.config import settings

GOOD = {
    "summary": "The package razorpay is imported but not installed.",
    "category": "dependency",
    "root_cause": "razorpay is missing from package.json.",
    "confidence": 0.93,
    "severity": "critical",
    "evidence_lines": ["Module not found: Can't resolve 'razorpay'"],
    "fix_steps": ["npm install razorpay", "commit lock file", "redeploy"],
    "auto_fixable": True,
    "files_to_change": ["package.json"],
}


def _sample(name: str) -> str:
    return (settings.data_dir / "logs" / f"{name}.log").read_text(encoding="utf-8")


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_analyze_with_llm(client, fake_llm):
    fake_llm.reply = GOOD
    r = client.post("/analyze", json={"log": _sample("npm-missing-module")})
    assert r.status_code == 200, r.text
    d = r.json()["diagnosis"]
    assert d["provider"] == "groq"
    assert d["pattern_id"] == "missing-npm-module"
    assert d["auto_fixable"] is True
    assert "<log>" in fake_llm.calls[0][1]["messages"][1]["content"]


def test_llm_failure_falls_back_to_pattern(client, fake_llm):
    fake_llm.reply = RuntimeError("down")
    r = client.post("/analyze", json={"log": _sample("oomkilled")})
    d = r.json()["diagnosis"]
    assert r.status_code == 200
    assert d["provider"] == "pattern" and d["pattern_id"] == "oom-killed"
    assert d["auto_fixable"] is False and d["fix_steps"]


def test_pattern_forces_handoff_even_if_llm_says_fixable(client, fake_llm):
    fake_llm.reply = {**GOOD, "auto_fixable": True}
    d = client.post("/analyze", json={"log": _sample("db-refused")}).json()["diagnosis"]
    assert d["auto_fixable"] is False


def test_secrets_never_reach_llm(client, fake_llm):
    fake_llm.reply = GOOD
    d = client.post("/analyze", json={"log": _sample("db-refused")}).json()["diagnosis"]
    sent = fake_llm.calls[0][1]["messages"][1]["content"]
    assert "Sup3rS3cretPass" not in sent and "sk-live-9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c" not in sent
    assert d["redactions"] >= 2


def test_bad_llm_json_is_handled(client, fake_llm):
    fake_llm.reply = ("not json at all", [])
    r = client.post("/analyze", json={"log": _sample("imagepull")})
    assert r.status_code == 200 and r.json()["diagnosis"]["provider"] == "pattern"


def test_feedback_and_stats(client, fake_llm):
    fake_llm.reply = GOOD
    res = client.post("/analyze", json={"log": _sample("npm-missing-module")}).json()
    ok = client.post("/feedback", json={"run_id": res["run_id"], "diagnosis_id": res["diagnosis"]["id"], "rating": 1})
    assert ok.status_code == 200
    bad = client.post("/feedback", json={"run_id": 999, "diagnosis_id": 999, "rating": 1})
    assert bad.status_code == 404
    s = client.get("/stats").json()
    assert s["usefulness_pct"] == 100.0 and s["explain_runs"] == 1 and s["pattern_hit_pct"] == 100.0


def test_empty_and_oversized_logs_rejected(client, monkeypatch):
    assert client.post("/analyze", json={"log": ""}).status_code == 422
    big = "x" * (settings.max_log_bytes + 1)
    assert client.post("/analyze", json={"log": big}).status_code == 422


def test_api_key_enforced(client, monkeypatch, fake_llm):
    monkeypatch.setattr(settings, "app_api_key", "s3cret")
    assert client.get("/stats").status_code == 401
    assert client.get("/stats", headers={"X-API-Key": "s3cret"}).status_code == 200
    assert client.get("/health").status_code == 200


def test_samples_and_scenarios(client):
    names = [s["name"] for s in client.get("/samples").json()]
    assert "oomkilled" in names
    assert "OOMKilled" in client.get("/samples/oomkilled").json()["log"]
    assert client.get("/samples/..%2F..%2Fapp").status_code == 404
    ids = {s["id"]: s["expected"] for s in client.get("/demo/scenarios").json()}
    assert ids["missing-env"] == "hand-off" and len(ids) == 5


def test_patterns_listed(client):
    assert len(client.get("/patterns").json()) == 13
