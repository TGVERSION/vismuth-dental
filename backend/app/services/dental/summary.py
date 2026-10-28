"""Карточка врача по стоматологической анкете — только правила.

Пациент подписывает распечатку, поэтому здесь нет пересказа моделью:
фразы собираются из нажатых кнопок, свой текст пациента идёт как есть.
"""

from __future__ import annotations

import re
from typing import Any

from .flow import DentalAnswers, GroupAnswer, has_pain
from .questions import BLOOD_THINNERS, HEALTH_ITEMS, OTHER, PAIN_GROUPS, REASON, Group

_GROUPS: dict[str, Group] = {
    g.key: g
    for g in (REASON, *PAIN_GROUPS, *(dg for item in HEALTH_ITEMS for dg in item.detail_groups))
}

_PAIN_WHEN = {
    "cold": "от холодного",
    "hot": "от горячего",
    "bite": "при накусывании",
    "spontaneous": "сама по себе",
    "night": "ночью",
}
# Строки «Здоровья», которые идут в анамнез жизни (аллергия и лекарства —
# в свои разделы).
_CHRONIC = (
    "anesthesia_reaction", "bleeding", "heart", "lungs", "diabetes", "thyroid",
    "liver_kidney", "pregnancy", "epilepsy", "infections", "bone_onco",
)
_BLEEDING_NOTE = "риск кровотечения при удалении и хирургии"
_RISK_NOTES = {
    "anesthesia_reaction": "подобрать анестетик, наблюдать после укола",
    "bleeding": _BLEEDING_NOTE,
    "pregnancy": "учитывать при рентгене и выборе анестетика",
    "epilepsy": "риск приступа в кресле",
    "infections": "соблюдать меры инфекционной безопасности",
    "bone_onco": "риск осложнений при удалении и имплантации",
}
_ADRENALINE_NOTE = "осторожно с анестетиком с адреналином"
_PACEMAKER_NOTE = "осторожно с анестетиком с адреналином и электроприборами"
# Строки, где в красное идут только варианты, меняющие лечение в кресле:
# одно повышенное давление, ХОБЛ или гипотиреоз остаются в анамнезе.
_SERIOUS: dict[str, tuple[tuple[str, ...], str]] = {
    "heart": (("pacemaker", "heart_attack", "arrhythmia"), _ADRENALINE_NOTE),
    "lungs": (("asthma",), "риск приступа в кресле — ингалятор пациента под рукой"),
    "thyroid": (("hyperthyroid",), _ADRENALINE_NOTE),
}
# Текст про аллергию не ищем: «аллергия на аспирин» — не приём аспирина.
_NOT_MEDICATION_TEXT = ("allergy.substance", "allergy.reaction")
_BLOOD_THINNER_FALLBACK = "препарат, разжижающий кровь"


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:]


def _upper_first(text: str) -> str:
    return text[:1].upper() + text[1:]


def _answer(answers: DentalAnswers, key: str) -> GroupAnswer:
    return answers.groups.get(key, GroupAnswer())


def _labels(answers: DentalAnswers, key: str) -> list[str]:
    group = _GROUPS[key]
    by_value = {o.value: o.label for o in group.options}
    # Значение могло пропасть из questions.py, пока анкета хранится: пропускаем.
    # «Другое» — не ответ, а приглашение написать свой текст: в фразы не идёт.
    return [
        by_value[v] for v in _answer(answers, key).selected if v in by_value and v != OTHER
    ]


def _group_detail(answers: DentalAnswers, key: str, *, lower: bool) -> str:
    labels = _labels(answers, key)
    if lower:
        labels = [_lower_first(label) for label in labels]
    parts = [", ".join(labels), _answer(answers, key).text]
    return "; ".join(part for part in parts if part)


def _item_detail(answers: DentalAnswers, item_value: str, *, lower: bool) -> str:
    item = next(i for i in HEALTH_ITEMS if i.value == item_value)
    parts = [_group_detail(answers, g.key, lower=lower) for g in item.detail_groups]
    return "; ".join(part for part in parts if part)


