"""Types at JSON and device boundaries.

JSON objects are dynamic because their schemas are defined by the generated DTOs.
Application collaborators use explicit interfaces instead of importing CLI code.
"""

from typing import Any, Protocol

type JsonObject = dict[str, Any]


class Device(Protocol):
    metadata: dict[str, str | None]

    def read(self) -> JsonObject: ...

    def write(self, name: str, value: object) -> None: ...
