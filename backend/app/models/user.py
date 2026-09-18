"""An account. One row per Google identity (or the local dev account)."""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Google's stable subject claim. Null for the local dev account, which is
    # identified by email instead.
    google_sub: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    picture_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    activities: Mapped[list["Activity"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    categories: Mapped[list["Category"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
