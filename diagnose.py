"""Read-only miIO/MIoT diagnostics. No setters or device actions are invoked."""
import argparse
from datetime import datetime, timezone
from getpass import getpass
from importlib.metadata import version
import ipaddress
import json
import logging
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / 'device.local.json'
EXPECTED_MODEL = 'zhimi.humidifier.ca7'


class PairingError(Exception):
    """Contains only a locally constructed, safe diagnostic message."""


def safe_login_event(response):
    """Allowlist HTTP/API codes and challenge flags; never retain raw responses."""
    event = {'http_status': response.status_code}
    try:
        data = json.loads(response.text.removeprefix('&&&START&&&'))
    except (ValueError, TypeError):
        return event
    if not isinstance(data, dict):
        return event
    code = data.get('code')
    if type(code) is int:
        event['api_code'] = code
    for key in ('notificationUrl', 'captchaUrl'):
        if data.get(key):
            event[key + '_present'] = True
    return event


def cloud_devices(username, password, locale):
    from miio.cloud import CloudInterface
    from micloud import MiCloud
    from micloud.miutils import get_session

    class ObservedCloud(CloudInterface):
        def _login(self):
            if self._micloud is not None:
                return
            client = MiCloud(username=self.username, password=self.password)
            client.session = get_session()
            events = []

            def observe(response, **kwargs):
                events.append(safe_login_event(response))

            client.session.hooks['response'].append(observe)
            try:
                try:
                    success = client.login()
                except Exception:
                    success = False
                if not success:
                    summary = json.dumps(events) if events else 'No HTTP response received (network/TLS/proxy or client error).'
                    raise PairingError(
                        'Xiaomi login failed before device lookup. Safe login responses: ' + summary +
                        '\nIf a challenge flag is present, Xiaomi requires additional verification unsupported by this login flow.' +
                        '\nOtherwise verify password login at https://account.xiaomi.com using the same account; numeric Xiaomi Account ID can also be used as the login.' +
                        '\nChanging ru/de will not fix this login stage. Do not enable raw debug logging.'
                    )
                self._micloud = client
            finally:
                client.session.hooks['response'].remove(observe)

    return ObservedCloud(username, password).get_devices(locale=locale)


def validate_config(data):
    ip = str(ipaddress.IPv4Address(data['ip']))
    token = data['token'].strip()
    if not re.fullmatch(r'[0-9a-fA-F]{32}', token):
        raise ValueError('Token must contain exactly 32 hexadecimal characters')
    return {'ip': ip, 'token': token}


def save_config(data):
    data = validate_config(data)
    if CONFIG.exists():
        raise ValueError('device.local.json already exists; edit it locally or rename it first')
    # Exclusive creation prevents an accidental overwrite of existing credentials.
    with CONFIG.open('x', encoding='utf-8') as stream:
        json.dump(data, stream, indent=2)
    print('Saved device.local.json (excluded from Git). Token is not printed.')


def pair():
    from miio.cloud import CloudInterface
    username = input('Xiaomi account: ').strip()
    password = getpass('Xiaomi password (hidden): ')
    locale = input('Region [de/ru/cn/sg/us/i2/all]: ').strip().lower()
    if locale not in CloudInterface.available_locales():
        raise ValueError('Unknown region; use the region configured in Mi Home')
    devices = cloud_devices(username, password, locale)
    candidates = [d for d in devices.values() if not d.parent_id and 'humidifier' in d.model]
    if not candidates:
        raise ValueError('No humidifier found. Check account and Mi Home region')
    for index, device in enumerate(candidates, 1):
        print(f'{index}. {device.model} (expected model: {device.model == EXPECTED_MODEL})')
    choice = int(input('Device number: '))
    if not 1 <= choice <= len(candidates):
        raise ValueError('Invalid device number')
    selected = candidates[choice - 1]
    save_config({'ip': selected.ip, 'token': selected.token})


def error_details(exc, stage):
    # Do not include raw exception messages: upstream may include credentials/packets.
    kind = type(exc).__name__
    if isinstance(exc, (TimeoutError, OSError)) or kind in ('DeviceException', 'DiscoveryException'):
        category = 'connection_or_authentication'
        hint = 'Check router IP, current token, same subnet, UDP 54321 and Wi-Fi client isolation. A timeout alone cannot distinguish an invalid token from blocked traffic.'
    else:
        category = 'spec_or_protocol' if stage != 'info' else 'device_info'
        hint = 'Check installed python-miio version, model specification access and supported commands.'
    return {'stage': stage, 'category': category, 'exception_type': kind, 'hint': hint}


