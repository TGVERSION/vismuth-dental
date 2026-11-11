from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_db
from ...deps import require_roles
from ...schemas.completed_questionnaire import CompletedQuestionnaireDetail, CompletedQuestionnairePage
from ...services.questionnaire_read import completed_dates, get_completed, list_completed

router = APIRouter(prefix='/super-admin/questionnaires', tags=['super-admin-questionnaires'],
                   dependencies=[Depends(require_roles('super_admin'))])


@router.get('', response_model=CompletedQuestionnairePage)
async def list_questionnaires(
    clinic_id: UUID | None = None,
    kind: Literal['general', 'gastro', 'dental'] | None = None,
    name: str | None = Query(default=None, max_length=255),
    date_from: date | None = None, date_to: date | None = None,
    page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    by_completion: bool = False,
    utc_offset_minutes: int = Query(default=0, ge=-840, le=840),
):
    return await list_completed(db, clinic_id=clinic_id, kind=kind, name=name,
        date_from=date_from, date_to=date_to, page=page, page_size=page_size,
        by_completion=by_completion, utc_offset_minutes=utc_offset_minutes)


@router.get('/appointment-dates', response_model=list[date])
async def appointment_dates(
    clinic_id: UUID | None = None,
    kind: Literal['general', 'gastro', 'dental'] | None = None,
    name: str | None = Query(default=None, max_length=255),
    date_from: date | None = None, date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    by_completion: bool = False,
    utc_offset_minutes: int = Query(default=0, ge=-840, le=840),
):
    return await completed_dates(db, clinic_id=clinic_id, kind=kind, name=name,
                                date_from=date_from, date_to=date_to, by_completion=by_completion,
                                utc_offset_minutes=utc_offset_minutes)


@router.get('/{questionnaire_id}', response_model=CompletedQuestionnaireDetail)
async def get_questionnaire(questionnaire_id: UUID, db: AsyncSession = Depends(get_db)):
    return await get_completed(db, questionnaire_id)
