"""Sign-in, session inspection and sign-out."""

from fastapi import APIRouter, Cookie, Response, status

from app.core.config import Settings
from app.core.deps import DbSession, SettingsDep
from app.core.security import (
    InvalidGoogleCredentialError,
    InvalidSessionError,
    create_session_token,
    read_session_token,
    verify_google_credential,
)
from app.models import User
from app.schemas.auth import GoogleSignInRequest, SessionRead, UserRead
from app.schemas.common import FieldError
from app.services.errors import ApiError
from app.services.user_service import get_or_create_dev_user, upsert_google_user

router = APIRouter(prefix="/auth", tags=["auth"])


class SignInRejected(ApiError):
    status_code = 401


def _set_session_cookie(response: Response, user: User, settings: Settings) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=create_session_token(user.id, settings),
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        # Lax rather than Strict: the cookie must survive the redirect back
        # from the Google sign-in flow, but is still withheld from
        # cross-site POSTs.
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )


@router.post("/google", response_model=SessionRead)
def sign_in_with_google(
    payload: GoogleSignInRequest,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
) -> SessionRead:
    """Exchange a verified Google ID token for a session cookie."""
    try:
        identity = verify_google_credential(payload.credential, settings)
    except InvalidGoogleCredentialError as exc:
        # The underlying reason is logged by the handler; the client is told
        # only that the credential was rejected.
        raise SignInRejected(
            [
                FieldError(
                    field="credential",
                    message="that Google sign-in could not be verified",
                )
            ]
        ) from exc

    user = upsert_google_user(db, identity)
    _set_session_cookie(response, user, settings)

    return SessionRead(
        authenticated=True,
        user=UserRead.model_validate(user),
        google_sign_in_enabled=settings.google_sign_in_enabled,
        google_client_id=settings.google_client_id,
        is_dev_session=False,
    )


@router.get("/session", response_model=SessionRead)
def read_session(
    db: DbSession,
    settings: SettingsDep,
    session_cookie: str | None = Cookie(default=None, alias="pt_session"),
) -> SessionRead:
    """Describe the current session.

    Unlike the protected routes this never raises: the landing page calls it to
    decide what to render, and a signed-out visitor is an expected state, not an
    error.
    """
    user: User | None = None
    is_dev_session = False

    if session_cookie:
        try:
            user = db.get(User, read_session_token(session_cookie, settings))
        except InvalidSessionError:
            user = None

    if user is None and settings.auth_dev_bypass:
        user = get_or_create_dev_user(db, settings)
        is_dev_session = True

    return SessionRead(
        authenticated=user is not None,
        user=None if user is None else UserRead.model_validate(user),
        google_sign_in_enabled=settings.google_sign_in_enabled,
        google_client_id=settings.google_client_id,
        is_dev_session=is_dev_session,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, settings: SettingsDep) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        path="/",
    )
