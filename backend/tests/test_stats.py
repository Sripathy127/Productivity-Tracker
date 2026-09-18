"""Monthly aggregation, including overnight and cross-month clipping."""

from datetime import date, datetime

from fastapi.testclient import TestClient

from app.services.time_range import days_in_window, minutes_per_day, parse_month
from tests.test_activities import make_activity


def test_parse_month_window() -> None:
    start, end = parse_month("2026-12")
    assert (start.year, start.month, start.day) == (2026, 12, 1)
    assert (end.year, end.month, end.day) == (2027, 1, 1)


def test_days_in_window_covers_february_leap_year() -> None:
    start, end = parse_month("2028-02")
    days = days_in_window(start, end)
    assert len(days) == 29
    assert days[0] == date(2028, 2, 1)
    assert days[-1] == date(2028, 2, 29)


def test_minutes_per_day_splits_an_overnight_interval() -> None:
    totals = minutes_per_day(
        datetime(2026, 9, 18, 23, 10), datetime(2026, 9, 19, 1, 30)
    )

    assert totals == {date(2026, 9, 18): 50, date(2026, 9, 19): 90}


def test_month_stats_totals(client: TestClient, category_id: int) -> None:
    make_activity(
        client,
        title="Morning",
        start_at="2026-09-18T09:00:00",
        end_at="2026-09-18T11:30:00",
        category_id=category_id,
    )
    make_activity(
        client,
        title="Afternoon",
        start_at="2026-09-18T14:00:00",
        end_at="2026-09-18T15:07:00",
        category_id=category_id,
    )
    make_activity(
        client,
        title="Another day",
        start_at="2026-09-20T10:00:00",
        end_at="2026-09-20T10:30:00",
    )

    stats = client.get("/api/stats/month?month=2026-09").json()

    assert stats["month"] == "2026-09"
    assert stats["tracked_minutes"] == 150 + 67 + 30
    assert stats["activity_count"] == 3
    assert stats["tracked_days"] == 2
    assert stats["busiest_day"] == "2026-09-18"
    assert len(stats["per_day"]) == 30

    by_day = {item["date"]: item["tracked_minutes"] for item in stats["per_day"]}
    assert by_day["2026-09-18"] == 217
    assert by_day["2026-09-19"] == 0

    top_category = stats["per_category"][0]
    assert top_category["category_id"] == category_id
    assert top_category["tracked_minutes"] == 217


def test_month_stats_clips_activities_at_the_month_boundary(
    client: TestClient,
) -> None:
    make_activity(
        client,
        title="Spills into September",
        start_at="2026-08-31T23:10:00",
        end_at="2026-09-01T01:30:00",
    )

    stats = client.get("/api/stats/month?month=2026-09").json()

    # Only the 90 minutes that fall inside September are counted.
    assert stats["tracked_minutes"] == 90
    by_day = {item["date"]: item["tracked_minutes"] for item in stats["per_day"]}
    assert by_day["2026-09-01"] == 90


def test_month_stats_for_an_empty_month(client: TestClient) -> None:
    stats = client.get("/api/stats/month?month=2026-09").json()

    assert stats["tracked_minutes"] == 0
    assert stats["activity_count"] == 0
    assert stats["busiest_day"] is None
    assert stats["per_category"] == []
    assert len(stats["per_day"]) == 30


def test_uncategorised_activities_are_grouped(client: TestClient) -> None:
    make_activity(
        client, start_at="2026-09-18T09:00:00", end_at="2026-09-18T10:00:00"
    )

    stats = client.get("/api/stats/month?month=2026-09").json()

    assert stats["per_category"][0]["category_id"] is None
    assert stats["per_category"][0]["category_name"] == "Uncategorised"
