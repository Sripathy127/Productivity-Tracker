"""Activity endpoints, including the month query that drives the timeline."""

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUser, DbSession
from app.models import Activity, SubActivity
from app.schemas.activity import ActivityCreate, ActivityRead, ActivityUpdate
from app.schemas.sub_activity import SubActivityCreate, SubActivityRead
from app.services import activity_service
from app.services.time_range import parse_month

router = APIRouter(prefix="/activities", tags=["activities"])

MONTH_QUERY = Query(
    description="Calendar month to load, formatted YYYY-MM (e.g. 2026-09).",
    examples=["2026-09"],
)


@router.get("", response_model=list[ActivityRead])
def list_activities_for_month(
    db: DbSession, user: CurrentUser, month: str = MONTH_QUERY
) -> list[Activity]:
    """The signed-in user's activities overlapping the given month.

    Activities that straddle a month boundary are included in full; the client
    clips them to the visible day rows.
    """
    window_start, window_end = parse_month(month)
    return activity_service.list_activities_overlapping(
        db, window_start, window_end, user.id
    )


@router.get("/{activity_id}", response_model=ActivityRead)
def get_activity(activity_id: int, db: DbSession, user: CurrentUser) -> Activity:
    return activity_service.get_activity_or_404(db, activity_id, user.id)


@router.post("", response_model=ActivityRead, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: ActivityCreate, db: DbSession, user: CurrentUser
) -> Activity:
    return activity_service.create_activity(db, payload, user.id)


@router.patch("/{activity_id}", response_model=ActivityRead)
def update_activity(
    activity_id: int, payload: ActivityUpdate, db: DbSession, user: CurrentUser
) -> Activity:
    return activity_service.update_activity(db, activity_id, payload, user.id)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: int, db: DbSession, user: CurrentUser) -> None:
    activity_service.delete_activity(db, activity_id, user.id)


@router.post(
    "/{activity_id}/sub-activities",
    response_model=SubActivityRead,
    status_code=status.HTTP_201_CREATED,
    tags=["sub-activities"],
)
def create_sub_activity(
    activity_id: int,
    payload: SubActivityCreate,
    db: DbSession,
    user: CurrentUser,
) -> SubActivity:
    return activity_service.create_sub_activity(db, activity_id, payload, user.id)
