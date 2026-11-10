import asyncio

from fastapi import APIRouter
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from ..generated import models as dto
from ..rule_store import RuleStore
from ..serialization import record
from ..service import Service
from ..types import JsonObject


def build_router(service: Service, sessions: sessionmaker[OrmSession]) -> APIRouter:
    router = APIRouter()
    store = RuleStore(service, sessions)

    def install_rules(resource: str, kind: str) -> None:
        path = "/api/v1/" + resource
        singular = resource[:-1].title()

        def list_rules() -> JsonObject:
            return store.list(kind)

        def create_rule(body: dto.RuleInput) -> JsonObject:
            return store.create(kind, body.model_dump(mode="json", by_alias=True, exclude_none=True))

        def update_rule(id: str, body: dto.RuleInput) -> JsonObject:
            return store.update(kind, id, body.model_dump(mode="json", by_alias=True, exclude_none=True))

        def delete_rule(id: str) -> JsonObject:
            return store.delete(kind, id)

        router.add_api_route(
            path,
            list_rules,
            methods=["GET"],
            response_model=dto.Rules,
            response_model_exclude_unset=True,
            operation_id="list" + resource.title(),
        )
        router.add_api_route(
            path,
            create_rule,
            methods=["POST"],
            response_model=dto.RuleItem,
            response_model_exclude_unset=True,
            status_code=201,
            operation_id="create" + singular,
        )
        router.add_api_route(
            path + "/{id}",
            update_rule,
            methods=["PUT"],
            response_model=dto.RuleItem,
            response_model_exclude_unset=True,
            operation_id="update" + singular,
        )
        router.add_api_route(
            path + "/{id}",
            delete_rule,
            methods=["DELETE"],
            response_model=dto.VerificationResult,
            operation_id="delete" + singular,
        )

    for resource, kind in [("scenes", "scene"), ("schedules", "schedule"), ("automations", "automation")]:
        install_rules(resource, kind)

    def scene_actions(id: str) -> list[JsonObject]:
        return store.scene_actions(id)

    @router.post("/api/v1/scenes/{id}/run", response_model=dto.RunResult, operation_id="runScene")
    async def run_scene(id: str) -> JsonObject:
        actions = await asyncio.to_thread(scene_actions, id)
        commands = [record(await service.enqueue(a["name"], a["value"])) for a in actions]
        return {"commands": commands}

    return router
