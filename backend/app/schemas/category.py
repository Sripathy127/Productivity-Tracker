"""Request/response contracts for activity categories."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import HEX_COLOR_PATTERN


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(pattern=HEX_COLOR_PATTERN)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    """Every field optional: this backs a PATCH."""

    name: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = Field(default=None, pattern=HEX_COLOR_PATTERN)


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_default: bool
    created_at: datetime
