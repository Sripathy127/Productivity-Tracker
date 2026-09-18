"""Request/response contracts for activities (the top-level timeline bars)."""

from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.category import CategoryRead
from app.schemas.common import (
    MAX_NOTES_LENGTH,
    MAX_TITLE_LENGTH,
    MINUTES_IN_DAY,
    normalize_timestamp,
)
from app.schemas.sub_activity import SubActivityCreate, SubActivityRead


class ActivityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)
    notes: str | None = Field(default=None, max_length=MAX_NOTES_LENGTH)
    start_at: datetime
    end_at: datetime
    category_id: int | None = None
    sub_activities: list[SubActivityCreate] = Field(default_factory=list)

    _normalize = field_validator("start_at", "end_at")(normalize_timestamp)

    @model_validator(mode="after")
    def _check_interval(self) -> Self:
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be later than start_at")
        span_minutes = (self.end_at - self.start_at).total_seconds() / 60
        if span_minutes > MINUTES_IN_DAY:
            raise ValueError("an activity cannot be longer than 24 hours")
        return self


class ActivityUpdate(BaseModel):
    """PATCH body. Only the supplied fields are applied."""

    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    notes: str | None = Field(default=None, max_length=MAX_NOTES_LENGTH)
    start_at: datetime | None = None
    end_at: datetime | None = None
    category_id: int | None = None

    @field_validator("start_at", "end_at")
    @classmethod
    def _normalize(cls, value: datetime | None) -> datetime | None:
        return None if value is None else normalize_timestamp(value)


class ActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    notes: str | None
    start_at: datetime
    end_at: datetime
    category_id: int | None
    category: CategoryRead | None
    sub_activities: list[SubActivityRead]
