import json

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.core import llm


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    """Fresh DB per test, no auth, no real providers configured unless a test adds them."""
    monkeypatch.setattr(settings, "db_path", str(tmp_path / "test.db"))
    monkeypatch.setattr(settings, "app_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "test-key")
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    monkeypatch.setattr(settings, "ollama_model", "")
    yield


@pytest.fixture
def fake_llm(monkeypatch):
    """Script LLM replies. Usage: fake_llm.reply = {...} | Exception | callable(provider, kwargs)."""
    class Fake:
        reply: object = None
        calls: list = []

    fake = Fake()
    fake.calls = []

    def _call(provider, **kwargs):
        fake.calls.append((provider.name, kwargs))
        r = fake.reply(provider, kwargs) if callable(fake.reply) else fake.reply
        if isinstance(r, Exception):
            raise r
        if isinstance(r, tuple):            # (content, tool_calls)
            return r
        return json.dumps(r), []

    monkeypatch.setattr(llm, "_call", _call)
    return fake


@pytest.fixture
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c
