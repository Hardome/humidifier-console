"""Safe HTTP errors and request correlation."""

import logging
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import RequestResponseEndpoint

from .device import DeviceFailure
from .errors import ConfigurationError
from .service import Service


def is_cross_origin(request: Request) -> bool:
    if request.headers.get("sec-fetch-site") == "cross-site":
        return True
    origin = request.headers.get("origin")
    if not origin:
        return False
    try:
        parsed = urlsplit(origin)
        return parsed.scheme != request.url.scheme or (
            parsed.netloc.lower() != request.headers.get("host", "").lower()
        )
    except ValueError:
        return True


def install_error_handlers(app: FastAPI, service: Service) -> None:
    @app.middleware("http")
    async def request_id(request: Request, call_next: RequestResponseEndpoint) -> Response:
        request.state.request_id = str(uuid4())
        response: Response
        if request.method not in {"GET", "HEAD", "OPTIONS"} and is_cross_origin(request):
            response = error_response(request, 403, "cross_origin_request")
        else:
            try:
                response = await call_next(request)
            except Exception as exc:
                # Подробности исключения могут содержать секреты и остаются внутри приложения.
                response = await unexpected_error(request, exc)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        return response

    def error_response(request: Request, status: int, code: str) -> JSONResponse:
        return JSONResponse(
            status_code=status,
            content={"code": code, "message": code, "request_id": request.state.request_id},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return error_response(request, exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(request, 422, "validation_error")

    @app.exception_handler(ConfigurationError)
    async def configuration_error(request: Request, exc: ConfigurationError) -> JSONResponse:
        return error_response(request, exc.status, exc.code)

    @app.exception_handler(ValueError)
    async def value_error(request: Request, exc: ValueError) -> JSONResponse:
        safe = str(exc)
        allowed = {
            "stale_state",
            "capability_unverified",
            "command_not_allowed",
            "boolean_required",
            "value_out_of_range",
            "owner_observation_required",
            "choose_different_value",
            "restoration_pending",
            "verify_mode_first",
        }
        return error_response(request, 409, safe if safe in allowed else "invalid_configuration")

    @app.exception_handler(DeviceFailure)
    async def device_error(request: Request, exc: DeviceFailure) -> JSONResponse:
        return error_response(request, 503, exc.code)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        service.db_ok = False
        return error_response(request, 503, "database_unavailable")

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logging.getLogger(__name__).error(
            "Unhandled request failure",
            extra={"request_id": request.state.request_id, "error_type": type(exc).__name__},
        )
        return error_response(request, 503, "internal_error")
