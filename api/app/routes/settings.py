from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from ..generated import models as dto
from ..service import Service, send_telegram
from ..settings_store import SettingsStore
from ..types import JsonObject


def build_router(service: Service, sessions: sessionmaker[OrmSession]) -> APIRouter:
    router = APIRouter()
    store = SettingsStore(service, sessions)

    @router.get("/api/v1/settings", response_model=dto.Settings, operation_id="getSettings")
    def settings() -> JsonObject:
        return store.read()

    @router.put("/api/v1/settings", response_model=dto.Settings, operation_id="updateSettings")
    def update_settings(body: dto.SettingsInput) -> JsonObject:
        return store.update(body.model_dump(mode="json", by_alias=True))

    @router.post("/api/v1/telegram/test", response_model=dto.TelegramResult, operation_id="testTelegram")
    async def test_telegram() -> JsonObject:
        try:
            await send_telegram("Smartmi: тестовое уведомление")
        except Exception:
            raise HTTPException(503, "telegram_delivery") from None
        return {"sent": True}

    return router
