"""Happy-path CRUD behaviour for activities."""

from fastapi.testclient import TestClient


def make_activity(
    client: TestClient,
    *,
    title: str = "Write the timeline geometry",
    start_at: str = "2026-09-18T03:53:00",
    end_at: str = "2026-09-18T04:41:00",
    category_id: int | None = None,
    sub_activities: list[dict[str, str]] | None = None,
) -> dict[str, object]:
    body: dict[str, object] = {
        "title": title,
        "start_at": start_at,
        "end_at": end_at,
        "category_id": category_id,
        "sub_activities": sub_activities or [],
    }
    response = client.post("/api/activities", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_default_categories_are_seeded(client: TestClient) -> None:
    categories = client.get("/api/categories").json()
    assert len(categories) == 6
    assert all(item["is_default"] for item in categories)
    assert {"Deep Work", "Break"} <= {item["name"] for item in categories}


def test_create_activity_preserves_exact_minutes(
    client: TestClient, category_id: int
) -> None:
    created = make_activity(client, category_id=category_id)

    assert created["start_at"] == "2026-09-18T03:53:00"
    assert created["end_at"] == "2026-09-18T04:41:00"
    assert created["category"]["id"] == category_id
    assert created["sub_activities"] == []


def test_seconds_are_truncated_to_the_minute(client: TestClient) -> None:
    created = make_activity(
        client, start_at="2026-09-18T03:53:47.912000", end_at="2026-09-18T04:41:09"
    )

    assert created["start_at"] == "2026-09-18T03:53:00"
    assert created["end_at"] == "2026-09-18T04:41:00"


def test_create_activity_with_nested_sub_activities(client: TestClient) -> None:
    created = make_activity(
        client,
        start_at="2026-09-18T09:00:00",
        end_at="2026-09-18T11:30:00",
        sub_activities=[
            {
                "title": "Read the spec",
                "start_at": "2026-09-18T09:00:00",
                "end_at": "2026-09-18T09:22:00",
            },
            {
                "title": "Draft the grid maths",
                "start_at": "2026-09-18T09:22:00",
                "end_at": "2026-09-18T11:30:00",
            },
        ],
    )

    assert [child["title"] for child in created["sub_activities"]] == [
        "Read the spec",
        "Draft the grid maths",
    ]


def test_list_by_month_returns_only_overlapping_activities(
    client: TestClient,
) -> None:
    inside = make_activity(client, title="September work")
    make_activity(
        client,
        title="August work",
        start_at="2026-08-14T10:00:00",
        end_at="2026-08-14T11:00:00",
    )
    overnight = make_activity(
        client,
        title="Month boundary",
        start_at="2026-08-31T23:10:00",
        end_at="2026-09-01T01:30:00",
    )

    titles = [item["title"] for item in client.get("/api/activities?month=2026-09").json()]

    assert titles == [overnight["title"], inside["title"]]


def test_update_activity_changes_only_supplied_fields(client: TestClient) -> None:
    created = make_activity(client)

    response = client.patch(
        f"/api/activities/{created['id']}",
        json={"title": "Renamed", "end_at": "2026-09-18T05:07:00"},
    )

    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["title"] == "Renamed"
    assert updated["end_at"] == "2026-09-18T05:07:00"
    assert updated["start_at"] == created["start_at"]


def test_delete_activity_cascades_to_sub_activities(client: TestClient) -> None:
    created = make_activity(
        client,
        start_at="2026-09-18T09:00:00",
        end_at="2026-09-18T10:00:00",
        sub_activities=[
            {
                "title": "Child",
                "start_at": "2026-09-18T09:10:00",
                "end_at": "2026-09-18T09:20:00",
            }
        ],
    )
    child_id = created["sub_activities"][0]["id"]

    assert client.delete(f"/api/activities/{created['id']}").status_code == 204
    assert client.get(f"/api/activities/{created['id']}").status_code == 404
    assert client.get(f"/api/sub-activities/{child_id}").status_code == 404


def test_activity_can_be_uncategorised_then_categorised(
    client: TestClient, category_id: int
) -> None:
    created = make_activity(client)
    assert created["category"] is None

    response = client.patch(
        f"/api/activities/{created['id']}", json={"category_id": category_id}
    )
    assert response.json()["category"]["id"] == category_id

    cleared = client.patch(
        f"/api/activities/{created['id']}", json={"category_id": None}
    )
    assert cleared.json()["category"] is None
