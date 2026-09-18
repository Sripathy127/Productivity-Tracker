"""Request-scoped dependencies: settings, and the current account."""

from typing import Annotated

from fastapi import Cookie, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.security import InvalidSessionError, read_session_token
from app.models import User
from app.schemas.common import FieldError
from app.services.errors import ApiError
from app.services.user_service import get_or_create_dev_user


class UnauthenticatedError(ApiError):
    """No usable session on the request."""

    status_code = 401


def settings_dependency(request: Request) -> Settings:
    """Prefer settings stored on the app by the factory, so tests can override."""
    configured = getattr(request.app.state, "settings", None)
    return configured if isinstance(configured, Settings) else get_settings()


SettingsDep = Annotated[Settings, Depends(settings_dependency)]


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    settings: SettingsDep,
    session_cookie: Annotated[str | None, Cookie(alias="pt_session")] = None,
) -> User:
    """Resolve the signed-in account, or reject the request.

    A valid session cookie always wins. The dev bypass is only consulted when
    no cookie is present, so signing in properly still takes effect on a
    machine that has the bypass enabled.
    """
    if session_cookie:
        try:
            user_id = read_session_token(session_cookie, settings)
        except InvalidSessionError as exc:
            raise UnauthenticatedError(
                [FieldError(field="session", message="your session has expired")]
            ) from exc

        user = db.get(User, user_id)
        if user is not None:
            return user
        # Signed cookie for a user that no longer exists: treat as signed out.
        raise UnauthenticatedError(
            [FieldError(field="session", message="your session is no longer valid")]
        )

    if settings.auth_dev_bypass:
        return get_or_create_dev_user(db, settings)

    raise UnauthenticatedError(
        [FieldError(field="session", message="sign in to continue")]
    )


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
