"""Every rejection path: bad intervals, bad fields, missing references."""

from fastapi.testclient import TestClient

from tests.test_activities import make_activity


def field_names(response_json: dict[str, object]) -> list[str]:
    detail = response_json["detail"]
    assert isinstance(detail, list)
    return [item["field"] for item in detail]


def test_end_before_start_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/activities",
        json={
            "title": "Backwards",
            "start_at": "2026-09-18T10:00:00",
            "end_at": "2026-09-18T09:00:00",
        },
    )

    assert response.status_code == 422
    assert "end_at must be later than start_at" in response.text


def test_zero_length_activity_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/activities",
        json={
            "title": "Instant",
            "start_at": "2026-09-18T10:00:00",
            "end_at": "2026-09-18T10:00:00",
        },
    )

    assert response.status_code == 422


def test_activity_longer_than_a_day_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/activities",
        json={
            "title": "Marathon",
            "start_at": "2026-09-18T00:00:00",
            "end_at": "2026-09-19T00:01:00",
        },
    )

    assert response.status_code == 422
    assert "cannot be longer than 24 hours" in response.text


def test_exactly_24_hours_is_allowed(client: TestClient) -> None:
    created = make_activity(
        client, start_at="2026-09-18T00:00:00", end_at="2026-09-19T00:00:00"
    )
    assert created["id"]


def test_blank_title_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/activities",
        json={
            "title": "",
            "start_at": "2026-09-18T10:00:00",
            "end_at": "2026-09-18T11:00:00",
        },
    )

    assert response.status_code == 422
    assert field_names(response.json()) == ["title"]


def test_over_long_title_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/activities",
        json={
            "title": "x" * 201,
            "start_at": "2026-09-18T10:00:00",
            "end_at": "2026-09-18T11:00:00",
        },
    )

    assert response.status_code == 422
    assert field_names(response.json()) == ["title"]


def test_unknown_category_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/activities",
        json={
            "title": "Ghost category",
            "start_at": "2026-09-18T10:00:00",
            "end_at": "2026-09-18T11:00:00",
            "category_id": 9999,
        },
    )

    assert response.status_code == 404
    assert field_names(response.json()) == ["category_id"]


def test_malformed_month_is_rejected(client: TestClient) -> None:
    for bad_month in ("2026-13", "2026-1", "September", "2026/09", ""):
        response = client.get(f"/api/activities?month={bad_month}")
        assert response.status_code == 422, bad_month
        assert "YYYY-MM" in response.text


def test_missing_month_is_rejected(client: TestClient) -> None:
    response = client.get("/api/activities")
    assert response.status_code == 422
    assert "month" in field_names(response.json())


def test_updating_a_missing_activity_is_404(client: TestClient) -> None:
    response = client.patch("/api/activities/4242", json={"title": "Nope"})
    assert response.status_code == 404


def test_deleting_a_missing_activity_is_404(client: TestClient) -> None:
    assert client.delete("/api/activities/4242").status_code == 404


def test_patch_cannot_invert_the_interval(client: TestClient) -> None:
    created = make_activity(client)

    response = client.patch(
        f"/api/activities/{created['id']}", json={"end_at": "2026-09-18T01:00:00"}
    )

    assert response.status_code == 422
    assert "end_at must be later than start_at" in response.text


def test_category_colour_must_be_hex(client: TestClient) -> None:
    response = client.post("/api/categories", json={"name": "Bad", "color": "red"})

    assert response.status_code == 422
    assert field_names(response.json()) == ["color"]


def test_duplicate_category_name_is_409(client: TestClient) -> None:
    """Names are unique per account; see test_auth for the cross-account case."""
    assert (
        client.post(
            "/api/categories", json={"name": "Research", "color": "#123456"}
        ).status_code
        == 201
    )

    response = client.post(
        "/api/categories", json={"name": "Research", "color": "#654321"}
    )

    assert response.status_code == 409
    assert field_names(response.json()) == ["name"]


def test_default_category_cannot_be_deleted(
    client: TestClient, category_id: int
) -> None:
    response = client.delete(f"/api/categories/{category_id}")

    assert response.status_code == 422
    assert "built-in category" in response.text


def test_custom_category_delete_leaves_activity_uncategorised(
    client: TestClient,
) -> None:
    custom = client.post(
        "/api/categories", json={"name": "Side project", "color": "#abcdef"}
    ).json()
    activity = make_activity(client, category_id=custom["id"])

    assert client.delete(f"/api/categories/{custom['id']}").status_code == 204

    reloaded = client.get(f"/api/activities/{activity['id']}").json()
    assert reloaded["category"] is None
    assert reloaded["category_id"] is None
