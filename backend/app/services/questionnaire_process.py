"""Фоновая обработка анкеты через ML `/summarize_form`."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import AsyncSessionLocal
from ..models.questionnaire import Questionnaire, QuestionnaireAnswer
from .dental.flow import DentalAnswers
from .dental.summary import build_dental_summary
from .ml_proxy import proxy_post_to_ml
from .questionnaire_flow import load_answers, specialization_name

logger = logging.getLogger(__name__)


def build_summarize_messages(
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
        relevant_keys = {"complaint", "ai_clarify", "medications", "allergy"}

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


def extract_chronic_text(answers: list[QuestionnaireAnswer]) -> str:
    for answer in answers:
        if answer.step_key != "chronic":
            continue
        if answer.kind not in {"answer", "fixed", "skip"}:
            continue
        if answer.answer_text:
            return answer.answer_text
        if answer.kind == "skip":
            return "пропущено"
    return ""


def schedule_processing(
    background_tasks: BackgroundTasks,
    questionnaire_id: UUID,
) -> None:
    background_tasks.add_task(run_questionnaire_processing, questionnaire_id)


async def _rebuild_dental_summary(db: AsyncSession, questionnaire: Questionnaire) -> None:
    """Стоматологическая карточка собирается правилами: ML не нужен."""
    answers = DentalAnswers.model_validate(questionnaire.dental_answers or {})
    structured, gaps = build_dental_summary(answers)
    questionnaire.structured = structured
    questionnaire.gaps = gaps
    questionnaire.processing_status = "done"
    questionnaire.updated_at = datetime.now(timezone.utc)
    await db.commit()


async def run_questionnaire_processing(questionnaire_id: UUID) -> None:
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Questionnaire).where(
                    Questionnaire.id == questionnaire_id,
                    Questionnaire.status == "completed",
                ),
            )
            questionnaire = result.scalar_one_or_none()
            if questionnaire is None:
                logger.warning(
                    "Questionnaire %s not found for processing",
                    questionnaire_id,
                )
                return

            if questionnaire.kind == "dental":
                await _rebuild_dental_summary(db, questionnaire)
                return

            answers = await load_answers(db, questionnaire.id)
            spec_name = await specialization_name(
                db,
                questionnaire.specialization_id,
            )
            messages = build_summarize_messages(questionnaire, answers, spec_name)

            try:
                response = await proxy_post_to_ml(
                    "/summarize_form",
                    {"messages": messages},
                    timeout=settings.questionnaire_ai_timeout,
                )
            except HTTPException:
                questionnaire.processing_status = "failed"
                questionnaire.updated_at = datetime.now(timezone.utc)
                await db.commit()
                return
            except Exception:
                logger.exception(
                    "Unexpected error processing questionnaire %s",
                    questionnaire_id,
                )
                questionnaire.processing_status = "failed"
                questionnaire.updated_at = datetime.now(timezone.utc)
                await db.commit()
                return

            if not isinstance(response, dict):
                questionnaire.processing_status = "failed"
                questionnaire.updated_at = datetime.now(timezone.utc)
                await db.commit()
                return

            structured: dict[str, Any] = {
                "complaints": str(response.get("complaints") or ""),
                "medications": str(response.get("medications") or ""),
                "allergy_anamnesis": str(response.get("allergy_anamnesis") or ""),
                "life_anamnesis": extract_chronic_text(answers),
            }
            questionnaire.structured = structured
            if "gaps" in response:
                gaps_value = response["gaps"]
                questionnaire.gaps = gaps_value if isinstance(gaps_value, list) else []
            else:
                questionnaire.gaps = []
            questionnaire.processing_status = "done"
            questionnaire.updated_at = datetime.now(timezone.utc)
            await db.commit()
        except Exception:
            logger.exception(
                "Failed to finalize questionnaire processing %s",
                questionnaire_id,
            )
            try:
                await db.rollback()
                result = await db.execute(
                    select(Questionnaire).where(Questionnaire.id == questionnaire_id),
                )
                questionnaire = result.scalar_one_or_none()
                if questionnaire is not None:
                    questionnaire.processing_status = "failed"
                    questionnaire.updated_at = datetime.now(timezone.utc)
                    await db.commit()
            except Exception:
                logger.exception(
                    "Failed to mark questionnaire %s as failed",
                    questionnaire_id,
                )
