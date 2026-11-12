"""Сценарий стоматологической анкеты без базы данных.

Шаги: повод → здоровье → уточнения по
отмеченному (если им есть что уточнять) → о вас → готово. Модуль чистый:
получает прежние ответы и ответ на шаг, возвращает новые ответы и следующий
шаг. Сохранение — в `questionnaire_flow`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .questions import (
    ALLERGY_REACTION,
    ABOUT_GROUPS,
    HEALTH_BY_VALUE,
    HEALTH_ITEMS,
    OTHER,
    PAIN_GROUPS,
    REASON,
    Group,
    is_uncertain_choice,
)

STEP_REASON = "dental_reason"
STEP_PAIN = "dental_pain"
STEP_HEALTH = "dental_health"
STEP_DETAILS = "dental_details"
STEP_ABOUT = "dental_about"
STEP_REVIEW = "dental_review"
STEP_DONE = "done"
FIRST_STEP = STEP_REASON

HEALTH_KEY = "health"
DEFAULT_MAX_TEXT_LEN = 20000

# Порядок экрана тематический; HEALTH_ITEMS остаётся порядком печатного бланка.
HEALTH_PAGES = (
    ("Общее самочувствие", ("mouth_ulcers", "fever", "throat", "lymph", "skin_spots", "night_sweats", "diarrhea", "dry_mouth")),
    ("Инфекции и перенесённые события", ("hepatitis", "tuberculosis", "hiv", "transfusion", "injections", "jaw_trauma", "surgery")),
    ("Хронические заболевания", ("endocrine", "skin", "neurodermatitis", "urinary", "stomach", "musculoskeletal", "ent", "liver")),
    ("Сердце и сосуды", ("heart_defect", "heart_valve", "ischemia", "heart_attack", "pacemaker", "varicose", "pressure")),
    ("Нервная система и другие состояния", ("cns", "seizures", "concussion", "asthma", "diabetes", "bleeding")),
    ("Лечение, лекарства и привычки", ("weight_loss", "smoking", "oncology", "radio_chemo", "medications", "allergy", "pregnancy")),
)
HEALTH_PAGE_KEYS = tuple(f"dental_health_{number}" for number in range(1, 7))

_STEP_TITLES = {
    STEP_REASON: "Зачем пришли",
    STEP_PAIN: "Уточним про боль",
    STEP_HEALTH: "Здоровье сейчас и раньше",
    STEP_DETAILS: "Уточните, пожалуйста",
    STEP_ABOUT: "Несколько слов о вас",
    STEP_REVIEW: "Проверьте ответы перед отправкой",
}


class DentalAnswerError(ValueError):
    """Ответ не подходит к шагу: текст ошибки уходит клиенту как 400."""


class GroupAnswer(BaseModel):
    model_config = ConfigDict(frozen=True)

    selected: list[str] = Field(default_factory=list)
    text: str = ""


class AiTurn(BaseModel):
    """Уточняющий вопрос нейросети и ответ пациента."""

    model_config = ConfigDict(frozen=True)

    question: str
    choices: list[str] = Field(default_factory=list)
    answer: str = ""
    skipped: bool = False

    @property
    def is_closed(self) -> bool:
        return bool(self.answer) or self.skipped


class DentalAnswers(BaseModel):
    """Ответы пациента; хранятся в `questionnaire.dental_answers`.

    `health`: None — шаг ещё не пройден, [] — «Ничего из этого нет».
    """

    model_config = ConfigDict(frozen=True)

    # JSON без версии относится к существующему одностраничному сценарию.
    flow_version: int = 1
    form_mode: bool = False
    health: list[str] | None = None
    health_unknown: list[str] = Field(default_factory=list)
    health_answered: list[str] = Field(default_factory=list)
    groups: dict[str, GroupAnswer] = Field(default_factory=dict)
    ai: list[AiTurn] = Field(default_factory=list)
    revision: int = 0
    completed_steps: list[str] = Field(default_factory=list)
    clarification_checked: bool = False
    return_to_review: bool = False
    answered_questions: dict[str, list[str]] = Field(default_factory=dict)
    free_text_groups: list[str] = Field(default_factory=list)
    health_comments: dict[str, str] = Field(default_factory=dict)


@dataclass(frozen=True)
class DentalStep:
    step_key: str
    step_type: str
    title: str | None = None
    groups: list[dict[str, Any]] = field(default_factory=list)
    items: list[dict[str, str]] = field(default_factory=list)
    allow_none: bool = False
    allow_skip: bool = False


def has_pain(answers: DentalAnswers) -> bool:
    reason = answers.groups.get(REASON.key)
    return reason is not None and "pain" in reason.selected


def _groups_for(step: str, answers: DentalAnswers) -> tuple[Group, ...]:
    if step == STEP_REASON:
        return (REASON,)
    if step == STEP_PAIN:
        return PAIN_GROUPS
    if step == STEP_ABOUT:
        return ABOUT_GROUPS
    if step == STEP_DETAILS:
        return _detail_groups(answers)
    if answers.flow_version == 2 and step in detail_pages(answers):
        return detail_pages(answers)[step]
    raise DentalAnswerError(f"Unknown dental step {step}")


def _detail_groups(answers: DentalAnswers) -> tuple[Group, ...]:
    checked = answers.health or []
    return tuple(
        group
        for item in HEALTH_ITEMS
        if item.value in checked
        for group in item.detail_groups
    )


def detail_pages(answers: DentalAnswers) -> dict[str, tuple[Group, ...]]:
    """Уточнения в порядке бланка: до трёх групп, лекарства/аллергия отдельно."""
    pages: dict[str, tuple[Group, ...]] = {}
    pending: list[Group] = []
    first = ""

    def flush() -> None:
        nonlocal pending
        if pending:
            pages[f"dental_details_{first}"] = tuple(pending)
            pending = []

    for item in HEALTH_ITEMS:
        if item.value not in (answers.health or []) or not item.detail_groups:
            continue
        if item.value in {"medications", "allergy"}:
            flush()
            if item.value == "allergy" and answers.form_mode:
                pages["dental_details_allergy"] = (item.detail_groups[0],)
                pages["dental_details_allergy_reaction"] = (item.detail_groups[1],)
                continue
            pages[f"dental_details_{item.value}"] = item.detail_groups
            continue
        if len(pending) + len(item.detail_groups) > 3:
            flush()
        if not pending:
            first = item.value
        pending.extend(item.detail_groups)
    flush()
    return pages


def dental_route(answers: DentalAnswers) -> list[str]:
    route = [STEP_REASON]
    if answers.flow_version == 2:
        return [*route, *HEALTH_PAGE_KEYS, *detail_pages(answers), STEP_ABOUT]
    return [*route, STEP_HEALTH, *([STEP_DETAILS] if _detail_groups(answers) else []), STEP_ABOUT]


def step_title(step: str, answers: DentalAnswers) -> str:
    if step in HEALTH_PAGE_KEYS:
        return HEALTH_PAGES[HEALTH_PAGE_KEYS.index(step)][0]
    if step in detail_pages(answers):
        groups = detail_pages(answers)[step]
        titles = list(dict.fromkeys(g.title for g in groups if g.title))
        return "Уточним: " + ", ".join(titles) if titles else "Уточните, пожалуйста"
    return _STEP_TITLES.get(step, "Уточнение")


def _group_descriptor(group: Group) -> dict[str, Any]:
    text = None
    if group.text_placeholder is not None:
        text = {
            "placeholder": group.text_placeholder,
            "required": group.text_required,
            "show": group.text_show,
            **input_metadata(group.key),
        }
    return {
        "key": group.key,
        "title": group.title,
        "question": group.question,
        # Старый код неизвестной дозы принимается и печатается,
        # но не предлагается как быстрый ответ.
        "options": [] if group.key == "medications.dose" else [
            {"value": o.value, "label": o.label} for o in group.options
            if o.value != "unknown" and not is_uncertain_choice(o.label)],
        "multiple": group.multiple,
        "required": group.selection_required,
        "text": text,
    }


def input_metadata(key: str) -> dict[str, Any]:
    """Подсказки для ввода, не преобразующие исходную строку пациента."""
    from datetime import datetime, timezone
    kind = {
        "about.birth_date": "date", "about.visit_year": "year",
        "heart_attack": "year", "hepatitis": "year", "pressure": "pressure",
        "smoking": "duration", "pregnancy": "duration",
    }.get(key, "text")
    quick = {
        "about.visit_year": [str(datetime.now(timezone.utc).year), "Не помню"],
        "about.visit_clinic": ["В этой клинике", "Не помню"],
        "weight_loss": ["Намеренно снижал(а) вес", "Причину не знаю"],
        "heart_attack": ["Не помню точно"], "hepatitis": ["Не помню когда"],
        "pressure": ["Не знаю"], "smoking": ["Не помню точно"],
        "medications.dose": ["Дозу не помню"],
    }.get(key, [])
    quick = [label for label in quick if not is_uncertain_choice(label)]
    return {"input_kind": kind, "input_mode": "numeric" if kind in {"date", "year", "pressure", "duration"} else "text",
            "quick_choices": quick, "optional_reveal": key == "about.more", "max_length": DEFAULT_MAX_TEXT_LEN}


def health_state(answers: DentalAnswers, value: str) -> bool | None:
    if answers.health is None or value in answers.health_unknown or (answers.flow_version == 2 and value not in answers.health_answered):
        return None
    return value in answers.health


def _section(number: int) -> str:
    if number <= 11:
        return "Инфекции и симптомы"
    if number <= 24:
        return "Болезни и лечение"
    if number <= 36:
        return "Сердце, сосуды, нервы"
    return "Лекарства и аллергия"


def dental_step(step: str, answers: DentalAnswers) -> DentalStep:
    """Описание шага для экрана пациента."""
    if step == STEP_HEALTH or (answers.flow_version == 2 and step in HEALTH_PAGE_KEYS):
        values = HEALTH_PAGES[HEALTH_PAGE_KEYS.index(step)][1] if step in HEALTH_PAGE_KEYS else tuple(item.value for item in HEALTH_ITEMS)
        return DentalStep(
            step_key=step,
            step_type="checklist",
            title=step_title(step, answers),
            items=[
                {"value": item.value, "label": item.label, "hint": item.hint, "section": _section(item.form.number)}
                for item in (HEALTH_BY_VALUE[value] for value in values)
            ],
            allow_none=True,
        )
    return DentalStep(
        step_key=step,
        step_type="chip_groups",
        title=step_title(step, answers),
        groups=[_group_descriptor(g) for g in _groups_for(step, answers)],
    )


def _clean_text(value: str | None, max_len: int) -> str:
    text = (value or "").strip()
    if len(text) > max_len:
        raise DentalAnswerError(f"Ответ слишком длинный: не более {max_len} символов. Сократите его, данные не были обрезаны.")
    return text


def _parse_group(
    group: Group,
    selected: list[str],
    text: str,
    *, allow_free_text: bool = False,
) -> GroupAnswer:
    allowed = {o.value for o in group.options}
    unknown = [value for value in selected if value not in allowed]
    if unknown:
        raise DentalAnswerError(f"Unknown values for {group.key}: {unknown}")
    unique = list(dict.fromkeys(selected))
    if not group.multiple and len(unique) > 1:
        raise DentalAnswerError(f"Only one value allowed for {group.key}")
    text_can_replace_selection = allow_free_text and group.key != ALLERGY_REACTION
    if group.selection_required and not unique and not (text_can_replace_selection and text):
        raise DentalAnswerError(f"Choose at least one value for {group.key}")
    if text and group.text_placeholder is None and not allow_free_text:
        raise DentalAnswerError(f"Text is not allowed for {group.key}")
    needs_text = group.text_placeholder is not None and (
        group.text_required or OTHER in unique
    )
    if group.key == "medications" and not unique and not text:
        raise DentalAnswerError("Выберите препарат или напишите его название")
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
    if answers.form_mode and step == STEP_ABOUT and "about.more" not in texts and "about.more" not in selections:
        groups = tuple(group for group in groups if group.key != "about.more")
    allowed_keys = {g.key for g in groups}
    foreign = (set(selections) | set(texts)) - allowed_keys
    if foreign:
        raise DentalAnswerError(f"Groups not on this step: {sorted(foreign)}")

    parsed: dict[str, GroupAnswer] = {}
    for group in groups:
        text = _clean_text(texts.get(group.key), max_len)
        before = answers.groups.get(group.key)
        if answers.form_mode and group.options and group.key not in texts and before and before.text and OTHER not in before.selected and selections.get(group.key, []) == before.selected:
            # Скрытое старое пояснение не стирается при возврате и отправке
            # того же выбора новой формой без поля для свободного уточнения.
            text = before.text
        answer = _parse_group(
            group,
            selections.get(group.key, []),
            text,
            allow_free_text=answers.form_mode or group.key in answers.free_text_groups,
        )
        if answer.selected or answer.text:
            parsed[group.key] = answer
    # Полный ответ на шаг заменяет его прошлые значения, включая очищенные поля.
    merged = {key: value for key, value in answers.groups.items() if key not in allowed_keys}
    merged.update(parsed)
    if step == STEP_REASON and "pain" not in parsed[REASON.key].selected:
        merged = {key: value for key, value in merged.items() if not key.startswith("pain.")}
    changed = merged != answers.groups
    return answers.model_copy(update={"groups": merged,
        "free_text_groups": list(dict.fromkeys([*answers.free_text_groups, *(g.key for g in groups)])) if answers.form_mode else answers.free_text_groups,
        "ai": [] if changed else answers.ai,
        "clarification_checked": False if changed else answers.clarification_checked})


def _apply_health(
    answers: DentalAnswers,
    selections: dict[str, list[str]],
    none: bool,
    owned: set[str] | None = None,
) -> DentalAnswers:
    if set(selections) - {HEALTH_KEY, "health_unknown"}:
        raise DentalAnswerError("Only health selection allowed on this step")
    chosen = set(selections.get(HEALTH_KEY, []))
    uncertain = set(selections.get("health_unknown", []))
    unknown = (chosen | uncertain) - set(HEALTH_BY_VALUE)
    if unknown:
        raise DentalAnswerError(f"Unknown health items: {sorted(unknown)}")
    if owned is not None and (chosen | uncertain) - owned:
        raise DentalAnswerError("На этой странице доступны только её пункты здоровья")
    if chosen & uncertain:
        raise DentalAnswerError("Пункт не может одновременно иметь ответы «Да» и «Не знаю»")
    if none and (chosen or uncertain):
        raise DentalAnswerError("Either mark items or answer «none»")
    if not none and not chosen and not uncertain:
        raise DentalAnswerError("Mark items or answer «none»")
    if owned is not None:
        chosen |= set(answers.health or []) - owned
        uncertain |= set(answers.health_unknown) - owned
    ordered = [item.value for item in HEALTH_ITEMS if item.value in chosen]
    unknown_ordered = [item.value for item in HEALTH_ITEMS if item.value in uncertain]
    allowed_groups = {g.key for item in HEALTH_ITEMS if item.value in chosen for g in item.detail_groups}
    all_details = {g.key for item in HEALTH_ITEMS for g in item.detail_groups}
    groups = {key: value for key, value in answers.groups.items() if key not in all_details or key in allowed_groups}
    changed = ordered != answers.health or unknown_ordered != answers.health_unknown
    return answers.model_copy(update={"health": ordered, "health_unknown": unknown_ordered, "groups": groups,
        "health_answered": [item.value for item in HEALTH_ITEMS if item.value in (set(answers.health_answered) | owned)] if owned is not None else answers.health_answered,
        "ai": [] if changed else answers.ai,
        "completed_steps": [key for key in answers.completed_steps if not (changed and (key == STEP_DETAILS or key.startswith("dental_details_")))],
        "answered_questions": {key: value for key, value in answers.answered_questions.items()
                               if not (changed and (key == STEP_DETAILS or key.startswith('dental_details_')))},
        "clarification_checked": False if changed else answers.clarification_checked})


def _next_step(step: str, answers: DentalAnswers) -> str:
    if answers.flow_version == 2:
        route = dental_route(answers)
        return route[route.index(step) + 1] if route.index(step) + 1 < len(route) else STEP_REVIEW
    if step == STEP_REASON:
        return STEP_HEALTH
    if step == STEP_PAIN:
        return STEP_HEALTH
    if step == STEP_HEALTH:
        return STEP_DETAILS if _detail_groups(answers) else STEP_ABOUT
    if step == STEP_DETAILS:
        return STEP_ABOUT
    return STEP_REVIEW


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
    if answers.flow_version == 2 and step not in dental_route(answers):
        raise DentalAnswerError(f"Unknown dental step {step}")
    if step == STEP_HEALTH or (answers.flow_version == 2 and step in HEALTH_PAGE_KEYS):
        if texts:
            raise DentalAnswerError("На шаге здоровья доступны только отметки")
        owned = set(HEALTH_PAGES[HEALTH_PAGE_KEYS.index(step)][1]) if step in HEALTH_PAGE_KEYS else None
        updated = _apply_health(answers, selections, none, owned)
    else:
        if none:
            raise DentalAnswerError("«None» is allowed only on the health step")
        updated = _apply_groups(step, answers, selections, texts, max_len)
    return updated, _next_step(step, updated)
