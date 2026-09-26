from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.clinic import Clinic
from ..models.clinic_membership import ClinicMembership
from ..models.questionnaire import Questionnaire
from ..models.service_user import ServiceUser
from ..schemas.questionnaire_statistics import (
    AbandonedStepRow,
    ClinicQuestionnaireStatistics,
    ClinicStatisticsRow,
    DoctorStatisticsRow,
    StatisticsSummary,
    SuperAdminQuestionnaireStatistics,
)

PeriodPreset = Literal["week", "month"]

ABANDONED_STEP_ORDER: tuple[str, ...] = (
    "choose_doctor",
    "choose_specialization",
    "visit_type",
    "complaint",
    "ai_clarify",
    "medications",
    "chronic",
    "allergy",
    "repeat_change",
    "repeat_compliance",
    "repeat_side_effects",
    "patient_info",
)

_STEP_INDEX = {key: idx for idx, key in enumerate(ABANDONED_STEP_ORDER)}


def resolve_period(
    *,
    period: Optional[PeriodPreset] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    now: Optional[datetime] = None,
) -> tuple[datetime, datetime]:
    """Return half-open UTC window [start, end)."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    has_range = date_from is not None or date_to is not None
    if period is not None and has_range:
        raise ValueError("Use either period or from/to, not both")
    if has_range:
        if date_from is None or date_to is None:
            raise ValueError("Both from and to are required")
        if date_from > date_to:
            raise ValueError("from must be <= to")
        start = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc)
        end = datetime(date_to.year, date_to.month, date_to.day, tzinfo=timezone.utc) + timedelta(
            days=1,
        )
        return start, end

    preset: PeriodPreset = period or "month"
    if preset == "week":
        # Monday 00:00 UTC of the current calendar week.
        weekday = current.weekday()  # Mon=0
        day_start = datetime(
            current.year,
            current.month,
            current.day,
            tzinfo=timezone.utc,
        )
        start = day_start - timedelta(days=weekday)
        return start, current
    # month
    start = datetime(current.year, current.month, 1, tzinfo=timezone.utc)
    return start, current


def current_month_window(now: Optional[datetime] = None) -> tuple[datetime, datetime]:
    return resolve_period(period="month", now=now)


def _sort_abandoned_rows(rows: list[AbandonedStepRow]) -> list[AbandonedStepRow]:
    def key(row: AbandonedStepRow) -> tuple[int, int]:
        step_idx = _STEP_INDEX.get(row.step_key, len(ABANDONED_STEP_ORDER))
        n = row.ai_question_n if row.ai_question_n is not None else 0
        return (step_idx, n)

    return sorted(rows, key=key)


async def completed_counts_for_month(
    db: AsyncSession,
    clinic_ids: list[UUID],
    *,
    now: Optional[datetime] = None,
) -> dict[UUID, int]:
    if not clinic_ids:
        return {}
    start, end = current_month_window(now)
    result = await db.execute(
        select(Questionnaire.clinic_id, func.count())
        .where(
            Questionnaire.clinic_id.in_(clinic_ids),
            Questionnaire.status == "completed",
            Questionnaire.completed_at.is_not(None),
            Questionnaire.completed_at >= start,
            Questionnaire.completed_at < end,
        )
        .group_by(Questionnaire.clinic_id),
    )
    return {clinic_id: int(count) for clinic_id, count in result.all()}


async def clinic_statistics(
    db: AsyncSession,
    clinic_id: UUID,
    start: datetime,
    end: datetime,
) -> ClinicQuestionnaireStatistics:
    completed_filter = (
        Questionnaire.clinic_id == clinic_id,
        Questionnaire.status == "completed",
        Questionnaire.completed_at.is_not(None),
        Questionnaire.completed_at >= start,
        Questionnaire.completed_at < end,
    )

    totals_row = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(
                    func.sum(case((Questionnaire.visit_type == "primary", 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(case((Questionnaire.visit_type == "repeat", 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(case((Questionnaire.protocol_id.is_not(None), 1), else_=0)),
                    0,
                ),
            ).where(*completed_filter)
        )
    ).one()
    completed_total = int(totals_row[0] or 0)
    primary_count = int(totals_row[1] or 0)
    repeat_count = int(totals_row[2] or 0)
    protocols_total = int(totals_row[3] or 0)

    by_doctor_result = await db.execute(
        select(
            Questionnaire.doctor_membership_id,
            ServiceUser.first_name,
            ServiceUser.last_name,
            ServiceUser.middle_name,
            func.count().label("completed_count"),
            func.coalesce(
                func.sum(case((Questionnaire.protocol_id.is_not(None), 1), else_=0)),
                0,
            ).label("protocols_count"),
        )
        .outerjoin(
            ClinicMembership,
            ClinicMembership.id == Questionnaire.doctor_membership_id,
        )
        .outerjoin(ServiceUser, ServiceUser.id == ClinicMembership.user_id)
        .where(*completed_filter)
        .group_by(
            Questionnaire.doctor_membership_id,
            ServiceUser.first_name,
            ServiceUser.last_name,
            ServiceUser.middle_name,
        )
        .order_by(func.count().desc()),
    )
    by_doctor: list[DoctorStatisticsRow] = []
    for row in by_doctor_result.all():
        by_doctor.append(
            DoctorStatisticsRow(
                doctor_membership_id=row.doctor_membership_id,
                first_name=row.first_name,
                last_name=row.last_name,
                middle_name=row.middle_name,
                completed_count=int(row.completed_count),
                protocols_count=int(row.protocols_count),
            ),
        )

    abandoned_result = await db.execute(
        select(
            Questionnaire.current_step,
            Questionnaire.ai_questions_count,
            func.count(),
        )
        .where(
            Questionnaire.clinic_id == clinic_id,
            Questionnaire.status == "abandoned",
            Questionnaire.last_activity_at >= start,
            Questionnaire.last_activity_at < end,
        )
        .group_by(Questionnaire.current_step, Questionnaire.ai_questions_count),
    )
    abandoned_by_step: list[AbandonedStepRow] = []
    for step_key, ai_count, count in abandoned_result.all():
        ai_question_n = int(ai_count) if step_key == "ai_clarify" else None
        abandoned_by_step.append(
            AbandonedStepRow(
                step_key=step_key,
                ai_question_n=ai_question_n,
                count=int(count),
            ),
        )
    abandoned_by_step = _sort_abandoned_rows(abandoned_by_step)

    return ClinicQuestionnaireStatistics(
        clinic_id=clinic_id,
        period_from=start,
        period_to=end,
        completed_total=completed_total,
        primary_count=primary_count,
        repeat_count=repeat_count,
        protocols_total=protocols_total,
        by_doctor=by_doctor,
        abandoned_by_step=abandoned_by_step,
    )


def _merge_abandoned(rows: list[AbandonedStepRow]) -> list[AbandonedStepRow]:
    merged: dict[tuple[str, Optional[int]], int] = {}
    for row in rows:
        key = (row.step_key, row.ai_question_n)
        merged[key] = merged.get(key, 0) + row.count
    return _sort_abandoned_rows(
        [
            AbandonedStepRow(step_key=step, ai_question_n=n, count=count)
            for (step, n), count in merged.items()
        ],
    )


async def all_clinics_statistics(
    db: AsyncSession,
    start: datetime,
    end: datetime,
) -> SuperAdminQuestionnaireStatistics:
    result = await db.execute(
        select(Clinic)
        .where(Clinic.deleted_at.is_(None))
        .order_by(Clinic.created_at.desc()),
    )
    clinics = list(result.scalars().all())

    clinic_rows: list[ClinicStatisticsRow] = []
    for clinic in clinics:
        stats = await clinic_statistics(db, clinic.id, start, end)
        clinic_rows.append(
            ClinicStatisticsRow(
                **stats.model_dump(),
                clinic_name=clinic.name,
            ),
        )

    summary = StatisticsSummary(
        period_from=start,
        period_to=end,
        completed_total=sum(r.completed_total for r in clinic_rows),
        primary_count=sum(r.primary_count for r in clinic_rows),
        repeat_count=sum(r.repeat_count for r in clinic_rows),
        protocols_total=sum(r.protocols_total for r in clinic_rows),
        abandoned_by_step=_merge_abandoned(
            [row for clinic in clinic_rows for row in clinic.abandoned_by_step],
        ),
    )
    return SuperAdminQuestionnaireStatistics(
        period_from=start,
        period_to=end,
        clinics=clinic_rows,
        summary=summary,
    )
