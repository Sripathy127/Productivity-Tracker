"""Request/response contracts for authentication."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GoogleSignInRequest(BaseModel):
    """The ID token produced by Google Identity Services in the browser."""

    credential: str = Field(min_length=16, max_length=8192)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    picture_url: str | None
    created_at: datetime


class SessionRead(BaseModel):
    """What the frontend needs to decide between landing page and tracker."""

    authenticated: bool
    user: UserRead | None
    google_sign_in_enabled: bool
    # Returned so the browser needs no env var of its own. An OAuth *client id*
    # is public by design (it ships in the page of every Google sign-in site);
    # the client *secret* is not used by this flow at all.
    google_client_id: str
    # True when the account came from the local dev bypass rather than Google.
    is_dev_session: bool
