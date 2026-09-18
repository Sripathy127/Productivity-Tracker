"""Database engine, session factory and the declarative base."""

from collections.abc import Iterator
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import Settings, get_settings


class Base(DeclarativeBase):
    """Declarative base for every ORM model."""


def build_engine(settings: Settings) -> Engine:
    connect_args: dict[str, Any] = {}
    if settings.is_sqlite:
        # The API is single-process but FastAPI serves requests from a thread
        # pool, so the connection must not be pinned to its creating thread.
        connect_args["check_same_thread"] = False

    engine = create_engine(
        settings.database_url,
        echo=settings.sql_echo,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    if settings.is_sqlite:
        # SQLite does not honour foreign keys (and therefore ON DELETE CASCADE)
        # unless explicitly enabled per connection. Postgres always does.
        @event.listens_for(engine, "connect")
        def _enable_sqlite_foreign_keys(dbapi_connection: Any, _: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = build_engine(get_settings())
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a session that is always closed."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
