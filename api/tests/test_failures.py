"""Failure boundaries and lifecycle behavior, independent of physical hardware."""

import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import select

from api.app.command_store import CommandStore
from api.app.db import Command, Delivery, Event, Setting, read_settings, utcnow, write_settings
from api.app.device import DeviceFailure
from api.app.events import EventRecorder
from api.app.main import create_app
from api.app.notifications import Notifications
from api.app.service import Service


@pytest.mark.parametrize(
    ("kind", "config", "code"),
    [
        ("scenes", {"actions": []}, "invalid_actions"),
        ("schedules", {"actions": [{"name": "power", "value": True}]}, "schedule_requires_days_and_time"),
        ("automations", {"low": 60, "high": 40}, "invalid_hysteresis"),
    ],
)
def test_invalid_rule_configuration(client, sessions, kind, config, code):
    with sessions.begin() as session:
        session.merge(Setting(key="capabilities", value={"power": "verified"}))
    response = client.post(
        f"/api/v1/{kind}", json={"name": "test", "enabled": False, "priority": 0, "config": config}
    )
    assert response.status_code == 422
    assert response.json()["code"] == code


def test_rule_crud_and_scene_execution(client, sessions):
    with sessions.begin() as session:
        session.merge(Setting(key="capabilities", value={"power": "verified"}))
    body = {
        "name": "test",
        "priority": 0,
        "enabled": True,
        "config": {"actions": [{"name": "power", "value": True}]},
    }
    created = client.post("/api/v1/scenes", json=body)
    assert created.status_code == 201
    scene_id = created.json()["id"]
    assert created.json()["enabled"] is False
    body["name"] = "updated"
    assert client.put(f"/api/v1/scenes/{scene_id}", json=body).json()["name"] == "updated"
    assert client.post(f"/api/v1/scenes/{scene_id}/run").status_code == 200
    client.portal.call(client.app.state.service.shutdown)
    assert client.delete(f"/api/v1/scenes/{scene_id}").status_code == 200
    assert client.delete(f"/api/v1/scenes/{scene_id}").status_code == 404


def test_history_and_event_filter_boundaries(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/diagnostics").json()["database_ok"]
    response = client.get(
        "/api/v1/events",
        params={
            "type": "fault",
            "source": "panel",
            "start": "2020-01-01T00:00:00Z",
            "end": "2030-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 200
    assert response.json()["items"] == []
    response = client.get(
        "/api/v1/history", params={"start": "2030-01-01T00:00:00Z", "end": "2020-01-01T00:00:00Z"}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_time_range"


def test_notification_success_and_orphan_intent(sessions):
    with sessions.begin() as session:
        event = Event(id="event", type="fault", message="safe", source="test")
        session.add(event)
        session.add(Delivery(id="delivery", event_id="event"))
    sent = []

    async def send(message):
        sent.append(message)

    notifications = Notifications(sessions)
    assert asyncio.run(notifications.deliver(send))
    assert asyncio.run(notifications.deliver(send))
    assert sent == ["safe"]
    with sessions.begin() as session:
        assert session.get(Delivery, "delivery").status == "sent"
        session.add(Delivery(id="orphan", event_id="missing"))
    assert asyncio.run(notifications.deliver(send))
    with sessions() as session:
        assert session.get(Delivery, "orphan").status == "unknown"
    notifications.complete("missing", "sent")


def test_command_store_missing_rows_are_harmless(sessions):
    store = CommandStore(sessions, EventRecorder())
    assert store.claim("missing") is None
    store.complete(
        Command(id="missing", name="power", value={"value": True}, source="test"), "confirmed", None
    )


def test_stale_service_rejects_commands_without_device_write(sessions, device):
    service = Service(device, sessions)
    with pytest.raises(DeviceFailure, match="stale_state"):
        _ = service.values
    with pytest.raises(ValueError, match="stale_state"):
        asyncio.run(service.enqueue("power", True))
    asyncio.run(service.execute("missing"))
    assert device.read()["power"] is False
    assert asyncio.run(service.restore(True)) is True
    with pytest.raises(ValueError, match="owner_observation_required"):
        asyncio.run(service.restore(False))


def test_maintenance_deletes_only_expired_rows(sessions, device):
    now = utcnow()
    with sessions.begin() as session:
        session.add(Event(id="old", at=now - timedelta(days=400), type="fault", message="old", source="test"))
        session.add(Event(id="new", at=now, type="fault", message="new", source="test"))
    service = Service(device, sessions)
    asyncio.run(service.maintenance())
    asyncio.run(service.maintenance())
    with sessions() as session:
        assert [event.id for event in session.scalars(select(Event))] == ["new"]


def test_background_loops_stop_and_release_tasks(sessions, device, monkeypatch):
    service = Service(device, sessions)

    async def scenario():
        async def poll_and_stop():
            service.stop.set()

        monkeypatch.setattr(service, "poll", poll_and_stop)
        await service.run()
        service.stop.clear()

        async def deliver_and_stop():
            service.stop.set()

        monkeypatch.setattr(service, "deliver", deliver_and_stop)
        await service.notification_loop()

        async def failure():
            raise RuntimeError("private detail")

        service.spawn(failure())
        await service.shutdown()
        assert not service.tasks

    asyncio.run(scenario())


def test_app_construction_never_reads_device_credentials(sessions, monkeypatch):
    def unexpected(*args, **kwargs):
        pytest.fail("device construction before lifespan")

    monkeypatch.setattr("api.app.main.create_device", unexpected)
    app = create_app(sessions=sessions, background=False)
    assert app.state.service.state is None


@pytest.mark.parametrize("content", ["null", "[]", '{"ip": null, "token": null}', "{}", '"invalid"'])
def test_malformed_credentials_leave_device_unavailable(tmp_path, content):
    from api.app.device import DeviceFailure, create_device

    config = tmp_path / "device.json"
    config.write_text(content, encoding="utf-8")

    device = create_device(config)

    with pytest.raises(DeviceFailure, match="configuration"):
        device.read()


def test_notification_thresholds_generate_edges(sessions):
    recorder = EventRecorder()
    now = utcnow()
    with sessions.begin() as session:
        settings = read_settings(session)
        settings["notifications"] = {
            **settings["notifications"],
            "humidity_low": 40,
            "humidity_high": 60,
            "no_growth_minutes": 1,
            "washing_days": 1,
            "last_washed": (now - timedelta(days=2)).isoformat(),
        }
        settings["water_labels"] = {"1": "low"}
        write_settings(session, settings)
        session.merge(
            Setting(key="growth", value={"at": (now - timedelta(minutes=2)).isoformat(), "humidity": 45})
        )
    with sessions.begin() as session:
        recorder.diagnostics(session, {"humidity": 35, "power": True, "water_code": 1}, now)
    with sessions() as session:
        kinds = set(session.scalars(select(Event.type)))
        assert {"humidity", "no_growth", "washing", "water"} <= kinds
