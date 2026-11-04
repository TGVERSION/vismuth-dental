"""Бланк «Анкета о здоровье» по ответам пациента — для листа, который он подписывает.

Строки бланка и их формулировки — в `questions.py` (`FormRow`). Здесь только
перенос ответов: «Да / Нет» строки и подпунктов, вписанный текст,
подчёркнутые варианты. Своих слов модуль не добавляет: пациент подписывает
то, что ответил сам.
"""

from __future__ import annotations

from typing import Any

from .flow import DentalAnswers, GroupAnswer, health_state
from .questions import HEALTH_ITEMS, OTHER, PROBLEMS, REASON, PAIN_GROUPS, FormRow, HealthItem
from .conversation import health_free_reference


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


def _row(answers: DentalAnswers, item: HealthItem, checked: bool | None) -> dict[str, Any]:
    form: FormRow = item.form
    subs_selected = _answer(answers, form.sub_group).selected if checked and form.sub_group else []
    underlined = (
        _answer(answers, form.underline_group).selected
        if checked and form.underline_group
        else []
    )
    sub_text = _text(answers, form.sub_group) if form.sub_group else ""
    # При одной категории название относится к ней. При нескольких связь
    # пациент не уточнял: общий исходный текст сохраняется отдельно в more.
    named_sub = OTHER if OTHER in subs_selected else (subs_selected[0] if item.value == "allergy" and len(subs_selected) == 1 else None)
    uncertainty = health_free_reference(answers, item.value) or ("Не знаю" if item.value in answers.health_unknown else "Не отвечено")
    return {
        "number": form.number,
        "text": form.text,
        "answer": checked if form.has_answer else None,
        "note_label": "Ответ пациента" if checked is None else form.note,
        "note": uncertainty if checked is None else (_note(answers, item) if checked and form.note else ""),
        "underline": [
            {"text": text, "selected": value in underlined} for value, text in form.underline
        ],
        "subs": [
            {
                "text": text,
                "answer": None if checked is None else value in subs_selected,
                "note": sub_text if checked and value == named_sub else "",
            }
            for value, text in form.subs
        ],
    }


def build_paper_form(answers: DentalAnswers) -> dict[str, Any]:
    """Всё, что вписано в бланк: шапка, 43 строки, «дополнительно сообщить»."""
    checked = set(answers.health or [])
    reasons = _answer(answers, REASON.key).selected
    extra = [_text(answers, "about.more")]
    from .flow import dental_step
    extra.extend(f"{dental_step(key, answers).title} — свободный ответ: {comment}"
                 for key, comment in answers.health_comments.items())
    free_groups = [*PAIN_GROUPS, *(group for item in HEALTH_ITEMS for group in item.detail_groups)]
    reason_text = _text(answers, REASON.key)
    if reason_text:
        extra.append(f"Повод визита (свой ответ): {reason_text}")
    for item in HEALTH_ITEMS:
        if item.value not in checked:
            continue
        detail = _note(answers, item)
        if detail and not item.form.note:
            extra.append(f"{item.label}: {detail}")
    allergy = _answer(answers, "allergy.substance")
    if "allergy" in checked and len(allergy.selected) > 1 and OTHER not in allergy.selected and allergy.text:
        extra.append(f"Аллергия — название препарата или вещества (общий ответ к выбранным категориям; связь не уточнена): {allergy.text}")
    extra.extend(f"Уточнение — {turn.question}\nОтвет пациента: {turn.answer}"
                 for turn in answers.ai if turn.answer and not turn.skipped)
    rows = [_row(answers, item, health_state(answers, item.value)) for item in HEALTH_ITEMS]
    represented = '\n'.join([*extra, *(row['note'] for row in rows),
                              *(sub['note'] for row in rows for sub in row['subs'])])
    for group in free_groups:
        text = _text(answers, group.key)
        if group.key in answers.free_text_groups and text and text not in represented:
            extra.append(f"{group.title + ': ' if group.title else ''}{group.question}: {text}")
            represented += '\n' + text
    return {
        "birth_date": _text(answers, "about.birth_date"),
        "visit_year": _text(answers, "about.visit_year"),
        "visit_clinic": _text(answers, "about.visit_clinic"),
        "more": "\n".join(part for part in extra if part),
        "problems": [
            {"letter": letter, "text": text, "selected": any(r in reasons for r in values)}
            for letter, text, values in PROBLEMS
        ],
        "rows": rows,
    }
