"""Response contracts for the monthly productivity summary."""

from pydantic import BaseModel


class DayTotal(BaseModel):
    """Minutes tracked on one calendar day of the requested month."""

    date: str
    tracked_minutes: int
    activity_count: int


class CategoryTotal(BaseModel):
    category_id: int | None
    category_name: str
    color: str
    tracked_minutes: int


class MonthStats(BaseModel):
    month: str
    tracked_minutes: int
    activity_count: int
    tracked_days: int
    busiest_day: str | None
    per_day: list[DayTotal]
    per_category: list[CategoryTotal]
