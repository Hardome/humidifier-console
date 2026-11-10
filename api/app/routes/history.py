from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from .. import history_queries as queries
from ..generated import models as dto
from ..service import Service
from ..types import JsonObject


def build_router(service: Service, sessions: sessionmaker[OrmSession]) -> APIRouter:
    router = APIRouter()

    @router.get("/api/v1/events", response_model=dto.Events, operation_id="getEvents")
    def events(
        limit: int = Query(100, ge=1, le=500),
        offset: int = Query(0, ge=0),
        type: str | None = None,
        source: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> JsonObject:
        return queries.events(
            sessions, limit=limit, offset=offset, type=type, source=source, start=start, end=end
        )

    @router.get("/api/v1/history", response_model=dto.History, operation_id="getHistory")
    def history(
        limit: int = Query(100, ge=1, le=500),
        offset: int = Query(0, ge=0),
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> JsonObject:
        return queries.history(sessions, limit=limit, offset=offset, start=start, end=end)

    return router
