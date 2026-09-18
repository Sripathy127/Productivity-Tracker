"""Request/response contracts for sub-activities (the nested bars)."""

from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import (
    MAX_NOTES_LENGTH,
    MAX_TITLE_LENGTH,
    MINUTES_IN_DAY,
    normalize_timestamp,
)


class SubActivityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)
    notes: str | None = Field(default=None, max_length=MAX_NOTES_LENGTH)
    start_at: datetime
    end_at: datetime

    _normalize = field_validator("start_at", "end_at")(normalize_timestamp)

    @model_validator(mode="after")
    def _check_interval(self) -> Self:
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be later than start_at")
        span_minutes = (self.end_at - self.start_at).total_seconds() / 60
        if span_minutes > MINUTES_IN_DAY:
            raise ValueError("a sub-activity cannot be longer than 24 hours")
        return self


class SubActivityUpdate(BaseModel):
    """PATCH body. Interval coherence is checked against the merged record."""

    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    notes: str | None = Field(default=None, max_length=MAX_NOTES_LENGTH)
    start_at: datetime | None = None
    end_at: datetime | None = None

    @field_validator("start_at", "end_at")
    @classmethod
    def _normalize(cls, value: datetime | None) -> datetime | None:
        return None if value is None else normalize_timestamp(value)


class SubActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activity_id: int
    title: str
    notes: str | None
    start_at: datetime
    end_at: datetime
