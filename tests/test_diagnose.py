import json
from types import SimpleNamespace
import unittest

from diagnose import collect, validate_config

CONFIG = {'ip': '192.168.1.5', 'token': 'a' * 32}


class InfoDevice:
    def __init__(self, *args, **kwargs):
        pass

    def info(self):
        return SimpleNamespace(model='zhimi.humidifier.ca7', firmware_version='test', hardware_version='test')


class GoodDevice(InfoDevice):
    def status(self):
        return SimpleNamespace(data={'environment:relative-humidity': 45, 'humidifier:on': False})

    def sensors(self):
        return {}

    def settings(self):
        return {}

    def actions(self):
        return {}


class DiagnosticTests(unittest.TestCase):
    def test_repeated_read_accepts_power_off_and_excludes_credentials(self):
        pauses = []
        result = collect(CONFIG, 3, 5, InfoDevice, GoodDevice, pauses.append)
        self.assertTrue(result['result']['passed'])
        self.assertEqual(pauses, [5, 5])
        serialized = json.dumps(result)
        self.assertNotIn(CONFIG['token'], serialized)
        self.assertNotIn(CONFIG['ip'], serialized)

    def test_missing_humidity_does_not_pass(self):
        class NoHumidity(GoodDevice):
            def status(self):
                return SimpleNamespace(data={'humidifier:on': True})
        result = collect(CONFIG, 1, 0, InfoDevice, NoHumidity)
        self.assertFalse(result['result']['passed'])

    def test_intermittent_timeout_does_not_pass_or_leak_error(self):
        class Unstable(GoodDevice):
            calls = 0

            def status(self):
                self.calls += 1
                if self.calls == 2:
                    raise TimeoutError(CONFIG['token'])
                return super().status()
        result = collect(CONFIG, 3, 0, InfoDevice, Unstable, lambda _: None)
        self.assertFalse(result['result']['passed'])
        self.assertEqual(len(result['samples']), 3)
        self.assertNotIn(CONFIG['token'], json.dumps(result))

    def test_invalid_token_rejected(self):
        with self.assertRaises(ValueError):
            validate_config({'ip': CONFIG['ip'], 'token': 'invalid'})


if __name__ == '__main__':
    unittest.main()
