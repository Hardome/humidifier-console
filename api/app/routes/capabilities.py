from fastapi import APIRouter
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from ..capabilities import CapabilityStore
from ..generated import models as dto
from ..service import Service
from ..types import JsonObject


def build_router(service: Service, sessions: sessionmaker[OrmSession]) -> APIRouter:
    router = APIRouter()

    @router.get("/api/v1/capabilities", response_model=dto.Capabilities, operation_id="getCapabilities")
    def get_capabilities() -> JsonObject:
        return {"items": CapabilityStore(sessions, service.events).read()}

    @router.post(
        "/api/v1/capabilities/verify", response_model=dto.VerificationResult, operation_id="verifyCapability"
    )
    async def verify_capability(body: dto.Verification) -> JsonObject:
        data = body.model_dump(mode="json", by_alias=True)
        return {"verified": await service.verify(data["name"], data["value"], data["observed"])}

    @router.post(
        "/api/v1/capabilities/restore",
        response_model=dto.VerificationResult,
        operation_id="restoreVerification",
    )
    async def restore_verification(body: dto.RestoreInput) -> JsonObject:
        return {"verified": await service.restore(body.observed)}

    return router
