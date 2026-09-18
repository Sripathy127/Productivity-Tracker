"""Session tokens and Google ID-token verification.

Two distinct tokens are involved and must not be confused:

1. **Google's ID token** — a short-lived RS256 JWT the browser obtains from
   Google Identity Services. We verify its signature against Google's public
   keys and then discard it; it is never stored.
2. **Our session token** — an HS256 JWT this API signs itself, carrying only
   the local user id. It is delivered in an httpOnly cookie so page scripts
   cannot read it.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import Settings

SESSION_ALGORITHM = "HS256"
GOOGLE_ISSUERS = frozenset({"accounts.google.com", "https://accounts.google.com"})


class InvalidSessionError(Exception):
    """The session cookie is missing, malformed, expired or wrongly signed."""


class InvalidGoogleCredentialError(Exception):
    """The supplied Google ID token could not be trusted."""


@dataclass(frozen=True)
class GoogleIdentity:
    """The subset of verified Google claims this application stores."""

    subject: str
    email: str
    name: str
    picture_url: str | None


def create_session_token(user_id: int, settings: Settings) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.session_ttl_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.session_secret, algorithm=SESSION_ALGORITHM)


def read_session_token(token: str, settings: Settings) -> int:
    """Return the user id carried by a valid session token."""
    try:
        payload = jwt.decode(
            token,
            settings.session_secret,
            algorithms=[SESSION_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidSessionError(str(exc)) from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.isdigit():
        raise InvalidSessionError("session token carries no usable subject")
    return int(subject)


def verify_google_credential(credential: str, settings: Settings) -> GoogleIdentity:
    """Verify a Google ID token and extract the claims we need.

    ``google-auth`` handles fetching and caching Google's JWKS, signature
    verification, expiry and audience checking. The issuer and email
    verification are asserted explicitly because a token can be validly signed
    yet carry an unverified email address.
    """
    if not settings.google_sign_in_enabled:
        raise InvalidGoogleCredentialError(
            "Google sign-in is not configured on this server"
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except (GoogleAuthError, ValueError) as exc:
        raise InvalidGoogleCredentialError(str(exc)) from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise InvalidGoogleCredentialError("unexpected token issuer")

    subject = claims.get("sub")
    email = claims.get("email")
    if not isinstance(subject, str) or not isinstance(email, str):
        raise InvalidGoogleCredentialError("token is missing subject or email")
    if claims.get("email_verified") is not True:
        raise InvalidGoogleCredentialError(
            "the Google account's email address is not verified"
        )

    raw_name = claims.get("name")
    raw_picture = claims.get("picture")
    return GoogleIdentity(
        subject=subject,
        email=email.lower(),
        name=raw_name if isinstance(raw_name, str) and raw_name else email,
        picture_url=raw_picture if isinstance(raw_picture, str) else None,
    )
