"""Category endpoints. Each account has its own palette."""

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession
from app.models import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.schemas.common import FieldError
from app.services.errors import ConflictError, NotFoundError, ValidationFailure

router = APIRouter(prefix="/categories", tags=["categories"])


def _get_owned_or_404(db: Session, category_id: int, user_id: int) -> Category:
    """Fetch one of this user's categories; anything else is a 404."""
    category = db.execute(
        select(Category).where(
            Category.id == category_id, Category.user_id == user_id
        )
    ).scalar_one_or_none()
    if category is None:
        raise NotFoundError(
            [FieldError(field="id", message=f"no category with id {category_id}")]
        )
    return category


@router.get("", response_model=list[CategoryRead])
def list_categories(db: DbSession, user: CurrentUser) -> list[Category]:
    statement = (
        select(Category).where(Category.user_id == user.id).order_by(Category.id)
    )
    return list(db.execute(statement).scalars().all())


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate, db: DbSession, user: CurrentUser
) -> Category:
    category = Category(
        user_id=user.id, name=payload.name.strip(), color=payload.color.lower()
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            [
                FieldError(
                    field="name",
                    message=f"you already have a category named {payload.name!r}",
                )
            ]
        ) from exc
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: DbSession,
    user: CurrentUser,
) -> Category:
    category = _get_owned_or_404(db, category_id, user.id)
    fields = payload.model_dump(exclude_unset=True, exclude_none=True)

    if "name" in fields:
        category.name = fields["name"].strip()
    if "color" in fields:
        category.color = fields["color"].lower()

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            [
                FieldError(
                    field="name",
                    message="another of your categories already uses that name",
                )
            ]
        ) from exc
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: DbSession, user: CurrentUser) -> None:
    """Delete a custom category. Activities using it become uncategorised.

    Default categories are protected so the palette cannot be emptied by
    accident; rename or recolour them instead.
    """
    category = _get_owned_or_404(db, category_id, user.id)
    if category.is_default:
        raise ValidationFailure(
            [
                FieldError(
                    field="id",
                    message=(
                        f"{category.name!r} is a built-in category and cannot be "
                        "deleted; rename or recolour it instead"
                    ),
                )
            ]
        )
    db.delete(category)
    db.commit()
