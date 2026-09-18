"""Monthly productivity aggregation."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.schemas.stats import CategoryTotal, DayTotal, MonthStats
from app.services.activity_service import list_activities_overlapping
from app.services.time_range import days_in_window, minutes_per_day

UNCATEGORISED_NAME = "Uncategorised"
UNCATEGORISED_COLOR = "#94a3b8"


def build_month_stats(
    db: Session,
    month: str,
    window_start: datetime,
    window_end: datetime,
    user_id: int,
) -> MonthStats:
    """Summarise a month: minutes per day and minutes per category.

    Intervals are clipped to the requested month so an activity spilling over a
    month boundary only contributes the part that actually falls inside it.
    """
    activities = list_activities_overlapping(db, window_start, window_end, user_id)

    day_minutes: dict[str, int] = {
        day.isoformat(): 0 for day in days_in_window(window_start, window_end)
    }
    day_activity_count: dict[str, int] = dict.fromkeys(day_minutes, 0)
    category_minutes: dict[int | None, int] = {}
    category_meta: dict[int | None, tuple[str, str]] = {}
    counted_activities = 0

    for activity in activities:
        clipped_start = max(activity.start_at, window_start)
        clipped_end = min(activity.end_at, window_end)
        if clipped_end <= clipped_start:
            continue

        counted_activities += 1
        activity_minutes = 0
        for day, minutes in minutes_per_day(clipped_start, clipped_end).items():
            key = day.isoformat()
            if key not in day_minutes:
                continue
            day_minutes[key] += minutes
            day_activity_count[key] += 1
            activity_minutes += minutes

        category_key = activity.category_id
        category_minutes[category_key] = (
            category_minutes.get(category_key, 0) + activity_minutes
        )
        if activity.category is not None:
            category_meta[category_key] = (
                activity.category.name,
                activity.category.color,
            )
        else:
            category_meta[category_key] = (UNCATEGORISED_NAME, UNCATEGORISED_COLOR)

    per_day = [
        DayTotal(
            date=key,
            tracked_minutes=minutes,
            activity_count=day_activity_count[key],
        )
        for key, minutes in sorted(day_minutes.items())
    ]

    per_category = sorted(
        (
            CategoryTotal(
                category_id=key,
                category_name=category_meta[key][0],
                color=category_meta[key][1],
                tracked_minutes=minutes,
            )
            for key, minutes in category_minutes.items()
        ),
        key=lambda total: total.tracked_minutes,
        reverse=True,
    )

    tracked_days = sum(1 for total in per_day if total.tracked_minutes > 0)
    busiest = max(per_day, key=lambda total: total.tracked_minutes, default=None)

    return MonthStats(
        month=month,
        tracked_minutes=sum(day_minutes.values()),
        activity_count=counted_activities,
        tracked_days=tracked_days,
        busiest_day=(
            busiest.date if busiest is not None and busiest.tracked_minutes > 0 else None
        ),
        per_day=per_day,
        per_category=per_category,
    )
