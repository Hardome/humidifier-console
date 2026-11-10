import asyncio
from datetime import timedelta

from sqlalchemy import func, select

from api.app.db import Delivery, Event, read_settings, utcnow, write_settings
from api.app.service import Service


def test_notification_edges_and_reminders_deduplicate(sessions, device):
    service = Service(device, sessions)
    now = utcnow()
    with sessions.begin() as session:
        settings = read_settings(session)
        settings["notifications"] = {**settings["notifications"], "enabled": True}
        write_settings(session, settings)
        for seconds in [0, 1, 3599, 3601]:
            service.events.alert(session, "fault", True, "Ошибка", now + timedelta(seconds=seconds))
            session.flush()
        service.events.alert(session, "fault", False, "Устранена", now + timedelta(seconds=3602))
    with sessions() as session:
        assert session.scalar(select(func.count()).select_from(Event)) == 3
        assert session.scalar(select(func.count()).select_from(Delivery)) == 3


def test_minute_aggregation_and_weighted_history(client, sessions, device, app):
    service = app.state.service
    minute = utcnow().replace(second=0, microsecond=0) - timedelta(minutes=2)
    with sessions.begin() as session:
        service.measurements.minute = minute
        service.measurements.samples = [
            (minute, {**device.read(), "humidity": 40, "power": True}),
            (minute + timedelta(seconds=10), {**device.read(), "humidity": 60, "power": True}),
        ]
        service.measurements.flush_samples(session)
        service.measurements.samples = []
    response = client.get("/api/v1/history", params={"limit": 1})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["stats"]["humidity_mean"] == 50
    assert data["stats"]["humidity_min"] == 40
    assert data["stats"]["humidity_max"] == 60
    assert data["stats"]["sample_count"] == 2
    assert data["stats"]["power_seconds"] == 10


def test_telegram_failure_does_not_retry_ambiguous_delivery(sessions, device, monkeypatch):
    from api.app import service as service_module

    calls = []

    async def failed_send(message):
        calls.append(message)
        raise TimeoutError("lost Telegram response")

    monkeypatch.setattr(service_module, "send_telegram", failed_send)
    service = Service(device, sessions)
    with sessions.begin() as session:
        settings = read_settings(session)
        settings["notifications"] = {**settings["notifications"], "enabled": True}
        write_settings(session, settings)
        service.events.event(session, "fault", "Тест отказа Telegram")

    async def scenario():
        await service.deliver()
        await service.deliver()
        await service.poll()

    asyncio.run(scenario())
    assert calls == ["Тест отказа Telegram"]
    with sessions() as session:
        row = session.scalar(select(Delivery))
        assert row.status == "unknown" and row.attempts == 1
    assert service.state is not None
