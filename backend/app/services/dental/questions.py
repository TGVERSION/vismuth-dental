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


def _note(key: str, title: str, question: str, placeholder: str) -> Group:
    """Строка без вариантов: пациент пишет сам, может и не писать."""
    return _detail(key, title, question, (), text_placeholder=placeholder,
                   text_show="always")


# Строки — как в бумажной «Анкете о здоровье пациента»: всё, что в ней есть,
# есть и здесь, иногда двумя-тремя пунктами бланка в одной строке.
HEALTH_ITEMS = (
    HealthItem("allergy", "Аллергия",
               "на лекарства, обезболивание, пыльцу, еду", (
        _detail("allergy.substance", "аллергия", "На что аллергия?", (
            ("local_anesthesia", "Обезболивание у стоматолога"),
            ("antibiotics", "Антибиотики"),
            ("painkillers", "Таблетки от боли"),
            ("latex", "Латекс"),
            ("pollen_food", "Пыльца, еда, животные"),
            (OTHER, "Другое"),
        ), text_placeholder="Название препарата, если помните"),
        Group(key="allergy.reaction", question="Как проявлялась?", options=_opts(
            ("rash", "Сыпь, зуд"),
            ("edema", "Отёк"),
            ("shock", "Становилось плохо, падало давление"),
            ("unknown", "Не помню"),
        )),
    )),
    # Не аллергия: обморок или сердцебиение от укола — во всех бумажных анкетах
    # отдельным вопросом.
    HealthItem("anesthesia_reaction", "Плохо переносили обезболивание у стоматолога",
               "обморок, сердцебиение, трудно дышать", (
        _detail("anesthesia_reaction", "плохо переносили обезболивание", "Что было?", (
            ("fainting", "Терял(а) сознание"),
            ("palpitations", "Сильно билось сердце"),
            ("breathing", "Было трудно дышать"),
            ("dizziness", "Кружилась голова, тошнило"),
            (OTHER, "Другое"),
        ), text_placeholder="Когда это было, если помните"),
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
    HealthItem("bleeding", "Кровоточивость или плохая свёртываемость крови",
               "кровь долго не останавливается", (
        _detail("bleeding", "кровоточивость", "Что именно?", (
            ("long_bleeding", "Долго идёт кровь после пореза или удаления зуба"),
            ("blood_disease", "Гемофилия или другая болезнь крови"),
            ("bruises", "Легко появляются синяки"),
            (OTHER, "Другое"),
        ), text_placeholder="Можно уточнить"),
    )),
    HealthItem("heart", "Болезни сердца или давление", "", (
        _detail("heart", "сердце или давление", "Что именно?", (
            ("hypertension", "Повышенное давление"),
            ("low_pressure", "Пониженное давление"),
            ("heart_attack", "Был инфаркт"),
            ("stroke", "Был инсульт"),
            ("angina", "Стенокардия"),
            ("arrhythmia", "Аритмия"),
            ("heart_defect", "Порок сердца или операция на сердце"),
            ("pacemaker", "Кардиостимулятор"),
            (OTHER, "Другое"),
        ), text_placeholder="Можно уточнить"),
    )),
    HealthItem("lungs", "Астма или болезни лёгких", "", (
        _detail("lungs", "астма или болезни лёгких", "Что именно?", (
            ("asthma", "Бронхиальная астма"),
            ("copd", "Хронический бронхит или ХОБЛ"),
            (OTHER, "Другое"),
        ), text_placeholder="Чем пользуетесь при приступе"),
    )),
    HealthItem("diabetes", "Сахарный диабет", "", (
        _detail("diabetes", "сахарный диабет", "Какой тип?", (
            ("type1", "Первого типа"),
            ("type2", "Второго типа"),
            ("unknown", "Не знаю"),
        ), multiple=False, text_placeholder="Чем лечите"),
    )),
    HealthItem("thyroid", "Болезни щитовидной железы", "", (
        _detail("thyroid", "щитовидная железа", "Что именно?", (
            ("hypothyroid", "Пониженная функция (гипотиреоз)"),
            ("hyperthyroid", "Повышенная функция (тиреотоксикоз)"),
            (OTHER, "Другое"),
        ), text_placeholder="Чем лечите"),
    )),
    HealthItem("liver_kidney", "Болезни печени или почек", "", (
        _detail("liver_kidney", "печень или почки", "Что именно?", (
            ("liver", "Печень"),
            ("kidney", "Почки"),
            ("dialysis", "Диализ"),
        ), text_placeholder="Какой диагноз, если знаете"),
    )),
    HealthItem("stomach", "Болезни желудка или кишечника",
               "в том числе сильный рвотный рефлекс", (
        _detail("stomach", "желудок или кишечник", "Что именно?", (
            ("ulcer", "Язва или гастрит"),
            ("gag", "Сильный рвотный рефлекс"),
            (OTHER, "Другое"),
        ), text_placeholder="Можно уточнить"),
    )),
    HealthItem("ent", "Болезни уха, горла, носа или гайморит", "", (
        _detail("ent", "ухо, горло, нос", "Что именно?", (
            ("sinusitis", "Гайморит"),
            ("ear_throat_nose", "Уши, горло или нос"),
        ), text_placeholder="Можно уточнить"),
    )),
    HealthItem("bones_skin", "Болезни костей, суставов или кожи", "", (
        _detail("bones_skin", "кости, суставы или кожа", "Что именно?", (
            ("bones", "Кости или суставы"),
            ("skin", "Кожа"),
        ), text_placeholder="Можно уточнить"),
    )),
    HealthItem("lymph", "Постоянно увеличены лимфоузлы", "", (
        _note("lymph", "увеличены лимфоузлы", "Где и как давно?", "Например: на шее, полгода"),
    )),
    HealthItem("epilepsy", "Эпилепсия, обмороки или болезни нервной системы", "", (
        _detail("epilepsy", "эпилепсия, обмороки или нервная система", "Что именно?", (
            ("epilepsy", "Эпилепсия"),
            ("fainting", "Бывают обмороки"),
            ("nervous", "Другая болезнь нервной системы"),
        ), text_placeholder="Как часто, когда было последний раз"),
    )),
    HealthItem("infections", "Гепатит, ВИЧ, туберкулёз или венерические болезни", "", (
        _detail("infections", "инфекции", "Что именно?", (
            ("hepatitis_b", "Гепатит B"),
            ("hepatitis_c", "Гепатит C"),
            ("hiv", "ВИЧ"),
            ("tuberculosis", "Туберкулёз"),
            ("venereal", "Венерическая болезнь"),
        )),
    )),
    HealthItem("transfusion", "Было переливание крови", "", (
        _note("transfusion", "переливание крови", "Когда?", "Например: в 2015 году"),
    )),
    HealthItem("bone_onco", "Онкология или лечение остеопороза",
               "лучевая, химиотерапия, операции — сейчас или раньше", (
        _detail("bone_onco", "онкология или остеопороз", "Что именно?", (
            ("osteoporosis_drugs", "Лекарства от остеопороза"),
            ("radiation", "Лучевая терапия головы или шеи"),
            ("chemo", "Химиотерапия"),
            (OTHER, "Другое"),
        ), text_placeholder="Препарат или когда было лечение"),
    )),
    HealthItem("pregnancy", "Беременность или кормление грудью", "", (
        _detail("pregnancy", "беременность или кормление", "Что именно?", (
            ("pregnant", "Беременность"),
            ("breastfeeding", "Кормлю грудью"),
        ), text_placeholder="Срок беременности, если знаете"),
    )),
    HealthItem("other_diseases", "Другие болезни, операции или травмы", "", (
        _detail("other_diseases", "другие болезни", "Что и когда?", (),
                text_placeholder="Например: операция на желчном пузыре в 2019",
                text_required=True, text_show="always"),
    )),
    HealthItem("other_meds", "Другие лекарства каждый день", "", (
        _detail("other_meds", "другие лекарства", "Какие лекарства и в какой дозе?", (),
                text_placeholder="Например: Конкор 5 мг утром", text_required=True,
                text_show="always"),
    )),
)

HEALTH_BY_VALUE = {item.value: item for item in HEALTH_ITEMS}

# Стоматологический анамнез бумажной анкеты — отдельный шаг «Зубы и дёсны».
# Все группы необязательны: невыбранный признак на листе — «Нет».
MOUTH_GROUPS = (
    Group(
        key="mouth.last_visit",
        question="Когда последний раз были у стоматолога?",
        options=_opts(
            ("half_year", "Меньше полугода назад"),
            ("year", "Полгода — год назад"),
            ("over_year", "Больше года назад"),
            ("unknown", "Не помню"),
        ),
        multiple=False,
    ),
    Group(
        key="mouth.signs",
        question="Что из этого бывает?",
        options=_opts(
            ("tmj", "Боль или щелчки в челюстном суставе"),
            ("bruxism", "Скрежет зубами (бруксизм)"),
            ("gums_bleed", "Кровоточат дёсны при чистке"),
            ("herpes", "Герпес на губах"),
            ("dry_mouth", "Сухость во рту"),
            ("bad_breath", "Запах изо рта"),
        ),
    ),
    Group(
        key="mouth.complications",
        question="Были осложнения во время или после лечения у стоматолога?",
        options=_opts(
            ("long_bleeding", "Долго шла кровь"),
            ("swelling", "Сильный отёк или воспаление"),
            ("allergy", "Аллергическая реакция"),
            (OTHER, "Другое"),
        ),
        text_placeholder="Что было",
        text_show="on_other",
    ),
)

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
