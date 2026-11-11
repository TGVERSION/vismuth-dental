"""Read-only completed questionnaires, shared by platform and clinic registry."""
from datetime import datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Date, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.clinic import Clinic
from ..models.questionnaire import Questionnaire
from ..models.specialization import RefSpecialization
from ..schemas.completed_questionnaire import (
    CompletedQuestionnaireDetail, CompletedQuestionnaireItem, CompletedQuestionnairePage,
)


def completed_query(*, clinic_id=None, kind=None, name=None, date_from=None, date_to=None,
                    by_completion=False, utc_offset_minutes=0):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail='date_from must not be after date_to')
    stmt = (select(Questionnaire, Clinic.name, RefSpecialization.name)
            .join(Clinic, Clinic.id == Questionnaire.clinic_id)
            .outerjoin(RefSpecialization, RefSpecialization.id == Questionnaire.specialization_id)
            .where(Questionnaire.status == 'completed'))
    if clinic_id is not None:
        stmt = stmt.where(Questionnaire.clinic_id == clinic_id)
    if kind is not None:
        stmt = stmt.where(Questionnaire.kind == kind)
    if name and name.strip():
        pattern = '%' + name.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        stmt = stmt.where(or_(
            func.concat_ws(' ', Questionnaire.patient_last_name,
                           Questionnaire.patient_first_name, Questionnaire.patient_middle_name).ilike(pattern, escape='\\'),
            func.concat_ws(' ', Questionnaire.patient_first_name,
                           Questionnaire.patient_middle_name, Questionnaire.patient_last_name).ilike(pattern, escape='\\'),
        ))
    if by_completion:
        zone = timezone(timedelta(minutes=utc_offset_minutes))
        stmt = stmt.where(Questionnaire.completed_at.is_not(None))
        if date_from:
            start = datetime.combine(date_from, time.min, tzinfo=zone).astimezone(timezone.utc)
            stmt = stmt.where(Questionnaire.completed_at >= start)
        if date_to:
            end = datetime.combine(date_to, time.min, tzinfo=zone).astimezone(timezone.utc)
            stmt = stmt.where(Questionnaire.completed_at < end + timedelta(days=1))
    else:
        if date_from:
            stmt = stmt.where(Questionnaire.appointment_date >= date_from)
        if date_to:
            stmt = stmt.where(Questionnaire.appointment_date <= date_to)
    return stmt


async def list_completed(db: AsyncSession, *, page=1, page_size=50, **filters):
    if page < 1 or not 1 <= page_size <= 100:
        raise HTTPException(status_code=422, detail='Invalid pagination')
    stmt = completed_query(**filters)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    if filters.get('by_completion'):
        stmt = stmt.order_by(Questionnaire.completed_at.desc(), Questionnaire.id.desc())
    else:
        stmt = stmt.order_by(Questionnaire.appointment_date.desc().nulls_last(), Questionnaire.appointment_time.asc().nulls_last(), Questionnaire.id.desc())
    rows = (await db.execute(stmt
                             .offset((page - 1) * page_size).limit(page_size))).all()
    items = [CompletedQuestionnaireItem(
        id=q.id, clinic_id=q.clinic_id, clinic_name=clinic_name, kind=q.kind,
        completed_at=q.completed_at, printed_at=q.printed_at, signed_at=q.signed_at,
        appointment_time=q.appointment_time, appointment_date=q.appointment_date,
        patient_last_name=q.patient_last_name, patient_first_name=q.patient_first_name,
        patient_middle_name=q.patient_middle_name, visit_type=q.visit_type,
        specialization_name=spec_name, code=q.code, protocol_id=q.protocol_id,
    ) for q, clinic_name, spec_name in rows]
    return CompletedQuestionnairePage(items=items, total=total, page=page, page_size=page_size)


async def completed_dates(db: AsyncSession, **filters):
    day = Questionnaire.appointment_date
    if filters.get('by_completion'):
        offset = timedelta(minutes=filters.get('utc_offset_minutes', 0))
        day = cast(func.timezone('UTC', Questionnaire.completed_at) + offset, Date)
    stmt = completed_query(**filters).with_only_columns(day).where(day.is_not(None)).distinct().order_by(day)
    return list((await db.execute(stmt)).scalars())


async def get_completed(db: AsyncSession, questionnaire_id: UUID, *, clinic_id=None):
    row = (await db.execute(completed_query(clinic_id=clinic_id).where(Questionnaire.id == questionnaire_id))).first()
    if row is None:
        raise HTTPException(status_code=404, detail='Questionnaire not found')
    q, clinic_name, _ = row
    # Reuse existing doctor serialization, including gastro's lossless summary fallback.
    from ..routers.questionnaires import _build_doctor_detail
    detail = await _build_doctor_detail(db, q)
    return CompletedQuestionnaireDetail(**detail.model_dump(), clinic_id=q.clinic_id,
        clinic_name=clinic_name, completed_at=q.completed_at, printed_at=q.printed_at, signed_at=q.signed_at)
