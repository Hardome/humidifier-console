from fastapi import APIRouter
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from ..generated import models as dto
from ..service import Service
from ..types import JsonObject


def build_router(service: Service, sessions: sessionmaker[OrmSession]) -> APIRouter:
    router = APIRouter()

    @router.get("/health", include_in_schema=False)
    def health() -> JsonObject:
        # Device disconnection is not a process liveness failure.
        return {"status": "ok"}

    @router.get("/api/v1/state", response_model=dto.State, operation_id="getState")
    def get_state() -> JsonObject:
        return service.snapshot()

    @router.post("/api/v1/state/refresh", response_model=dto.State, operation_id="refreshState")
    async def refresh_state() -> JsonObject:
        await service.poll()
        return service.snapshot()

    @router.get("/api/v1/diagnostics", response_model=dto.Diagnostics, operation_id="getDiagnostics")
    def diagnostics() -> JsonObject:
        return service.diagnostics()

    return router