def describe(descriptors):
    return [
        {'id': d.id, 'name': d.name, 'access': str(d.access), 'unit': d.unit}
        for d in descriptors.values()
    ]


def evaluate(samples, expected):
    def present(values, name):
        return any(key.endswith(':' + name) and values[key] is not None for key in values)
    complete = len(samples) == expected and all(s['ok'] for s in samples)
    humidity = complete and all(present(s['values'], 'relative-humidity') for s in samples)
    power = complete and all(present(s['values'], 'on') for s in samples)
    return {'stable_reads': complete, 'humidity_available': humidity,
            'power_available': power, 'passed': bool(complete and humidity and power)}


def collect(config, count, interval, device_cls, generic_cls, sleep=time.sleep):
    report = {'created_utc': datetime.now(timezone.utc).isoformat(),
              'read_only': True, 'cloud_independence_tested': False,
              'samples': [], 'errors': []}
    try:
        info = device_cls(config['ip'], config['token'], timeout=5).info()
        report['device'] = {'model': info.model, 'firmware': info.firmware_version,
                            'hardware': info.hardware_version,
                            'matches_expected_model': info.model == EXPECTED_MODEL}
    except Exception as exc:
        report['errors'].append(error_details(exc, 'info'))
        report['result'] = evaluate([], count)
        return report
    device = generic_cls(config['ip'], config['token'], model=info.model, timeout=5)
    for index in range(count):
        sample = {'at_utc': datetime.now(timezone.utc).isoformat(), 'ok': False, 'values': {}}
        try:
            status = device.status()
            sample['values'] = dict(status.data)
            sample['ok'] = bool(sample['values'])
            if 'capabilities' not in report:
                report['capabilities'] = {'properties': describe({**dict(device.sensors()), **dict(device.settings())}),
                                          'actions': describe(device.actions()),
                                          'source': 'MIoT specification; writes/actions NOT tested'}
        except Exception as exc:
            report['errors'].append(error_details(exc, 'status'))
        report['samples'].append(sample)
        if index + 1 < count:
            sleep(interval)
    report['result'] = evaluate(report['samples'], count)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['pair', 'configure', 'check'])
    parser.add_argument('--samples', type=int, default=3)
    parser.add_argument('--interval', type=float, default=5)
    args = parser.parse_args()
    if not 1 <= args.samples <= 20 or not 0 <= args.interval <= 60:
        parser.error('samples must be 1..20; interval must be 0..60 seconds')
    # Suppress upstream logging that can expose tokens, account or LAN identifiers.
    logging.disable(logging.CRITICAL)
    try:
        if args.command in ('pair', 'configure') and CONFIG.exists():
            raise ValueError('device.local.json already exists; edit it locally or rename it first')
        if args.command == 'pair':
            pair()
            return 0
        if args.command == 'configure':
            save_config({'ip': input('Device IPv4: ').strip(), 'token': getpass('miIO token (hidden): ')})
            return 0
        config = validate_config(json.loads(CONFIG.read_text(encoding='utf-8-sig')))
        from miio import Device
        from miio.integrations.genericmiot.genericmiot import GenericMiot
        report = collect(config, args.samples, args.interval, Device, GenericMiot)
        report['python_miio_version'] = version('python-miio')
        report['python_version'] = sys.version.split()[0]
        reports = ROOT / 'reports'
        reports.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        path = reports / f'diagnostic-{stamp}.json'
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report['result'], indent=2))
        print(f'Report: {path}')
        return 0 if report['result']['passed'] else 2
    except PairingError as exc:
        print(str(exc), file=sys.stderr)
    except FileNotFoundError:
        print('Configuration missing. Run pair or configure first.', file=sys.stderr)
    except (ValueError, KeyError):
        print('Invalid configuration, region or device selection. Check README and local settings.', file=sys.stderr)
    except ImportError:
        print('Dependencies missing. Run setup.ps1 first.', file=sys.stderr)
    except Exception as exc:
        print(f'Failed ({type(exc).__name__}). Check network/account; no raw error printed to protect credentials.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
