from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.clinic_membership import ClinicMembership
from ..models.questionnaire import Questionnaire, QuestionnaireAnswer
from ..models.service_user import ServiceUser
from ..models.specialization import RefSpecialization
from ..services.clinic_members import load_specializations_map
from ..services.ml_proxy import proxy_post_to_ml
from ..services.questionnaire_code import allocate_code

StepKey = Literal[
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
    "code",
]

FIXED_TEXTS: dict[str, str] = {
    "complaint": "Что вас беспокоит?",
    "medications": "Принимаете ли сейчас какие-то лекарства? Какие?",
    "chronic": "Есть ли хронические заболевания?",
    "allergy": "Есть ли аллергия на лекарства?",
    "repeat_change": "Что изменилось после прошлого приёма?",
    "repeat_compliance": "Выполняли ли назначения врача?",
    "repeat_side_effects": "Были ли побочные эффекты или новые жалобы?",
}


@dataclass
class StepDescriptor:
    step_key: str
    step_type: str
    title: Optional[str] = None
    text: Optional[str] = None
    required: bool = True
    allow_skip: bool = False
    allow_none: bool = False
    choices: list[dict[str, str]] = field(default_factory=list)
    options: list[dict[str, Any]] = field(default_factory=list)
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    time_slots: list[str] = field(default_factory=list)
    code: Optional[str] = None
    completed: bool = False
    truncated: bool = False
    ai_unavailable: bool = False


def truncate_answer(value: str) -> tuple[str, bool]:
    max_len = settings.questionnaire_answer_max_len
    if len(value) <= max_len:
        return value, False
    return value[:max_len], True


def ai_max_for(visit_type: str | None) -> int:
    if visit_type == "repeat":
        return settings.questionnaire_ai_repeat_max
    return settings.questionnaire_ai_primary_max


def is_ai_done_heuristic(
    question_text: str | None,
    previous_question: str | None,
) -> bool:
    if not question_text:
        return True
    text = question_text.strip()
    if not text:
        return True
    if "?" not in text:
        return True
    if len(text) > 300:
        return True
    if previous_question and text == previous_question.strip():
        return True
    return False


async def next_answer_seq(db: AsyncSession, questionnaire_id: UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(QuestionnaireAnswer.seq), 0)).where(
            QuestionnaireAnswer.questionnaire_id == questionnaire_id,
        ),
    )
    return int(result.scalar_one() or 0) + 1


async def add_answer(
    db: AsyncSession,
    questionnaire: Questionnaire,
    *,
    step_key: str,
    kind: str,
    question_text: str | None = None,
    answer_text: str | None = None,
    choice: str | None = None,
) -> QuestionnaireAnswer:
    seq = await next_answer_seq(db, questionnaire.id)
    row = QuestionnaireAnswer(
        questionnaire_id=questionnaire.id,
        seq=seq,
        step_key=step_key,
        kind=kind,
        question_text=question_text,
        answer_text=answer_text,
        choice=choice,
    )
    db.add(row)
    return row


async def load_answers(
    db: AsyncSession,
    questionnaire_id: UUID,
) -> list[QuestionnaireAnswer]:
    result = await db.execute(
        select(QuestionnaireAnswer)
        .where(QuestionnaireAnswer.questionnaire_id == questionnaire_id)
        .order_by(QuestionnaireAnswer.seq),
    )
    return list(result.scalars().all())


async def resolve_initial_step(
    db: AsyncSession,
    questionnaire: Questionnaire,
    *,
    doctor_preselected: bool,
) -> str:
    if not doctor_preselected or questionnaire.doctor_membership_id is None:
        return "choose_doctor"
    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=[questionnaire.doctor_membership_id],
    )
    specs = membership_map.get(questionnaire.doctor_membership_id, [])
    if len(specs) == 1:
        questionnaire.specialization_id = specs[0]["id"]
        return "visit_type"
    if len(specs) > 1:
        return "choose_specialization"
    return "visit_type"


