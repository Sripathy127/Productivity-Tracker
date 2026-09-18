"""Application configuration loaded from the environment."""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


class Settings(BaseSettings):
    """Runtime settings.

    The database URL intentionally defaults to SQLite so the API runs with no
    external services. Point it at Postgres (``postgresql+psycopg://...``) for
    Docker or production; the ORM layer is written to work with both.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = Field(default="sqlite:///./productivity_tracker.db")
    # `NoDecode` stops pydantic-settings from JSON-parsing the raw env value, so
    # the validator below can accept a plain comma-separated list.
    cors_origins: Annotated[tuple[str, ...], NoDecode] = Field(
        default=DEFAULT_CORS_ORIGINS
    )
    sql_echo: bool = Field(default=False)
    api_prefix: str = Field(default="/api")

    # --- Authentication -----------------------------------------------------
    # OAuth client id from Google Cloud Console. Empty means Google sign-in is
    # not configured; the API then only works via the dev bypass below.
    google_client_id: str = Field(default="")
    # Signing key for this API's own session cookie. MUST be overridden with a
    # long random value in any deployment.
    session_secret: str = Field(default="dev-only-insecure-session-secret")
    session_cookie_name: str = Field(default="pt_session")
    session_ttl_hours: int = Field(default=24 * 14)
    # Set to 1 only behind HTTPS.
    session_cookie_secure: bool = Field(default=False)
    # Local escape hatch: treat every request as a fixed local account so the
    # app is usable before Google credentials exist. Never enable in production.
    auth_dev_bypass: bool = Field(default=True)
    dev_user_email: str = Field(default="local@productivity.tracker")
    dev_user_name: str = Field(default="Local User")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma-separated string as well as a real sequence."""
        if isinstance(value, str):
            return tuple(item.strip() for item in value.split(",") if item.strip())
        return value

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def google_sign_in_enabled(self) -> bool:
        return bool(self.google_client_id.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