def _pain_sentence(answers: DentalAnswers) -> str:
    where = ", ".join(_lower_first(label) for label in _labels(answers, "pain.where"))
    when = ", ".join(
        _PAIN_WHEN[v] for v in _answer(answers, "pain.when").selected if v in _PAIN_WHEN
    )
    since = ", ".join(_lower_first(label) for label in _labels(answers, "pain.since"))
    sentence = "Болит зуб" + (f" {where}" if where else "")
    sentence += f": {when}" if when else ""
    sentence += f"; {since}" if since else ""
    return sentence + "."


def _complaints(answers: DentalAnswers) -> str:
    sentences = []
    if has_pain(answers):
        sentences.append(_pain_sentence(answers))
    reason_labels = {o.value: o.label for o in REASON.options}
    others = [
        reason_labels[value]
        for value in _answer(answers, REASON.key).selected
        if value in reason_labels and value not in ("pain", OTHER)
    ]
    if others:
        sentences.append(_upper_first(", ".join(_lower_first(l) for l in others)) + ".")
    other_text = _answer(answers, REASON.key).text
    if other_text:
        sentences.append(f"Другое: {other_text}.")
    return " ".join(sentences)


def _blood_thinner_text(answers: DentalAnswers) -> str:
    parts = [*_labels(answers, "anticoagulants"), _answer(answers, "anticoagulants").text]
    return ", ".join(part for part in parts if part)


def _allergy_line(answers: DentalAnswers) -> str:
    substances = ", ".join(_lower_first(l) for l in _labels(answers, "allergy.substance"))
    name = _answer(answers, "allergy.substance").text
    what = " — ".join(part for part in (substances, name) if part)
    line = f"Аллергия: {what}" if what else "Аллергия на лекарства"
    reaction = _group_detail(answers, "allergy.reaction", lower=True)
    return line + (f"; реакция: {reaction}" if reaction else "")


def _normalize(text: str) -> str:
    text = re.sub(r"[-‐-―]", " ", text.lower().replace("ё", "е"))
    return re.sub(r"\s+", " ", text)


def _mentioned_blood_thinners(answers: DentalAnswers) -> list[str]:
    """Препараты из словаря, найденные в свободном тексте пациента, без повторов."""
    text = _normalize(" ".join(
        answer.text
        for key, answer in answers.groups.items()
        if key not in _NOT_MEDICATION_TEXT
    ))
    found = [name for stem, name in BLOOD_THINNERS.items() if stem in text]
    return list(dict.fromkeys(found))


# Пункт «Самого важного»: факт из ответов пациента и предупреждение врачу.
# Врач видит их одной строкой, на лист для подписи идёт только факт —
# пациент подписывает свои ответы, а не выводы системы.
ImportantItem = tuple[str, str | None]


def _serious_item(answers: DentalAnswers, key: str) -> ImportantItem | None:
    values, note = _SERIOUS[key]
    selected = _answer(answers, key).selected
    labels = {o.value: o.label for o in _GROUPS[key].options}
    serious = [labels[v] for v in values if v in selected]
    if not serious:
        return None
    if "pacemaker" in selected:
        note = _PACEMAKER_NOTE
    return ", ".join(serious), note


def _risk_item(answers: DentalAnswers, item_value: str) -> ImportantItem | None:
    if item_value in _SERIOUS:
        return _serious_item(answers, item_value)
    note = _RISK_NOTES.get(item_value)
    if note is None:
        return None
    # Несколько вариантов — одна фраза: заглавная только у первого.
    detail = _item_detail(answers, item_value, lower=True)
    label = next(i.label for i in HEALTH_ITEMS if i.value == item_value)
    return (_upper_first(detail) if detail else label), note


def _important_items(answers: DentalAnswers, health: list[str]) -> list[ImportantItem]:
    items: list[ImportantItem] = []
    if "anticoagulants" in health:
        drug = _blood_thinner_text(answers) or _BLOOD_THINNER_FALLBACK
        items.append((f"Принимает {drug}", _BLEEDING_NOTE))
    if "allergy" in health:
        items.append((_allergy_line(answers), None))
    for item in HEALTH_ITEMS:
        risk = _risk_item(answers, item.value) if item.value in health else None
        if risk:
            items.append(risk)
    return items


def _important(answers: DentalAnswers, health: list[str]) -> list[str]:
    lines = [
        f"{fact}: {note}" if note else fact
        for fact, note in _important_items(answers, health)
    ]
    if "anticoagulants" not in health:
        # Вывод системы по словарю, а не ответ пациента: только врачу.
        lines.extend(
            f"Упомянут «{name}» — разжижает кровь, а строка «разжижающие кровь» не отмечена"
            for name in _mentioned_blood_thinners(answers)
        )
    return lines


