"""Restart reconciliation and initial durable defaults."""

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from .db import Command, Delivery, Rule, Setting


def seed(session: OrmSession) -> None:
    for command in session.scalars(select(Command).where(Command.status.in_(["pending", "running"]))):
        command.status, command.error = "unknown", "server_restarted"
    for delivery in session.scalars(select(Delivery).where(Delivery.status == "sending")):
        delivery.status = "unknown"
    if not session.get(Setting, "initial_scenes") and not session.scalar(
        select(Rule).where(Rule.kind == "scene")
    ):
        for name, actions in [
            ("Ночь", [{"name": "mode", "value": 2}, {"name": "brightness", "value": 0}]),
            ("Обычный день", [{"name": "mode", "value": 3}, {"name": "target_humidity", "value": 50}]),
            ("Выключить", [{"name": "power", "value": False}]),
        ]:
            session.add(Rule(kind="scene", name=name, enabled=False, priority=0, config={"actions": actions}))
    session.merge(Setting(key="initial_scenes", value={"created": True}))
