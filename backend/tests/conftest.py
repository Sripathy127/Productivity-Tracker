"""Test fixtures: an isolated in-file SQLite database per test."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.db import Base, build_engine, get_db
from app.core.security import create_session_token
from app.main import create_app
from app.models import User
from app.services.seed import seed_default_categories

TEST_SESSION_SECRET = "test-session-secret-not-used-anywhere-real"


@pytest.fixture
def settings(tmp_path) -> Settings:
    """Dev bypass on: most tests exercise the app as a single signed-in user."""
    db_path = tmp_path / "test.db"
    return Settings(
        database_url=f"sqlite:///{db_path}",
        cors_origins=("http://testserver",),
        sql_echo=False,
        session_secret=TEST_SESSION_SECRET,
        auth_dev_bypass=True,
        google_client_id="",
    )


@pytest.fixture
def strict_settings(settings: Settings) -> Settings:
    """Same database, but authentication is actually required."""
    return settings.model_copy(
        update={"auth_dev_bypass": False, "google_client_id": "test-client-id.apps.googleusercontent.com"}
    )


@pytest.fixture
def session_factory(settings: Settings) -> sessionmaker[Session]:
    engine = build_engine(settings)

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _):  # noqa: ANN001, ANN202
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _build_app(
    app_settings: Settings, session_factory: sessionmaker[Session]
) -> FastAPI:
    application = create_app(app_settings)

    def override_get_db() -> Iterator[Session]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    application.dependency_overrides[get_db] = override_get_db
    return application


@pytest.fixture
def app(settings: Settings, session_factory: sessionmaker[Session]) -> FastAPI:
    return _build_app(settings, session_factory)


@pytest.fixture
def strict_app(
    strict_settings: Settings, session_factory: sessionmaker[Session]
) -> FastAPI:
    return _build_app(strict_settings, session_factory)


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    # Constructed without the context manager on purpose, so the lifespan does
    # not run: the schema is already in place via `session_factory`, and the
    # lifespan would touch the configured database.
    return TestClient(app)


@pytest.fixture
def strict_client(strict_app: FastAPI) -> TestClient:
    return TestClient(strict_app)


@pytest.fixture
def category_id(client: TestClient) -> int:
    response = client.get("/api/categories")
    assert response.status_code == 200
    return int(response.json()[0]["id"])


def make_signed_in_client(
    strict_app: FastAPI,
    session_factory: sessionmaker[Session],
    *,
    email: str,
    name: str,
    google_sub: str,
) -> TestClient:
    """A client carrying a valid session cookie for a freshly created account.

    Built directly rather than through the Google endpoint so tests do not have
    to forge an RS256 token signed by Google.
    """
    with session_factory() as session:
        user = User(google_sub=google_sub, email=email, name=name)
        session.add(user)
        session.flush()
        seed_default_categories(session, user.id)
        session.commit()
        user_id = user.id

    test_client = TestClient(strict_app)
    token = create_session_token(
        user_id, strict_app.state.settings  # type: ignore[arg-type]
    )
    test_client.cookies.set("pt_session", token)
    return test_client


@pytest.fixture
def alice(
    strict_app: FastAPI, session_factory: sessionmaker[Session]
) -> TestClient:
    return make_signed_in_client(
        strict_app,
        session_factory,
        email="alice@example.com",
        name="Alice",
        google_sub="google-sub-alice",
    )


@pytest.fixture
def bob(strict_app: FastAPI, session_factory: sessionmaker[Session]) -> TestClient:
    return make_signed_in_client(
        strict_app,
        session_factory,
        email="bob@example.com",
        name="Bob",
        google_sub="google-sub-bob",
    )
