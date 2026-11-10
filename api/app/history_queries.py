"""Read models for event pages and weighted measurement history."""

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from .db import (
    Event,
    Measurement,
    utcnow,
)
from .errors import ConfigurationError
from .scheduler import aware
from .serialization import record
from .types import JsonObject


def events(
    sessions: sessionmaker[OrmSession],
    limit: int = 100,
    offset: int = 0,
    type: str | None = None,
    source: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> JsonObject:
    query = select(Event)
    if type:
        query = query.where(Event.type == type)
    if source:
        query = query.where(Event.source == source)
    if start:
        query = query.where(Event.at >= aware(start))
    if end:
        query = query.where(Event.at <= aware(end))
    with sessions() as session:
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        items = session.scalars(query.order_by(Event.at.desc(), Event.id).offset(offset).limit(limit)).all()
        return {"items": [record(r) for r in items], "total": total, "limit": limit, "offset": offset}


def history(
    sessions: sessionmaker[OrmSession],
    limit: int = 100,
    offset: int = 0,
    start: datetime | None = None,
    end: datetime | None = None,
) -> JsonObject:
    start, end = aware(start) if start else utcnow() - timedelta(days=1), aware(end) if end else utcnow()
    if start >= end or end - start > timedelta(days=366):
        raise ConfigurationError(422, "invalid_time_range")
    query = select(Measurement).where(Measurement.at >= start, Measurement.at <= end)
    with sessions() as session:
        # SQL aggregates cover the full range, regardless of page size.
        sub = query.subquery()
        c = sub.c
        stats = session.execute(
            select(
                func.min(c.humidity_min),
                func.max(c.humidity_max),
                func.sum(c.humidity * c.count) / func.nullif(func.sum(c.count), 0),
                func.min(c.temperature_min),
                func.max(c.temperature_max),
                func.sum(c.temperature * c.count) / func.nullif(func.sum(c.count), 0),
                func.sum(c.power_seconds),
                func.sum(c.count),
                func.count(),
            ).select_from(sub)
        ).one()
        items = session.scalars(query.order_by(Measurement.at).offset(offset).limit(limit)).all()
        return {
            "items": [record(r) for r in items],
            "total": stats[8],
            "limit": limit,
            "offset": offset,
            "stats": dict(
                zip(
                    [
                        "humidity_min",
                        "humidity_max",
                        "humidity_mean",
                        "temperature_min",
                        "temperature_max",
                        "temperature_mean",
                        "power_seconds",
                        "sample_count",
                    ],
                    [*stats[:6], stats[6] or 0, stats[7] or 0],
                    strict=True,
                )
            ),
        }