async def build_step_descriptor(
    db: AsyncSession,
    questionnaire: Questionnaire,
) -> StepDescriptor:
    step = questionnaire.current_step

    if questionnaire.status == "completed" or step == "code":
        return StepDescriptor(
            step_key="code",
            step_type="code",
            title="Назовите этот код врачу на приёме",
            code=questionnaire.code,
            completed=True,
            ai_unavailable=questionnaire.ai_unavailable,
        )

    if step == "choose_doctor":
        doctors = await list_active_doctors(db, questionnaire.clinic_id)
        return StepDescriptor(
            step_key="choose_doctor",
            step_type="choose_doctor",
            title="Выберите врача",
            options=doctors,
        )

    if step == "choose_specialization":
        specs = await doctor_specializations(db, questionnaire.doctor_membership_id)
        return StepDescriptor(
            step_key="choose_specialization",
            step_type="choose_specialization",
            title="К какому специалисту вы записаны?",
            options=specs,
        )

    if step == "visit_type":
        return StepDescriptor(
            step_key="visit_type",
            step_type="choice",
            title="Тип приёма",
            choices=[
                {"value": "primary", "label": "Первичный"},
                {"value": "repeat", "label": "Повторный"},
            ],
        )

    if step in FIXED_TEXTS:
        allow_none = step in {
            "medications",
            "chronic",
            "allergy",
            "repeat_side_effects",
        }
        choices: list[dict[str, str]] = []
        step_type = "text"
        if step == "repeat_change":
            step_type = "choice_text"
            choices = [
                {"value": "better", "label": "Лучше"},
                {"value": "worse", "label": "Хуже"},
                {"value": "same", "label": "Без изменений"},
            ]
        elif step == "repeat_compliance":
            step_type = "choice"
            choices = [
                {"value": "yes", "label": "Да"},
                {"value": "partial", "label": "Частично"},
                {"value": "no", "label": "Нет"},
            ]
        elif allow_none:
            step_type = "text_or_none"
        return StepDescriptor(
            step_key=step,
            step_type=step_type,
            text=FIXED_TEXTS[step],
            allow_none=allow_none,
            choices=choices,
        )

    if step == "ai_clarify":
        answers = await load_answers(db, questionnaire.id)
        last_q = next(
            (
                a
                for a in reversed(answers)
                if a.kind == "ai_question" and a.step_key == "ai_clarify"
            ),
            None,
        )
        return StepDescriptor(
            step_key="ai_clarify",
            step_type="ai_question",
            text=last_q.question_text if last_q else None,
            allow_skip=True,
            ai_unavailable=questionnaire.ai_unavailable,
        )

    if step == "patient_info":
        today = date.today()
        return StepDescriptor(
            step_key="patient_info",
            step_type="patient_info",
            title="Имя, отчество, дата и время приёма",
            date_min=today.isoformat(),
            date_max=(
                today + timedelta(days=settings.questionnaire_appointment_days_ahead)
            ).isoformat(),
            time_slots=settings.appointment_time_slots,
        )

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Unknown step {step}",
    )


async def list_active_doctors(
    db: AsyncSession,
    clinic_id: UUID,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ClinicMembership, ServiceUser)
        .join(ServiceUser, ServiceUser.id == ClinicMembership.user_id)
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.is_doctor.is_(True),
            ClinicMembership.status == "active",
            ClinicMembership.deleted_at.is_(None),
            ServiceUser.deleted_at.is_(None),
            ServiceUser.is_active.is_(True),
        )
        .order_by(ServiceUser.last_name, ServiceUser.first_name),
    )
    rows = list(result.all())
    membership_ids = [m.id for m, _ in rows]
    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=membership_ids,
    )
    out: list[dict[str, Any]] = []
    for membership, user in rows:
        out.append(
            {
                "membership_id": str(membership.id),
                "public_slug": membership.public_slug,
                "photo_url": membership.photo_url,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "middle_name": user.middle_name,
                "specializations": membership_map.get(membership.id, []),
            },
        )
    return out


async def doctor_specializations(
    db: AsyncSession,
    membership_id: UUID | None,
) -> list[dict[str, Any]]:
    if membership_id is None:
        return []
    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=[membership_id],
    )
    return membership_map.get(membership_id, [])


async def specialization_name(
    db: AsyncSession,
    specialization_id: int | None,
) -> str | None:
    if specialization_id is None:
        return None
    result = await db.execute(
        select(RefSpecialization.name).where(RefSpecialization.id == specialization_id),
    )
    return result.scalar_one_or_none()


