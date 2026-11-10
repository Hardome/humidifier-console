"""Durable events, alert edges and notification intent."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session as OrmSession

from .db import Delivery, Event, Setting, identifier, read_settings
from .scheduler import aware
from .types import JsonObject


class EventRecorder:
    def event(
        self,
        session: OrmSession,
        kind: str,
        message: str,
        source: str = "external",
        data: JsonObject | None = None,
    ) -> None:
        event = Event(id=identifier(), type=kind, message=message, source=source, data=data or {})
        session.add(event)
        settings = read_settings(session)
        notices = settings["notifications"]
        if notices["enabled"] and kind in notices["categories"]:
            session.add(Delivery(event_id=event.id))

    def alert(self, session: OrmSession, kind: str, active: bool, message: str, now: datetime) -> None:
        key = "alert:" + kind
        row = session.get(Setting, key)
        old: JsonObject = row.value if row else {"active": False, "at": None}
        changed = old["active"] != active
        reminder = active and old["at"] and (now - aware(old["at"])).total_seconds() >= 3600
        if changed or reminder:
            self.event(session, kind, message, data={"active": active})
            session.merge(Setting(key=key, value={"active": active, "at": now.isoformat()}))

    def diagnostics(self, session: OrmSession, values: JsonObject, now: datetime) -> None:
        settings = read_settings(session)["notifications"]
        low, high = settings.get("humidity_low"), settings.get("humidity_high")
        if low is not None and high is not None:
            outside = not low <= values["humidity"] <= high
            self.alert(
                session,
                "humidity",
                outside,
                "Влажность вне заданных границ" if outside else "Влажность в норме",
                now,
            )
        minutes = settings.get("no_growth_minutes")
        row = session.get(Setting, "growth")
        growth = row.value if row else {"at": now.isoformat(), "humidity": values["humidity"]}
        if not values["power"] or values["humidity"] > growth["humidity"]:
            growth = {"at": now.isoformat(), "humidity": values["humidity"]}
        session.merge(Setting(key="growth", value=growth))
        if minutes:
            active = values["power"] and (now - aware(growth["at"])).total_seconds() >= minutes * 60
            self.alert(
                session,
                "no_growth",
                active,
                "Влажность не растёт" if active else "Рост влажности восстановлен",
                now,
            )
        if settings.get("washing_days") and settings.get("last_washed"):
            overdue = now - aware(settings["last_washed"]) >= timedelta(days=settings["washing_days"])
            self.alert(
                session, "washing", overdue, "Пора вымыть увлажнитель" if overdue else "Мойка отмечена", now
            )
        # Water codes deliberately have no meaning until the owner confirms them.
        water = read_settings(session)["water_labels"]
        if water.get(str(values["water_code"]), "unknown") != "unknown":
            active = water[str(values["water_code"])] == "low"
            self.alert(session, "water", active, "Мало воды" if active else "Уровень воды восстановлен", now)
