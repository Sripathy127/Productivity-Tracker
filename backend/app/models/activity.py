"""A tracked block of time, optionally broken down into sub-activities."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Activity(Base):
    """Top-level timeline bar.

    ``start_at`` / ``end_at`` are stored *without* timezone and hold the user's
    local wall-clock time. This is deliberate: the timeline positions bars by
    minutes-from-midnight, and a UTC round-trip would shift a 03:53 entry into a
    different hour column (and possibly a different day row) depending on the
    viewer's offset and DST. See ARCHITECTURE.md.
    """

    __tablename__ = "activities"
    __table_args__ = (
        # The month query filters by owner then by range, so the composite
        # index leads with user_id.
        Index("ix_activities_user_start_end", "user_id", "start_at", "end_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Nullable so rows created before accounts existed are not destroyed; every
    # API path scopes to a concrete user, so legacy rows are simply invisible
    # until claimed (see scripts/claim_legacy_activities.py).
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User | None"] = relationship(  # noqa: F821
        back_populates="activities"
    )
    category: Mapped["Category | None"] = relationship(  # noqa: F821
        back_populates="activities", lazy="joined"
    )
    sub_activities: Mapped[list["SubActivity"]] = relationship(  # noqa: F821
        back_populates="activity",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SubActivity.start_at",
        lazy="selectin",
    )