def build_collect_messages(
    questionnaire: Questionnaire,
    answers: list[QuestionnaireAnswer],
    specialization_name_value: str | None,
) -> list[dict[str, str]]:
    visit_label = (
        "первичный" if questionnaire.visit_type == "primary" else "повторный"
    )
    context = (
        f"Контекст: специализация — {specialization_name_value or 'не указана'}, "
        f"приём {visit_label}."
    )
    messages: list[dict[str, str]] = [{"role": "user", "text": context}]

    if questionnaire.visit_type == "repeat":
        relevant_keys = {"repeat_change", "repeat_side_effects", "ai_clarify"}
    else:
        relevant_keys = {"complaint", "ai_clarify"}

    for answer in answers:
        if answer.step_key not in relevant_keys:
            continue
        if answer.kind == "ai_question" and answer.question_text:
            messages.append({"role": "assistant", "text": answer.question_text})
        elif answer.kind in {"answer", "fixed", "skip"}:
            parts = []
            if answer.question_text:
                parts.append(answer.question_text)
            if answer.choice:
                parts.append(f"Выбор: {answer.choice}")
            if answer.answer_text:
                parts.append(answer.answer_text)
            elif answer.kind == "skip":
                parts.append("Пациент пропустил вопрос")
            if parts:
                messages.append({"role": "user", "text": "\n".join(parts)})
    return messages


async def request_ai_question(
    db: AsyncSession,
    questionnaire: Questionnaire,
) -> str | None:
    if questionnaire.ai_unavailable:
        return None
    if questionnaire.ai_questions_count >= ai_max_for(questionnaire.visit_type):
        return None

    answers = await load_answers(db, questionnaire.id)
    spec_name = await specialization_name(db, questionnaire.specialization_id)
    messages = build_collect_messages(questionnaire, answers, spec_name)
    previous_q = next(
        (
            a.question_text
            for a in reversed(answers)
            if a.kind == "ai_question"
        ),
        None,
    )

    try:
        response = await proxy_post_to_ml(
            "/collect_form",
            {"messages": messages},
            timeout=settings.questionnaire_ai_timeout,
        )
    except HTTPException:
        questionnaire.ai_unavailable = True
        return None
    except Exception:
        questionnaire.ai_unavailable = True
        return None

    question_obj = response.get("messages") if isinstance(response, dict) else None
    text = None
    if isinstance(question_obj, dict):
        text = question_obj.get("text")
    if is_ai_done_heuristic(text, previous_q):
        return None

    await add_answer(
        db,
        questionnaire,
        step_key="ai_clarify",
        kind="ai_question",
        question_text=text,
    )
    questionnaire.ai_questions_count += 1
    return text


async def enter_ai_or_next(
    db: AsyncSession,
    questionnaire: Questionnaire,
    after_ai_next: str,
) -> str:
    question = await request_ai_question(db, questionnaire)
    if question:
        return "ai_clarify"
    return after_ai_next


