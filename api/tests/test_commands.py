import asyncio
from typing import Any

import pytest

from api.app.db import Command, Setting, read_settings
from api.app.device import DeviceFailure, validate_command
from api.app.service import Service
from api.tests.helpers import allow


def test_duplicate_execution_does_not_repeat_device_write(sessions, device):
    allow(sessions, "power")
    service = Service(device, sessions)
    writes = []
    original = device.write

    def counted(name, value):
        writes.append((name, value))
        original(name, value)

    device.write = counted

    async def scenario():
        await service.poll()
        command = service._enqueue("power", True)

        await asyncio.gather(service.execute(command.id), service.execute(command.id))
        await service.execute(command.id)

        assert writes == [("power", True)]
        with sessions() as session:
            assert session.get(Command, command.id).status == "confirmed"

    asyncio.run(scenario())


def test_cached_state_never_polls_device(client, device):
    count = 0
    original = device.read

    def counted():
        nonlocal count
        count += 1
        return original()

    device.read = counted
    for _ in range(10):
        response = client.get("/api/v1/state")
        assert response.status_code == 200
    assert count == 0
    client.post("/api/v1/state/refresh")
    assert count == 1


@pytest.mark.parametrize(
    "name,value",
    [
        ("raw", 1),
        ("country_code", 86),
        ("power", 1),
        ("mode", True),
        ("mode", 1),
        ("target_humidity", 61),
        ("level", 6),
    ],
)
def test_only_typed_allowlisted_commands(name, value):
    with pytest.raises(ValueError):
        validate_command(name, value)


def test_unverified_command_cannot_touch_device(client):
    response = client.post("/api/v1/commands", json={"name": "power", "value": True})
    assert response.status_code == 409
    assert response.json()["code"] == "capability_unverified"


def test_controlled_verification_restores_original(client, device):
    before = device.read()["target_humidity"]
    response = client.post(
        "/api/v1/capabilities/verify", json={"name": "target_humidity", "value": 55, "observed": True}
    )
    assert response.status_code == 200 and response.json()["verified"]
    assert device.read()["target_humidity"] == before
    assert (
        next(c for c in client.get("/api/v1/capabilities").json()["items"] if c["name"] == "target_humidity")[
            "status"
        ]
        == "verified"
    )


def test_mode_cycle_verification_and_restore(client, device):
    before = device.read()["mode"]
    response = client.post(
        "/api/v1/capabilities/verify", json={"name": "cycle_mode", "value": None, "observed": True}
    )
    assert response.status_code == 200, response.text
    assert device.read()["mode"] == before


def test_mode_cycle_accepts_device_order_instead_of_numeric_order(client, device):
    original_write = device.write

    def physical_order(name, value):
        if name == "cycle_mode":
            device.values["mode"] = {2: 4, 4: 3, 3: 2}[device.values["mode"]]
        else:
            original_write(name, value)

    device.write = physical_order
    before = device.read()["mode"]
    verified = client.post(
        "/api/v1/capabilities/verify", json={"name": "cycle_mode", "value": None, "observed": True}
    )
    assert verified.status_code == 200 and verified.json()["verified"]
    assert device.read()["mode"] == before
    submitted = client.post("/api/v1/commands", json={"name": "cycle_mode", "value": None})
    assert submitted.status_code == 202

    async def finish_command():
        await asyncio.gather(*list(client.app.state.service.tasks))

    client.portal.call(finish_command)
    result = client.get("/api/v1/commands/" + submitted.json()["id"])
    assert result.json()["status"] == "confirmed"
    assert device.read()["mode"] == 2


def test_observation_required(client):
    response = client.post(
        "/api/v1/capabilities/verify", json={"name": "power", "value": True, "observed": False}
    )
    assert response.status_code == 409


def test_delayed_firmware_readback_does_not_repeat_writes(client, device):
    original_read, original_write = device.read, device.write
    pending: list[Any] = []
    writes = []

    def delayed_write(name, value):
        writes.append((name, value))
        pending[:] = [name, value, 2]

    def delayed_read():
        if pending:
            pending[2] -= 1
            if pending[2] == 0:
                original_write(pending[0], pending[1])
                pending.clear()
        return original_read()

    device.write, device.read = delayed_write, delayed_read
    before = device.values["target_humidity"]
    result = client.post(
        "/api/v1/capabilities/verify", json={"name": "target_humidity", "value": 55, "observed": True}
    )
    assert result.status_code == 200 and result.json()["verified"]
    assert device.values["target_humidity"] == before
    assert writes == [("target_humidity", 55), ("target_humidity", before)]
    assert not client.get("/api/v1/settings").json()["restoration_pending"]
    submitted = client.post("/api/v1/commands", json={"name": "target_humidity", "value": 55})
    assert submitted.status_code == 202

    async def finish_command():
        await asyncio.gather(*list(client.app.state.service.tasks))

    client.portal.call(finish_command)
    result = client.get("/api/v1/commands/" + submitted.json()["id"])
    assert result.json()["status"] == "confirmed"
    assert writes == [("target_humidity", 55), ("target_humidity", before), ("target_humidity", 55)]


@pytest.mark.parametrize(
    "failure,expected", [(None, "confirmed"), ("command_rejected", "failed"), ("result_unknown", "unknown")]
)
def test_command_outcomes_are_durable(sessions, device, failure, expected):
    allow(sessions, "power")
    service = Service(device, sessions)
    writes = []
    original = device.write

    def write(name, value):
        writes.append((name, value))
        if failure:
            raise DeviceFailure(failure)
        original(name, value)

    device.write = write

    async def scenario():
        await service.poll()
        command = await service.enqueue("power", True)
        await asyncio.gather(*list(service.tasks))
        return command.id

    cid = asyncio.run(scenario())
    with sessions() as session:
        result = session.get(Command, cid)
        assert result.status == expected
        assert read_settings(session)["pause_until"] is not None
    assert writes == [("power", True)]


def test_offline_after_three_failures_keeps_stale_values(sessions, device):
    service = Service(device, sessions)

    async def scenario():
        await service.poll()
        device.read = lambda: (_ for _ in ()).throw(DeviceFailure())
        for _ in range(3):
            await service.poll()
        assert service.snapshot()["online"] is False
        assert service.snapshot()["stale"] is True
        assert service.snapshot()["values"]["humidity"] == 45

    asyncio.run(scenario())


def test_restoration_intent_blocks_commands_and_can_be_recovered(client, sessions, device):
    allow(sessions, "power")
    with sessions.begin() as session:
        session.add(Setting(key="verification_restore", value={"name": "target_humidity", "value": 45}))
    assert (
        client.post("/api/v1/commands", json={"name": "power", "value": True}).json()["code"]
        == "restoration_pending"
    )
    response = client.post("/api/v1/capabilities/restore", json={"observed": True})
    assert response.status_code == 200
    assert device.read()["target_humidity"] == 45
