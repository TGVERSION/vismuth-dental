"""Карточка врача по стоматологической анкете — только правила.

Пациент подписывает распечатку, поэтому здесь нет пересказа моделью:
фразы собираются из нажатых кнопок, свой текст пациента идёт как есть.
"""

from __future__ import annotations

import re
from typing import Any

from .flow import DentalAnswers, GroupAnswer, has_pain, health_state
from .paper_form import build_paper_form
from .conversation import health_free_reference
from .questions import (
    BLOOD_THINNER_OPTIONS,
    BLOOD_THINNERS,
    HEALTH_ITEMS,
    OTHER,
    PAIN_GROUPS,
    REASON,
    Group,
)

_GROUPS: dict[str, Group] = {
    g.key: g
    for g in (
        REASON,
        *PAIN_GROUPS,
        *(dg for item in HEALTH_ITEMS for dg in item.detail_groups),
    )
}

_PAIN_WHEN = {
    "cold": "от холодного",
    "hot": "от горячего",
    "bite": "при накусывании",
    "spontaneous": "сама по себе",
    "night": "ночью",
}
# Аллергия и лекарства — в своих разделах карточки, остальное — анамнез жизни.
_NOT_CHRONIC = ("allergy", "medications")
_CHRONIC = tuple(item.value for item in HEALTH_ITEMS if item.value not in _NOT_CHRONIC)

_BLEEDING_NOTE = "риск кровотечения при удалении и хирургии"
_ADRENALINE_NOTE = "осторожно с анестетиком с адреналином"
_INFECTION_NOTE = "соблюдать меры инфекционной безопасности"
_PROPHYLAXIS_NOTE = "уточнить, нужна ли профилактика антибиотиком"
# Что меняет лечение в кресле — в красное «Самое важное». Остальное (давление,
# диабет, болезни органов) — в анамнезе.
_RISK_NOTES = {
    "hepatitis": _INFECTION_NOTE,
    "tuberculosis": _INFECTION_NOTE,
    "radio_chemo": "риск осложнений при удалении и имплантации",
    "heart_defect": _PROPHYLAXIS_NOTE,
    "heart_valve": _PROPHYLAXIS_NOTE,
    "ischemia": _ADRENALINE_NOTE,
    "heart_attack": _ADRENALINE_NOTE,
    "pacemaker": "осторожно с анестетиком с адреналином и электроприборами",
    "seizures": "риск приступа в кресле",
    "asthma": "риск приступа в кресле — ингалятор пациента под рукой",
    "bleeding": _BLEEDING_NOTE,
    "pregnancy": "учитывать при рентгене и выборе анестетика",
    "hiv": _INFECTION_NOTE,
}
# Текст про аллергию не ищем: «аллергия на аспирин» — не приём аспирина.
_NOT_MEDICATION_TEXT = ("allergy.substance", "allergy.reaction")


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


def _item(item_value: str):
    return next(i for i in HEALTH_ITEMS if i.value == item_value)


def _item_detail(answers: DentalAnswers, item_value: str, *, lower: bool) -> str:
    parts = [_group_detail(answers, g.key, lower=lower) for g in _item(item_value).detail_groups]
    return "; ".join(part for part in parts if part)


def _pain_sentence(answers: DentalAnswers) -> str:
    where = ", ".join(_lower_first(label) for label in _labels(answers, "pain.where"))
    where = '; '.join(part for part in [where, _answer(answers, 'pain.where').text] if part)
    when = ", ".join(
        _PAIN_WHEN[v] for v in _answer(answers, "pain.when").selected if v in _PAIN_WHEN
    )
    since = ", ".join(_lower_first(label) for label in _labels(answers, "pain.since"))
    when = '; '.join(part for part in [when, _answer(answers, 'pain.when').text] if part)
    since = '; '.join(part for part in [since, _answer(answers, 'pain.since').text] if part)
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


def _thinner_labels(answers: DentalAnswers, health: list[str]) -> list[str]:
    """Разжижающие кровь, отмеченные кнопками в «Постоянно принимаю лекарства»."""
    if "medications" not in health:
        return []
    labels = {o.value: o.label for o in _GROUPS["medications"].options}
    selected = _answer(answers, "medications").selected
    return [labels[v] for v in BLOOD_THINNER_OPTIONS if v in selected]


def _medications(answers: DentalAnswers, health: list[str]) -> str:
    if health_state(answers, "medications") is None:
        if health_free_reference(answers, 'medications'):
            return health_free_reference(answers, 'medications') + '.'
        return "Не знает, принимает ли постоянно лекарства." if "medications" in answers.health_unknown else "Не отвечено."
    if "medications" not in health:
        return "Постоянно не принимает."
    parts = [*_labels(answers, "medications"), _answer(answers, "medications").text,
             _group_detail(answers, "medications.dose", lower=False)]
    return ", ".join(part for part in parts if part) or "Постоянно не принимает."


def _allergy_line(answers: DentalAnswers) -> str:
    substances = ", ".join(_lower_first(l) for l in _labels(answers, "allergy.substance"))
    name = _answer(answers, "allergy.substance").text
    what = " — ".join(part for part in (substances, name) if part)
    line = f"Аллергия: {what}" if what else "Аллергия"
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


