"""LLM router: one OpenAI-compatible client per provider, tried in order.

Order: Groq -> OpenAI -> Gemini -> OpenRouter -> Ollama (local, offline). Providers without a key are skipped.
Every call returns which provider answered so the UI can show an "offline" badge.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from openai import BadRequestError, OpenAI

from app.config import settings

log = logging.getLogger("fixloop.llm")


@dataclass(frozen=True)
class Provider:
    name: str
    base_url: str
    api_key: str
    model: str
    timeout: float


@dataclass
class LLMResult:
    content: str
    provider: str
    model: str
    latency_ms: int
    tool_calls: list[dict[str, Any]] = field(default_factory=list)  # [{"name": ..., "arguments": "json str"}]


class LLMError(RuntimeError):
    """Raised when every provider failed."""


class NoProviderError(LLMError):
    """Raised when no provider is configured for the call at all."""


def all_providers() -> list[Provider]:
    s = settings
    out: list[Provider] = []
    if s.groq_api_key:
        out.append(Provider("groq", "https://api.groq.com/openai/v1", s.groq_api_key, s.groq_model, s.llm_timeout_seconds))
    if s.openai_api_key:
        out.append(Provider("openai", "https://api.openai.com/v1", s.openai_api_key, s.openai_model,
                            s.llm_timeout_seconds))
    if s.gemini_api_key:
        out.append(Provider("gemini", "https://generativelanguage.googleapis.com/v1beta/openai/",
                            s.gemini_api_key, s.gemini_model, s.llm_timeout_seconds))
    if s.openrouter_api_key:
        out.append(Provider("openrouter", "https://openrouter.ai/api/v1", s.openrouter_api_key,
                            s.openrouter_model, s.llm_timeout_seconds))
    if s.ollama_model:
        out.append(Provider("ollama", s.ollama_base_url, "ollama", s.ollama_model, s.llm_timeout_seconds * 3))
    return out


def configured_providers() -> list[str]:
    return [p.name for p in all_providers()]


def _select(allow_local: bool, force: str | None) -> list[Provider]:
    provs = all_providers()
    if force:
        return [p for p in provs if p.name == force]
    return [p for p in provs if allow_local or p.name != "ollama"]


def _call(provider: Provider, **kwargs: Any) -> tuple[str, list[dict[str, Any]]]:
    """One request to one provider. Tests monkeypatch this function."""
    client = OpenAI(base_url=provider.base_url, api_key=provider.api_key, timeout=provider.timeout, max_retries=0)
    try:
        resp = client.chat.completions.create(model=provider.model, **kwargs)
    except BadRequestError:
        if kwargs.get("tool_choice") == "required":
            kwargs = {**kwargs, "tool_choice": "auto"}          # provider may not support forced tool calls
        elif "response_format" in kwargs:
            kwargs = {k: v for k, v in kwargs.items() if k != "response_format"}  # or JSON mode
        else:
            raise
        resp = client.chat.completions.create(model=provider.model, **kwargs)
    msg = resp.choices[0].message
    calls = [{"name": tc.function.name, "arguments": tc.function.arguments or "{}"} for tc in (msg.tool_calls or [])]
    return msg.content or "", calls


def _run(kwargs: dict[str, Any], allow_local: bool, force: str | None, need_tool: bool = False) -> LLMResult:
    provs = _select(allow_local, force)
    if not provs:
        raise NoProviderError("No LLM provider configured")
    errors: list[str] = []
    for p in provs:
        start = time.perf_counter()
        try:
            content, calls = _call(p, **kwargs)
            if not content and not calls:
                raise LLMError("empty response")
            if need_tool and not calls:
                raise LLMError("no tool call in reply")         # counts as this provider failing
            return LLMResult(content, p.name, p.model, int((time.perf_counter() - start) * 1000), calls)
        except Exception as exc:  # noqa: BLE001 — any provider failure means "try the next one"
            log.warning("LLM provider %s failed: %s", p.name, type(exc).__name__)
            errors.append(f"{p.name}: {type(exc).__name__}")
    raise LLMError("All LLM providers failed (" + "; ".join(errors) + ")")


def chat_json(messages: list[dict[str, str]], *, allow_local: bool = True, force_provider: str | None = None,
              temperature: float = 0.1, max_tokens: int = 4000) -> LLMResult:
    """Chat call that asks for a single JSON object in `content`."""
    return _run({"messages": messages, "temperature": temperature, "max_tokens": max_tokens,
                 "response_format": {"type": "json_object"}}, allow_local, force_provider)


def chat_tools(messages: list[dict[str, Any]], tools: list[dict[str, Any]], *, allow_local: bool = False,
               temperature: float = 0.1, max_tokens: int = 4000) -> LLMResult:
    """Chat call that must answer with a tool call (used by the Fix-mode agent).
    A provider that replies without one is skipped like a failed provider."""
    return _run({"messages": messages, "tools": tools, "tool_choice": "required", "temperature": temperature,
                 "max_tokens": max_tokens}, allow_local, None, need_tool=True)
