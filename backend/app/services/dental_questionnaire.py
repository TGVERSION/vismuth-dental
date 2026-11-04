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
    STEP_REASON, STEP_PAIN, STEP_HEALTH, STEP_DETAILS, STEP_ABOUT, STEP_REVIEW,
    DEFAULT_MAX_TEXT_LEN, has_pain,
    _groups_for, _parse_group,
    dental_route, detail_pages, HEALTH_PAGE_KEYS, step_title,
)
from .dental.summary import build_dental_summary
from .dental.history import dental_history
from .dental.conversation import active_group, prepare_question_answer
from .dental.questions import HEALTH_ITEMS
from .ml_proxy import proxy_post_to_ml
from .questionnaire_step import StepDescriptor

logger = logging.getLogger(__name__)

MAX_AI_CHOICES = 5


def _dental_answers(questionnaire: Questionnaire) -> DentalAnswers:
    return DentalAnswers.model_validate(questionnaire.dental_answers or {})


def _route(answers: DentalAnswers) -> list[str]:
    return dental_route(answers)


def _editable_steps(questionnaire: Questionnaire, answers: DentalAnswers) -> list[str]:
    route = _route(answers)
    # Старые незавершённые JSON без completed_steps восстанавливаются по
    # положению текущего шага в прежнем последовательном сценарии.
    if questionnaire.current_step in route:
        before = route[:route.index(questionnaire.current_step)]
    else:
        before = route
    if answers.flow_version == 2:
        return [key for key in before if key in answers.completed_steps]
    return before


def _validate_before_completion(answers: DentalAnswers) -> None:
    """Проверка экрана не позволяет обойти обязательные зависимые ответы."""
    if answers.health is None:
        raise DentalAnswerError("Подтвердите ответы о здоровье")
    if answers.flow_version == 2:
        if set(answers.health_answered) != {item.value for item in HEALTH_ITEMS}:
            raise DentalAnswerError("Ответьте на все страницы о здоровье")
        if any(step not in answers.completed_steps for step in _route(answers)):
            raise DentalAnswerError("Заполните все обязательные страницы")
    for step in _route(answers):
        if step == STEP_HEALTH or step in HEALTH_PAGE_KEYS:
            continue
        for group in _groups_for(step, answers):
            saved = answers.groups.get(group.key)
            _parse_group(group, saved.selected if saved else [], saved.text if saved else "",
                         allow_free_text=group.key in answers.free_text_groups)


