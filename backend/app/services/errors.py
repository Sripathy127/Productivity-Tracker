"""Domain-level exceptions that map onto HTTP responses."""

from app.schemas.common import FieldError


class ApiError(Exception):
    """Base class for errors that carry a field-addressed detail list."""

    status_code = 400

    def __init__(self, errors: list[FieldError]) -> None:
        self.errors = errors
        super().__init__("; ".join(f"{e.field}: {e.message}" for e in errors))

    @classmethod
    def single(cls, field: str, message: str) -> "ApiError":
        return cls([FieldError(field=field, message=message)])


class ValidationFailure(ApiError):
    """Input was well-formed but violated a business rule."""

    status_code = 422


class NotFoundError(ApiError):
    """A referenced record does not exist."""

    status_code = 404


class ConflictError(ApiError):
    """The request collides with existing data (e.g. a duplicate name)."""

    status_code = 409
