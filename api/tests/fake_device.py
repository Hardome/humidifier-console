"""Тестовое устройство без сетевого доступа."""

from api.app.device import FIELDS, validate_command
from api.app.device_config import MODEL
from api.app.types import JsonObject


class FakeDevice:
    """Подмена устройства только для автоматических тестов."""

    def __init__(self) -> None:
        self.metadata: dict[str, str | None] = {"model": MODEL, "firmware": "test", "hardware": "test"}
        self.values: JsonObject = dict(
            zip(
                FIELDS,
                [False, 3, 50, 0, 1, True, 1, 45, 23.5, 1, False, False, 0, 44, False, 30, 2, 0],
                strict=True,
            )
        )

    def read(self) -> JsonObject:
        return dict(self.values)

    def write(self, name: str, value: object) -> None:
        validate_command(name, value)
        if name == "cycle_mode":
            self.values["mode"] = {2: 3, 3: 4, 4: 2}[self.values["mode"]]
        else:
            self.values[name] = value
        self.values["status"] = 4 if self.values["clean"] else 2 if self.values["power"] else 1
