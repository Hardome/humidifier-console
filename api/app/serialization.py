"""Conversion of ORM records to transport data."""

from datetime import datetime

from .db import Base
from .scheduler import aware
from .types import JsonObject


def record(row: Base) -> JsonObject:
    result: JsonObject = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        result[column.name] = aware(value) if isinstance(value, datetime) else value
    return result
