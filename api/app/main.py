import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from . import config
from .bootstrap import seed
from .db import (
    Session,
)
from .device import MissingDevice, create_device
from .generated import models as dto
from .http_errors import install_error_handlers
from .routes import capabilities, commands, history, rules, settings, state
from .service import Service
from .types import Device

# Upstream debug logging may contain packets/tokens. Never emit those logs.
for logger_name in ("miio", "micloud", "httpx", "httpcore"):
    upstream_logger = logging.getLogger(logger_name)
    upstream_logger.disabled = True
    upstream_logger.propagate = False
    upstream_logger.addHandler(logging.NullHandler())


def create_app(
    device: Device | None = None, sessions: sessionmaker[OrmSession] = Session, background: bool = True
) -> FastAPI:
    environment = config.Settings()
    service = Service(device or MissingDevice(), sessions)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if device is None:
            service.device = create_device(environment.device_config)

        def initialize_storage() -> None:
            with sessions.begin() as session:
                seed(session)

        try:
            await asyncio.to_thread(initialize_storage)
        except SQLAlchemyError:
            service.db_ok = False
        workers = (
            [asyncio.create_task(service.run()), asyncio.create_task(service.notification_loop())]
            if background
            else []
        )
        try:
            yield
        finally:
            service.stop.set()
            try:
                async with asyncio.timeout(30):
                    await asyncio.gather(*workers, return_exceptions=True)
            except TimeoutError:
                for worker in workers:
                    worker.cancel()
                await asyncio.gather(*workers, return_exceptions=True)
            await service.shutdown()

    app = FastAPI(
        title="Humidifier Console",
        version="1.0.0",
        lifespan=lifespan,
        responses={
            code: {"model": dto.Error, "description": "Safe error"} for code in [403, 404, 409, 422, 503]
        },
    )
    app.state.service = service

    install_error_handlers(app, service)

    for module in (state, capabilities, commands, history, rules, settings):
        app.include_router(module.build_router(service, sessions))

    # Publish the source-of-truth schema, with runtime route parity verified by tests.
    contract = Path(__file__).resolve().parents[2] / "contracts" / "dist" / "openapi.json"
    if contract.exists():
        app.openapi_schema = json.loads(contract.read_text(encoding="utf-8"))
    return app


app = create_app()
