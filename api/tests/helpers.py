from types import SimpleNamespace

from api.app.db import Setting


def allow(sessions, *names):
    with sessions.begin() as session:
        session.merge(Setting(key="capabilities", value=dict.fromkeys(names, "verified")))


def rule(id, kind="automation", **config):
    return SimpleNamespace(id=id, kind=kind, priority=0, enabled=True, config=config, last_run=None)


def scheduler_settings():
    return {"timezone": "Asia/Yekaterinburg", "minimum_switch_seconds": 300, "pause_until": None}
