from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.clinic import Clinic
from ..models.clinic_membership import ClinicMembership
from ..models.questionnaire import Questionnaire, QuestionnaireAnswer
from ..models.service_user import ServiceUser
from ..models.specialization import RefSpecialization
from ..services.clinic_members import load_specializations_map
from ..services.ml_proxy import proxy_post_to_ml
from ..services.questionnaire_code import allocate_code
from ..services.questionnaire_limits import ensure_clinic_subscription_active
from .dental_questionnaire import apply_dental, build_dental_descriptor, open_invite
from .questionnaire_step import StepDescriptor
from .questionnaire_dedup import answered_fixed_topics, question_was_asked
from .patient_link_context import merge_appointment
from .questionnaire_answer_guard import (
    GUARDED_STEPS, MAX_CONSECUTIVE, MAX_TOTAL, classify_answer, guard_notice,
    rejected_before, rejection_counts, stopped_descriptor,
)
from .gastro_chat_questions import GASTRO_CHAT_QUESTIONS
from .gastro_questionnaire import apply_gastro, build_gastro_descriptor, submission_fingerprint

_APPOINTMENT_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")

StepKey = Literal[
    "choose_doctor",
    "choose_specialization",
    "visit_type",
    "complaint",
    "ai_clarify",
    "medications",
    "chronic",
    "allergy",
    "stool_changes",
    "weight_changes",
    "family_history",
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


def truncate_answer(value: str) -> tuple[str, bool]:
    max_len = settings.questionnaire_answer_max_len
    if len(value) <= max_len:
        return value, False
    return value[:max_len], True


def is_valid_appointment_time(value: str) -> bool:
    """Любое HH:MM (00:00–23:59)."""
    return _APPOINTMENT_TIME_RE.fullmatch(value) is not None


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
    questionnaire.visit_type = "primary"
    if not doctor_preselected or questionnaire.doctor_membership_id is None:
        return "choose_doctor"
    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=[questionnaire.doctor_membership_id],
    )
    specs = membership_map.get(questionnaire.doctor_membership_id, [])
    if len(specs) == 1:
        questionnaire.specialization_id = specs[0]["id"]
        return "complaint"
    if len(specs) > 1:
        return "choose_specialization"
    return "complaint"


async def build_step_descriptor(
    db: AsyncSession,
    questionnaire: Questionnaire,
) -> StepDescriptor:
    if questionnaire.kind == 'general' and questionnaire.current_step == 'guard_stopped':
        return stopped_descriptor()
    descriptor = await _build_step_descriptor(db, questionnaire)
    if (questionnaire.kind == 'general' and questionnaire.id
            and questionnaire.status == 'in_progress' and questionnaire.current_step in GUARDED_STEPS):
        notice = guard_notice(await load_answers(db, questionnaire.id), questionnaire.current_step)
        if notice:
            descriptor.text = notice + '\n\n' + (descriptor.text or '')
    return descriptor


