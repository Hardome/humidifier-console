import asyncio
import json
import logging
from io import StringIO
from pathlib import Path

import pytest
from fastapi.openapi.utils import get_openapi

from api.app.db import Command
from api.app.device import LanDevice, offline_diagnostic_class
from api.app.service import Service
from api.tests.helpers import allow


def test_routes_and_response_schemas_match_contract(app):
    contract = json.loads(Path("contracts/dist/openapi.json").read_text(encoding="utf-8"))
    actual = get_openapi(title=app.title, version=app.version, routes=app.routes)
    assert set(actual["paths"]) == set(contract["paths"])
    for path, methods in contract["paths"].items():
        assert set(actual["paths"][path]) == set(methods)
        for method, operation in methods.items():
            runtime = actual["paths"][path][method]
            assert runtime["operationId"] == operation["operationId"]
            assert set(runtime["responses"]) == set(operation["responses"])
            expected_params = {(p["name"], p["in"]) for p in operation.get("parameters", [])}
            assert {(p["name"], p["in"]) for p in runtime.get("parameters", [])} == expected_params
            for status, response in operation["responses"].items():
                assert (
                    runtime["responses"][status]["content"]["application/json"]["schema"]
                    == response["content"]["application/json"]["schema"]
                )


def test_errors_are_safe_and_secrets_never_return(client, monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "super-secret-token")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "12345")
    response = client.get("/api/v1/commands/missing")
    assert response.status_code == 404
    assert set(response.json()) == {"code", "message", "request_id"}
    assert response.headers["X-Request-ID"] == response.json()["request_id"]
    response = client.get("/api/v1/settings")
    assert response.status_code == 200
    assert "super-secret-token" not in response.text and "12345" not in response.text


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://untrusted.example"},
        {"Origin": "https://testserver"},
        {"Origin": "http://[invalid"},
        {"Origin": "null"},
        {"Sec-Fetch-Site": "cross-site"},
    ],
)
def test_cross_site_writes_are_rejected_before_device_access(client, device, headers):
    reads = []
    device.read = lambda: reads.append(True)

    response = client.post("/api/v1/state/refresh", headers=headers)

    assert response.status_code == 403
    assert response.json()["code"] == "cross_origin_request"
    assert response.headers["X-Request-ID"] == response.json()["request_id"]
    assert reads == []


def test_same_origin_browser_write_is_allowed(client):
    response = client.post("/api/v1/state/refresh", headers={"Origin": "http://testserver"})

    assert response.status_code == 200


def test_unexpected_error_does_not_escape_to_asgi_logging(client, app, monkeypatch, caplog):
    def fail():
        raise RuntimeError("private-test-secret")

    monkeypatch.setattr(app.state.service, "snapshot", fail)

    response = client.get("/api/v1/state")

    assert response.status_code == 503
    assert response.json()["code"] == "internal_error"
    assert response.headers["X-Request-ID"] == response.json()["request_id"]
    assert "private-test-secret" not in response.text + caplog.text


def test_upstream_child_loggers_do_not_propagate_secrets(monkeypatch):
    output = StringIO()
    monkeypatch.setattr(logging.getLogger(), "handlers", [logging.StreamHandler(output)])

    for name in ["miio.miioprotocol", "micloud.client", "httpx.transport", "httpcore.connection"]:
        logging.getLogger(name).error("private-test-secret")

    assert output.getvalue() == ""


def test_spec_is_bundled_without_cloud(monkeypatch):
    from miio.miot_cloud import MiotCloud

    monkeypatch.setattr(MiotCloud, "get_device_model", lambda *a: pytest.fail("runtime cloud lookup"))
    device = offline_diagnostic_class()("192.168.1.2", "a" * 32, model="zhimi.humidifier.ca7")
    device.initialize_model()
    assert device._miot_model is not None
    lan = LanDevice({"ip": "192.168.1.2", "token": "a" * 32})
    assert lan.device.retry_count == 0


def test_lan_renews_handshake_after_device_restart_without_repeating_commands():
    from datetime import UTC, datetime

    lan = LanDevice({"ip": "192.168.1.2", "token": "a" * 32})
    protocol = lan.device._protocol
    # Недавняя успешная сессия остаётся в памяти сервера при отключении питания прибора.
    protocol._discovered = True
    protocol._last_handshake = datetime.now(UTC)

    assert protocol._needs_handshake()
    assert lan.device.retry_count == 0


@pytest.mark.parametrize("field,value", [("power", "false"), ("status", "invalid"), ("speed", None)])
def test_malformed_lan_values_are_rejected_before_service(field, value, device, monkeypatch):
    from api.app.device import DeviceFailure

    lan = LanDevice({"ip": "192.168.1.2", "token": "a" * 32})
    lan.model_checked = True
    values = {**device.read(), field: value}
    properties = [{"did": name, "value": reading} for name, reading in values.items()]
    monkeypatch.setattr(lan.device, "get_properties", lambda *args, **kwargs: properties)

    with pytest.raises(DeviceFailure, match="specification"):
        lan.read()


def test_settings_roundtrip_and_rule_optional_fields(client, sessions):
    settings = client.get("/api/v1/settings").json()
    del settings["telegram_configured"], settings["restoration_pending"]
    settings["water_labels"]["0"] = "low"
    settings["retention_days"] = 180
    response = client.put("/api/v1/settings", json=settings)
    assert response.status_code == 200, response.text
    assert response.json()["water_labels"]["0"] == "low"
    scenes = client.get("/api/v1/scenes").json()["items"]
    assert len(scenes) == 3
    assert scenes[0]["last_run"] is None  # required nullable field remains present
    assert "days" not in scenes[0]["config"]  # optional nonnullable field is omitted
    allow(sessions, "power")
    response = client.post(
        "/api/v1/automations",
        json={"name": "Порог", "enabled": True, "priority": 10, "config": {"low": 40, "high": 55}},
    )
    assert response.status_code == 201, response.text
    assert response.json()["enabled"] is False
    assert response.json()["config"] == {"low": 40, "high": 55}


def test_database_failure_blocks_commands(sessions, device, monkeypatch):
    from sqlalchemy.exc import OperationalError

    service = Service(device, sessions)
    asyncio.run(service.poll())

    class Offline:
        def begin(self):
            raise OperationalError("", {}, Exception("private database detail"))

    monkeypatch.setattr(service, "sessions", Offline())
    asyncio.run(service.tick())
    assert service.db_ok is False
    assert device.read()["power"] is False


def test_abandoned_commands_become_unknown_on_restart(client, sessions):
    from api.app.bootstrap import seed

    with sessions.begin() as session:
        row = Command(name="power", value={"value": True}, source="panel", status="running")
        session.add(row)
        session.flush()
        cid = row.id
    with sessions.begin() as session:
        seed(session)
    with sessions() as session:
        assert session.get(Command, cid).status == "unknown"