async def apply_answer(
    db: AsyncSession,
    questionnaire: Questionnaire,
    *,
    step_key: str,
    value: str | None = None,
    choice: str | None = None,
    skip: bool = False,
    doctor_membership_id: UUID | None = None,
    specialization_id: int | None = None,
    first_name: str | None = None,
    middle_name: str | None = None,
    appointment_date: date | None = None,
    appointment_time: str | None = None,
    none_answer: bool = False,
) -> tuple[StepDescriptor, bool, bool]:
    should_process = False
    if questionnaire.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questionnaire is not in progress",
        )
    if step_key != questionnaire.current_step:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Expected step {questionnaire.current_step}",
        )

    truncated = False
    text_value = value
    if text_value is not None:
        text_value, truncated = truncate_answer(text_value.strip())

    now = datetime.now(timezone.utc)
    questionnaire.last_activity_at = now
    questionnaire.updated_at = now

    if step_key == "choose_doctor":
        if doctor_membership_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="doctor_membership_id required",
            )
        membership = await db.execute(
            select(ClinicMembership).where(
                ClinicMembership.id == doctor_membership_id,
                ClinicMembership.clinic_id == questionnaire.clinic_id,
                ClinicMembership.is_doctor.is_(True),
                ClinicMembership.status == "active",
                ClinicMembership.deleted_at.is_(None),
            ),
        )
        if membership.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor not available",
            )
        questionnaire.doctor_membership_id = doctor_membership_id
        specs = await doctor_specializations(db, doctor_membership_id)
        if len(specs) == 1:
            questionnaire.specialization_id = specs[0]["id"]
            questionnaire.current_step = "visit_type"
        elif len(specs) > 1:
            questionnaire.current_step = "choose_specialization"
        else:
            questionnaire.current_step = "visit_type"

    elif step_key == "choose_specialization":
        if specialization_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="specialization_id required",
            )
        specs = await doctor_specializations(db, questionnaire.doctor_membership_id)
        if specialization_id not in {s["id"] for s in specs}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specialization not available for doctor",
            )
        questionnaire.specialization_id = specialization_id
        questionnaire.current_step = "visit_type"

    elif step_key == "visit_type":
        if choice not in {"primary", "repeat"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="visit_type must be primary or repeat",
            )
        questionnaire.visit_type = choice
        if choice == "primary":
            questionnaire.current_step = "complaint"
        else:
            questionnaire.current_step = "repeat_change"

    elif step_key == "complaint":
        if not text_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Complaint is required",
            )
        await add_answer(
            db,
            questionnaire,
            step_key=step_key,
            kind="answer",
            question_text=FIXED_TEXTS[step_key],
            answer_text=text_value,
        )
        questionnaire.current_step = await enter_ai_or_next(
            db,
            questionnaire,
            "medications",
        )

    elif step_key == "ai_clarify":
        last_q = None
        answers = await load_answers(db, questionnaire.id)
        for a in reversed(answers):
            if a.kind == "ai_question":
                last_q = a
                break
        if skip:
            await add_answer(
                db,
                questionnaire,
                step_key=step_key,
                kind="skip",
                question_text=last_q.question_text if last_q else None,
            )
        else:
            if text_value is None and not none_answer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Answer text required",
                )
            await add_answer(
                db,
                questionnaire,
                step_key=step_key,
                kind="answer",
                question_text=last_q.question_text if last_q else None,
                answer_text=text_value or "",
            )

        after = "medications" if questionnaire.visit_type == "primary" else "patient_info"
        if questionnaire.ai_questions_count >= ai_max_for(questionnaire.visit_type):
            questionnaire.current_step = after
        else:
            question = await request_ai_question(db, questionnaire)
            questionnaire.current_step = "ai_clarify" if question else after

    elif step_key in {"medications", "chronic", "allergy", "repeat_side_effects"}:
        answer_text = "нет" if none_answer else text_value
        if answer_text is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Answer required",
            )
        await add_answer(
            db,
            questionnaire,
            step_key=step_key,
            kind="answer",
            question_text=FIXED_TEXTS[step_key],
            answer_text=answer_text,
            choice="none" if none_answer else None,
        )
        if step_key == "medications":
            questionnaire.current_step = "chronic"
        elif step_key == "chronic":
            questionnaire.current_step = "allergy"
        elif step_key == "allergy":
            questionnaire.current_step = "patient_info"
        else:
            questionnaire.current_step = await enter_ai_or_next(
                db,
                questionnaire,
                "patient_info",
            )

    elif step_key == "repeat_change":
        if choice not in {"better", "worse", "same"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid choice",
            )
        await add_answer(
            db,
            questionnaire,
            step_key=step_key,
            kind="answer",
            question_text=FIXED_TEXTS[step_key],
            answer_text=text_value,
            choice=choice,
        )
        questionnaire.current_step = "repeat_compliance"

    elif step_key == "repeat_compliance":
        if choice not in {"yes", "partial", "no"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid choice",
            )
        await add_answer(
            db,
            questionnaire,
            step_key=step_key,
            kind="answer",
            question_text=FIXED_TEXTS[step_key],
            choice=choice,
        )
        questionnaire.current_step = "repeat_side_effects"

    elif step_key == "patient_info":
        if not first_name or not appointment_date or not appointment_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_name, appointment_date and appointment_time required",
            )
        today = date.today()
        max_date = today + timedelta(days=settings.questionnaire_appointment_days_ahead)
        if appointment_date < today or appointment_date > max_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="appointment_date out of range",
            )
        if appointment_time not in settings.appointment_time_slots:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="appointment_time not in allowed slots",
            )
        first_name, trunc1 = truncate_answer(first_name.strip())
        middle = middle_name.strip() if middle_name else None
        trunc2 = False
        if middle:
            middle, trunc2 = truncate_answer(middle)
        truncated = trunc1 or trunc2

        questionnaire.patient_first_name = first_name
        questionnaire.patient_middle_name = middle
        questionnaire.appointment_date = appointment_date
        questionnaire.appointment_time = appointment_time
        questionnaire.code = await allocate_code(db, questionnaire.clinic_id)
        questionnaire.status = "completed"
        questionnaire.completed_at = now
        questionnaire.current_step = "code"
        questionnaire.processing_status = "pending"
        should_process = True

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported step {step_key}",
        )

    await db.commit()
    await db.refresh(questionnaire)
    descriptor = await build_step_descriptor(db, questionnaire)
    descriptor.truncated = truncated
    return descriptor, truncated, should_process
