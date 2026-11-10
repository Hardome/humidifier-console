from collections.abc import Sequence
from datetime import UTC, datetime
from typing import cast
from zoneinfo import ZoneInfo

from .db import Rule
from .types import JsonObject


def aware(value: str | datetime) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def rule_actions(
    rule: Rule, state: JsonObject, local: datetime, started_at: datetime, switch_blocked: bool
) -> list[JsonObject]:
    config = rule.config
    if rule.kind == "schedule":
        minute = local.replace(second=0, microsecond=0)
        if minute < started_at or local.weekday() not in config["days"]:
            return []
        if local.strftime("%H:%M") != config["time"]:
            return []
        if rule.last_run and aware(rule.last_run) >= minute:
            return []
        actions = cast(list[JsonObject], config["actions"])
        if switch_blocked:
            return [
                action for action in actions if action["name"] != "power" or action["value"] == state["power"]
            ]
        return actions
    if rule.kind == "automation" and not switch_blocked:
        if state["humidity"] < config["low"] and not state["power"]:
            return [{"name": "power", "value": True}]
        if state["humidity"] > config["high"] and state["power"]:
            return [{"name": "power", "value": False}]
    return []


def due_rules(
    rules: Sequence[Rule],
    settings: JsonObject,
    state: JsonObject | None,
    now: datetime,
    started_at: datetime,
    last_switch: str | datetime | None,
) -> list[tuple[Rule, list[JsonObject]]]:
    """Pure decision function; execution and durable bookkeeping live in the service."""
    if not state or (settings.get("pause_until") and aware(settings["pause_until"]) > now):
        return []
    local = now.astimezone(ZoneInfo(settings["timezone"]))
    result = []
    for rule in sorted(rules, key=lambda r: (-r.priority, r.id)):
        if not rule.enabled:
            continue
        switch_blocked = bool(
            last_switch and (now - aware(last_switch)).total_seconds() < settings["minimum_switch_seconds"]
        )
        actions = rule_actions(rule, state, local, started_at, switch_blocked)
        result.append((rule, actions))
    # Higher priority wins each individual setting, independent settings may coexist.
    seen: set[str] = set()
    resolved = []
    for rule, actions in result:
        selected = [a for a in actions if a["name"] not in seen]
        seen.update(a["name"] for a in selected)
        if selected:
            resolved.append((rule, selected))
    return resolved
