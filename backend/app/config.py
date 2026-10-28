"""All settings come from environment variables / backend/.env."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # LLM providers
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-oss-120b"
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "qwen2.5-coder"
    llm_timeout_seconds: float = 30

    # security
    app_api_key: str = ""
    allowed_origins: str = "http://localhost:3000"
    rate_limit_analyze: str = "30/minute"

    # limits
    max_log_bytes: int = 200_000
    max_llm_log_chars: int = 10_000

    # storage
    db_path: str = "fixloop.db"

    # fix mode
    enable_fix_mode: bool = True
    agent_max_attempts: int = 3
    build_timeout_seconds: int = 120
    auto_approve: bool = False

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def db_file(self) -> Path:
        p = Path(self.db_path)
        return p if p.is_absolute() else BACKEND_DIR / p

    data_dir: Path = BACKEND_DIR / "data"
    demo_dir: Path = BACKEND_DIR / "demo"
    runs_dir: Path = BACKEND_DIR / "runs"


settings = Settings()
