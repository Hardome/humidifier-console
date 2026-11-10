"""Shared device identity and credential validation for the API and CLI."""

import ipaddress
import re
from collections.abc import Mapping
from typing import TypedDict

MODEL = "zhimi.humidifier.ca7"


class DeviceConfig(TypedDict):
    ip: str
    token: str


def validate_config(data: Mapping[str, str]) -> DeviceConfig:
    """Normalize credentials without ever including them in error messages."""
    if not isinstance(data, Mapping) or not all(isinstance(data.get(key), str) for key in ("ip", "token")):
        raise ValueError("Invalid device configuration")
    address = str(ipaddress.IPv4Address(data["ip"]))
    token = data["token"].strip()
    if not re.fullmatch(r"[0-9a-fA-F]{32}", token):
        raise ValueError("Token must contain exactly 32 hexadecimal characters")
    return {"ip": address, "token": token}
