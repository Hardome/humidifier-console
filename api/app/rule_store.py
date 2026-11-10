"""Rule lookup with stable domain errors."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from .rule_validation import validate_rule
from .serialization import record
from .types import JsonObject

if TYPE_CHECKING:
    from .service import Service

from .db import Rule
from .errors import ConfigurationError


def rule_by_id(session: OrmSession, kind: str, id: str) -> Rule:
    row = session.get(Rule, id)
    if not row or row.kind != kind:
        raise ConfigurationError(404, "rule_not_found")
    return row


class RuleStore:
    def __init__(self, service: Service, sessions: sessionmaker[OrmSession]) -> None:
        self.service = service
        self.sessions = sessions

    def scene_actions(self, id: str) -> list[JsonObject]:
        with self.sessions() as session:
            row = rule_by_id(session, "scene", id)
            actions = row.config["actions"]
            if not all(self.service.allowed(session, a["name"]) for a in actions):
                raise ValueError("capability_unverified")
        return list(actions)

    def list(self, kind: str) -> JsonObject:
        with self.sessions() as session:
            rows = session.scalars(
                select(Rule).where(Rule.kind == kind).order_by(Rule.priority.desc(), Rule.id)
            )
            return {"items": [record(r) for r in rows]}

    def create(self, kind: str, data: JsonObject) -> JsonObject:
        with self.sessions.begin() as session:
            validate_rule(self.service, session, kind, data)
            # Creation always requires a separate explicit enable action.
            row = Rule(kind=kind, **{**data, "enabled": False})
            session.add(row)
            session.flush()
            return record(row)

    def update(self, kind: str, id: str, data: JsonObject) -> JsonObject:
        with self.sessions.begin() as session:
            row = rule_by_id(session, kind, id)
            validate_rule(self.service, session, kind, data)
            for key, value in data.items():
                setattr(row, key, value)
            return record(row)

    def delete(self, kind: str, id: str) -> JsonObject:
        with self.sessions.begin() as session:
            session.delete(rule_by_id(session, kind, id))
        return {"verified": True}
