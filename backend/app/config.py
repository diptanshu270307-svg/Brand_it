from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database: PostgreSQL in docker-compose / production, SQLite for zero-setup local dev.
    database_url: str = "sqlite:///./brandlint.db"

    # Auth
    secret_key: str = "dev-only-change-me-dev-only-change-me"
    token_ttl_minutes: int = 480
    demo_password: str = "demo1234"

    # LLM provider adapter (server side only). mock | openai | gemini
    llm_provider: str = "mock"
    llm_model: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    gemini_api_key: str = ""
    llm_timeout_seconds: float = 40.0

    # Guideline Health: fewer than this many events => "insufficient history"
    min_health_sample: int = 5

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_on_startup: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
