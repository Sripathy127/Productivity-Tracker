"""Account lookup, creation and per-account seeding."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import GoogleIdentity
from app.models import User
from app.services.seed import seed_default_categories


def _touch_login(user: User) -> None:
    user.last_login_at = datetime.now()


def upsert_google_user(db: Session, identity: GoogleIdentity) -> User:
    """Find or create the account behind a verified Google identity.

    Matching is by Google subject first, then by email. The email fallback
    covers an account that was created locally (or by an earlier sign-in
    mechanism) and is now being linked to Google for the first time; the
    subject is authoritative thereafter because a Google account's email can
    change while its subject cannot.
    """
    user = db.execute(
        select(User).where(User.google_sub == identity.subject)
    ).scalar_one_or_none()

    if user is None:
        user = db.execute(
            select(User).where(User.email == identity.email)
        ).scalar_one_or_none()

    if user is None:
        user = User(
            google_sub=identity.subject,
            email=identity.email,
            name=identity.name,
            picture_url=identity.picture_url,
        )
        db.add(user)
        db.flush()
        seed_default_categories(db, user.id)
    else:
        user.google_sub = identity.subject
        user.email = identity.email
        user.name = identity.name
        user.picture_url = identity.picture_url
        # A pre-existing account may predate per-user categories.
        seed_default_categories(db, user.id)

    _touch_login(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_dev_user(db: Session, settings: Settings) -> User:
    """The fixed local account used when ``AUTH_DEV_BYPASS`` is on."""
    email = settings.dev_user_email.lower()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    if user is None:
        user = User(google_sub=None, email=email, name=settings.dev_user_name)
        db.add(user)
        db.flush()
        seed_default_categories(db, user.id)
        _touch_login(user)
        db.commit()
        db.refresh(user)

    return user
