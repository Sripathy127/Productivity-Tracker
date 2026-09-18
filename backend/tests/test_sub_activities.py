"""Sub-activity CRUD and the parent-containment rule."""

from fastapi.testclient import TestClient

from tests.test_activities import make_activity
from tests.test_validation import field_names

PARENT_START = "2026-09-18T09:00:00"
PARENT_END = "2026-09-18T12:00:00"


def make_parent(client: TestClient) -> dict[str, object]:
    return make_activity(
        client, title="Feature work", start_at=PARENT_START, end_at=PARENT_END
    )


def test_create_sub_activity_inside_parent(client: TestClient) -> None:
    parent = make_parent(client)

    response = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Pair review at 10:07",
            "start_at": "2026-09-18T10:07:00",
            "end_at": "2026-09-18T10:39:00",
        },
    )

    assert response.status_code == 201, response.text
    child = response.json()
    assert child["activity_id"] == parent["id"]
    assert child["start_at"] == "2026-09-18T10:07:00"


def test_sub_activity_may_share_parent_boundaries(client: TestClient) -> None:
    parent = make_parent(client)

    response = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={"title": "Whole block", "start_at": PARENT_START, "end_at": PARENT_END},
    )

    assert response.status_code == 201


def test_sub_activity_starting_before_parent_is_rejected(client: TestClient) -> None:
    parent = make_parent(client)

    response = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Too early",
            "start_at": "2026-09-18T08:30:00",
            "end_at": "2026-09-18T09:30:00",
        },
    )

    assert response.status_code == 422
    assert field_names(response.json()) == ["start_at"]
    assert "before its activity starts" in response.text


def test_sub_activity_ending_after_parent_is_rejected(client: TestClient) -> None:
    parent = make_parent(client)

    response = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Overruns",
            "start_at": "2026-09-18T11:30:00",
            "end_at": "2026-09-18T12:30:00",
        },
    )

    assert response.status_code == 422
    assert field_names(response.json()) == ["end_at"]
    assert "after its activity ends" in response.text


def test_sub_activity_outside_on_both_sides_reports_both_fields(
    client: TestClient,
) -> None:
    parent = make_parent(client)

    response = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Engulfs the parent",
            "start_at": "2026-09-18T08:00:00",
            "end_at": "2026-09-18T13:00:00",
        },
    )

    assert response.status_code == 422
    assert field_names(response.json()) == ["start_at", "end_at"]


def test_nested_create_rejects_out_of_range_child(client: TestClient) -> None:
    response = client.post(
        "/api/activities",
        json={
            "title": "Parent",
            "start_at": PARENT_START,
            "end_at": PARENT_END,
            "sub_activities": [
                {
                    "title": "Fits",
                    "start_at": "2026-09-18T09:05:00",
                    "end_at": "2026-09-18T09:35:00",
                },
                {
                    "title": "Escapes",
                    "start_at": "2026-09-18T11:50:00",
                    "end_at": "2026-09-18T12:20:00",
                },
            ],
        },
    )

    assert response.status_code == 422
    assert "'Escapes'" in response.text
    assert client.get("/api/activities?month=2026-09").json() == []


def test_sub_activity_for_missing_parent_is_404(client: TestClient) -> None:
    response = client.post(
        "/api/activities/4242/sub-activities",
        json={
            "title": "Orphan",
            "start_at": PARENT_START,
            "end_at": PARENT_END,
        },
    )

    assert response.status_code == 404


def test_update_sub_activity(client: TestClient) -> None:
    parent = make_parent(client)
    child = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "First pass",
            "start_at": "2026-09-18T09:10:00",
            "end_at": "2026-09-18T09:40:00",
        },
    ).json()

    response = client.patch(
        f"/api/sub-activities/{child['id']}",
        json={"title": "Second pass", "end_at": "2026-09-18T09:53:00"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Second pass"
    assert response.json()["end_at"] == "2026-09-18T09:53:00"


def test_update_cannot_push_sub_activity_outside_parent(client: TestClient) -> None:
    parent = make_parent(client)
    child = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Bounded",
            "start_at": "2026-09-18T09:10:00",
            "end_at": "2026-09-18T09:40:00",
        },
    ).json()

    response = client.patch(
        f"/api/sub-activities/{child['id']}", json={"end_at": "2026-09-18T12:30:00"}
    )

    assert response.status_code == 422
    assert "after its activity ends" in response.text


def test_shrinking_parent_that_would_orphan_children_is_rejected(
    client: TestClient,
) -> None:
    parent = make_parent(client)
    client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Late block",
            "start_at": "2026-09-18T11:00:00",
            "end_at": "2026-09-18T11:45:00",
        },
    )

    response = client.patch(
        f"/api/activities/{parent['id']}", json={"end_at": "2026-09-18T10:00:00"}
    )

    assert response.status_code == 422
    assert "'Late block'" in response.text
    assert "move or delete them first" in response.text


def test_growing_parent_is_allowed(client: TestClient) -> None:
    parent = make_parent(client)
    client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Inside",
            "start_at": "2026-09-18T11:00:00",
            "end_at": "2026-09-18T11:45:00",
        },
    )

    response = client.patch(
        f"/api/activities/{parent['id']}", json={"end_at": "2026-09-18T13:00:00"}
    )

    assert response.status_code == 200, response.text


def test_delete_sub_activity_leaves_parent_intact(client: TestClient) -> None:
    parent = make_parent(client)
    child = client.post(
        f"/api/activities/{parent['id']}/sub-activities",
        json={
            "title": "Removable",
            "start_at": "2026-09-18T09:10:00",
            "end_at": "2026-09-18T09:40:00",
        },
    ).json()

    assert client.delete(f"/api/sub-activities/{child['id']}").status_code == 204

    reloaded = client.get(f"/api/activities/{parent['id']}").json()
    assert reloaded["sub_activities"] == []


def test_deleting_a_missing_sub_activity_is_404(client: TestClient) -> None:
    assert client.delete("/api/sub-activities/4242").status_code == 404