def _fact(answers: DentalAnswers, item_value: str) -> str:
    """Факт словами пациента: выбранные варианты, иначе строка списка и его текст."""
    item = _item(item_value)
    if any(_labels(answers, g.key) for g in item.detail_groups):
        return _upper_first(_item_detail(answers, item_value, lower=True))
    texts = [_answer(answers, g.key).text for g in item.detail_groups]
    return "; ".join(part for part in (item.label, *texts) if part)


def _important_items(answers: DentalAnswers, health: list[str]) -> list[ImportantItem]:
    items: list[ImportantItem] = []
    thinners = _thinner_labels(answers, health)
    if thinners:
        parts = [*thinners, _answer(answers, "medications").text]
        drug = ", ".join(part for part in parts if part)
        items.append((f"Принимает {drug}", _BLEEDING_NOTE))
    if "allergy" in health:
        items.append((_allergy_line(answers), None))
    items.extend(
        (_fact(answers, item.value), _RISK_NOTES[item.value])
        for item in HEALTH_ITEMS
        if item.value in health and item.value in _RISK_NOTES
    )
    return items


def _important(answers: DentalAnswers, health: list[str]) -> list[str]:
    lines = [
        f"{fact}: {note}" if note else fact
        for fact, note in _important_items(answers, health)
    ]
    if not _thinner_labels(answers, health):
        # Вывод системы по словарю, а не ответ пациента: только врачу.
        lines.extend(
            f"Упомянут «{name}» — разжижает кровь"
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


def _about(answers: DentalAnswers) -> str:
    """Шапка бланка одной строкой для врача: дата рождения, последний визит."""
    birth = _answer(answers, "about.birth_date").text
    year = _answer(answers, "about.visit_year").text
    clinic = _answer(answers, "about.visit_clinic").text
    more = _answer(answers, "about.more").text
    sentences = []
    if birth:
        sentences.append(f"Дата рождения: {birth}.")
    visit = ", ".join(part for part in (year, f"клиника «{clinic}»" if clinic else "") if part)
    if visit:
        sentences.append(f"Последний визит к стоматологу: {visit}.")
    if more:
        sentences.append(f"Дополнительно: {more}.")
    return " ".join(sentences)


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
    thinners = _thinner_labels(answers, health)
    if thinners:
        gaps.append(_gap(MEDICATIONS, f"По какому поводу назначен {', '.join(thinners)}"))
    else:
        gaps.extend(
            _gap(MEDICATIONS, f"Принимает ли {name} сейчас и в какой дозе")
            for name in _mentioned_blood_thinners(answers)
        )
    if "allergy" in health and not (_answer(answers, "allergy.reaction").selected or _answer(answers, "allergy.reaction").text):
        gaps.append(_gap(ALLERGY, "Как проявлялась аллергия"))
    # Пропущенный вопрос нейросети — врач задаст его сам.
    gaps.extend(_gap(COMPLAINTS, turn.question) for turn in answers.ai if turn.skipped)
    return gaps


def build_dental_summary(
    answers: DentalAnswers,
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Карточка врача, бланк для подписи и список «Что доспросить».

    Ключи `complaints`, `medications`, `allergy_anamnesis`, `life_anamnesis`
    совпадают с общей анкетой: по ним создаётся протокол.
    """
    health = answers.health or []
    uncertainty = [f"{item.label}: {health_free_reference(answers, item.value) or 'не знаю'}" for item in HEALTH_ITEMS if item.value in answers.health_unknown]
    unknown_chronic = any(item.value in answers.health_unknown for item in HEALTH_ITEMS if item.value in _CHRONIC)
    structured = {
        "important": [*_important(answers, health), *uncertainty],
        # Для листа, который подписывает пациент: только факты из его ответов.
        "important_facts": [fact for fact, _ in _important_items(answers, health)],
        "complaints": _complaints(answers),
        "health": [
            {
                "key": item.value,
                "label": item.label,
                "has": health_state(answers, item.value),
                "detail": _item_detail(answers, item.value, lower=False)
                if item.value in health
                else (health_free_reference(answers, item.value) or ("Не знаю" if item.value in answers.health_unknown else ("Не отвечено" if answers.health is None else ""))),
            }
            for item in HEALTH_ITEMS
        ],
        "medications": _medications(answers, health),
        "allergy_anamnesis": _allergy_line(answers) if "allergy" in health else (health_free_reference(answers, 'allergy') or ("Не знает, есть ли аллергия." if "allergy" in answers.health_unknown else ("Не отвечено." if answers.health is None else "Аллергии нет."))),
        "life_anamnesis": (_life_anamnesis(answers, health) if health or not unknown_chronic else "Есть ответы «Не знаю».") + (" " + "; ".join(uncertainty) if uncertainty else ""),
        "about": '\n'.join(part for part in [_about(answers), *answers.health_comments.values()] if part),
        # Вопросы нейросети и ответы пациента дословно; пусто — пропустил.
        "clarifications": [
            {"question": turn.question, "answer": turn.answer}
            for turn in answers.ai
            if turn.is_closed
        ],
        "paper_form": build_paper_form(answers),
    }
    return structured, [*_gaps(answers, health), *[_gap(ALLERGY if value == "allergy" else MEDICATIONS if value == "medications" else COMPLAINTS,
                            f"Уточнить: {next(i.label for i in HEALTH_ITEMS if i.value == value)} — {health_free_reference(answers, value) or 'пациент ответил «Не знаю»'}")
                            for value in answers.health_unknown]]
