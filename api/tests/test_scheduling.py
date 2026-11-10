import asyncio
from datetime import UTC, timedelta

from sqlalchemy import select

from api.app.db import Measurement, read_settings, utcnow, write_settings
from api.app.scheduler import due_rules
from api.app.service import Service
from api.tests.helpers import allow, rule, scheduler_settings


def test_hysteresis_pause_and_switch_guard():
    now = utcnow()
    r = rule("a", low=40, high=55)
    state = {"humidity": 39, "power": False}
    settings = scheduler_settings()
    assert due_rules([r], settings, state, now, now, None)[0][1] == [{"name": "power", "value": True}]
    assert due_rules([r], settings, {**state, "humidity": 45}, now, now, None) == []
    assert due_rules([r], settings, state, now, now, now - timedelta(seconds=299)) == []
    settings["pause_until"] = (now + timedelta(minutes=60)).isoformat()
    assert due_rules([r], settings, state, now, now, None) == []


def test_priorities_and_midnight_no_schedule_replay():
    from datetime import datetime

    now = datetime(2026, 11, 8, 19, 0, 20, tzinfo=UTC)  # Monday 00:00 in Yekaterinburg
    a = rule("a", "schedule", days=[0], time="00:00", actions=[{"name": "power", "value": True}])
    b = rule("b", "schedule", days=[0], time="00:00", actions=[{"name": "power", "value": False}])
    b.priority = 10
    result = due_rules(
        [a, b], scheduler_settings(), {"humidity": 45, "power": False}, now, now - timedelta(minutes=1), None
    )
    assert len(result) == 1 and result[0][0].id == "b"
    assert due_rules([a], scheduler_settings(), {"humidity": 45, "power": False}, now, now, None) == []
    b.last_run = now
    assert (
        due_rules(
            [b], scheduler_settings(), {"humidity": 45, "power": False}, now, now - timedelta(minutes=1), None
        )
        == []
    )


def test_overdue_timer_survives_new_service(sessions, device):
    allow(sessions, "power")
    with sessions.begin() as session:
        settings = read_settings(session)
        settings["off_timer"] = (utcnow() - timedelta(minutes=2)).isoformat()
        settings["pause_until"] = (utcnow() + timedelta(hours=1)).isoformat()
        write_settings(session, settings)
    device.write("power", True)

    async def scenario():
        service = Service(device, sessions)
        await service.tick()  # No fresh measurement: must leave the timer intact.
        with sessions() as session:
            assert read_settings(session)["off_timer"] is not None
        await service.poll()
        await service.tick()
        await asyncio.gather(*list(service.tasks))
        assert not device.read()["power"]
        with sessions() as session:
            assert read_settings(session)["off_timer"] is None

    asyncio.run(scenario())


def test_work_time_spans_minute_boundaries_without_counting_outages(sessions, device, monkeypatch):
    from api.app import service as service_module

    now = utcnow().replace(second=55, microsecond=0) - timedelta(minutes=1)
    clock = [now]
    monkeypatch.setattr(service_module, "utcnow", lambda: clock[0])
    device.write("power", True)
    service = Service(device, sessions)

    async def scenario():
        await service.poll()
        clock[0] += timedelta(seconds=10)
        await service.poll()
        await service.shutdown()

    asyncio.run(scenario())
    with sessions() as session:
        points = session.scalars(select(Measurement).order_by(Measurement.at)).all()
        assert len(points) == 2
        assert [p.power_seconds for p in points] == [5, 5]
