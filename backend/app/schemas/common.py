"""Shared schema helpers: the error envelope and time-value normalisation."""

from datetime import datetime

from pydantic import BaseModel, Field

MAX_TITLE_LENGTH = 200
MAX_NOTES_LENGTH = 2000
MINUTES_IN_DAY = 24 * 60
HEX_COLOR_PATTERN = r"^#(?:[0-9a-fA-F]{6})$"


class FieldError(BaseModel):
    """A single validation problem, addressed to one input field."""

    field: str
    message: str


class ErrorResponse(BaseModel):
    """Every non-2xx response from this API uses this shape."""

    detail: list[FieldError] = Field(default_factory=list)


def normalize_timestamp(value: datetime) -> datetime:
    """Reduce an incoming timestamp to naive, minute-precision local time.

    The timeline addresses time by minutes-from-midnight, so sub-minute
    components are dropped rather than silently rendered as a fraction of a
    pixel. A timezone-aware input is converted to the server's local wall clock
    before the offset is discarded.
    """
    if value.tzinfo is not None:
        value = value.astimezone().replace(tzinfo=None)
    return value.replace(second=0, microsecond=0)
