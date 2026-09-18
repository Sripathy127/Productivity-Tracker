"""Monthly productivity summary endpoint."""

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.routers.activities import MONTH_QUERY
from app.schemas.stats import MonthStats
from app.services.stats_service import build_month_stats
from app.services.time_range import parse_month

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/month", response_model=MonthStats)
def get_month_stats(
    db: DbSession, user: CurrentUser, month: str = MONTH_QUERY
) -> MonthStats:
    window_start, window_end = parse_month(month)
    return build_month_stats(db, month, window_start, window_end, user.id)
