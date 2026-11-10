import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.app.db import Base
from api.app.main import create_app
from api.tests.fake_device import FakeDevice


@pytest.fixture
def sessions():
    url = os.getenv("TEST_DATABASE_URL")
    admin = None
    if url:
        schema = "test_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    yield sessionmaker(engine, expire_on_commit=False)
    engine.dispose()
    if admin:
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture
def device():
    return FakeDevice()


@pytest.fixture
def app(sessions, device):
    return create_app(device, sessions, background=False)


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        client.post("/api/v1/state/refresh")
        yield client
