"""Command transactions. Sessions never escape the worker that owns them."""

from sqlalchemy import update
from sqlalchemy.orm import Session, sessionmaker

from .db import Command
from .errors import ConfigurationError
from .events import EventRecorder
from .serialization import record
from .types import JsonObject


class CommandStore:
    def __init__(self, sessions: sessionmaker[Session], events: EventRecorder) -> None:
        self.sessions = sessions
        self.events = events

    def claim(self, command_id: str) -> Command | None:
        with self.sessions.begin() as session:
            # Один атомарный переход исключает повторное выполнение команды.
            return session.scalar(
                update(Command)
                .where(Command.id == command_id, Command.status == "pending")
                .values(status="running")
                .returning(Command)
            )

    def complete(self, command: Command, status: str, error: str | None) -> None:
        with self.sessions.begin() as session:
            row = session.get(Command, command.id)
            if row is None:
                return
            row.status = status
            row.error = error
            self.events.event(
                session,
                "command_unknown" if status == "unknown" else "command",
                f"{command.name}: {status}",
                command.source,
                {"command_id": command.id, "error": error},
            )

    def get(self, command_id: str) -> JsonObject:
        with self.sessions() as session:
            command = session.get(Command, command_id)
            if command is None:
                raise ConfigurationError(404, "command_not_found")
            return record(command)
