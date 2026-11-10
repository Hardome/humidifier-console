"""Verified capabilities and durable restoration intents."""

from datetime import timedelta

from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from .db import Setting, read_settings, utcnow, write_settings
from .device import WRITABLE
from .events import EventRecorder
from .types import JsonObject


class CapabilityStore:
    def __init__(self, sessions: sessionmaker[OrmSession], events: EventRecorder) -> None:
        self.sessions = sessions
        self.events = events

    def read(self) -> list[JsonObject]:
        with self.sessions() as session:
            return self.describe(session)

    def describe(self, session: OrmSession) -> list[JsonObject]:
        row = session.get(Setting, "capabilities")
        verified = row.value if row else {}
        return [
            {
                "name": name,
                "status": verified.get(name, "declared"),
                "requires_observation": name in {"power", "mode", "cycle_mode", "clean"},
            }
            for name in sorted(WRITABLE | {"cycle_mode"})
        ]

    def allowed(self, session: OrmSession, name: str) -> bool:
        return any(c["status"] == "verified" for c in self.describe(session) if c["name"] == name)

    def begin(self, property_name: str, original: object) -> None:
        with self.sessions.begin() as session:
            if session.get(Setting, "verification_restore"):
                raise ValueError("restoration_pending")
            session.add(Setting(key="verification_restore", value={"name": property_name, "value": original}))
            settings = read_settings(session)
            settings["pause_until"] = (
                utcnow() + timedelta(minutes=settings["manual_pause_minutes"])
            ).isoformat()
            write_settings(session, settings)

    def clear(self) -> None:
        with self.sessions.begin() as session:
            row = session.get(Setting, "verification_restore")
            if row is not None:
                session.delete(row)

    def finish(self, name: str, confirmed: bool) -> None:
        with self.sessions.begin() as session:
            row = session.get(Setting, "capabilities")
            values = dict(row.value) if row else {}
            values[name] = "verified" if confirmed else "unsupported"
            session.merge(Setting(key="capabilities", value=values))
            self.events.event(session, "verification", f"{name}: {values[name]}", "panel")

    def intent(self) -> JsonObject | None:
        with self.sessions() as session:
            row = session.get(Setting, "verification_restore")
            return row.value if row else None

    def restored(self) -> None:
        with self.sessions.begin() as session:
            session.delete(session.get(Setting, "verification_restore"))
            self.events.event(session, "verification", "Исходное значение восстановлено", "panel")