def build_dental_descriptor(questionnaire: Questionnaire) -> StepDescriptor:
    if questionnaire.status == "completed":
        return StepDescriptor(
            step_key=DENTAL_DONE,
            step_type=DENTAL_DONE,
            title="Спасибо, анкета у врача",
            completed=True,
        )
    answers = _dental_answers(questionnaire)
    metadata = {"revision": answers.revision, "answers": answers.model_dump(),
                "editable_steps": _editable_steps(questionnaire, answers)}
    route = _route(answers)
    current = route.index(questionnaire.current_step) + 1 if questionnaire.current_step in route else len(route) + 1
    metadata["progress"] = {"current": current, "total": max(len(route), current),
                            "label": step_title(questionnaire.current_step, answers)}
    metadata["navigation"] = [{"step_key": key, "label": step_title(key, answers)} for key in metadata["editable_steps"]]
    metadata["history"] = dental_history(answers, metadata["editable_steps"])
    if questionnaire.current_step in HEALTH_PAGE_KEYS:
        metadata["page"] = {"kind": "health", "current": HEALTH_PAGE_KEYS.index(questionnaire.current_step) + 1, "total": 6}
    elif questionnaire.current_step in detail_pages(answers):
        pages = list(detail_pages(answers))
        metadata["page"] = {"kind": "details", "current": pages.index(questionnaire.current_step) + 1, "total": len(pages)}
    if questionnaire.current_step == STEP_REVIEW:
        structured, gaps = build_dental_summary(answers)
        metadata["review"] = {**structured, "gaps": gaps}
        return StepDescriptor(step_key=STEP_REVIEW, step_type=STEP_REVIEW,
                              title="Проверьте ответы перед отправкой", dental=metadata)
    if questionnaire.current_step == AI_STEP:
        step = ai_step(answers)
    else:
        step = dental_step(questionnaire.current_step, answers)
    groups = step.groups
    if groups:
        group = None if questionnaire.current_step == AI_STEP else active_group(questionnaire.current_step, answers)
        active = groups[0] if group is None else next(g for g in groups if g['key'] == group.key)
        # Поле доступно на любом вопросе, включая варианты без «Другое».
        groups = [{**active, 'text': {**(active.get('text') or {}), 'show': 'always',
                   'placeholder': (active.get('text') or {}).get('placeholder', 'Напишите свой ответ'),
                   'max_length': DEFAULT_MAX_TEXT_LEN}}]
        metadata['question'] = groups[0]
        metadata['question_key'] = active['key']
        metadata['allow_empty'] = not active.get('required', False) and not (active.get('text') or {}).get('required', False) and active['key'] != 'medications'
        partial = answers.answered_questions.get(questionnaire.current_step, [])
        if partial:
            metadata['history'].extend(entry for entry in dental_history(answers, [questionnaire.current_step])
                                       if entry['id'].split(':', 1)[-1] in partial)
    else:
        metadata['question_key'] = 'health'
        metadata['allow_empty'] = False
    # Прогресс считает вопросы, а не прежние страницы с несколькими полями.
    counts = {key: max(1, len(dental_step(key, answers).groups)) for key in route}
    total = sum(counts.values()) + (1 if questionnaire.current_step == AI_STEP else 0)
    done = sum(counts[key] for key in metadata['editable_steps']) + len(answers.answered_questions.get(questionnaire.current_step, []))
    metadata['conversation_progress'] = {'current': min(done + 1, total), 'total': total, 'label': step.title}
    return StepDescriptor(
        step_key=step.step_key,
        step_type=step.step_type,
        title=step.title,
        allow_none=step.allow_none,
        allow_skip=step.allow_skip,
        choices=step.items,
        groups=step.groups,
        dental=metadata,
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


def _finish_or_legacy_review(questionnaire: Questionnaire, answers: DentalAnswers, now: datetime) -> None:
    if answers.flow_version != 2 and answers.return_to_review:
        # Совместимость с уже открытым экраном проверки прежней версии.
        questionnaire.dental_answers = answers.model_dump()
        questionnaire.current_step = STEP_REVIEW
        return
    try:
        _validate_before_completion(answers)
    except DentalAnswerError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _complete(questionnaire, answers, now)


async def _clarify_or_complete(questionnaire: Questionnaire, answers: DentalAnswers, now: datetime) -> None:
    """Уточнить конкретный пробел один раз и сохранить без лишнего экрана."""
    can_ask = (
        not questionnaire.ai_unavailable
        and len(answers.ai) < settings.questionnaire_dental_ai_max
        and needs_clarification(answers)
    )
    question = await _ask_model(questionnaire, answers) if can_ask else None
    answers = answers.model_copy(update={"clarification_checked": True})
    if question is None:
        _finish_or_legacy_review(questionnaire, answers, now)
        return
    text, choices = question
    if any(turn.question.casefold().strip() == text.casefold().strip() for turn in answers.ai):
        _finish_or_legacy_review(questionnaire, answers, now)
        return
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
    revision: int | None = None,
    choice: str | None = None,
) -> None:
    """Сохраняет ответ стоматологической анкеты; на финале — уточнения или карточка.

    Карточка строится правилами сразу, без фоновой обработки ML.
    """
    saved = questionnaire.dental_answers or {}
    previous = _dental_answers(questionnaire)
    if step_key != questionnaire.current_step or (revision != previous.revision and not (revision is None and "revision" not in saved)):
        raise HTTPException(status_code=409, detail="Ответы изменились. Загрузите актуальный шаг и повторите действие.")
    if questionnaire.status != "in_progress":
        raise HTTPException(status_code=409, detail="Questionnaire already completed")
    updated_revision = previous.revision + 1
    if choice and choice.startswith('question:'):
        if skip and step_key != AI_STEP:
            raise HTTPException(status_code=400, detail='Пропуск недоступен на этом шаге')
        question_key = choice.removeprefix('question:')
        try:
            if step_key == AI_STEP:
                if question_key != 'ai':
                    raise DentalAnswerError('Ответьте на текущий вопрос')
            else:
                previous, complete, selections, texts, none_answer = prepare_question_answer(
                    step_key, previous, question_key, selections, texts, none_answer)
                if not complete:
                    questionnaire.dental_answers = previous.model_copy(update={'revision': updated_revision}).model_dump()
                    return
        except DentalAnswerError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        choice = None
    if choice and choice.startswith("edit:"):
        target = choice.removeprefix("edit:")
        if target not in _editable_steps(questionnaire, previous):
            raise HTTPException(status_code=400, detail="Этот шаг пока недоступен для исправления")
        if selections or texts or none_answer or skip:
            raise HTTPException(status_code=400, detail="Возврат не должен содержать ответ")
        was_review = questionnaire.current_step == STEP_REVIEW
        completed = list(dict.fromkeys([*previous.completed_steps, *_editable_steps(questionnaire, previous)]))
        if previous.flow_version == 2:
            if target in HEALTH_PAGE_KEYS:
                completed = [key for key in completed if not key.startswith("dental_details_")]
            # Возврат никогда не разрешает перескочить через новую ветку;
            # ответы сохраняются, но её страницы пациент проходит снова.
            previous = previous.model_copy(update={"ai": [], "clarification_checked": False,
                "return_to_review": False})
            questionnaire.ai_questions_count = 0
            questionnaire.ai_unavailable = False
        questionnaire.current_step = target
        previous = previous.model_copy(update={'answered_questions': {**previous.answered_questions, target: []}})
        questionnaire.dental_answers = previous.model_copy(update={"revision": updated_revision,
            "completed_steps": completed, "return_to_review": was_review or previous.return_to_review}).model_dump()
        return
    if step_key == STEP_REVIEW:
        if choice != "confirm" or selections or texts or none_answer or skip:
            raise HTTPException(status_code=400, detail="Подтвердите проверенные ответы или выберите шаг для исправления")
        try:
            _validate_before_completion(previous)
        except DentalAnswerError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        _complete(questionnaire, previous.model_copy(update={"revision": updated_revision}), now)
        return
    if choice or (skip and step_key != AI_STEP):
        raise HTTPException(status_code=400, detail="Действие недоступно на этом шаге")
    try:
        if step_key == AI_STEP and questionnaire.current_step == AI_STEP:
            answers = apply_ai_answer(
                previous,
                selections=selections,
                texts=texts,
                skip=skip,
                max_len=DEFAULT_MAX_TEXT_LEN,
            )
            next_step = STEP_REVIEW
        else:
            answers, next_step = apply_dental_answer(
                step_key,
                previous,
                selections=selections,
                texts=texts,
                none=none_answer,
                max_len=DEFAULT_MAX_TEXT_LEN,
            )
    except DentalAnswerError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if answers.flow_version == 2:
        completed_steps = [key for key in _route(answers) if key in {*answers.completed_steps, step_key}]
        if next_step == STEP_REVIEW and any(key not in completed_steps for key in _route(answers)):
            # Повреждённый/неполный JSON не должен завершиться через последний экран.
            raise HTTPException(status_code=400, detail="Заполните все обязательные страницы")
        next_step = next((key for key in _route(answers) if key not in completed_steps), STEP_REVIEW)
    else:
        completed_steps = [key for key in _route(answers) if key in {*answers.completed_steps, *_editable_steps(questionnaire, previous), step_key}]
    answers = answers.model_copy(update={"revision": updated_revision, "completed_steps": completed_steps})
    if answers.flow_version != 2 and answers.return_to_review:
        next_step = next((key for key in _route(answers) if key not in completed_steps), STEP_REVIEW)
        if next_step == STEP_REVIEW:
            # Данные могли появиться из старой версии: перед возвратом проверяем
            # условные обязательные поля, а не только список пройденных экранов.
            for candidate in _route(answers):
                if candidate == STEP_HEALTH:
                    continue
                try:
                    for group in _groups_for(candidate, answers):
                        saved_group = answers.groups.get(group.key)
                        _parse_group(group, saved_group.selected if saved_group else [], saved_group.text if saved_group else "")
                except DentalAnswerError:
                    next_step = candidate
                    break
    if answers.ai == [] and previous.ai:
        questionnaire.ai_questions_count = 0
        questionnaire.ai_unavailable = False
    if next_step != STEP_REVIEW:
        questionnaire.dental_answers = answers.model_dump()
        questionnaire.current_step = next_step
        return
    await _clarify_or_complete(questionnaire, answers, now)
