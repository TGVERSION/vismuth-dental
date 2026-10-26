"""Сценарий стоматологической анкеты без базы данных.

Шаги: повод → боль (только если «Болит зуб») → здоровье → уточнения по
отмеченному → готово. Модуль чистый: получает прежние ответы и ответ на шаг,
возвращает новые ответы и следующий шаг. Сохранение — в `questionnaire_flow`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .questions import HEALTH_BY_VALUE, HEALTH_ITEMS, OTHER, PAIN_GROUPS, REASON, Group

STEP_REASON = "dental_reason"
STEP_PAIN = "dental_pain"
STEP_HEALTH = "dental_health"
STEP_DETAILS = "dental_details"
STEP_DONE = "done"
FIRST_STEP = STEP_REASON

HEALTH_KEY = "health"
DEFAULT_MAX_TEXT_LEN = 1000

_STEP_TITLES = {
    STEP_REASON: "Зачем пришли",
    STEP_PAIN: "Уточним про боль",
    STEP_HEALTH: "Что из этого у вас есть?",
    STEP_DETAILS: "Уточните, пожалуйста",
}


class DentalAnswerError(ValueError):
    """Ответ не подходит к шагу: текст ошибки уходит клиенту как 400."""


class GroupAnswer(BaseModel):
    model_config = ConfigDict(frozen=True)

    selected: list[str] = Field(default_factory=list)
    text: str = ""


class DentalAnswers(BaseModel):
    """Ответы пациента; хранятся в `questionnaire.dental_answers`.

    `health`: None — шаг ещё не пройден, [] — «Ничего из этого нет».
    """

    model_config = ConfigDict(frozen=True)

    health: list[str] | None = None
    groups: dict[str, GroupAnswer] = Field(default_factory=dict)


@dataclass(frozen=True)
class DentalStep:
    step_key: str
    step_type: str
    title: str | None = None
    groups: list[dict[str, Any]] = field(default_factory=list)
    items: list[dict[str, str]] = field(default_factory=list)
    allow_none: bool = False


def has_pain(answers: DentalAnswers) -> bool:
    reason = answers.groups.get(REASON.key)
    return reason is not None and "pain" in reason.selected


def _groups_for(step: str, answers: DentalAnswers) -> tuple[Group, ...]:
    if step == STEP_REASON:
        return (REASON,)
    if step == STEP_PAIN:
        return PAIN_GROUPS
    if step == STEP_DETAILS:
        checked = answers.health or []
        return tuple(
            group
            for item in HEALTH_ITEMS
            if item.value in checked
            for group in item.detail_groups
        )
    raise DentalAnswerError(f"Unknown dental step {step}")


def _group_descriptor(group: Group) -> dict[str, Any]:
    text = None
    if group.text_placeholder is not None:
        text = {"placeholder": group.text_placeholder, "required": group.text_required}
    return {
        "key": group.key,
        "title": group.title,
        "question": group.question,
        "options": [{"value": o.value, "label": o.label} for o in group.options],
        "multiple": group.multiple,
        "required": group.selection_required,
        "text": text,
    }


def dental_step(step: str, answers: DentalAnswers) -> DentalStep:
    """Описание шага для экрана пациента."""
    if step == STEP_HEALTH:
        return DentalStep(
            step_key=step,
            step_type="checklist",
            title=_STEP_TITLES[step],
            items=[
                {"value": item.value, "label": item.label, "hint": item.hint}
                for item in HEALTH_ITEMS
            ],
            allow_none=True,
        )
    return DentalStep(
        step_key=step,
        step_type="chip_groups",
        title=_STEP_TITLES.get(step),
        groups=[_group_descriptor(g) for g in _groups_for(step, answers)],
    )


def _clean_text(value: str | None, max_len: int) -> str:
    return (value or "").strip()[:max_len]


def _parse_group(
    group: Group,
    selected: list[str],
    text: str,
) -> GroupAnswer:
    allowed = {o.value for o in group.options}
    unknown = [value for value in selected if value not in allowed]
    if unknown:
        raise DentalAnswerError(f"Unknown values for {group.key}: {unknown}")
    unique = list(dict.fromkeys(selected))
    if not group.multiple and len(unique) > 1:
        raise DentalAnswerError(f"Only one value allowed for {group.key}")
    if group.selection_required and not unique:
        raise DentalAnswerError(f"Choose at least one value for {group.key}")
    if text and group.text_placeholder is None:
        raise DentalAnswerError(f"Text is not allowed for {group.key}")
    needs_text = group.text_placeholder is not None and (
        group.text_required or OTHER in unique
    )
    if needs_text and not text:
        raise DentalAnswerError(f"Text required for {group.key}")
    return GroupAnswer(selected=unique, text=text)


def _apply_groups(
    step: str,
    answers: DentalAnswers,
    selections: dict[str, list[str]],
    texts: dict[str, str],
    max_len: int,
) -> DentalAnswers:
    groups = _groups_for(step, answers)
    allowed_keys = {g.key for g in groups}
    foreign = (set(selections) | set(texts)) - allowed_keys
    if foreign:
        raise DentalAnswerError(f"Groups not on this step: {sorted(foreign)}")

    parsed: dict[str, GroupAnswer] = {}
    for group in groups:
        answer = _parse_group(
            group,
            selections.get(group.key, []),
            _clean_text(texts.get(group.key), max_len),
        )
        if answer.selected or answer.text:
            parsed[group.key] = answer
    return answers.model_copy(update={"groups": {**answers.groups, **parsed}})


def _apply_health(
    answers: DentalAnswers,
    selections: dict[str, list[str]],
    none: bool,
) -> DentalAnswers:
    if set(selections) - {HEALTH_KEY}:
        raise DentalAnswerError("Only health selection allowed on this step")
    chosen = set(selections.get(HEALTH_KEY, []))
    unknown = chosen - set(HEALTH_BY_VALUE)
    if unknown:
        raise DentalAnswerError(f"Unknown health items: {sorted(unknown)}")
    if none and chosen:
        raise DentalAnswerError("Either mark items or answer «none»")
    if not none and not chosen:
        raise DentalAnswerError("Mark items or answer «none»")
    ordered = [item.value for item in HEALTH_ITEMS if item.value in chosen]
    return answers.model_copy(update={"health": ordered})


def _next_step(step: str, answers: DentalAnswers) -> str:
    if step == STEP_REASON:
        return STEP_PAIN if has_pain(answers) else STEP_HEALTH
    if step == STEP_PAIN:
        return STEP_HEALTH
    if step == STEP_HEALTH:
        return STEP_DETAILS if answers.health else STEP_DONE
    return STEP_DONE


def apply_dental_answer(
    step: str,
    answers: DentalAnswers,
    *,
    selections: dict[str, list[str]],
    texts: dict[str, str],
    none: bool = False,
    max_len: int = DEFAULT_MAX_TEXT_LEN,
) -> tuple[DentalAnswers, str]:
    """Проверяет ответ на шаг и возвращает новые ответы и следующий шаг."""
    if step == STEP_HEALTH:
        updated = _apply_health(answers, selections, none)
    else:
        if none:
            raise DentalAnswerError("«None» is allowed only on the health step")
        updated = _apply_groups(step, answers, selections, texts, max_len)
    return updated, _next_step(step, updated)
