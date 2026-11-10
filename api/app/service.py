import asyncio
import logging
from collections.abc import Callable, Coroutine
from contextlib import suppress
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from .capabilities import CapabilityStore
from .command_store import CommandStore
from .db import (
    Command,
    Delivery,
    Event,
    Measurement,
    Rule,
    Setting,
    identifier,
    read_settings,
    utcnow,
    write_settings,
)
from .device import DeviceFailure, validate_command
from .events import EventRecorder
from .measurements import Measurements
from .notifications import Notifications
from .notifications import send_telegram as send_telegram
from .scheduler import aware, due_rules
from .types import Device, JsonObject


class Service:
    """Coordinate device operations; every physical read/write shares one lock."""

    def __init__(self, device: Device, sessions: sessionmaker[OrmSession]) -> None:
        self.device = device
        self.sessions = sessions
        self.lock = asyncio.Lock()
        self.state: JsonObject | None = None
        self.measured_at: datetime | None = None
        self.failures = 0
        self.error: str | None = None
        self.db_ok = True
        self.started_at = utcnow()
        self.disconnected_at: datetime | None = None
        self.measurements = Measurements()
        self.events = EventRecorder()
        self.last_cleanup: datetime | None = None
        self.tasks: set[asyncio.Task[None]] = set()
        self.stop = asyncio.Event()
        self.last_switch: datetime | None = None

    @property
    def stale(self) -> bool:
        return self.failures > 0 or not self.measured_at or (utcnow() - self.measured_at).total_seconds() > 30

    @property
    def values(self) -> JsonObject:
        if self.state is None:
            raise DeviceFailure("stale_state")
        return self.state

    def snapshot(self) -> JsonObject:
        return {
            "online": self.failures < 3 and self.measured_at is not None,
            "stale": self.stale,
            "measured_at": self.measured_at,
            "values": self.state,
            "device": self.device.metadata,
            "database_ok": self.db_ok,
            "error": self.error,
        }

    def diagnostics(self) -> JsonObject:
        with self.sessions() as session:
            try:
                session.execute(text("SELECT 1"))
                self.db_ok = True
            except SQLAlchemyError:
                self.db_ok = False
        return {
            "device": self.device.metadata,
            "error": self.error,
            "database_ok": self.db_ok,
            "consecutive_failures": self.failures,
            "specification": "bundled:zhimi.humidifier.ca7",
            "cloud_independence_tested": False,
        }

    async def poll(self, source: str = "external") -> None:
        async with self.lock:
            await self._poll(source)

    async def _poll(self, source: str = "external") -> None:
        now = utcnow()
        try:
            values = await asyncio.to_thread(self.device.read)
        except DeviceFailure as exc:
            self.failures += 1
            self.error = exc.code
            if not self.disconnected_at:
                self.disconnected_at = now
            return
        previous = self.state
        previous_at = self.measured_at
        self.measurements.observe_power(previous, previous_at, now, self.failures)
        self.state = values
        self.measured_at = now
        self.failures = 0
        self.error = None
        await asyncio.to_thread(self._record_poll, previous, values, now, source)

    def _record_poll(
        self, previous: JsonObject | None, values: JsonObject, now: datetime, source: str
    ) -> None:
        try:
            with self.sessions.begin() as session:
                if not previous or self.disconnected_at:
                    session.merge(
                        Setting(key="growth", value={"at": now.isoformat(), "humidity": values["humidity"]})
                    )
                if self.disconnected_at:
                    alert = session.get(Setting, "alert:connection")
                    if alert and alert.value.get("active"):
                        self.events.alert(session, "connection", False, "Связь восстановлена", now)
                    self.disconnected_at = None
                if previous:
                    changes = {
                        k: {"before": previous[k], "after": values[k]}
                        for k in values
                        if k not in {"humidity", "temperature", "speed", "clean_minutes"}
                        and previous.get(k) != values[k]
                    }
                    if changes:
                        self.events.event(session, "state", "Изменение состояния прибора", source, changes)
                    if values["power"] != previous["power"]:
                        self.last_switch = now
                        session.merge(Setting(key="last_switch", value={"at": now.isoformat()}))
                    if previous["status"] == 4 and values["status"] != 4:
                        self.events.event(session, "cleaning", "Очистка завершена", source)
                self.events.alert(
                    session,
                    "fault",
                    values["fault"] != 0,
                    f"Код ошибки: {values['fault']}" if values["fault"] else "Ошибка устранена",
                    now,
                )
                self.measurements.aggregate(session, values, now)
                self.events.diagnostics(session, values, now)
            self.db_ok = True
        except SQLAlchemyError:
            self.db_ok = False

    def capabilities(self, session: OrmSession) -> list[JsonObject]:
        return CapabilityStore(self.sessions, self.events).describe(session)

    def allowed(self, session: OrmSession, name: str) -> bool:
        return CapabilityStore(self.sessions, self.events).allowed(session, name)

    async def enqueue(self, name: str, value: object, source: str = "panel") -> Command:
        command = await asyncio.to_thread(self._enqueue, name, value, source)
        self.spawn(self.execute(command.id))
        return command

    def _enqueue(self, name: str, value: object, source: str = "panel") -> Command:
        validate_command(name, value)
        if self.stale:
            raise ValueError("stale_state")
        with self.sessions.begin() as session:
            if session.get(Setting, "verification_restore"):
                raise ValueError("restoration_pending")
            if not self.allowed(session, name):
                raise ValueError("capability_unverified")
            command = Command(id=identifier(), name=name, value={"value": value}, source=source)
            session.add(command)
            if source in {"panel", "api"}:
                settings = read_settings(session)
                settings["pause_until"] = (
                    utcnow() + timedelta(minutes=settings["manual_pause_minutes"])
                ).isoformat()
                write_settings(session, settings)
        return command

    def spawn(self, coroutine: Coroutine[Any, Any, None]) -> None:
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        task.add_done_callback(self._task_finished)

    def _task_finished(self, task: asyncio.Task[None]) -> None:
        self.tasks.discard(task)
        if not task.cancelled() and task.exception() is not None:
            logging.getLogger(__name__).error(
                "Background command failed", extra={"error_type": type(task.exception()).__name__}
            )

    async def readback(self, source: str, matches: Callable[[JsonObject], bool]) -> None:
        # Firmware may acknowledge a write before its readable state changes.
        # Repeat only reads, never the write or action with an ambiguous result.
        for attempt in range(4):
            await self._poll(source)
            if self.stale or matches(self.values):
                return
            if attempt < 3:
                await asyncio.sleep(0.5)

    async def execute(self, command_id: str) -> None:
        async with self.lock:
            try:
                command = await asyncio.to_thread(CommandStore(self.sessions, self.events).claim, command_id)
                if command is None:
                    return
                if self.stale:
                    raise DeviceFailure("stale_state")
                await asyncio.to_thread(self.device.write, command.name, command.value["value"])
                before = self.values["mode"] if command.name == "cycle_mode" else None
                await self.readback(
                    command.source,
                    lambda state: (
                        state["mode"] in {2, 3, 4} and state["mode"] != before
                        if command.name == "cycle_mode"
                        else state[command.name] == command.value["value"]
                    ),
                )
                if self.stale:
                    raise DeviceFailure("result_unknown")
                actual = self.values["mode" if command.name == "cycle_mode" else command.name]
                matches = (
                    actual in {2, 3, 4} and actual != before
                    if command.name == "cycle_mode"
                    else actual == command.value["value"]
                )
                status, error = ("confirmed", None) if matches else ("failed", "readback_mismatch")
            except DeviceFailure as exc:
                status = "unknown" if exc.code == "result_unknown" else "failed"
                error = exc.code
                if status == "unknown" and command is not None:
                    await self._poll(command.source)
            except SQLAlchemyError:
                self.db_ok = False
                return
            if command is None:
                return
            try:
                await asyncio.to_thread(
                    CommandStore(self.sessions, self.events).complete, command, status, error
                )
            except SQLAlchemyError:
                self.db_ok = False

    async def verify(self, name: str, value: object, observed: bool) -> bool:
        validate_command(name, value)
        if not observed:
            raise ValueError("owner_observation_required")
        async with self.lock:
            await self._poll()
            if self.stale:
                raise ValueError("stale_state")
            property_name = "mode" if name == "cycle_mode" else name
            original = self.values[property_name]
            if name != "cycle_mode" and value == original:
                raise ValueError("choose_different_value")
            # Durable restoration intent before touching the physical device.
            store = CapabilityStore(self.sessions, self.events)
            await asyncio.to_thread(store.begin, property_name, original)
            confirmed = False
            try:
                await asyncio.to_thread(self.device.write, name, value)
                await self.readback(
                    "panel",
                    lambda state: (
                        state["mode"] in {2, 3, 4} and state["mode"] != original
                        if name == "cycle_mode"
                        else state[property_name] == value
                    ),
                )
                actual = self.values[property_name]
                matches = (
                    actual in {2, 3, 4} and actual != original if name == "cycle_mode" else actual == value
                )
                confirmed = not self.stale and matches
            finally:
                await asyncio.to_thread(self.device.write, property_name, original)
                await self.readback("panel", lambda state: state[property_name] == original)
                if self.stale or self.values[property_name] != original:
                    raise ValueError("restoration_pending")
                await asyncio.to_thread(store.clear)
            await asyncio.to_thread(store.finish, name, confirmed)
            return confirmed

    async def restore(self, observed: bool) -> bool:
        if not observed:
            raise ValueError("owner_observation_required")
        async with self.lock:
            store = CapabilityStore(self.sessions, self.events)
            intent = await asyncio.to_thread(store.intent)
            if intent is None:
                return True
            await asyncio.to_thread(self.device.write, intent["name"], intent["value"])
            await self.readback("panel", lambda state: state[intent["name"]] == intent["value"])
            if self.stale or self.values[intent["name"]] != intent["value"]:
                raise ValueError("restoration_pending")
            await asyncio.to_thread(store.restored)
            return True

    async def tick(self) -> None:
        for command_id in await asyncio.to_thread(self._scheduled_commands):
            self.spawn(self.execute(command_id))

    def _scheduled_commands(self) -> list[str]:
        now = utcnow()
        try:
            with self.sessions.begin() as session:
                if self.disconnected_at and (now - self.disconnected_at).total_seconds() >= 60:
                    self.events.alert(
                        session, "connection", True, "Нет связи с увлажнителем более минуты", now
                    )
                settings = read_settings(session)
                restore = session.get(Setting, "verification_restore")
                if restore:
                    # Restoration is a single explicit write, then readback; never retry ambiguous actions.
                    return []
                if self.stale:
                    return []
                timer = settings.get("off_timer")
                if timer and aware(timer) <= now:
                    if self.allowed(session, "power"):
                        command = Command(
                            id=identifier(), name="power", value={"value": False}, source="schedule"
                        )
                        session.add(command)
                        settings["off_timer"] = None
                        write_settings(session, settings)
                        session.flush()
                        cid = command.id
                    else:
                        cid = None
                    decisions = []
                else:
                    cid = None
                    last = session.get(Setting, "last_switch")
                    decisions = due_rules(
                        session.scalars(select(Rule).where(Rule.kind != "scene")).all(),
                        settings,
                        self.state,
                        now,
                        self.started_at,
                        last.value["at"] if last else None,
                    )
                pending = session.scalar(select(Command).where(Command.status.in_(["pending", "running"])))
                ids = []
                if not pending:
                    for rule, actions in decisions:
                        if not all(self.allowed(session, a["name"]) for a in actions):
                            continue
                        rule.last_run = now
                        for action in actions:
                            command = Command(
                                id=identifier(),
                                name=action["name"],
                                value={"value": action["value"]},
                                source=rule.kind,
                            )
                            session.add(command)
                            ids.append(command.id)
            self.db_ok = True
            return ([cid] if cid else []) + ids
        except SQLAlchemyError:
            self.db_ok = False
        return []

    async def deliver(self) -> None:
        if not await Notifications(self.sessions).deliver(send_telegram):
            self.db_ok = False

    async def maintenance(self) -> None:
        await asyncio.to_thread(self._maintenance)

    def _maintenance(self) -> None:
        now = utcnow()
        if self.last_cleanup and now - self.last_cleanup < timedelta(hours=1):
            return
        try:
            with self.sessions.begin() as session:
                cutoff = now - timedelta(days=read_settings(session)["retention_days"])
                for model, col in [
                    (Delivery, Delivery.at),
                    (Measurement, Measurement.at),
                    (Event, Event.at),
                    (Command, Command.at),
                ]:
                    session.execute(delete(model).where(col < cutoff))
            self.last_cleanup = now
        except SQLAlchemyError:
            self.db_ok = False

    async def run(self) -> None:
        while not self.stop.is_set():
            started = asyncio.get_running_loop().time()
            await self.poll()
            await self.tick()
            await self.maintenance()
            with suppress(TimeoutError):
                await asyncio.wait_for(
                    self.stop.wait(), timeout=max(0.1, 10 - (asyncio.get_running_loop().time() - started))
                )

    async def notification_loop(self) -> None:
        while not self.stop.is_set():
            await self.deliver()
            with suppress(TimeoutError):
                await asyncio.wait_for(self.stop.wait(), timeout=2)

    async def shutdown(self) -> None:
        self.stop.set()
        pending = list(self.tasks)
        if pending:
            try:
                async with asyncio.timeout(30):
                    await asyncio.gather(*pending, return_exceptions=True)
            except TimeoutError:
                for task in pending:
                    task.cancel()
                await asyncio.gather(*pending, return_exceptions=True)
        await asyncio.to_thread(self._flush_measurements)

    def _flush_measurements(self) -> None:
        if self.measurements.samples:
            with suppress(SQLAlchemyError), self.sessions.begin() as session:
                self.measurements.flush_samples(session)
