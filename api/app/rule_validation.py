"""Validation of rule configuration before persistence."""

from sqlalchemy.orm import Session as OrmSession

from .device import validate_command
from .errors import ConfigurationError
from .service import Service
from .types import JsonObject


def validate_rule(service: Service, session: OrmSession, kind: str, data: JsonObject) -> None:
    cfg = data["config"]
    if kind in {"scene", "schedule"}:
        actions = cfg.get("actions")
        if not actions or len(actions) > 10 or len({a["name"] for a in actions}) != len(actions):
            raise ConfigurationError(422, "invalid_actions")
        for a in actions:
            validate_command(a["name"], a["value"])
            if not service.allowed(session, a["name"]):
                raise ValueError("capability_unverified")
    if kind == "schedule" and (not cfg.get("days") or not cfg.get("time")):
        raise ConfigurationError(422, "schedule_requires_days_and_time")
    if kind == "automation":
        if cfg.get("low") is None or cfg.get("high") is None or cfg["low"] >= cfg["high"]:
            raise ConfigurationError(422, "invalid_hysteresis")
        if not service.allowed(session, "power"):
            raise ValueError("capability_unverified")
