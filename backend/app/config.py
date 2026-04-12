"""
Application configuration.

Settings loaded from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration read from env / .env file."""

    # ── App ──────────────────────────────────────────────
    APP_TITLE: str = "Aparu QR Module API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["*"]

    # ── Aparu Maps API ───────────────────────────────────
    APARU_MAPS_BASE_URL: str = "http://testtaxi3.aparu.kz"
    APARU_MAPS_API_KEY: str = "test1"

    # ── Database (SQLite stub — DB not implemented yet) ──
    DATABASE_URL: str = "sqlite+aiosqlite:///./aparu_qr.db"

    # ── Telegram Bot ─────────────────────────────────────
    BOT_TOKEN: str = ""
    BOT_STORE_DB_PATH: str = "../bot/bot_store.db"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
