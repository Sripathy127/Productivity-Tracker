"""Pure helpers for month windows and per-day minute accounting."""

import re
from datetime import date, datetime, timedelta

from app.schemas.common import FieldError
from app.services.errors import ValidationFailure

MONTH_PATTERN = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def parse_month(month: str) -> tuple[datetime, datetime]:
    """Turn ``"2026-09"`` into the half-open window ``[Sep 1 00:00, Oct 1 00:00)``."""
    match = MONTH_PATTERN.match(month)
    if match is None:
        raise ValidationFailure(
            [
                FieldError(
                    field="month",
                    message="month must be formatted as YYYY-MM (e.g. 2026-09)",
                )
            ]
        )

    year, month_number = int(match.group(1)), int(match.group(2))
    window_start = datetime(year, month_number, 1)
    if month_number == 12:
        window_end = datetime(year + 1, 1, 1)
    else:
        window_end = datetime(year, month_number + 1, 1)
    return window_start, window_end


def days_in_window(window_start: datetime, window_end: datetime) -> list[date]:
    """Every calendar day touched by a half-open window."""
    days: list[date] = []
    cursor = window_start.date()
    last = (window_end - timedelta(minutes=1)).date()
    while cursor <= last:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def minutes_per_day(
    start_at: datetime, end_at: datetime
) -> dict[date, int]:
    """Split an interval across calendar days, in whole minutes per day.

    An activity from 23:10 to 01:30 contributes 50 minutes to the first day and
    90 to the next, so daily totals stay correct for overnight work.
    """
    totals: dict[date, int] = {}
    cursor = start_at
    while cursor < end_at:
        day_end = datetime.combine(cursor.date(), datetime.min.time()) + timedelta(
            days=1
        )
        segment_end = min(day_end, end_at)
        minutes = int((segment_end - cursor).total_seconds() // 60)
        if minutes > 0:
            totals[cursor.date()] = totals.get(cursor.date(), 0) + minutes
        cursor = segment_end
    return totals