def _life_anamnesis(answers: DentalAnswers, health: list[str]) -> str:
    sentences = []
    for item in HEALTH_ITEMS:
        if item.value not in _CHRONIC or item.value not in health:
            continue
        detail = _item_detail(answers, item.value, lower=True)
        sentences.append(f"{item.label}: {detail}." if detail else f"{item.label}.")
    return " ".join(sentences) or "Хронических заболеваний не отмечено."


def _medications(answers: DentalAnswers, health: list[str]) -> str:
    parts = []
    if "anticoagulants" in health:
        parts.append(_blood_thinner_text(answers) or _BLOOD_THINNER_FALLBACK)
    if "other_meds" in health:
        parts.append(_answer(answers, "other_meds").text)
    return "; ".join(p for p in parts if p) or "Постоянно не принимает."


# Раздел карточки врача, под которым показывается вопрос «Что доспросить»:
# тот же формат `{section, question}`, что у общей анкеты.
COMPLAINTS = "complaints"
MEDICATIONS = "medications"
ALLERGY = "allergy_anamnesis"


def _gap(section: str, question: str) -> dict[str, str]:
    return {"section": section, "question": question}


def _gaps(answers: DentalAnswers, health: list[str]) -> list[dict[str, str]]:
    gaps = []
    other_text = _answer(answers, REASON.key).text
    if other_text:
        gaps.append(_gap(COMPLAINTS, f"Уточнить повод визита: «{other_text}»"))
    if has_pain(answers):
        for key, question in (
            ("pain.where", "Где именно болит"),
            ("pain.when", "От чего возникает боль"),
            ("pain.since", "Как давно болит"),
        ):
            if not _answer(answers, key).selected:
                gaps.append(_gap(COMPLAINTS, question))
    if "anticoagulants" in health:
        if not _answer(answers, "anticoagulants").text:
            gaps.append(_gap(MEDICATIONS, "Доза и схема приёма препарата, разжижающего кровь"))
        drugs = ", ".join(_labels(answers, "anticoagulants")) or _BLOOD_THINNER_FALLBACK
        gaps.append(_gap(MEDICATIONS, f"По какому поводу назначен {drugs}"))
    if "allergy" in health:
        substance = _answer(answers, "allergy.substance")
        if not substance.selected and not substance.text:
            gaps.append(_gap(ALLERGY, "На что аллергия"))
        if not _answer(answers, "allergy.reaction").selected:
            gaps.append(_gap(ALLERGY, "Как проявлялась аллергия"))
    if "anticoagulants" not in health:
        gaps.extend(
            _gap(MEDICATIONS, f"Принимает ли {name} сейчас и в какой дозе")
            for name in _mentioned_blood_thinners(answers)
        )
    # Пропущенный вопрос нейросети — врач задаст его сам.
    gaps.extend(_gap(COMPLAINTS, turn.question) for turn in answers.ai if turn.skipped)
    return gaps


def build_dental_summary(
    answers: DentalAnswers,
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Карточка врача и список «Что доспросить».

    Ключи `complaints`, `medications`, `allergy_anamnesis`, `life_anamnesis`
    совпадают с общей анкетой: по ним создаётся протокол.
    """
    health = answers.health or []
    structured = {
        "important": _important(answers, health),
        # Для листа, который подписывает пациент: только факты из его ответов.
        "important_facts": [fact for fact, _ in _important_items(answers, health)],
        "complaints": _complaints(answers),
        "health": [
            {
                "key": item.value,
                "label": item.label,
                "has": item.value in health,
                "detail": _item_detail(answers, item.value, lower=False)
                if item.value in health
                else "",
            }
            for item in HEALTH_ITEMS
        ],
        "medications": _medications(answers, health),
        "allergy_anamnesis": _allergy_line(answers) if "allergy" in health else "Аллергии нет.",
        "life_anamnesis": _life_anamnesis(answers, health),
        # Вопросы нейросети и ответы пациента дословно; пусто — пропустил.
        "clarifications": [
            {"question": turn.question, "answer": turn.answer}
            for turn in answers.ai
            if turn.is_closed
        ],
    }
    return structured, _gaps(answers, health)
