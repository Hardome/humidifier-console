"""The only LAN boundary. No runtime cloud/spec discovery and no raw protocol API."""

from __future__ import annotations

import json
import math
import threading
from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from miio.integrations.genericmiot.genericmiot import GenericMiot

from .device_config import MODEL, validate_config
from .generated.models import Values
from .types import Device, JsonObject

SPEC = json.loads((Path(__file__).parent / "spec" / f"{MODEL}.json").read_text(encoding="utf-8"))
FIELDS = {
    "power": (2, 1),
    "mode": (2, 3),
    "target_humidity": (2, 5),
    "fault": (2, 2),
    "water_code": (2, 6),
    "auto_dry": (2, 9),
    "status": (2, 11),
    "humidity": (3, 1),
    "temperature": (3, 2),
    "brightness": (6, 2),
    "sound": (7, 1),
    "child_lock": (8, 1),
    "speed": (10, 1),
    "country_code": (10, 2),
    "clean": (10, 3),
    "clean_minutes": (10, 4),
    "level": (10, 5),
    "clean_end_display": (10, 6),
}
WRITABLE = {
    "power",
    "mode",
    "target_humidity",
    "auto_dry",
    "brightness",
    "sound",
    "child_lock",
    "clean",
    "level",
    "clean_end_display",
}
BOOLS = {"power", "auto_dry", "sound", "child_lock", "clean"}
RANGES = {
    "mode": (2, 4),
    "target_humidity": (30, 60),
    "brightness": (0, 2),
    "level": (0, 5),
    "clean_end_display": (0, 1),
}


class DeviceFailure(Exception):
    def __init__(self, code: str = "lan_or_token") -> None:
        self.code = code
        super().__init__(code)


def validate_command(name: str, value: object) -> None:
    if name == "cycle_mode" and value is None:
        return
    if name not in WRITABLE:
        raise ValueError("command_not_allowed")
    if name in BOOLS:
        if type(value) is not bool:
            raise ValueError("boolean_required")
    elif type(value) is not int or not RANGES[name][0] <= value <= RANGES[name][1]:
        raise ValueError("value_out_of_range")


class LanDevice:
    def __init__(self, config: Mapping[str, str]) -> None:
        from miio import MiotDevice

        credentials = validate_config(config)
        # После перезапуска прибора часы сбрасываются: перед запросом обновляем сессию.
        self.device = MiotDevice(
            credentials["ip"], credentials["token"], model=MODEL, timeout=5, lazy_discover=False
        )
        # A lost write response must never cause an automatic duplicate write.
        self.device.retry_count = 0
        self.lock = threading.RLock()
        self.metadata = {"model": MODEL, "firmware": None, "hardware": None}
        self.model_checked = False

    def read(self) -> JsonObject:
        with self.lock:
            try:
                if not self.model_checked:
                    info = self.device.info()
                    if info.model != MODEL:
                        raise DeviceFailure("specification")
                    self.metadata = {
                        "model": info.model,
                        "firmware": info.firmware_version,
                        "hardware": info.hardware_version,
                    }
                    self.model_checked = True
                result = self.device.get_properties(
                    [{"did": name, "siid": ids[0], "piid": ids[1]} for name, ids in FIELDS.items()],
                    property_getter="get_properties",
                    max_properties=10,
                )
                data = {}
                for prop in result:
                    if prop.get("code", 0) != 0 or "value" not in prop:
                        raise DeviceFailure("specification")
                    name = prop.get("did")
                    if name not in FIELDS:
                        name = next(
                            (k for k, v in FIELDS.items() if v == (prop.get("siid"), prop.get("piid"))), None
                        )
                    if name:
                        data[name] = prop["value"]
                if set(data) != set(FIELDS) or not all(
                    type(data[k]) in (int, float) and math.isfinite(data[k])
                    for k in ("humidity", "temperature")
                ):
                    raise DeviceFailure("specification")
                try:
                    return Values.model_validate(data).model_dump()
                except ValueError:
                    raise DeviceFailure("specification") from None
            except DeviceFailure:
                raise
            except Exception:
                raise DeviceFailure() from None

    def write(self, name: str, value: object) -> None:
        validate_command(name, value)
        with self.lock:
            try:
                if name == "cycle_mode":
                    result = self.device.call_action_by(10, 1)
                    result = [result] if isinstance(result, dict) else result
                else:
                    siid, piid = FIELDS[name]
                    result = self.device.set_property_by(siid, piid, value)
                if not result or any(p.get("code", 0) != 0 for p in result):
                    raise DeviceFailure("command_rejected")
            except DeviceFailure:
                raise
            except Exception:
                # A lost reply cannot prove whether the write happened.
                raise DeviceFailure("result_unknown") from None


class MissingDevice:
    def __init__(self) -> None:
        self.metadata: dict[str, str | None] = {"model": MODEL, "firmware": None, "hardware": None}

    def read(self) -> JsonObject:
        raise DeviceFailure("configuration")

    def write(self, name: str, value: object) -> None:
        raise DeviceFailure("configuration")


def create_device(path: Path) -> Device:
    try:
        return LanDevice(json.loads(path.read_text(encoding="utf-8-sig")))
    except (OSError, ValueError, KeyError):
        return MissingDevice()


def offline_diagnostic_class() -> type[GenericMiot]:
    """The CLI shares the bundled model and transport policy with the web adapter."""
    from miio.integrations.genericmiot.genericmiot import GenericMiot
    from miio.miot_models import DeviceModel

    class OfflineMiot(GenericMiot):
        retry_count = 0

        def initialize_model(self) -> None:
            if self._miot_model is None:
                if self.model != MODEL:
                    raise DeviceFailure("specification")
                self._miot_model = DeviceModel.model_validate(SPEC)
                self._create_descriptors()

    return OfflineMiot
