"""Стоматологическая анкета в сценарии: сохранение ответов, уточнения
нейросети и завершение.

Чистая логика — в `services/dental` (без базы и сети); здесь — то, что
связывает её с моделью анкеты и ml-service.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from ..config import settings
from ..models.questionnaire import Questionnaire
from .dental.clarify import (
    AI_STEP,
    add_ai_question,
    ai_step,
    apply_ai_answer,
    clarify_request,
    needs_clarification,
)
from .dental.flow import (
    STEP_DONE as DENTAL_DONE,
    DentalAnswerError,
    DentalAnswers,
    apply_dental_answer,
    dental_step,
)
from .dental.summary import build_dental_summary
from .ml_proxy import proxy_post_to_ml
from .questionnaire_step import StepDescriptor

logger = logging.getLogger(__name__)

MAX_AI_CHOICES = 5


def _dental_answers(questionnaire: Questionnaire) -> DentalAnswers:
    return DentalAnswers.model_validate(questionnaire.dental_answers or {})


def build_dental_descriptor(questionnaire: Questionnaire) -> StepDescriptor:
    if questionnaire.status == "completed":
        return StepDescriptor(
            step_key=DENTAL_DONE,
            step_type=DENTAL_DONE,
            title="Спасибо, анкета у врача",
            completed=True,
        )
    answers = _dental_answers(questionnaire)
    if questionnaire.current_step == AI_STEP:
        step = ai_step(answers)
    else:
        step = dental_step(questionnaire.current_step, answers)
    return StepDescriptor(
        step_key=step.step_key,
        step_type=step.step_type,
        title=step.title,
        allow_none=step.allow_none,
        allow_skip=step.allow_skip,
        choices=step.items,
        groups=step.groups,
    )


def open_invite(questionnaire: Questionnaire) -> None:
    """Ответ по персональной ссылке: срок истёк — 410; первый ответ начинает анкету."""
    if questionnaire.status not in {"invited", "in_progress"}:
        return
    expires = questionnaire.invite_expires_at
    if expires is not None and datetime.now(timezone.utc) >= expires:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invite expired",
        )
    questionnaire.status = "in_progress"


def _parse_question(response: Any) -> tuple[str, list[str]] | None:
    """Вопрос из ответа ml-service; всё непохожее на вопрос — «спрашивать нечего»."""
    if not isinstance(response, dict) or response.get("status") != "question":
        return None
    question = response.get("question")
    if not isinstance(question, str) or not question.strip():
        return None
    raw_choices = response.get("choices")
    choices = [c.strip() for c in raw_choices if isinstance(c, str) and c.strip()] if isinstance(raw_choices, list) else []
    return question.strip(), choices[:MAX_AI_CHOICES]


async def _ask_model(questionnaire: Questionnaire, answers: DentalAnswers) -> tuple[str, list[str]] | None:
    """Вопрос нейросети или None. Сбой модели не мешает пациенту: просто без уточнений."""
    try:
        response = await proxy_post_to_ml(
            "/dental_clarify",
            clarify_request(answers),
            timeout=settings.questionnaire_ai_timeout,
        )
    except Exception:
        logger.warning("dental clarify unavailable questionnaire=%s", questionnaire.id, exc_info=True)
        questionnaire.ai_unavailable = True
        return None
    return _parse_question(response)


def _complete(questionnaire: Questionnaire, answers: DentalAnswers, now: datetime) -> None:
    structured, gaps = build_dental_summary(answers)
    questionnaire.dental_answers = answers.model_dump()
    questionnaire.structured = structured
    questionnaire.gaps = gaps
    questionnaire.processing_status = "done"
    questionnaire.status = "completed"
    questionnaire.current_step = DENTAL_DONE
    questionnaire.completed_at = now


async def _clarify_or_complete(questionnaire: Questionnaire, answers: DentalAnswers, now: datetime) -> None:
    """После последнего шага: иногда один вопрос нейросети, иначе — готово."""
    can_ask = (
        not questionnaire.ai_unavailable
        and len(answers.ai) < settings.questionnaire_dental_ai_max
        and needs_clarification(answers)
    )
    question = await _ask_model(questionnaire, answers) if can_ask else None
    if question is None:
        _complete(questionnaire, answers, now)
        return
    text, choices = question
    questionnaire.dental_answers = add_ai_question(answers, text, choices).model_dump()
    questionnaire.ai_questions_count = len(answers.ai) + 1
    questionnaire.current_step = AI_STEP


async def apply_dental(
    questionnaire: Questionnaire,
    *,
    step_key: str,
    selections: dict[str, list[str]],
    texts: dict[str, str],
    none_answer: bool,
    skip: bool,
    now: datetime,
) -> None:
    """Сохраняет ответ стоматологической анкеты; на финале — уточнения или карточка.

    Карточка строится правилами сразу, без фоновой обработки ML.
    """
    try:
        if step_key == AI_STEP and questionnaire.current_step == AI_STEP:
            answers = apply_ai_answer(
                _dental_answers(questionnaire),
                selections=selections,
                texts=texts,
                skip=skip,
                max_len=settings.questionnaire_answer_max_len,
            )
            next_step = DENTAL_DONE
        else:
            answers, next_step = apply_dental_answer(
                step_key,
                _dental_answers(questionnaire),
                selections=selections,
                texts=texts,
                none=none_answer,
                max_len=settings.questionnaire_answer_max_len,
            )
    except DentalAnswerError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if next_step != DENTAL_DONE:
        questionnaire.dental_answers = answers.model_dump()
        questionnaire.current_step = next_step
        return
    await _clarify_or_complete(questionnaire, answers, now)
