"""Load a month of sample activities through the running API.

Usage (with the backend running):

    backend/.venv/Scripts/python.exe backend/scripts/load_sample_data.py 2026-09

Useful for seeing the timeline populated, and for exercising the awkward cases:
an odd-minute start, an overnight block, and two overlapping activities.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

API_ROOT = "http://127.0.0.1:8000/api"


def post(path: str, payload: dict[str, object]) -> dict[str, object]:
    request = urllib.request.Request(
        f"{API_ROOT}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            body: dict[str, object] = json.loads(response.read())
            return body
    except urllib.error.HTTPError as error:
        raise SystemExit(
            f"POST {path} failed ({error.code}): {error.read().decode('utf-8')}"
        ) from error


def get(path: str) -> list[dict[str, object]]:
    with urllib.request.urlopen(f"{API_ROOT}{path}") as response:
        body: list[dict[str, object]] = json.loads(response.read())
        return body


def stamp(day: date, hour: int, minute: int) -> str:
    return f"{day.isoformat()}T{hour:02d}:{minute:02d}:00"


def main() -> None:
    month = sys.argv[1] if len(sys.argv) > 1 else date.today().strftime("%Y-%m")
    year, month_number = (int(part) for part in month.split("-"))
    first = date(year, month_number, 1)

    categories = {
        str(item["name"]): int(item["id"])  # type: ignore[arg-type]
        for item in get("/categories")
    }

    deep = categories.get("Deep Work")
    meeting = categories.get("Meeting")
    learning = categories.get("Learning")
    admin = categories.get("Admin")
    break_ = categories.get("Break")

    # A weekday-shaped pattern across the first three working weeks.
    created = 0
    for offset in range(21):
        day = first + timedelta(days=offset)
        if day.month != month_number or day.weekday() >= 5:
            continue

        post(
            "/activities",
            {
                "title": "Morning focus block",
                "category_id": deep,
                "start_at": stamp(day, 9, 12),
                "end_at": stamp(day, 11, 48),
                "notes": "Main build work for the day.",
                "sub_activities": [
                    {
                        "title": "Read yesterday's notes",
                        "start_at": stamp(day, 9, 12),
                        "end_at": stamp(day, 9, 26),
                        "notes": None,
                    },
                    {
                        "title": "Implementation",
                        "start_at": stamp(day, 9, 26),
                        "end_at": stamp(day, 10, 54),
                        "notes": None,
                    },
                    {
                        "title": "Self review",
                        "start_at": stamp(day, 10, 54),
                        "end_at": stamp(day, 11, 48),
                        "notes": None,
                    },
                ],
            },
        )
        post(
            "/activities",
            {
                "title": "Stand-up",
                "category_id": meeting,
                "start_at": stamp(day, 12, 0),
                "end_at": stamp(day, 12, 18),
                "notes": None,
                "sub_activities": [],
            },
        )
        post(
            "/activities",
            {
                "title": "Lunch",
                "category_id": break_,
                "start_at": stamp(day, 13, 6),
                "end_at": stamp(day, 13, 52),
                "notes": None,
                "sub_activities": [],
            },
        )
        post(
            "/activities",
            {
                "title": "Afternoon session",
                "category_id": deep if offset % 2 == 0 else learning,
                "start_at": stamp(day, 14, 24),
                "end_at": stamp(day, 17, 36),
                "notes": None,
                "sub_activities": [
                    {
                        "title": "Pairing",
                        "start_at": stamp(day, 14, 24),
                        "end_at": stamp(day, 15, 42),
                        "notes": None,
                    },
                    {
                        "title": "Docs and cleanup",
                        "start_at": stamp(day, 15, 42),
                        "end_at": stamp(day, 17, 36),
                        "notes": None,
                    },
                ],
            },
        )
        created += 4

    # Odd-minute start, to prove exact-minute placement.
    odd_day = first + timedelta(days=(2 - first.weekday()) % 7)
    post(
        "/activities",
        {
            "title": "Early debugging (03:53)",
            "category_id": deep,
            "start_at": stamp(odd_day, 3, 53),
            "end_at": stamp(odd_day, 4, 41),
            "notes": "Starts at 03:53 exactly, not on a 2-minute boundary.",
            "sub_activities": [
                {
                    "title": "Reproduce",
                    "start_at": stamp(odd_day, 3, 53),
                    "end_at": stamp(odd_day, 4, 7),
                    "notes": None,
                },
                {
                    "title": "Fix and verify",
                    "start_at": stamp(odd_day, 4, 7),
                    "end_at": stamp(odd_day, 4, 41),
                    "notes": None,
                },
            ],
        },
    )

    # Overlapping activity, to show lane stacking.
    post(
        "/activities",
        {
            "title": "Interview panel (overlaps)",
            "category_id": meeting,
            "start_at": stamp(odd_day, 10, 30),
            "end_at": stamp(odd_day, 11, 15),
            "notes": "Overlaps the morning focus block, so it gets its own lane.",
            "sub_activities": [],
        },
    )

    # Overnight activity, to show the midnight split on two rows.
    overnight_day = first + timedelta(days=min(17, 26))
    post(
        "/activities",
        {
            "title": "Release window (overnight)",
            "category_id": admin,
            "start_at": stamp(overnight_day, 23, 10),
            "end_at": stamp(overnight_day + timedelta(days=1), 1, 34),
            "notes": "Crosses midnight; rendered on both day rows.",
            "sub_activities": [
                {
                    "title": "Deploy",
                    "start_at": stamp(overnight_day, 23, 10),
                    "end_at": stamp(overnight_day + timedelta(days=1), 0, 12),
                    "notes": None,
                },
                {
                    "title": "Smoke tests",
                    "start_at": stamp(overnight_day + timedelta(days=1), 0, 12),
                    "end_at": stamp(overnight_day + timedelta(days=1), 1, 34),
                    "notes": None,
                },
            ],
        },
    )

    print(f"Created {created + 3} activities for {month}.")


if __name__ == "__main__":
    main()
