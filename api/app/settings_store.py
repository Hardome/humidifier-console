"""Settings normalization and transactional persistence."""

import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from .db import (
    Setting,
    read_settings,
    utcnow,
    write_settings,
)
from .errors import ConfigurationError
from .scheduler import aware
from .service import Service
from .types import JsonObject


class SettingsStore:
    def __init__(self, service: Service, sessions: sessionmaker[OrmSession]) -> None:
        self.service = service
        self.sessions = sessions

    def public(self, session: OrmSession) -> JsonObject:
        return {
            **read_settings(session),
            "telegram_configured": bool(os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID")),
            "restoration_pending": session.get(Setting, "verification_restore") is not None,
        }

    def read(self) -> JsonObject:
        with self.sessions() as session:
            return self.public(session)

    def update(self, data: JsonObject) -> JsonObject:
        # One UTC representation also keeps generated date validators deterministic.
        for field in ["pause_until", "off_timer"]:
            if data[field]:
                data[field] = (
                    aware(data[field]).astimezone(utcnow().tzinfo).isoformat().replace("+00:00", "Z")
                )
        if data["notifications"]["last_washed"]:
            data["notifications"]["last_washed"] = (
                aware(data["notifications"]["last_washed"])
                .astimezone(utcnow().tzinfo)
                .isoformat()
                .replace("+00:00", "Z")
            )
        try:
            ZoneInfo(data["timezone"])
        except (ZoneInfoNotFoundError, ValueError):
            raise ConfigurationError(422, "invalid_timezone") from None
        n = data["notifications"]
        if (
            n["humidity_low"] is not None
            and n["humidity_high"] is not None
            and n["humidity_low"] >= n["humidity_high"]
        ):
            raise ConfigurationError(422, "invalid_humidity_range")
        with self.sessions.begin() as session:
            if (
                data["off_timer"]
                and data["off_timer"] != read_settings(session)["off_timer"]
                and not self.service.allowed(session, "power")
            ):
                raise ValueError("capability_unverified")
            write_settings(session, data)
            return self.public(session)
