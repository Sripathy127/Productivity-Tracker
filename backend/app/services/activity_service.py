"""Business rules for activities and their sub-activities."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity, Category, SubActivity
from app.schemas.activity import ActivityCreate, ActivityUpdate
from app.schemas.common import FieldError
from app.schemas.sub_activity import SubActivityCreate, SubActivityUpdate
from app.services.errors import NotFoundError, ValidationFailure

MAX_SUB_ACTIVITY_PREVIEW = 3


def resolve_category(
    db: Session, category_id: int | None, user_id: int
) -> Category | None:
    """Look up one of this user's categories, rejecting anything else."""
    if category_id is None:
        return None
    category = db.execute(
        select(Category).where(
            Category.id == category_id, Category.user_id == user_id
        )
    ).scalar_one_or_none()
    if category is None:
        raise NotFoundError(
            [
                FieldError(
                    field="category_id",
                    message=f"no category with id {category_id}",
                )
            ]
        )
    return category


def get_activity_or_404(db: Session, activity_id: int, user_id: int) -> Activity:
    """Fetch an activity the user owns.

    Another account's activity yields the same 404 as a non-existent one: a
    distinct 403 would confirm that the id exists.
    """
    activity = db.execute(
        select(Activity).where(
            Activity.id == activity_id, Activity.user_id == user_id
        )
    ).scalar_one_or_none()
    if activity is None:
        raise NotFoundError(
            [FieldError(field="id", message=f"no activity with id {activity_id}")]
        )
    return activity


def get_sub_activity_or_404(
    db: Session, sub_activity_id: int, user_id: int
) -> SubActivity:
    """Fetch a sub-activity whose parent activity the user owns."""
    sub_activity = db.execute(
        select(SubActivity)
        .join(Activity, SubActivity.activity_id == Activity.id)
        .where(SubActivity.id == sub_activity_id, Activity.user_id == user_id)
    ).scalar_one_or_none()
    if sub_activity is None:
        raise NotFoundError(
            [
                FieldError(
                    field="id",
                    message=f"no sub-activity with id {sub_activity_id}",
                )
            ]
        )
    return sub_activity


def assert_within_parent(
    parent_start: datetime,
    parent_end: datetime,
    child_start: datetime,
    child_end: datetime,
    label: str,
) -> None:
    """A sub-activity must sit entirely inside its parent's window."""
    errors: list[FieldError] = []
    if child_start < parent_start:
        errors.append(
            FieldError(
                field="start_at",
                message=(
                    f"{label} starts at {child_start:%Y-%m-%d %H:%M}, before its "
                    f"activity starts at {parent_start:%Y-%m-%d %H:%M}"
                ),
            )
        )
    if child_end > parent_end:
        errors.append(
            FieldError(
                field="end_at",
                message=(
                    f"{label} ends at {child_end:%Y-%m-%d %H:%M}, after its "
                    f"activity ends at {parent_end:%Y-%m-%d %H:%M}"
                ),
            )
        )
    if errors:
        raise ValidationFailure(errors)


def assert_children_still_fit(
    activity: Activity, new_start: datetime, new_end: datetime
) -> None:
    """Reject a parent resize that would push existing children out of range.

    Silently clamping or deleting children would lose data the user typed, so
    the write is refused and the offending children are named instead.
    """
    offenders = [
        child
        for child in activity.sub_activities
        if child.start_at < new_start or child.end_at > new_end
    ]
    if not offenders:
        return

    preview = offenders[:MAX_SUB_ACTIVITY_PREVIEW]
    names = ", ".join(f"{child.title!r}" for child in preview)
    remaining = len(offenders) - len(preview)
    if remaining > 0:
        names = f"{names} and {remaining} more"

    starts_too_early = any(child.start_at < new_start for child in offenders)
    raise ValidationFailure(
        [
            FieldError(
                field="start_at" if starts_too_early else "end_at",
                message=(
                    f"the new time range would exclude {len(offenders)} existing "
                    f"sub-activity(ies) ({names}); move or delete them first"
                ),
            )
        ]
    )


