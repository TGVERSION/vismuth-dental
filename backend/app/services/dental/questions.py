"""Набор вопросов стоматологической анкеты.

Единственное место, где живут формулировки: поменять список поводов, строк
здоровья или уточнений — значит поправить этот файл. Сценарий и карточка
врача читают его, но своих текстов для пациента не держат.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

OTHER = "other"


@dataclass(frozen=True)
class Option:
    value: str
    label: str


@dataclass(frozen=True)
class Group:
    """Группа кнопок на экране; у группы может быть поле для своего текста.

    `text_required` — текст нужен всегда; если поле есть и выбрано «Другое»,
    текст нужен тоже. `text_show` — когда экран показывает поле: всегда,
    после выбора любого варианта или только при «Другое».
    """

    key: str
    question: str
    options: tuple[Option, ...] = ()
    multiple: bool = True
    text_placeholder: str | None = None
    text_required: bool = False
    text_show: Literal["always", "on_select", "on_other"] = "on_select"
    selection_required: bool = False
    title: str | None = None


@dataclass(frozen=True)
class HealthItem:
    value: str
    label: str
    hint: str
    detail_groups: tuple[Group, ...]


def _opts(*pairs: tuple[str, str]) -> tuple[Option, ...]:
    return tuple(Option(value, label) for value, label in pairs)


REASON = Group(
    key="reason",
    question="С чем вы пришли?",
    options=_opts(
        ("pain", "Болит зуб"),
        ("checkup", "Профосмотр"),
        ("cleaning", "Чистка зубов"),
        ("gums", "Кровоточат дёсны"),
        ("broken", "Скололся зуб или выпала пломба"),
        ("missing", "Нет зуба — хочу поставить"),
        (OTHER, "Другое"),
    ),
    text_placeholder="Напишите, с чем пришли",
    text_show="on_other",
    selection_required=True,
)

PAIN_GROUPS = (
    Group(
        key="pain.where",
        question="Где болит?",
        options=_opts(
            ("upper_right", "Сверху справа"),
            ("upper_left", "Сверху слева"),
            ("lower_right", "Снизу справа"),
            ("lower_left", "Снизу слева"),
        ),
    ),
    Group(
        key="pain.when",
        question="Когда болит?",
        options=_opts(
            ("cold", "От холодного"),
            ("hot", "От горячего"),
            ("bite", "Когда кусаю"),
            ("spontaneous", "Сама по себе"),
            ("night", "Ночью"),
        ),
    ),
    Group(
        key="pain.since",
        question="Как давно?",
        options=_opts(
            ("today", "Сегодня"),
            ("days", "Несколько дней"),
            ("week", "Больше недели"),
        ),
        multiple=False,
    ),
)


def _detail(key: str, title: str, question: str, options, **kwargs) -> Group:
    return Group(key=key, title=f"Вы отметили: {title}", question=question,
                 options=_opts(*options), **kwargs)


HEALTH_ITEMS = (
    HealthItem("allergy", "Аллергия на лекарства",
               "в том числе на обезболивание у стоматолога", (
        _detail("allergy.substance", "аллергия на лекарства", "На что аллергия?", (
            ("local_anesthesia", "Обезболивание у стоматолога"),
            ("antibiotics", "Антибиотики"),
            ("painkillers", "Таблетки от боли"),
            ("latex", "Латекс"),
            (OTHER, "Другое"),
        ), text_placeholder="Название препарата, если помните"),
        Group(key="allergy.reaction", question="Как проявлялась?", options=_opts(
            ("rash", "Сыпь, зуд"),
            ("edema", "Отёк"),
            ("shock", "Становилось плохо, падало давление"),
            ("unknown", "Не помню"),
        )),
    )),
    HealthItem("anticoagulants", "Лекарства, разжижающие кровь",
               "Кардиомагнил, Эликвис, Ксарелто, варфарин…", (
        _detail("anticoagulants", "разжижающие кровь", "Какое лекарство и как принимаете?", (
            ("cardiomagnil", "Кардиомагнил или аспирин"),
            ("eliquis", "Эликвис"),
            ("xarelto", "Ксарелто"),
            ("warfarin", "Варфарин"),
            (OTHER, "Другое"),
        ), text_placeholder="Например: 5 мг, 2 раза в день"),
    )),
    HealthItem("heart", "Болезни сердца или давление", "", (
        _detail("heart", "сердце или давление", "Что именно?", (
            ("hypertension", "Повышенное давление"),
            ("heart_attack", "Был инфаркт"),
            ("arrhythmia", "Аритмия"),
            ("pacemaker", "Кардиостимулятор"),
            (OTHER, "Другое"),
        ), text_placeholder="Можно уточнить"),
    )),
    HealthItem("diabetes", "Сахарный диабет", "", (
        _detail("diabetes", "сахарный диабет", "Какой тип?", (
            ("type1", "Первого типа"),
            ("type2", "Второго типа"),
            ("unknown", "Не знаю"),
        ), multiple=False, text_placeholder="Чем лечите"),
    )),
    HealthItem("pregnancy", "Беременность или кормление грудью", "", (
        _detail("pregnancy", "беременность или кормление", "Что именно?", (
            ("pregnant", "Беременность"),
            ("breastfeeding", "Кормлю грудью"),
        ), text_placeholder="Срок беременности, если знаете"),
    )),
    HealthItem("epilepsy", "Эпилепсия или бывают обмороки", "", (
        _detail("epilepsy", "эпилепсия или обмороки", "Что именно?", (
            ("epilepsy", "Эпилепсия"),
            ("fainting", "Бывают обмороки"),
        ), text_placeholder="Как часто, когда было последний раз"),
    )),
    HealthItem("infections", "Гепатит, ВИЧ или туберкулёз", "", (
        _detail("infections", "гепатит, ВИЧ или туберкулёз", "Что именно?", (
            ("hepatitis_b", "Гепатит B"),
            ("hepatitis_c", "Гепатит C"),
            ("hiv", "ВИЧ"),
            ("tuberculosis", "Туберкулёз"),
        )),
    )),
    HealthItem("bone_onco", "Лечение остеопороза или онкологии", "сейчас или раньше", (
        _detail("bone_onco", "остеопороз или онкология", "Что именно?", (
            ("osteoporosis_drugs", "Лекарства от остеопороза"),
            ("radiation", "Лучевая терапия головы или шеи"),
            ("chemo", "Химиотерапия"),
            (OTHER, "Другое"),
        ), text_placeholder="Препарат или когда было лечение"),
    )),
    HealthItem("other_meds", "Другие лекарства каждый день", "", (
        _detail("other_meds", "другие лекарства", "Какие лекарства и в какой дозе?", (),
                text_placeholder="Например: Конкор 5 мг утром", text_required=True,
                text_show="always"),
    )),
)

HEALTH_BY_VALUE = {item.value: item for item in HEALTH_ITEMS}

# Препараты, разжижающие кровь: основа названия → как показать врачу.
# Ищем их в свободном тексте пациента (кроме текста про аллергию): строку
# «разжижающие кровь» часто не отмечают, а лекарство вписывают в «Другие
# лекарства». Текст перед поиском приводится к нижнему регистру, «ё» → «е»,
# дефисы → пробел. Основы на латинице — для тех, кто переписал упаковку.
BLOOD_THINNERS: dict[str, str] = {
    "кардиомагнил": "Кардиомагнил", "cardiomagnyl": "Кардиомагнил",
    "магникор": "Кардиомагнил",
    "аспирин": "Аспирин", "aspirin": "Аспирин", "тромбо асс": "Аспирин",
    "тромбоасс": "Аспирин", "thrombo ass": "Аспирин", "ацекардол": "Аспирин",
    "кардиаск": "Аспирин", "аспекард": "Аспирин", "ацетилсалицил": "Аспирин",
    "эликвис": "Эликвис", "eliquis": "Эликвис", "апиксабан": "Эликвис",
    "apixaban": "Эликвис",
    "ксарелто": "Ксарелто", "xarelto": "Ксарелто", "ривароксабан": "Ксарелто",
    "rivaroxaban": "Ксарелто",
    "прадакс": "Прадакса", "pradaxa": "Прадакса", "дабигатран": "Прадакса",
    "dabigatran": "Прадакса",
    "варфарин": "Варфарин", "warfarin": "Варфарин",
    "плавикс": "Клопидогрел", "plavix": "Клопидогрел", "зилт": "Клопидогрел",
    "клопидогрел": "Клопидогрел", "clopidogrel": "Клопидогрел",
    "брилинт": "Брилинта", "brilinta": "Брилинта", "тикагрелор": "Брилинта",
    "ticagrelor": "Брилинта",
    "эффиент": "Прасугрел", "прасугрел": "Прасугрел",
    "клексан": "Гепарин", "clexane": "Гепарин", "эноксапарин": "Гепарин",
    "фраксипарин": "Гепарин", "надропарин": "Гепарин", "гепарин": "Гепарин",
    "heparin": "Гепарин",
    "синкумар": "Синкумар", "аценокумарол": "Синкумар", "фенилин": "Фенилин",
    "курантил": "Курантил", "дипиридамол": "Курантил",
}