async def _build_step_descriptor(
    db: AsyncSession,
    questionnaire: Questionnaire,
) -> StepDescriptor:
    step = questionnaire.current_step

    if questionnaire.kind == "dental":
        return build_dental_descriptor(questionnaire)
    if questionnaire.kind == "gastro":
        return build_gastro_descriptor(questionnaire)

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

    if step in GASTRO_CHAT_QUESTIONS:
        question = GASTRO_CHAT_QUESTIONS[step]
        return StepDescriptor(
            step_key=step,
            step_type="text",
            text=question['text'],
            choices=[
                {"value": "none", "label": question['negative_label']},
                {"value": "unknown", "label": "Не знаю"},
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
            appointment_date=(questionnaire.gastro_answers or {}).get('appointment_context', {}).get('appointment_date'),
            appointment_time=(questionnaire.gastro_answers or {}).get('appointment_context', {}).get('appointment_time'),
            date_min=today.isoformat(),
            date_max=(
                today + timedelta(days=settings.questionnaire_appointment_days_ahead)
            ).isoformat(),
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


async def step_after_allergy(db: AsyncSession, questionnaire: Questionnaire) -> str:
    if questionnaire.visit_type != "primary":
        return "patient_info"
    specialty = (await specialization_name(db, questionnaire.specialization_id) or "").casefold()
    return "stool_changes" if "гастро" in specialty and "детск" not in specialty else "patient_info"


async def next_unanswered_general_step(
    db: AsyncSession, questionnaire: Questionnaire, step: str,
) -> str:
    if questionnaire.visit_type != "primary" or not questionnaire.id or step not in {"medications", "allergy"}:
        return step
    answered = answered_fixed_topics(await load_answers(db, questionnaire.id))
    if step == "medications" and "medications" in answered:
        return "chronic"
    if step == "allergy" and "allergy" in answered:
        return await step_after_allergy(db, questionnaire)
    return step


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

    body: dict[str, Any] = {"messages": messages}
    if questionnaire.collect_form_state is not None:
        body["state"] = questionnaire.collect_form_state

    try:
        response = await proxy_post_to_ml(
            "/collect_form",
            body,
            timeout=settings.questionnaire_ai_timeout,
        )
    except HTTPException:
        questionnaire.ai_unavailable = True
        return None
    except Exception:
        questionnaire.ai_unavailable = True
        return None

    if not isinstance(response, dict):
        return None

    status_value = response.get("status")
    if isinstance(status_value, str):
        if status_value in {"complete", "stopped"}:
            new_state = response.get("state")
            if isinstance(new_state, dict):
                questionnaire.collect_form_state = new_state
            return None
        if status_value != "question":
            return None
        question_obj = response.get("messages")
        text = None
        if isinstance(question_obj, dict):
            text = question_obj.get("text")
        if not text or not str(text).strip():
            return None
        new_state = response.get("state")
        if isinstance(new_state, dict):
            questionnaire.collect_form_state = new_state
    else:
        # Старый ml-service без status: эвристика конца сбора.
        question_obj = response.get("messages")
        text = None
        if isinstance(question_obj, dict):
            text = question_obj.get("text")
        if is_ai_done_heuristic(text, previous_q):
            return None
        new_state = response.get("state")
        if isinstance(new_state, dict):
            questionnaire.collect_form_state = new_state

    # В первичной анкете лекарства и аллергия принадлежат фиксированным
    # шагам. Без явной цели ML не показываем вопрос неизвестной тематики.
    if questionnaire.visit_type == "primary":
        target = response.get("next_field")
        if not isinstance(target, str) or target not in {"complaints", "complaints_detail"}:
            return None
    if question_was_asked(str(text), answers):
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
    return await next_unanswered_general_step(db, questionnaire, after_ai_next)


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
    selections: dict[str, list[str]] | None = None,
    texts: dict[str, str] | None = None,
    revision: int | None = None,
    answer_id: UUID | None = None,
) -> tuple[StepDescriptor, bool, bool]:
    should_process = False
    if questionnaire.kind == 'general' and questionnaire.current_step == 'guard_stopped':
        return stopped_descriptor(), False, False
    if questionnaire.kind == "gastro":
        if questionnaire.status == "completed":
            saved = questionnaire.gastro_answers or {}
            if step_key == "gastro_questions" and revision == saved.get("submission_revision") and submission_fingerprint(selections, texts, choice) == saved.get("submission_fingerprint"):
                return build_gastro_descriptor(questionnaire), False, False
            raise HTTPException(status_code=409, detail="Questionnaire already completed")
        if questionnaire.status != "in_progress" or step_key != questionnaire.current_step:
            raise HTTPException(status_code=409, detail=f"Expected step {questionnaire.current_step}")
        await apply_gastro(db, questionnaire, step_key=step_key, revision=revision, selections=selections or {}, texts=texts or {}, choice=choice)
        await db.commit()
        await db.refresh(questionnaire)
        return await build_step_descriptor(db, questionnaire), False, False
    if questionnaire.kind == "dental":
        if questionnaire.status == "invited":
            # Как у общей анкеты: новую не начинаем при истёкшей подписке,
            # начатую даём закончить.
            clinic = await db.get(Clinic, questionnaire.clinic_id)
            ensure_clinic_subscription_active(clinic)
        open_invite(questionnaire)
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

    if questionnaire.kind == "dental":
        now = datetime.now(timezone.utc)
        questionnaire.last_activity_at = now
        questionnaire.updated_at = now
        await apply_dental(
            questionnaire,
            step_key=step_key,
            selections=selections or {},
            texts=texts or {},
            none_answer=none_answer,
            skip=skip,
            now=now,
            revision=revision,
            choice=choice,
        )
        await db.commit()
        await db.refresh(questionnaire)
        truncated = False  # Стоматологические ответы сохраняются целиком либо отклоняются.
        descriptor = build_dental_descriptor(questionnaire)
        descriptor.truncated = truncated
        return descriptor, truncated, False

    truncated = False
    text_value = value
    if text_value is not None:
        text_value, truncated = truncate_answer(text_value.strip())

    now = datetime.now(timezone.utc)
    questionnaire.last_activity_at = now
    questionnaire.updated_at = now

    if (questionnaire.kind == 'general' and text_value and step_key in GUARDED_STEPS
            and 'гастро' in (await specialization_name(db, questionnaire.specialization_id) or '').casefold()):
        history = await load_answers(db, questionnaire.id)
        if rejected_before(history, answer_id):
            return await build_step_descriptor(db, questionnaire), truncated, False
        current = await _build_step_descriptor(db, questionnaire)
        if await classify_answer(current.text or '', text_value, step_key, questionnaire_id=questionnaire.id):
            consecutive, total = rejection_counts(history)
            await add_answer(db, questionnaire, step_key='guard_reject', kind='fixed',
                             question_text=str(answer_id) if answer_id else None, choice=step_key)
            if consecutive + 1 >= MAX_CONSECUTIVE or total + 1 >= MAX_TOTAL:
                await db.execute(delete(QuestionnaireAnswer).where(QuestionnaireAnswer.questionnaire_id == questionnaire.id))
                questionnaire.status = 'abandoned'
                questionnaire.current_step = 'guard_stopped'
                questionnaire.collect_form_state = None
                questionnaire.gastro_answers = None
                questionnaire.dental_answers = None
                questionnaire.structured = None
                questionnaire.gaps = None
                questionnaire.patient_first_name = None
                questionnaire.patient_middle_name = None
                questionnaire.patient_last_name = None
                questionnaire.appointment_date = None
                questionnaire.appointment_time = None
                questionnaire.code = None
                questionnaire.processing_status = None
                questionnaire.completed_at = None
            await db.commit()
            return await build_step_descriptor(db, questionnaire), truncated, False

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
        questionnaire.visit_type = "primary"
        questionnaire.doctor_membership_id = doctor_membership_id
        specs = await doctor_specializations(db, doctor_membership_id)
        if len(specs) == 1:
            questionnaire.specialization_id = specs[0]["id"]
            questionnaire.current_step = "complaint"
        elif len(specs) > 1:
            questionnaire.current_step = "choose_specialization"
        else:
            questionnaire.current_step = "complaint"

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
        questionnaire.visit_type = "primary"
        questionnaire.specialization_id = specialization_id
        questionnaire.current_step = "complaint"

    elif step_key == "visit_type":
        if choice not in {"primary", "repeat"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="visit_type must be primary or repeat",
            )
        # Compatibility for a browser that was already on the old visit-type step.
        questionnaire.visit_type = "primary"
        questionnaire.current_step = "complaint"

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
            questionnaire.current_step = await next_unanswered_general_step(db, questionnaire, after)
        else:
            question = await request_ai_question(db, questionnaire)
            questionnaire.current_step = "ai_clarify" if question else await next_unanswered_general_step(db, questionnaire, after)

    elif step_key in GASTRO_CHAT_QUESTIONS:
        question = GASTRO_CHAT_QUESTIONS[step_key]
        if skip or (choice is not None and choice not in {"none", "unknown"}):
            raise HTTPException(status_code=400, detail="Invalid answer")
        if ((choice is not None or none_answer) and text_value) or (none_answer and choice == "unknown"):
            raise HTTPException(status_code=400, detail="Choose a quick reply or send text")
        if choice == "unknown":
            answer_text = "Не знаю"
        elif choice == "none" or none_answer:
            answer_text = question['negative_text']
        elif text_value:
            answer_text = text_value
        else:
            raise HTTPException(status_code=400, detail="Answer required")
        await add_answer(db, questionnaire, step_key=step_key, kind="answer",
                         question_text=question['text'], answer_text=answer_text,
                         choice=choice or ("none" if none_answer else None))
        questionnaire.current_step = question['next']

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
            questionnaire.current_step = await next_unanswered_general_step(db, questionnaire, "allergy")
        elif step_key == "allergy":
            questionnaire.current_step = await step_after_allergy(db, questionnaire)
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
        appointment_date, appointment_time = merge_appointment(questionnaire, appointment_date, appointment_time)
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
        if not is_valid_appointment_time(appointment_time):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="appointment_time must be HH:MM",
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
