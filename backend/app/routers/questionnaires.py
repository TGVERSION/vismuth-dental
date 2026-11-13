from datetime import date, datetime, time, timedelta, timezone
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_active_doctor_membership, get_current_user
from ..models.protocol import Protocol, ProtocolField
from ..models.protocol_structure import ProtocolFieldMain, ProtocolStructure, ProtocolStructureField
from ..models.questionnaire import Questionnaire, QuestionnaireAnswer
from ..models.clinic_membership import ClinicMembership
from ..models.service_user import ServiceUser
from ..models.specialization import RefSpecialization
from ..schemas.protocol import ProtocolRead
from ..schemas.questionnaire import (
    CreateProtocolFromQuestionnaireRequest,
    DoctorQuestionnaireDetail,
    DoctorQuestionnaireListItem,
    QuestionnaireAnswerItem,
)
from ..services.questionnaire_flow import specialization_name
from ..services.questionnaire_limits import ensure_user_clinic_subscription_active
from ..services.questionnaire_process import schedule_processing

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])


async def _answers_for_mapping(
    db: AsyncSession,
    questionnaire_id: UUID,
) -> list[QuestionnaireAnswer]:
    result = await db.execute(
        select(QuestionnaireAnswer)
        .where(QuestionnaireAnswer.questionnaire_id == questionnaire_id,
               QuestionnaireAnswer.step_key != 'guard_reject')
        .order_by(QuestionnaireAnswer.seq),
    )
    return list(result.scalars().all())


def _map_answers_to_fields(answers: list[QuestionnaireAnswer]) -> dict[str, str]:
    by_step: dict[str, list[str]] = {}
    ai_parts: list[str] = []
    for answer in answers:
        if answer.kind == "ai_question" and answer.question_text:
            ai_parts.append(f"ИИ: {answer.question_text}")
        elif answer.kind in {"answer", "skip", "fixed"}:
            chunks = []
            if answer.question_text:
                chunks.append(answer.question_text)
            if answer.choice:
                chunks.append(f"({answer.choice})")
            if answer.answer_text:
                chunks.append(answer.answer_text)
            elif answer.kind == "skip":
                chunks.append("пропущено")
            text = " — ".join(chunks) if chunks else ""
            if answer.step_key == "ai_clarify":
                if text:
                    ai_parts.append(f"Пациент: {answer.answer_text or 'пропущено'}")
            else:
                by_step.setdefault(answer.step_key, []).append(text)

    complaints_parts = by_step.get("complaint", []) + by_step.get("repeat_change", [])
    if ai_parts:
        complaints_parts.extend(ai_parts)
    complaints_parts.extend(by_step.get("repeat_side_effects", []))

    life_parts = by_step.get("chronic", []) + by_step.get("repeat_compliance", [])
    allergy_parts = by_step.get("allergy", [])
    meds = by_step.get("medications", [])

    result = {
        "complaints": "\n".join(p for p in complaints_parts if p),
        "life_anamnesis": "\n".join(p for p in life_parts if p),
        "allergy_anamnesis": "\n".join(p for p in allergy_parts if p),
    }
    if meds:
        prefix = "Препараты: " + "; ".join(meds)
        if result["complaints"]:
            result["complaints"] += "\n" + prefix
        else:
            result["complaints"] = prefix
    return result


def _map_structured_to_fields(structured: dict[str, Any]) -> dict[str, str]:
    result = {
        "complaints": str(structured.get("complaints") or ""),
        "life_anamnesis": str(structured.get("life_anamnesis") or ""),
        "allergy_anamnesis": str(structured.get("allergy_anamnesis") or ""),
    }
    medications = str(structured.get("medications") or "").strip()
    if medications:
        result["medications"] = medications
    return result


def _structured_for_questionnaire(questionnaire: Questionnaire) -> dict[str, Any] | None:
    if questionnaire.kind == "gastro":
        from ..services.gastro.summary import build_summary

        # Даже без сохранённой сводки исходная история доступна врачу/протоколу.
        structured, _ = build_summary(questionnaire.gastro_answers or {})
        return structured
    return questionnaire.structured


