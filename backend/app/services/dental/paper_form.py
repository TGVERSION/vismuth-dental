"""Бланк «Анкета о здоровье» по ответам пациента — для листа, который он подписывает.

Строки бланка и их формулировки — в `questions.py` (`FormRow`). Здесь только
перенос ответов: «Да / Нет» строки и подпунктов, вписанный текст,
подчёркнутые варианты. Своих слов модуль не добавляет: пациент подписывает
то, что ответил сам.
"""

from __future__ import annotations

from typing import Any

from .flow import DentalAnswers, GroupAnswer
from .questions import HEALTH_ITEMS, OTHER, PROBLEMS, REASON, FormRow, HealthItem


def _answer(answers: DentalAnswers, key: str) -> GroupAnswer:
    return answers.groups.get(key, GroupAnswer())


def _text(answers: DentalAnswers, key: str) -> str:
    return _answer(answers, key).text


def _note(answers: DentalAnswers, item: HealthItem) -> str:
    """Вписанный текст строки: выбранные варианты и свой текст пациента.

    Варианты подпунктов и «нужное подчеркнуть» в него не идут — они отмечены
    в своих местах бланка; текст «Другое» стоит у подпункта «другие …».
    """
    form = item.form
    other_sub = any(value == OTHER for value, _ in form.subs)
    parts = []
    for group in item.detail_groups:
        answer = _answer(answers, group.key)
        if group.key not in (form.sub_group, form.underline_group):
            labels = {o.value: o.label for o in group.options}
            chosen = [labels[v] for v in answer.selected if v in labels and v != OTHER]
            parts.append(", ".join(chosen))
        if not (group.key == form.sub_group and other_sub):
            parts.append(answer.text)
    return "; ".join(part for part in parts if part)


def _row(answers: DentalAnswers, item: HealthItem, checked: bool) -> dict[str, Any]:
    form: FormRow = item.form
    subs_selected = _answer(answers, form.sub_group).selected if checked and form.sub_group else []
    underlined = (
        _answer(answers, form.underline_group).selected
        if checked and form.underline_group
        else []
    )
    sub_text = _text(answers, form.sub_group) if form.sub_group else ""
    return {
        "number": form.number,
        "text": form.text,
        "answer": checked if form.has_answer else None,
        "note_label": form.note,
        "note": _note(answers, item) if checked and form.note else "",
        "underline": [
            {"text": text, "selected": value in underlined} for value, text in form.underline
        ],
        "subs": [
            {
                "text": text,
                "answer": value in subs_selected,
                "note": sub_text if value == OTHER and value in subs_selected else "",
            }
            for value, text in form.subs
        ],
    }


def build_paper_form(answers: DentalAnswers) -> dict[str, Any]:
    """Всё, что вписано в бланк: шапка, 43 строки, «дополнительно сообщить»."""
    checked = set(answers.health or [])
    reasons = _answer(answers, REASON.key).selected
    return {
        "birth_date": _text(answers, "about.birth_date"),
        "visit_year": _text(answers, "about.visit_year"),
        "visit_clinic": _text(answers, "about.visit_clinic"),
        "more": _text(answers, "about.more"),
        "problems": [
            {"letter": letter, "text": text, "selected": any(r in reasons for r in values)}
            for letter, text, values in PROBLEMS
        ],
        "rows": [_row(answers, item, item.value in checked) for item in HEALTH_ITEMS],
    }
