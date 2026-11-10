from fastapi import APIRouter
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from ..command_store import CommandStore
from ..generated import models as dto
from ..serialization import record
from ..service import Service
from ..types import JsonObject


def build_router(service: Service, sessions: sessionmaker[OrmSession]) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/api/v1/commands", response_model=dto.CommandResult, status_code=202, operation_id="createCommand"
    )
    async def create_command(body: dto.CommandInput) -> JsonObject:
        data = body.model_dump(mode="json", by_alias=True)
        command = await service.enqueue(data["name"], data["value"], data.get("source") or "panel")
        return record(command)

    @router.get("/api/v1/commands/{id}", response_model=dto.CommandResult, operation_id="getCommand")
    def get_command(id: str) -> JsonObject:
        return CommandStore(sessions, service.events).get(id)

    return router
