"""Runtime recovery and rule execution across persistence boundaries."""

import asyncio
import threading
from datetime import timedelta

import pytest
from sqlalchemy import event, select

from api.app.capabilities import CapabilityStore
from api.app.db import Command, Event, Rule, read_settings, utcnow, write_settings
from api.app.device import DeviceFailure
from api.app.measurements import Measurements
from api.app.service import Service
from api.tests.helpers import allow


@pytest.mark.parametrize("verified", [False, True])
def test_automation_only_executes_verified_actions(sessions, device, verified):
    if verified:
        allow(sessions, "power")
    with sessions.begin() as session:
        session.add(
            Rule(kind="automation", name="humidity", enabled=True, priority=1, config={"low": 50, "high": 60})
        )
    service = Service(device, sessions)

    async def scenario():
        await service.poll()
        await service.tick()
        await service.shutdown()

    asyncio.run(scenario())
    assert device.read()["power"] is verified
    with sessions() as session:
        commands = list(session.scalars(select(Command)))
        assert len(commands) == int(verified)


def test_offline_alert_recovers_and_cleaning_completion_is_recorded(sessions, device):
    service = Service(device, sessions)
    read = device.read

    def unavailable():
        raise DeviceFailure()

    async def scenario():
        await service.poll()
        device.read = unavailable
        await service.poll()
        service.disconnected_at = utcnow() - timedelta(minutes=2)
        await service.tick()
        device.read = read
        device.values["status"] = 4
        await service.poll()
        device.values["status"] = 1
        await service.poll()

    asyncio.run(scenario())
    with sessions() as session:
        kinds = list(session.scalars(select(Event.type)))
        assert kinds.count("connection") == 2
        assert "cleaning" in kinds


def test_readback_mismatch_does_not_repeat_a_write(sessions, device, monkeypatch):
    allow(sessions, "power")
    service = Service(device, sessions)
    writes = []

    def ignore_write(name, value):
        writes.append((name, value))

    async def no_delay(seconds):
        pass

    monkeypatch.setattr(device, "write", ignore_write)
    monkeypatch.setattr("api.app.service.asyncio.sleep", no_delay)

    async def scenario():
        await service.poll()
        command = await service.enqueue("power", True, source="schedule")
        await service.shutdown()
        return command.id

    command_id = asyncio.run(scenario())
    assert writes == [("power", True)]
    with sessions() as session:
        command = session.get(Command, command_id)
        assert command.status == "failed"
        assert command.error == "readback_mismatch"


def test_restore_intent_pauses_rules_until_owner_recovery(sessions, device):
    service = Service(device, sessions)
    store = CapabilityStore(sessions, service.events)
    store.begin("power", False)
    with pytest.raises(ValueError, match="restoration_pending"):
        store.begin("power", False)

    async def scenario():
        await service.poll()
        await service.tick()
        assert await service.restore(True)

    asyncio.run(scenario())
    assert store.intent() is None
    store.clear()
    with sessions() as session:
        Measurements().flush_samples(session)


def test_unverified_timer_is_retained(sessions, device):
    timer = (utcnow() - timedelta(minutes=1)).isoformat()
    with sessions.begin() as session:
        settings = read_settings(session)
        settings["off_timer"] = timer
        write_settings(session, settings)
    service = Service(device, sessions)

    async def scenario():
        await service.poll()
        await service.tick()

    asyncio.run(scenario())
    with sessions() as session:
        assert read_settings(session)["off_timer"] == timer


def test_verification_rejects_same_value_and_stale_state(sessions, device):
    service = Service(device, sessions)
    with pytest.raises(ValueError, match="choose_different_value"):
        asyncio.run(service.verify("power", False, True))

    def unavailable():
        raise DeviceFailure()

    device.read = unavailable
    with pytest.raises(ValueError, match="stale_state"):
        asyncio.run(service.verify("power", True, True))


def test_async_runtime_executes_sql_outside_event_loop(sessions, device):
    allow(sessions, "power")
    service = Service(device, sessions)
    sql_threads = []
    engine = sessions.kw["bind"]

    def observe_sql(*args):
        sql_threads.append(threading.get_ident())

    event.listen(engine, "before_cursor_execute", observe_sql)

    async def scenario():
        event_loop_thread = threading.get_ident()
        await service.poll()
        await service.verify("target_humidity", 55, True)
        await service.enqueue("power", True)
        await service.shutdown()
        assert sql_threads
        assert event_loop_thread not in sql_threads

    try:
        asyncio.run(scenario())
    finally:
        event.remove(engine, "before_cursor_execute", observe_sql)


def test_default_settings_do_not_share_mutable_notifications(sessions):
    with sessions() as session:
        first = read_settings(session)
        first["notifications"]["categories"].append("private-test-category")
        second = read_settings(session)
        assert "private-test-category" not in second["notifications"]["categories"]
