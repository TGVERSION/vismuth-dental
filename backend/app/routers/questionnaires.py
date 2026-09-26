from datetime import date, datetime, timezone
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_active_doctor_membership, get_current_user
from ..models.clinic import Clinic
from ..models.protocol import Protocol, ProtocolField
from ..models.protocol_structure import ProtocolFieldMain, ProtocolStructure, ProtocolStructureField
from ..models.questionnaire import Questionnaire, QuestionnaireAnswer
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
from ..services.questionnaire_limits import ensure_clinic_subscription_active
from ..services.questionnaire_process import schedule_processing

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])


async def _answers_for_mapping(
    db: AsyncSession,
    questionnaire_id: UUID,
) -> list[QuestionnaireAnswer]:
    result = await db.execute(
        select(QuestionnaireAnswer)
        .where(QuestionnaireAnswer.questionnaire_id == questionnaire_id)
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
        visit_type=questionnaire.visit_type,
        specialization_name=spec_name,
        patient_first_name=questionnaire.patient_first_name,
        patient_middle_name=questionnaire.patient_middle_name,
        appointment_date=questionnaire.appointment_date,
        appointment_time=questionnaire.appointment_time,
        code=questionnaire.code,
        ai_unavailable=questionnaire.ai_unavailable,
        protocol_id=questionnaire.protocol_id,
        structured=questionnaire.structured,
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


@router.get("", response_model=List[DoctorQuestionnaireListItem])
async def list_questionnaires(
    name: Optional[str] = Query(default=None),
    date_filter: Optional[date] = Query(default=None, alias="date"),
    visit_type: Optional[str] = Query(default=None),
    code: Optional[str] = Query(default=None, min_length=4, max_length=4),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[DoctorQuestionnaireListItem]:
    membership = await get_active_doctor_membership(current_user, db)

    stmt = (
        select(Questionnaire, RefSpecialization.name)
        .outerjoin(
            RefSpecialization,
            RefSpecialization.id == Questionnaire.specialization_id,
        )
        .where(
            Questionnaire.doctor_membership_id == membership.id,
            Questionnaire.status == "completed",
        )
    )

    # date defaults to today; if code is set and date omitted — search all days
    if code:
        stmt = stmt.where(Questionnaire.code == code)
        if date_filter is not None:
            stmt = stmt.where(Questionnaire.appointment_date == date_filter)
    else:
        appt_date = date_filter if date_filter is not None else date.today()
        stmt = stmt.where(Questionnaire.appointment_date == appt_date)

    if visit_type:
        stmt = stmt.where(Questionnaire.visit_type == visit_type)
    if name:
        pattern = f"%{name.strip()}%"
        stmt = stmt.where(
            or_(
                Questionnaire.patient_first_name.ilike(pattern),
                Questionnaire.patient_middle_name.ilike(pattern),
            ),
        )

    stmt = stmt.order_by(Questionnaire.appointment_time.asc().nulls_last())
    result = await db.execute(stmt)
    rows = result.all()
    return [
        DoctorQuestionnaireListItem(
            id=q.id,
            appointment_time=q.appointment_time,
            patient_first_name=q.patient_first_name,
            patient_middle_name=q.patient_middle_name,
            visit_type=q.visit_type,
            specialization_name=spec_name,
            code=q.code,
            protocol_id=q.protocol_id,
            appointment_date=q.appointment_date,
        )
        for q, spec_name in rows
    ]


@router.get("/{questionnaire_id}", response_model=DoctorQuestionnaireDetail)
async def get_questionnaire(
    questionnaire_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorQuestionnaireDetail:
    membership = await get_active_doctor_membership(current_user, db)
    result = await db.execute(
        select(Questionnaire).where(
            Questionnaire.id == questionnaire_id,
            Questionnaire.doctor_membership_id == membership.id,
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
)
async def process_questionnaire(
    questionnaire_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorQuestionnaireDetail:
    membership = await get_active_doctor_membership(current_user, db)
    clinic_result = await db.execute(
        select(Clinic).where(Clinic.id == membership.clinic_id),
    )
    clinic = clinic_result.scalar_one_or_none()
    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinic not found",
        )
    ensure_clinic_subscription_active(clinic)

    result = await db.execute(
        select(Questionnaire).where(
            Questionnaire.id == questionnaire_id,
            Questionnaire.doctor_membership_id == membership.id,
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
            Questionnaire.doctor_membership_id == membership.id,
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
    if questionnaire.structured:
        mapped = _map_structured_to_fields(questionnaire.structured)
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
