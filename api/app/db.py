from copy import deepcopy
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, Index, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.orm import Session as OrmSession

from .config import DATABASE_URL
from .types import JsonObject


def utcnow() -> datetime:
    return datetime.now(UTC)


def identifier() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[JsonObject] = mapped_column(JSON)


class Measurement(Base):
    __tablename__ = "measurements"
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)
    humidity: Mapped[float] = mapped_column(Float)
    temperature: Mapped[float] = mapped_column(Float)
    humidity_min: Mapped[float] = mapped_column(Float)
    humidity_max: Mapped[float] = mapped_column(Float)
    temperature_min: Mapped[float] = mapped_column(Float)
    temperature_max: Mapped[float] = mapped_column(Float)
    target_humidity: Mapped[float] = mapped_column(Float)
    speed: Mapped[float] = mapped_column(Float)
    power_seconds: Mapped[float] = mapped_column(Float)
    status: Mapped[int] = mapped_column(Integer)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    type: Mapped[str] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(String(500))
    data: Mapped[JsonObject] = mapped_column(JSON, default=dict)
    __table_args__ = (Index("ix_events_at_type", "at", "type"),)


class Command(Base):
    __tablename__ = "commands"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    name: Mapped[str] = mapped_column(String(100))
    value: Mapped[JsonObject] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    error: Mapped[str | None] = mapped_column(String(100), nullable=True)


class Rule(Base):
    __tablename__ = "rules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    name: Mapped[str] = mapped_column(String(100))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[JsonObject] = mapped_column(JSON)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Delivery(Base):
    __tablename__ = "deliveries"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    event_id: Mapped[str] = mapped_column(String(36), unique=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 3} if DATABASE_URL.startswith("postgresql") else {},
)
Session = sessionmaker(engine, expire_on_commit=False)


DEFAULTS: JsonObject = {
    "timezone": "Asia/Yekaterinburg",
    "retention_days": 365,
    "manual_pause_minutes": 60,
    "pause_until": None,
    "off_timer": None,
    "minimum_switch_seconds": 300,
    "water_labels": {"0": "unknown", "1": "unknown", "2": "unknown"},
    "notifications": {
        "enabled": False,
        "categories": ["fault", "connection", "command_unknown", "cleaning"],
        "humidity_low": None,
        "humidity_high": None,
        "no_growth_minutes": None,
        "washing_days": None,
        "last_washed": None,
    },
}


def read_settings(session: OrmSession) -> JsonObject:
    row = session.get(Setting, "application")
    return {**deepcopy(DEFAULTS), **(row.value if row else {})}


def write_settings(session: OrmSession, value: JsonObject) -> None:
    row = session.get(Setting, "application")
    if row:
        row.value = value
    else:
        session.add(Setting(key="application", value=value))