def _apply_medications_fallback(
    mapped: dict[str, str],
    structure_field_names: set[str],
) -> dict[str, str]:
    """Если в структуре нет поля medications — дописать препараты в complaints."""
    meds = mapped.get("medications")
    if not meds:
        return mapped
    if "medications" in structure_field_names:
        return mapped
    out = dict(mapped)
    prefix = f"Препараты: {meds}"
    if out.get("complaints"):
        out["complaints"] = out["complaints"] + "\n" + prefix
    else:
        out["complaints"] = prefix
    out.pop("medications", None)
    return out


async def _build_doctor_detail(
    db: AsyncSession,
    questionnaire: Questionnaire,
) -> DoctorQuestionnaireDetail:
    answers = await _answers_for_mapping(db, questionnaire.id)
    spec_name = await specialization_name(db, questionnaire.specialization_id)
    return DoctorQuestionnaireDetail(
        id=questionnaire.id,
        kind=questionnaire.kind,
        visit_type=questionnaire.visit_type,
        specialization_name=spec_name,
        patient_last_name=questionnaire.patient_last_name,
        patient_first_name=questionnaire.patient_first_name,
        patient_middle_name=questionnaire.patient_middle_name,
        appointment_date=questionnaire.appointment_date,
        appointment_time=questionnaire.appointment_time,
        code=questionnaire.code,
        ai_unavailable=questionnaire.ai_unavailable,
        protocol_id=questionnaire.protocol_id,
        structured=_structured_for_questionnaire(questionnaire),
        gaps=questionnaire.gaps,
        processing_status=questionnaire.processing_status,
        answers=[
            QuestionnaireAnswerItem(
                seq=a.seq,
                step_key=a.step_key,
                kind=a.kind,
                question_text=a.question_text,
                answer_text=a.answer_text,
                choice=a.choice,
            )
            for a in answers
        ],
    )


def _visible_to(membership: ClinicMembership):
    """Анкеты врача: свои общие и все стоматологические его клиники.

    Стоматологическая анкета, как бумажная, не привязана к врачу.
    """
    return or_(
        Questionnaire.doctor_membership_id == membership.id,
        and_(
            Questionnaire.kind == "dental",
            Questionnaire.clinic_id == membership.clinic_id,
        ),
    )


def _on_day(day: date):
    """День анкеты: у общей — дата приёма, у стоматологической — день заполнения."""
    return or_(
        and_(Questionnaire.kind != "dental", Questionnaire.appointment_date == day),
        and_(Questionnaire.kind == "dental", func.date(Questionnaire.completed_at) == day),
    )


def _name_matches(name: str):
    pattern = '%' + name.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
    return func.concat_ws(
        ' ', Questionnaire.patient_last_name, Questionnaire.patient_first_name,
        Questionnaire.patient_middle_name,
    ).ilike(pattern, escape='\\')


