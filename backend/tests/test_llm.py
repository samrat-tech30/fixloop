import json

from openai import BadRequestError

from app.config import settings
from app.core import llm


def _bad_request():
    exc = BadRequestError.__new__(BadRequestError)
    Exception.__init__(exc, "tool_choice 'required' is not supported")
    return exc


class _Msg:
    def __init__(self, content, calls):
        self.content, self.tool_calls = content, calls


def _fake_openai(monkeypatch, create):
    class Client:
        def __init__(self, **_):
            self.chat = type("C", (), {"completions": type("X", (), {"create": staticmethod(create)})()})()
    monkeypatch.setattr(llm, "OpenAI", Client)


def _resp(content="", calls=None):
    return type("R", (), {"choices": [type("Ch", (), {"message": _Msg(content, calls)})()]})()


def test_openai_provider_order(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "x")
    monkeypatch.setattr(settings, "gemini_api_key", "y")
    assert llm.configured_providers() == ["groq", "openai", "gemini"]


def test_required_tool_choice_falls_back_to_auto(monkeypatch):
    seen = []

    def create(**kw):
        seen.append(kw["tool_choice"])
        if kw["tool_choice"] == "required":
            raise _bad_request()
        fn = type("F", (), {"name": "install_package", "arguments": json.dumps({"name": "axios"})})()
        return _resp(calls=[type("T", (), {"function": fn})()])

    _fake_openai(monkeypatch, create)
    res = llm.chat_tools([{"role": "user", "content": "x"}], [])
    assert seen == ["required", "auto"]
    assert res.tool_calls == [{"name": "install_package", "arguments": '{"name": "axios"}'}]


def test_reply_without_tool_call_tries_next_provider(fake_llm, monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "x")

    def reply(provider, _kw):
        if provider.name == "groq":
            return "I think you should install axios", []
        return "", [{"name": "install_package", "arguments": '{"name": "axios"}'}]

    fake_llm.reply = reply
    res = llm.chat_tools([{"role": "user", "content": "x"}], [])
    assert res.provider == "openai" and res.tool_calls[0]["name"] == "install_package"
    assert [c[0] for c in fake_llm.calls] == ["groq", "openai"]
