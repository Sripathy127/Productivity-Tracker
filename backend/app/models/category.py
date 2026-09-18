"""Activity category: gives every bar on the timeline its colour."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Category(Base):
    __tablename__ = "categories"
    # Names are unique per owner, not globally: two accounts may both have a
    # category called "Deep Work".
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_category_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    user: Mapped["User | None"] = relationship(back_populates="categories")  # noqa: F821
    activities: Mapped[list["Activity"]] = relationship(  # noqa: F821
        back_populates="category"
    )