@router.get(
    "",
    response_model=List[DoctorQuestionnaireListItem],
    summary="Список анкет текущего врача",
)
async def list_questionnaires(
    name: Optional[str] = Query(default=None),
    date_filter: Optional[date] = Query(default=None, alias="date"),
    visit_type: Optional[str] = Query(default=None),
    code: Optional[str] = Query(default=None, min_length=4, max_length=4),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    by_completion: bool = False,
    utc_offset_minutes: int = Query(default=0, ge=-840, le=840),
    exclude_dental: bool = False,
    by_appointment: bool = False,
) -> List[DoctorQuestionnaireListItem]:
    membership = await get_active_doctor_membership(current_user, db)

    stmt = (
        select(Questionnaire, RefSpecialization.name)
        .outerjoin(
            RefSpecialization,
            RefSpecialization.id == Questionnaire.specialization_id,
        )
        .where(
            _visible_to(membership),
            Questionnaire.status == "completed",
        )
    )

    if code:
        stmt = stmt.where(Questionnaire.code == code)
    if exclude_dental:
        stmt = stmt.where(Questionnaire.kind != 'dental')
    if by_completion:
        stmt = stmt.where(Questionnaire.completed_at.is_not(None))
        if date_filter is not None:
            local_zone = timezone(timedelta(minutes=utc_offset_minutes))
            start = datetime.combine(date_filter, time.min, tzinfo=local_zone).astimezone(timezone.utc)
            stmt = stmt.where(Questionnaire.completed_at >= start, Questionnaire.completed_at < start + timedelta(days=1))
    elif by_appointment:
        stmt = stmt.where(Questionnaire.appointment_date.is_not(None))
        if date_filter is not None:
            stmt = stmt.where(Questionnaire.appointment_date == date_filter)
    elif date_filter is not None or not code:
        stmt = stmt.where(_on_day(date_filter or date.today()))

    if visit_type:
        stmt = stmt.where(Questionnaire.visit_type == visit_type)
    if name and name.strip():
        stmt = stmt.where(_name_matches(name))

    if by_completion:
        stmt = stmt.order_by(Questionnaire.completed_at.desc(), Questionnaire.id.desc()).limit(300)
    elif by_appointment:
        stmt = stmt.order_by(
            Questionnaire.appointment_date.asc().nulls_last(),
            Questionnaire.appointment_time.asc().nulls_last(),
            Questionnaire.id.asc(),
        )
    else:
        stmt = stmt.order_by(Questionnaire.appointment_time.asc().nulls_last(), Questionnaire.completed_at.desc())
    result = await db.execute(stmt)
    rows = result.all()
    return [
        DoctorQuestionnaireListItem(
            id=q.id,
            appointment_time=q.appointment_time,
            patient_last_name=q.patient_last_name,
            patient_first_name=q.patient_first_name,
            patient_middle_name=q.patient_middle_name,
            visit_type=q.visit_type,
            specialization_name=spec_name,
            code=q.code,
            protocol_id=q.protocol_id,
            appointment_date=q.appointment_date,
            completed_at=q.completed_at,
        )
        for q, spec_name in rows
    ]


@router.get('/appointment-dates', response_model=list[date])
async def appointment_dates(
    date_from: date | None = None, date_to: date | None = None,
    name: str | None = Query(default=None, max_length=255),
    code: str | None = Query(default=None, min_length=4, max_length=4),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    by_completion: bool = False,
    utc_offset_minutes: int = Query(default=0, ge=-840, le=840),
    exclude_dental: bool = False,
):
    membership = await get_active_doctor_membership(current_user, db)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, 'date_from must not be after date_to')
    day = (
        cast(func.timezone('UTC', Questionnaire.completed_at) + timedelta(minutes=utc_offset_minutes), Date)
        if by_completion
        else case((Questionnaire.kind == 'dental', func.date(Questionnaire.completed_at)),
                  else_=Questionnaire.appointment_date)
    )
    stmt = select(day).where(_visible_to(membership), Questionnaire.status == 'completed', day.is_not(None))
    if exclude_dental:
        stmt = stmt.where(Questionnaire.kind != 'dental')
    if date_from:
        stmt = stmt.where(day >= date_from)
    if date_to:
        stmt = stmt.where(day <= date_to)
    if name and name.strip():
        stmt = stmt.where(_name_matches(name))
    if isinstance(code, str):
        stmt = stmt.where(Questionnaire.code == code)
    return list((await db.execute(stmt.distinct().order_by(day))).scalars())


@router.get(
    "/{questionnaire_id}",
    response_model=DoctorQuestionnaireDetail,
    summary="Детали анкеты",
)
async def get_questionnaire(
    questionnaire_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorQuestionnaireDetail:
    membership = await get_active_doctor_membership(current_user, db)
    result = await db.execute(
        select(Questionnaire).where(
            Questionnaire.id == questionnaire_id,
            _visible_to(membership),
            Questionnaire.status == "completed",
        ),
    )
    questionnaire = result.scalar_one_or_none()
    if questionnaire is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found",
        )
    return await _build_doctor_detail(db, questionnaire)


