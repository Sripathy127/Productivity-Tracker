"""Sub-activity endpoints for editing and removing nested bars."""

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession
from app.models import SubActivity
from app.schemas.sub_activity import SubActivityRead, SubActivityUpdate
from app.services import activity_service

router = APIRouter(prefix="/sub-activities", tags=["sub-activities"])


@router.get("/{sub_activity_id}", response_model=SubActivityRead)
def get_sub_activity(
    sub_activity_id: int, db: DbSession, user: CurrentUser
) -> SubActivity:
    return activity_service.get_sub_activity_or_404(db, sub_activity_id, user.id)


@router.patch("/{sub_activity_id}", response_model=SubActivityRead)
def update_sub_activity(
    sub_activity_id: int,
    payload: SubActivityUpdate,
    db: DbSession,
    user: CurrentUser,
) -> SubActivity:
    return activity_service.update_sub_activity(
        db, sub_activity_id, payload, user.id
    )


@router.delete("/{sub_activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sub_activity(
    sub_activity_id: int, db: DbSession, user: CurrentUser
) -> None:
    activity_service.delete_sub_activity(db, sub_activity_id, user.id)
