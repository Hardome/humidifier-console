import json
import unittest
from types import SimpleNamespace

from diagnose import collect, safe_login_event, validate_config

CONFIG = {"ip": "192.168.1.5", "token": "a" * 32}


class InfoDevice:
    def __init__(self, *args, **kwargs):
        pass

    def info(self):
        return SimpleNamespace(model="zhimi.humidifier.ca7", firmware_version="test", hardware_version="test")


class GoodDevice(InfoDevice):
    def status(self):
        return SimpleNamespace(data={"environment:relative-humidity": 45, "humidifier:on": False})

    def sensors(self):
        return {}

    def settings(self):
        return {}

    def actions(self):
        return {}


class DiagnosticTests(unittest.TestCase):
    def test_login_event_excludes_secrets_and_exposes_challenge(self):
        response = SimpleNamespace(
            status_code=200,
            text="&&&START&&&"
            + json.dumps(
                {
                    "code": 0,
                    "notificationUrl": "https://example.com/?token=secret",
                    "ssecurity": "secret",
                    "userId": "private",
                    "description": "secret",
                }
            ),
        )
        event = safe_login_event(response)
        self.assertEqual(event, {"http_status": 200, "api_code": 0, "notificationUrl_present": True})
        self.assertNotIn("secret", json.dumps(event))

    def test_login_event_handles_non_json(self):
        self.assertEqual(
            safe_login_event(SimpleNamespace(status_code=502, text="secret")), {"http_status": 502}
        )

    def test_repeated_read_accepts_power_off_and_excludes_credentials(self):
        pauses: list[float] = []
        result = collect(CONFIG, 3, 5, InfoDevice, GoodDevice, pauses.append)
        self.assertTrue(result["result"]["passed"])
        self.assertEqual(pauses, [5, 5])
        serialized = json.dumps(result)
        self.assertNotIn(CONFIG["token"], serialized)
        self.assertNotIn(CONFIG["ip"], serialized)

    def test_missing_humidity_does_not_pass(self):
        class NoHumidity(GoodDevice):
            def status(self):
                return SimpleNamespace(data={"humidifier:on": True})

        result = collect(CONFIG, 1, 0, InfoDevice, NoHumidity)
        self.assertFalse(result["result"]["passed"])

    def test_intermittent_timeout_does_not_pass_or_leak_error(self):
        class Unstable(GoodDevice):
            calls = 0

            def status(self):
                self.calls += 1
                if self.calls == 2:
                    raise TimeoutError(CONFIG["token"])
                return super().status()

        result = collect(CONFIG, 3, 0, InfoDevice, Unstable, lambda _: None)
        self.assertFalse(result["result"]["passed"])
        self.assertEqual(len(result["samples"]), 3)
        self.assertNotIn(CONFIG["token"], json.dumps(result))

    def test_invalid_token_rejected(self):
        with self.assertRaises(ValueError):
            validate_config({"ip": CONFIG["ip"], "token": "invalid"})


if __name__ == "__main__":
    unittest.main()
