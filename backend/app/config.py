from functools import lru_cache
import re
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRET_KEYS = {
    "",
    "dev-only-change-me-dev-only-change-me",
    "replace-with-a-long-random-value-before-deployment",
    "secret",
    "changeme",
    "password",
    "12345678",
    "test-secret",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Mode: development | isolated-demo | production
    app_mode: str = "isolated-demo"

    # Database: PostgreSQL in docker-compose / production, SQLite for zero-setup local dev.
    database_url: str = "sqlite:///./brandlint.db"
    # None keeps automatic local setup; production migrations run as a separate release job.
    auto_migrate: bool | None = None

    # Auth. SECRET_KEY also keys the per-session CSRF HMAC.
    secret_key: str = "dev-only-change-me-dev-only-change-me"
    token_ttl_minutes: int = 480
    demo_password: str = "demo1234"

    # Server-stored sessions (OWASP Session Management): idle + absolute timeouts.
    session_idle_minutes: int = 30
    session_absolute_hours: int = 12
    # Empty keeps the existing mode-specific name. Firebase Hosting forwards only __session.
    session_cookie_name: str = ""
    # Local development / isolated-demo only. Production session cookies are always Secure.
    dev_cookie_secure: bool = False

    # Throttling: "auto" | "memory" | "database" | "redis".
    # Auto uses Redis if REDIS_URL is set, otherwise Database in production, Memory in dev/demo.
    throttling_backend: str = "auto"
    redis_url: str = ""
    auth_max_failed_attempts: int = 5       # per email within the window
    auth_ip_max_failed_attempts: int = 20   # per client IP within the window
    auth_throttle_window_seconds: int = 900
    recovery_max_requests: int = 3          # per email within the window (IP limit is 4x)

    # Session & recovery token retention cleanup
    session_retention_days: int = 30
    session_cleanup_enabled: bool = True
    session_cleanup_interval_hours: int = 6

    # Account recovery
    recovery_token_ttl_minutes: int = 30
    password_min_length: int = 12
    password_max_length: int = 256
    # Public origin used to build recovery links (token travels in the URL fragment, never sent to the server).
    public_base_url: str = "http://127.0.0.1:8000"

    # Mail adapter: "" (auto) | dev-outbox | smtp | none.
    # Auto = dev-outbox outside production; in production smtp when SMTP_HOST is set, otherwise none.
    mail_provider: str = ""
    dev_outbox_dir: str = ""  # default: backend/.dev_outbox
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    smtp_ssl: bool = False
    trusted_proxies: str = "127.0.0.1,::1,testclient"

    # LLM provider adapter (server side only). mock | openai | gemini
    llm_provider: str = "mock"
    llm_model: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    gemini_api_key: str = ""
    llm_timeout_seconds: float = 40.0

    # Abuse controls, upload limits, bounded parsing & quotas (Prompt 04)
    max_upload_size_bytes: int = 10 * 1024 * 1024       # 10 MB default
    max_pdf_pages: int = 50                             # Max 50 pages per PDF
    max_extracted_text_chars: int = 150_000             # Max 150k extracted characters
    max_pasted_text_chars: int = 100_000                # Max 100k pasted characters
    max_draft_text_chars: int = 50_000                  # Max 50k characters per draft
    max_model_context_chars: int = 35_000               # Max chars sent to LLM prompt
    pdf_parse_timeout_seconds: float = 8.0              # Max seconds for PDF text extraction
    document_storage_dir: str = "data/storage/documents" # Private tenant document storage

    ai_max_concurrency: int = 5                         # Bounded concurrency for AI requests
    ai_company_rate_limit_per_minute: int = 60          # Max checks per company / minute
    ai_user_rate_limit_per_minute: int = 20             # Max checks per user / minute
    ai_company_daily_call_limit: int = 500              # Max daily AI calls per company
    upload_company_rate_limit_per_minute: int = 15      # Max uploads per company / minute
    benchmark_company_rate_limit_per_10min: int = 3     # Max benchmark runs per company / 10m

    # Guideline Health: fewer than this many events => "insufficient history"
    min_health_sample: int = 5

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_on_startup: bool = True

    # Workspace Usage Limits & Accounting (Prompt 11)
    workspace_max_monthly_drafts: int = 500
    workspace_max_monthly_checks: int = 2000
    workspace_max_storage_bytes: int = 500 * 1024 * 1024  # 500 MB default per company
    workspace_max_members: int = 50

    # Durable Analysis Jobs & Resilience (Prompt 11)
    job_max_retries: int = 3
    job_retry_backoff_seconds: float = 0.5
    job_timeout_seconds: int = 120

    @field_validator("session_cookie_name", mode="before")
    @classmethod
    def validate_session_cookie_name(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("SESSION_COOKIE_NAME must be a cookie name or an empty string for the default")
        if value == "":
            return value
        if len(value) > 128 or not re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+", value):
            raise ValueError("SESSION_COOKIE_NAME must be a valid HTTP cookie token with no whitespace or separators")
        if value == "brandlint_csrf":
            raise ValueError("SESSION_COOKIE_NAME must not reuse the CSRF cookie name")
        return value

    @field_validator("app_mode", mode="before")
    @classmethod
    def normalize_mode(cls, v: str) -> str:
        raw = (v or "").strip().lower()
        if raw in ("prod", "production"):
            return "production"
        if raw in ("demo", "isolated-demo", "isolated_demo"):
            return "isolated-demo"
        if raw in ("dev", "development"):
            return "development"
        raise ValueError(f"Invalid APP_MODE '{v}'. Must be one of: development, isolated-demo, production")

    @property
    def is_production(self) -> bool:
        return self.app_mode == "production"

    @property
    def is_demo(self) -> bool:
        return self.app_mode == "isolated-demo"

    @property
    def is_development(self) -> bool:
        return self.app_mode == "development"

    @property
    def trusted_proxy_list(self) -> list[str]:
        """List of trusted reverse proxy IPs or network hostnames."""
        raw = self.trusted_proxies.strip()
        if raw == "*":
            return ["*"]
        return [p.strip() for p in raw.split(",") if p.strip()]

    def is_isolated_demo_db(self) -> bool:
        """Verify the database connection string targets an isolated demo or local test database."""
        if self.is_production:
            return False
        url = self.database_url.lower()
        if "sqlite" in url:
            # Local SQLite files or in-memory databases designated for demo or testing
            return ("brandlint.db" in url or "demo" in url or "test" in url or ":memory:" in url)
        if "postgres" in url:
            # PostgreSQL requires explicit demo or test indicator in database name
            return "demo" in url or "test" in url
        return False

    def validate_production_readiness(self) -> None:
        """Fails startup fast if production requirements are violated."""
        if not self.is_production:
            return

        # 1. Require strong, non-default signing secret
        secret = (self.secret_key or "").strip()
        if secret in INSECURE_SECRET_KEYS or len(secret) < 32:
            raise RuntimeError(
                "Production mode startup rejected: SECRET_KEY must be configured with a secure, "
                "non-default value containing at least 32 characters."
            )

        # 2. Refuse shared demo password
        if self.demo_password == "demo1234":
            raise RuntimeError(
                "Production mode startup rejected: default DEMO_PASSWORD ('demo1234') cannot be active."
            )

        # 3. Refuse automatic demo seeding
        if self.seed_on_startup:
            raise RuntimeError(
                "Production mode startup rejected: SEED_ON_STARTUP must be set to false in production."
            )

        # 4. In production deployments, recovery links and Secure cookies need an HTTPS public origin
        base = self.public_base_url.strip().lower()
        if not (base.startswith("https://") or "127.0.0.1" in base or "localhost" in base):
            raise RuntimeError(
                "Production mode startup rejected: PUBLIC_BASE_URL must be an https:// origin."
            )

        # 5. The dev outbox writes recovery links to local disk; never acceptable in production
        if self.resolved_mail_provider == "dev-outbox":
            raise RuntimeError(
                "Production mode startup rejected: MAIL_PROVIDER=dev-outbox is development-only."
            )
        if self.resolved_mail_provider == "smtp" and not (self.smtp_host and self.smtp_from):
            raise RuntimeError(
                "Production mode startup rejected: MAIL_PROVIDER=smtp requires SMTP_HOST and SMTP_FROM."
            )

        # 6. Production requires a PostgreSQL database (not SQLite)
        db_url = self.database_url.lower()
        if not (db_url.startswith("postgresql://") or db_url.startswith("postgresql+psycopg://")):
            raise RuntimeError(
                "Production mode startup rejected: DATABASE_URL must configure a PostgreSQL database (postgresql+psycopg://)."
            )

        # 7. Production requires explicit non-wildcard CORS origins
        if "*" in self.cors_origins:
            raise RuntimeError(
                "Production mode startup rejected: CORS_ORIGINS cannot contain wildcards ('*') in production."
            )

    @property
    def resolved_throttling_backend(self) -> str:
        raw = (self.throttling_backend or "").strip().lower()
        if raw in ("memory", "database", "redis"):
            return raw
        if self.redis_url.strip():
            return "redis"
        if self.is_production:
            return "database"
        return "memory"

    @property
    def resolved_mail_provider(self) -> str:
        raw = (self.mail_provider or "").strip().lower()
        if raw in ("dev-outbox", "smtp", "none"):
            return raw
        if raw:
            raise ValueError(f"Invalid MAIL_PROVIDER '{self.mail_provider}'. Use dev-outbox, smtp or none.")
        if self.is_production:
            return "smtp" if self.smtp_host else "none"
        return "dev-outbox"

    @property
    def allow_demo_personas(self) -> bool:
        """Password-less switching between seeded *.demo accounts. Never available in production."""
        return self.is_demo or self.is_development

    @model_validator(mode="after")
    def apply_mode_guardrails(self) -> "Settings":
        if self.is_production:
            # Always ensure demo seeding is disabled in production
            self.seed_on_startup = False
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
