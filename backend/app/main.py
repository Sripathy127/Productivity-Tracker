"""FastAPI application factory."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import Settings, get_settings
from app.core.db import Base, engine
from app.models import Activity, Category, SubActivity, User  # noqa: F401  (register tables)
from app.routers import activities, auth, categories, stats, sub_activities
from app.schemas.common import ErrorResponse, FieldError
from app.services.errors import ApiError

logger = logging.getLogger("productivity_tracker")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Create tables on start-up.

    ``create_all`` is adequate here because the schema is owned solely by this
    service and evolves additively. A dedicated migration tool would be the
    next step if the data model starts changing under live data.

    Categories are *not* seeded here: the palette is per-account and is created
    when an account first signs in.
    """
    Base.metadata.create_all(bind=engine)
    yield


def _error_response(status_code: int, errors: list[FieldError]) -> JSONResponse:
    payload = ErrorResponse(detail=errors)
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="Productivity Tracker API",
        description=(
            "Hour-resolution activity tracking for a month-at-a-glance Gantt "
            "timeline. Timestamps are naive local wall-clock values."
        ),
        version="2.0.0",
        lifespan=lifespan,
    )
    # Exposed so request-scoped dependencies read the same settings the factory
    # was built with, which is what lets tests inject their own.
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        # Required for the session cookie to be sent on cross-origin calls.
        # Note this forbids the `*` origin wildcard, which is why the allowed
        # origins are enumerated explicitly.
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        logger.info("Rejected request: %s", exc)
        return _error_response(exc.status_code, exc.errors)

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Flatten Pydantic's error list into this API's error envelope."""
        errors = [
            FieldError(
                field=".".join(str(part) for part in error["loc"][1:]) or "body",
                message=str(error["msg"]).removeprefix("Value error, "),
            )
            for error in exc.errors()
        ]
        return _error_response(422, errors)

    api_prefix = settings.api_prefix
    for module in (auth, categories, activities, sub_activities, stats):
        app.include_router(module.router, prefix=api_prefix)

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    if settings.auth_dev_bypass:
        logger.warning(
            "AUTH_DEV_BYPASS is enabled: every unauthenticated request is "
            "treated as %s. Never enable this in a deployment.",
            settings.dev_user_email,
        )

    return app


app = create_app()
