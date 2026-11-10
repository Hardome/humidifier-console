"""Typed environment settings; constructing settings never opens device credentials."""

from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    database_url: SecretStr | None = None
    pguser: str = "humidifier"
    pgpassword: SecretStr = SecretStr("humidifier")
    pghost: str = "localhost"
    pgport: int = Field(default=5432, ge=1, le=65535)
    pgdatabase: str = "humidifier"
    device_config: Path = ROOT / "device.local.json"
    telegram_bot_token: SecretStr | None = None
    telegram_chat_id: SecretStr | None = None

    @property
    def resolved_database_url(self) -> str:
        if self.database_url and self.database_url.get_secret_value():
            return self.database_url.get_secret_value()
        return URL.create(
            "postgresql+psycopg",
            username=self.pguser,
            password=self.pgpassword.get_secret_value(),
            host=self.pghost,
            port=self.pgport,
            database=self.pgdatabase,
        ).render_as_string(hide_password=False)


# Compatibility for Alembic and the existing database bootstrap.
DATABASE_URL = Settings().resolved_database_url
