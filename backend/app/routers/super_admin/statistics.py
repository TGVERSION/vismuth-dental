from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_db
from ...deps import require_roles
from ...models.service_user import ServiceUser
from ...schemas.questionnaire_statistics import SuperAdminQuestionnaireStatistics
from ...services.questionnaire_statistics import (
    all_clinics_statistics,
    resolve_period,
)

router = APIRouter(prefix="/super-admin", tags=["super-admin-statistics"])

require_super_admin = require_roles("super_admin")


@router.get("/statistics", response_model=SuperAdminQuestionnaireStatistics)
async def get_super_admin_statistics(
    period: Optional[Literal["week", "month"]] = Query(default=None),
    date_from: Optional[date] = Query(default=None, alias="from"),
    date_to: Optional[date] = Query(default=None, alias="to"),
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> SuperAdminQuestionnaireStatistics:
    try:
        start, end = resolve_period(period=period, date_from=date_from, date_to=date_to)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        ) from e
    return await all_clinics_statistics(db, start, end)