@router.post(
    "/{questionnaire_id}/process",
    response_model=DoctorQuestionnaireDetail,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Повторно запустить ML-обработку анкеты",
    description=(
        "Ставит processing_status=pending и в фоне вызывает summarize_form. "
        "Только завершенные анкеты текущего врача; нужна активная подписка клиники."
    ),
)
async def process_questionnaire(
    questionnaire_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorQuestionnaireDetail:
    membership = await get_active_doctor_membership(current_user, db)
    await ensure_user_clinic_subscription_active(db, current_user)

    result = await db.execute(
        select(Questionnaire).where(
            Questionnaire.id == questionnaire_id,
            _visible_to(membership),
            Questionnaire.status == "completed",
        ),
    )
    questionnaire = result.scalar_one_or_none()
    if questionnaire is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found",
        )

    questionnaire.processing_status = "pending"
    questionnaire.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(questionnaire)
    schedule_processing(background_tasks, questionnaire.id)
    return await _build_doctor_detail(db, questionnaire)


@router.post(
    "/{questionnaire_id}/protocol",
    response_model=ProtocolRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать протокол из анкеты",
    description=(
        "Маппинг structured/ответов анкеты в поля выбранной структуры протокола."
    ),
)
async def create_protocol_from_questionnaire(
    questionnaire_id: UUID,
    payload: CreateProtocolFromQuestionnaireRequest,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolRead:
    membership = await get_active_doctor_membership(current_user, db)
    result = await db.execute(
        select(Questionnaire)
        .where(
            Questionnaire.id == questionnaire_id,
            _visible_to(membership),
            Questionnaire.status == "completed",
        )
        .with_for_update(),
    )
    questionnaire = result.scalar_one_or_none()
    if questionnaire is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found",
        )
    if questionnaire.protocol_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Protocol already created from this questionnaire",
        )

    structure_result = await db.execute(
        select(ProtocolStructure).where(
            ProtocolStructure.id == payload.protocol_structure_id,
            ProtocolStructure.deleted_at.is_(None),
        ),
    )
    structure = structure_result.scalar_one_or_none()
    if structure is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol structure not found",
        )

    fields_result = await db.execute(
        select(ProtocolStructureField).where(
            ProtocolStructureField.protocol_structure_id == structure.id,
        ),
    )
    structure_fields = list(fields_result.scalars().all())

    main_result = await db.execute(select(ProtocolFieldMain))
    mains = {m.id: m for m in main_result.scalars().all()}

    answers = await _answers_for_mapping(db, questionnaire.id)
    structured = _structured_for_questionnaire(questionnaire)
    if structured:
        mapped = _map_structured_to_fields(structured)
        structure_field_names = {
            mains[sf.protocol_fields_main_id].field_name
            for sf in structure_fields
            if sf.protocol_fields_main_id and sf.protocol_fields_main_id in mains
        }
        mapped = _apply_medications_fallback(mapped, structure_field_names)
    else:
        mapped = _map_answers_to_fields(answers)

    now = datetime.now(timezone.utc)
    protocol = Protocol(
        service_user=current_user.id,
        protocol_structure_id=structure.id,
        doctor_id=current_user.id,
        protocol_name=payload.protocol_name
        or f"Анкета {questionnaire.patient_first_name or ''}".strip(),
        status_protocol="draft",
        created_at=now,
        source_questionnaire_id=questionnaire.id,
        created_from_questionnaire=True,
    )
    db.add(protocol)
    await db.flush()

    field_values: dict[UUID, str | None] = {}
    for sf in structure_fields:
        main = mains.get(sf.protocol_fields_main_id) if sf.protocol_fields_main_id else None
        code = main.field_name if main else None
        value = mapped.get(code) if code else None
        if value:
            db.add(
                ProtocolField(
                    protocol_id=protocol.id,
                    field_id=sf.id,
                    field_value=value,
                ),
            )
            field_values[sf.id] = value

    questionnaire.protocol_id = protocol.id
    questionnaire.updated_at = now
    await db.commit()
    await db.refresh(protocol)

    return ProtocolRead(
        id=protocol.id,
        service_user=protocol.service_user,
        protocol_structure_id=protocol.protocol_structure_id,
        patient_id=protocol.patient_id,
        doctor_id=protocol.doctor_id,
        protocol_name=protocol.protocol_name,
        status_protocol=protocol.status_protocol,
        created_at=protocol.created_at,
        updated_at=protocol.updated_at,
        deleted_at=protocol.deleted_at,
        field_values=field_values,
        source_questionnaire_id=protocol.source_questionnaire_id,
        created_from_questionnaire=protocol.created_from_questionnaire,
    )
