"""Sessions, the dev bypass, and cross-account isolation."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import (
    InvalidGoogleCredentialError,
    InvalidSessionError,
    create_session_token,
    read_session_token,
    verify_google_credential,
)
from tests.conftest import TEST_SESSION_SECRET
from tests.test_activities import make_activity

# --------------------------------------------------------------------------
# Session tokens
# --------------------------------------------------------------------------


def test_session_token_round_trip(settings: Settings) -> None:
    token = create_session_token(42, settings)
    assert read_session_token(token, settings) == 42


def test_session_token_signed_with_another_key_is_rejected(
    settings: Settings,
) -> None:
    other = settings.model_copy(update={"session_secret": "a-different-secret"})
    token = create_session_token(42, other)

    with pytest.raises(InvalidSessionError):
        read_session_token(token, settings)


def test_expired_session_token_is_rejected(settings: Settings) -> None:
    expired = jwt.encode(
        {
            "sub": "42",
            "iat": int((datetime.now(UTC) - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.now(UTC) - timedelta(hours=1)).timestamp()),
        },
        TEST_SESSION_SECRET,
        algorithm="HS256",
    )

    with pytest.raises(InvalidSessionError):
        read_session_token(expired, settings)


def test_unsigned_token_is_rejected(settings: Settings) -> None:
    """A `none`-algorithm token must never be accepted."""
    forged = jwt.encode({"sub": "1", "exp": 9999999999}, "", algorithm="none")

    with pytest.raises(InvalidSessionError):
        read_session_token(forged, settings)


def test_google_credential_rejected_when_not_configured(settings: Settings) -> None:
    with pytest.raises(InvalidGoogleCredentialError):
        verify_google_credential("whatever.token.value", settings)


# --------------------------------------------------------------------------
# Session endpoint
# --------------------------------------------------------------------------


def test_session_reports_dev_bypass(client: TestClient) -> None:
    body = client.get("/api/auth/session").json()

    assert body["authenticated"] is True
    assert body["is_dev_session"] is True
    assert body["google_sign_in_enabled"] is False
    assert body["user"]["email"] == "local@productivity.tracker"


def test_session_reports_signed_out_when_auth_required(
    strict_client: TestClient,
) -> None:
    body = strict_client.get("/api/auth/session").json()

    assert body["authenticated"] is False
    assert body["user"] is None
    assert body["google_sign_in_enabled"] is True


def test_session_reports_the_signed_in_user(alice: TestClient) -> None:
    body = alice.get("/api/auth/session").json()

    assert body["authenticated"] is True
    assert body["is_dev_session"] is False
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["name"] == "Alice"


def test_protected_routes_require_a_session(strict_client: TestClient) -> None:
    for method, path in (
        ("get", "/api/activities?month=2026-09"),
        ("get", "/api/categories"),
        ("get", "/api/stats/month?month=2026-09"),
        ("delete", "/api/activities/1"),
    ):
        response = getattr(strict_client, method)(path)
        assert response.status_code == 401, f"{method} {path}"
        assert response.json()["detail"][0]["field"] == "session"


def test_invalid_google_credential_is_401(strict_client: TestClient) -> None:
    response = strict_client.post(
        "/api/auth/google", json={"credential": "not-a-real-google-id-token"}
    )

    assert response.status_code == 401
    assert response.json()["detail"][0]["field"] == "credential"


def test_short_credential_is_rejected_by_schema(strict_client: TestClient) -> None:
    response = strict_client.post("/api/auth/google", json={"credential": "short"})
    assert response.status_code == 422


def test_logout_instructs_the_browser_to_drop_the_cookie(
    alice: TestClient,
) -> None:
    """Assert on the response header rather than the test client's cookie jar.

    The jar holds a hand-set cookie with no domain, which the jar will not
    match against the server's deletion cookie. What matters is that the
    endpoint emits a correctly scoped, immediately-expiring cookie.
    """
    response = alice.post("/api/auth/logout")

    assert response.status_code == 204
    set_cookie = response.headers["set-cookie"]
    assert "pt_session=" in set_cookie
    assert "Max-Age=0" in set_cookie
    assert "Path=/" in set_cookie
    assert "HttpOnly" in set_cookie


def test_a_client_without_a_cookie_is_signed_out(strict_client: TestClient) -> None:
    """The other half of logout: no cookie means no access."""
    assert strict_client.get("/api/auth/session").json()["authenticated"] is False
    assert strict_client.get("/api/activities?month=2026-09").status_code == 401


def test_tampered_cookie_is_rejected(strict_app) -> None:
    tampered = TestClient(strict_app)
    tampered.cookies.set("pt_session", "clearly.not.a.jwt")

    assert tampered.get("/api/activities?month=2026-09").status_code == 401


# --------------------------------------------------------------------------
# Per-account isolation
# --------------------------------------------------------------------------


def test_each_account_gets_its_own_seeded_palette(
    alice: TestClient, bob: TestClient
) -> None:
    alice_categories = alice.get("/api/categories").json()
    bob_categories = bob.get("/api/categories").json()

    assert len(alice_categories) == 6
    assert len(bob_categories) == 6
    # Same names, different rows.
    assert {c["name"] for c in alice_categories} == {c["name"] for c in bob_categories}
    assert not {c["id"] for c in alice_categories} & {c["id"] for c in bob_categories}


def test_activities_are_not_visible_across_accounts(
    alice: TestClient, bob: TestClient
) -> None:
    make_activity(alice, title="Alice's work")

    assert len(alice.get("/api/activities?month=2026-09").json()) == 1
    assert bob.get("/api/activities?month=2026-09").json() == []


def test_another_account_cannot_read_an_activity(
    alice: TestClient, bob: TestClient
) -> None:
    created = make_activity(alice, title="Private")

    # 404 rather than 403: a 403 would confirm the id exists.
    assert bob.get(f"/api/activities/{created['id']}").status_code == 404


def test_another_account_cannot_update_an_activity(
    alice: TestClient, bob: TestClient
) -> None:
    created = make_activity(alice, title="Private")

    response = bob.patch(
        f"/api/activities/{created['id']}", json={"title": "Hijacked"}
    )

    assert response.status_code == 404
    assert alice.get(f"/api/activities/{created['id']}").json()["title"] == "Private"


def test_another_account_cannot_delete_an_activity(
    alice: TestClient, bob: TestClient
) -> None:
    created = make_activity(alice, title="Private")

    assert bob.delete(f"/api/activities/{created['id']}").status_code == 404
    assert alice.get(f"/api/activities/{created['id']}").status_code == 200


def test_another_account_cannot_touch_a_sub_activity(
    alice: TestClient, bob: TestClient
) -> None:
    created = make_activity(
        alice,
        start_at="2026-09-18T09:00:00",
        end_at="2026-09-18T10:00:00",
        sub_activities=[
            {
                "title": "Detail",
                "start_at": "2026-09-18T09:10:00",
                "end_at": "2026-09-18T09:40:00",
            }
        ],
    )
    child_id = created["sub_activities"][0]["id"]

    assert bob.get(f"/api/sub-activities/{child_id}").status_code == 404
    assert bob.patch(
        f"/api/sub-activities/{child_id}", json={"title": "Hijacked"}
    ).status_code == 404
    assert bob.delete(f"/api/sub-activities/{child_id}").status_code == 404
    assert alice.get(f"/api/sub-activities/{child_id}").status_code == 200


def test_another_account_cannot_add_a_sub_activity(
    alice: TestClient, bob: TestClient
) -> None:
    created = make_activity(
        alice, start_at="2026-09-18T09:00:00", end_at="2026-09-18T10:00:00"
    )

    response = bob.post(
        f"/api/activities/{created['id']}/sub-activities",
        json={
            "title": "Injected",
            "start_at": "2026-09-18T09:10:00",
            "end_at": "2026-09-18T09:20:00",
        },
    )

    assert response.status_code == 404
    assert alice.get(f"/api/activities/{created['id']}").json()["sub_activities"] == []


def test_an_activity_cannot_borrow_another_accounts_category(
    alice: TestClient, bob: TestClient
) -> None:
    bobs_category = bob.get("/api/categories").json()[0]["id"]

    response = alice.post(
        "/api/activities",
        json={
            "title": "Cross-tenant category",
            "start_at": "2026-09-18T09:00:00",
            "end_at": "2026-09-18T10:00:00",
            "category_id": bobs_category,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"][0]["field"] == "category_id"


def test_another_account_cannot_modify_a_category(
    alice: TestClient, bob: TestClient
) -> None:
    alices_category = alice.get("/api/categories").json()[0]["id"]

    assert bob.patch(
        f"/api/categories/{alices_category}", json={"name": "Hijacked"}
    ).status_code == 404
    assert bob.delete(f"/api/categories/{alices_category}").status_code == 404


def test_stats_only_count_the_signed_in_account(
    alice: TestClient, bob: TestClient
) -> None:
    make_activity(
        alice, start_at="2026-09-18T09:00:00", end_at="2026-09-18T11:00:00"
    )
    make_activity(
        bob, start_at="2026-09-18T09:00:00", end_at="2026-09-18T17:00:00"
    )

    assert alice.get("/api/stats/month?month=2026-09").json()["tracked_minutes"] == 120
    assert bob.get("/api/stats/month?month=2026-09").json()["tracked_minutes"] == 480


def test_two_accounts_may_use_the_same_category_name(bob: TestClient) -> None:
    """`(user_id, name)` is unique, not `name` alone."""
    assert (
        bob.post("/api/categories", json={"name": "Research", "color": "#123456"}).status_code
        == 201
    )
    # A second one for the same account still conflicts.
    assert (
        bob.post("/api/categories", json={"name": "Research", "color": "#654321"}).status_code
        == 409
    )