def create_activity(db: Session, payload: ActivityCreate, user_id: int) -> Activity:
    resolve_category(db, payload.category_id, user_id)

    activity = Activity(
        user_id=user_id,
        title=payload.title.strip(),
        notes=payload.notes,
        start_at=payload.start_at,
        end_at=payload.end_at,
        category_id=payload.category_id,
    )

    for index, child in enumerate(payload.sub_activities):
        assert_within_parent(
            payload.start_at,
            payload.end_at,
            child.start_at,
            child.end_at,
            f"sub-activity #{index + 1} ({child.title!r})",
        )
        activity.sub_activities.append(
            SubActivity(
                title=child.title.strip(),
                notes=child.notes,
                start_at=child.start_at,
                end_at=child.end_at,
            )
        )

    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def update_activity(
    db: Session, activity_id: int, payload: ActivityUpdate, user_id: int
) -> Activity:
    activity = get_activity_or_404(db, activity_id, user_id)
    fields = payload.model_dump(exclude_unset=True)

    new_start = fields.get("start_at") or activity.start_at
    new_end = fields.get("end_at") or activity.end_at
    if new_end <= new_start:
        raise ValidationFailure(
            [FieldError(field="end_at", message="end_at must be later than start_at")]
        )
    assert_children_still_fit(activity, new_start, new_end)

    if "category_id" in fields:
        resolve_category(db, fields["category_id"], user_id)

    if fields.get("title") is not None:
        fields["title"] = fields["title"].strip()

    for key, value in fields.items():
        setattr(activity, key, value)

    db.commit()
    db.refresh(activity)
    return activity


def delete_activity(db: Session, activity_id: int, user_id: int) -> None:
    """Remove an activity; its sub-activities cascade away with it."""
    activity = get_activity_or_404(db, activity_id, user_id)
    db.delete(activity)
    db.commit()


def create_sub_activity(
    db: Session, activity_id: int, payload: SubActivityCreate, user_id: int
) -> SubActivity:
    activity = get_activity_or_404(db, activity_id, user_id)
    assert_within_parent(
        activity.start_at,
        activity.end_at,
        payload.start_at,
        payload.end_at,
        f"sub-activity {payload.title!r}",
    )

    sub_activity = SubActivity(
        activity_id=activity.id,
        title=payload.title.strip(),
        notes=payload.notes,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    db.add(sub_activity)
    db.commit()
    db.refresh(sub_activity)
    return sub_activity


def update_sub_activity(
    db: Session, sub_activity_id: int, payload: SubActivityUpdate, user_id: int
) -> SubActivity:
    sub_activity = get_sub_activity_or_404(db, sub_activity_id, user_id)
    fields = payload.model_dump(exclude_unset=True)

    new_start = fields.get("start_at") or sub_activity.start_at
    new_end = fields.get("end_at") or sub_activity.end_at
    if new_end <= new_start:
        raise ValidationFailure(
            [FieldError(field="end_at", message="end_at must be later than start_at")]
        )

    parent = get_activity_or_404(db, sub_activity.activity_id, user_id)
    assert_within_parent(
        parent.start_at,
        parent.end_at,
        new_start,
        new_end,
        f"sub-activity {sub_activity.title!r}",
    )

    if fields.get("title") is not None:
        fields["title"] = fields["title"].strip()

    for key, value in fields.items():
        setattr(sub_activity, key, value)

    db.commit()
    db.refresh(sub_activity)
    return sub_activity


def delete_sub_activity(db: Session, sub_activity_id: int, user_id: int) -> None:
    sub_activity = get_sub_activity_or_404(db, sub_activity_id, user_id)
    db.delete(sub_activity)
    db.commit()


def list_activities_overlapping(
    db: Session, window_start: datetime, window_end: datetime, user_id: int
) -> list[Activity]:
    """Activities that intersect a half-open window, earliest first.

    Overlap (rather than containment) is the right test so an activity that
    begins on the last night of the previous month still renders on day 1.
    """
    statement = (
        select(Activity)
        .where(
            Activity.user_id == user_id,
            Activity.start_at < window_end,
            Activity.end_at > window_start,
        )
        .order_by(Activity.start_at, Activity.id)
    )
    return list(db.execute(statement).unique().scalars().all())
