"""Isolated, deterministic browser-test server. Never opens the physical device config."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    database = ROOT / ".tmp" / "e2e.db"
    database.parent.mkdir(exist_ok=True)
    os.environ["DATABASE_URL"] = "sqlite:///" + database.as_posix()
    # Браузерные проверки не должны наследовать реальные реквизиты Telegram.
    os.environ.pop("TELEGRAM_BOT_TOKEN", None)
    os.environ.pop("TELEGRAM_CHAT_ID", None)

    from api.app.db import Base, Session, Setting, engine
    from api.app.device import WRITABLE
    from api.app.main import create_app
    from api.tests.fake_device import FakeDevice

    app = create_app(device=FakeDevice())

    # E2E data is disposable and restricted to this explicitly named test database.
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with Session.begin() as session:
        session.merge(Setting(key="capabilities", value=dict.fromkeys(WRITABLE | {"cycle_mode"}, "verified")))

    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8011, access_log=False)


if __name__ == "__main__":
    main()
