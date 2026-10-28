"""Карточка врача и бланк «Анкета о здоровье» по ответам: только правила, без ИИ."""

from app.services.dental.flow import DentalAnswers, GroupAnswer
from app.services.dental.summary import build_dental_summary


def _questions(gaps):
    return [gap["question"] for gap in gaps]


def _answers(health, **groups):
    return DentalAnswers(
        health=health,
        groups={key.replace("__", "."): GroupAnswer(**value) for key, value in groups.items()},
    )


OLGA = _answers(
    ["medications", "allergy"],
    reason={"selected": ["pain"]},
    pain__where={"selected": ["lower_right"]},
    pain__when={"selected": ["cold", "bite"]},
    pain__since={"selected": ["days"]},
    allergy__substance={"selected": ["antibiotics"], "text": "амоксициллин"},
    allergy__reaction={"selected": ["itch"]},
    medications={"selected": ["eliquis"], "text": "5 мг, 2 раза в день"},
)

IGOR = _answers([], reason={"selected": ["checkup", "prosthetics"]})


def _row(summary, number):
    return summary["paper_form"]["rows"][number - 1]


# ---------------------------------------------------------------------------
# Карточка врача


def test_olga_important_lists_blood_thinner_and_allergy():
    summary, _ = build_dental_summary(OLGA)

    assert summary["important"] == [
        "Принимает Эликвис, 5 мг, 2 раза в день: риск кровотечения при удалении и хирургии",
        "Аллергия: антибиотики — амоксициллин; реакция: зуд и покраснение кожи",
    ]


def test_olga_complaint_is_built_from_buttons():
    summary, _ = build_dental_summary(OLGA)

    assert summary["complaints"] == (
        "Болит зуб снизу справа: от холодного, при накусывании; несколько дней."
    )


def test_olga_health_has_every_point_of_the_form():
    summary, _ = build_dental_summary(OLGA)

    rows = {row["key"]: row for row in summary["health"]}
    assert len(rows) == 43
    assert rows["medications"]["has"] is True
    assert rows["medications"]["detail"] == "Эликвис; 5 мг, 2 раза в день"
    assert rows["diabetes"]["has"] is False
    assert rows["diabetes"]["detail"] == ""


def test_olga_protocol_fields():
    summary, _ = build_dental_summary(OLGA)

    assert summary["medications"] == "Эликвис, 5 мг, 2 раза в день"
    assert summary["allergy_anamnesis"] == (
        "Аллергия: антибиотики — амоксициллин; реакция: зуд и покраснение кожи"
    )
    assert summary["life_anamnesis"] == "Хронических заболеваний не отмечено."


def test_olga_gaps_ask_why_blood_thinner_is_prescribed():
    _, gaps = build_dental_summary(OLGA)

    assert _questions(gaps) == ["По какому поводу назначен Эликвис"]


def test_igor_has_nothing_important():
    summary, gaps = build_dental_summary(IGOR)

    assert summary["important"] == []
    assert summary["complaints"] == "Профосмотр или чистка, протезирование."
    assert summary["medications"] == "Постоянно не принимает."
    assert summary["allergy_anamnesis"] == "Аллергии нет."
    assert summary["about"] == ""
    assert all(row["has"] is False for row in summary["health"])
    assert _questions(gaps) == []


def test_risks_reach_important_with_patient_words_as_facts():
    answers = _answers(
        ["hepatitis", "radio_chemo", "heart_valve", "heart_attack", "pacemaker",
         "seizures", "asthma", "bleeding", "pregnancy", "hiv"],
        reason={"selected": ["checkup"]},
        hepatitis={"selected": ["c"], "text": "в 2010"},
        radio_chemo={"selected": ["chemo"]},
        heart_attack={"text": "в 2019"},
        asthma={"text": "Сальбутамол"},
        bleeding={"selected": ["bruises"]},
        pregnancy={"selected": ["pregnant"], "text": "20 недель"},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == [
        "Гепатит C; в 2010: соблюдать меры инфекционной безопасности",
        "Химиотерапия или бифосфонаты: риск осложнений при удалении и имплантации",
        "Искусственный клапан сердца: уточнить, нужна ли профилактика антибиотиком",
        "Был инфаркт; в 2019: осторожно с анестетиком с адреналином",
        "Кардиостимулятор: осторожно с анестетиком с адреналином и электроприборами",
        "Бывает потеря сознания или судороги: риск приступа в кресле",
        "Бронхиальная астма; Сальбутамол: риск приступа в кресле — ингалятор пациента под рукой",
        "Легко появляются синяки: риск кровотечения при удалении и хирургии",
        "Беременность; 20 недель: учитывать при рентгене и выборе анестетика",
        "ВИЧ или СПИД: соблюдать меры инфекционной безопасности",
    ]
    assert summary["important_facts"][0] == "Гепатит C; в 2010"


def test_other_diseases_go_to_life_anamnesis_only():
    answers = _answers(
        ["transfusion", "smoking", "pressure", "liver"],
        reason={"selected": ["checkup"]},
        transfusion={"text": "в 2015 году"},
        smoking={"text": "10 лет"},
        pressure={"selected": ["high"], "text": "130/85"},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == []
    assert summary["life_anamnesis"] == (
        "Было переливание крови: в 2015 году. "
        "Курю: 10 лет. "
        "Сильно меняется давление: повышенное; 130/85. "
        "Болезни печени."
    )


def _medications(text, selected=()):
    return _answers(["medications"], reason={"selected": ["checkup"]},
                    medications={"selected": list(selected), "text": text})


def test_blood_thinner_written_only_in_text_is_flagged_for_doctor():
    summary, gaps = build_dental_summary(_medications("Xarelto 20 mg"))

    assert summary["important"] == ["Упомянут «Ксарелто» — разжижает кровь"]
    assert summary["important_facts"] == []
    assert "Принимает ли Ксарелто сейчас и в какой дозе" in _questions(gaps)


def test_hyphenated_brand_name_is_recognised():
    summary, _ = build_dental_summary(_medications("Тромбо-АСС 100"))

    assert summary["important"] == ["Упомянут «Аспирин» — разжижает кровь"]


def test_same_drug_named_twice_gives_one_line():
    summary, _ = build_dental_summary(_medications("ацетилсалициловая кислота (аспирин)"))

    assert len(summary["important"]) == 1


def test_chosen_blood_thinner_is_not_flagged_twice():
    summary, _ = build_dental_summary(_medications("Кардиомагнил 75 мг", ["cardiomagnil"]))

    assert summary["important"] == [
        "Принимает Кардиомагнил или аспирин, Кардиомагнил 75 мг: "
        "риск кровотечения при удалении и хирургии",
    ]


def test_allergy_to_aspirin_is_not_taken_as_blood_thinner():
    answers = _answers(
        ["allergy"],
        reason={"selected": ["checkup"]},
        allergy__substance={"selected": ["painkillers"], "text": "аспирин"},
    )

    summary, gaps = build_dental_summary(answers)

    assert summary["important"] == ["Аллергия: обезболивающие (анальгин, аспирин) — аспирин"]
    assert "Как проявлялась аллергия" in _questions(gaps)


def test_other_label_never_appears_in_text():
    answers = _answers(["allergy"], reason={"selected": ["checkup"]},
                       allergy__substance={"selected": ["other"], "text": "латекс"})

    summary, _ = build_dental_summary(answers)

    assert summary["allergy_anamnesis"] == "Аллергия: латекс"


def test_unknown_stored_value_does_not_break_the_card():
    answers = _answers([], reason={"selected": ["pain", "removed_reason"]},
                       pain__when={"selected": ["removed_trigger"]})

    summary, _ = build_dental_summary(answers)

    assert summary["complaints"].startswith("Болит зуб")


def test_incomplete_pain_and_other_reason_go_to_gaps():
    answers = _answers([], reason={"selected": ["pain", "other"], "text": "Шатается зуб"},
                       pain__where={"selected": ["upper_left"]})

    summary, gaps = build_dental_summary(answers)

    assert summary["complaints"] == "Болит зуб сверху слева. Другое: Шатается зуб."
    assert {(gap["section"], gap["question"]) for gap in gaps} == {
        ("complaints", "Уточнить повод визита: «Шатается зуб»"),
        ("complaints", "От чего возникает боль"),
        ("complaints", "Как давно болит"),
    }


def test_about_patient_line():
    answers = _answers(
        [],
        reason={"selected": ["checkup"]},
        about__birth_date={"text": "14.03.1985"},
        about__visit_year={"text": "2024"},
        about__visit_clinic={"text": "Улыбка"},
        about__more={"text": "Боюсь уколов"},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["about"] == (
        "Дата рождения: 14.03.1985. Последний визит к стоматологу: 2024, клиника «Улыбка». "
        "Дополнительно: Боюсь уколов."
    )


# ---------------------------------------------------------------------------
# Бланк «Анкета о здоровье» для подписи


FULL = _answers(
    ["hepatitis", "radio_chemo", "pressure", "bleeding", "medications", "allergy", "pregnancy"],
    reason={"selected": ["pain", "implant"]},
    hepatitis={"selected": ["c"], "text": "в 2010"},
    radio_chemo={"selected": ["chemo"]},
    pressure={"selected": ["high"], "text": "130/85"},
    bleeding={"selected": ["bruises"]},
    medications={"selected": ["cardiomagnil"], "text": "75 мг утром"},
    allergy__substance={"selected": ["local_anesthesia", "other"], "text": "латекс"},
    allergy__reaction={"selected": ["urticaria"]},
    pregnancy={"selected": ["pregnant"], "text": "20 недель"},
    about__birth_date={"text": "14.03.1985"},
    about__visit_year={"text": "2024"},
    about__visit_clinic={"text": "Улыбка"},
    about__more={"text": "Боюсь уколов"},
)


def test_form_header_is_filled_from_answers():
    form = build_dental_summary(FULL)[0]["paper_form"]

    assert form["birth_date"] == "14.03.1985"
    assert form["visit_year"] == "2024"
    assert form["visit_clinic"] == "Улыбка"
    assert form["more"] == "Боюсь уколов"
    assert [(p["letter"], p["selected"]) for p in form["problems"]] == [
        ("а", True), ("б", False), ("в", False), ("г", False),
        ("д", True), ("е", False), ("ж", False),
    ]
    assert form["problems"][0]["text"] == "лечение зубов"


def test_form_has_all_43_points_in_order_with_paper_wording():
    form = build_dental_summary(FULL)[0]["paper_form"]

    assert [row["number"] for row in form["rows"]] == list(range(1, 44))
    assert form["rows"][3]["text"] == "Проводились ли Вам инъекции за последние 6 месяцев"
    assert form["rows"][42]["text"] == "СПИД, ВиЧ"


def test_form_row_with_note():
    summary, _ = build_dental_summary(FULL)

    assert _row(summary, 1) == {
        "number": 1,
        "text": "Вирусный гепатит",
        "answer": True,
        "note_label": "Если да, то какого типа и когда",
        "note": "Гепатит C; в 2010",
        "underline": [],
        "subs": [],
    }
    assert _row(summary, 2)["answer"] is False
    assert _row(summary, 40)["note"] == "Кардиомагнил или аспирин; 75 мг утром"


def test_form_rows_without_own_answer_mark_sub_points():
    summary, _ = build_dental_summary(FULL)

    radio_chemo = _row(summary, 15)
    assert radio_chemo["answer"] is None
    assert [(s["text"], s["answer"]) for s in radio_chemo["subs"]] == [
        ("лучевую терапию за последние 10 лет", False),
        ("химиотерапию (принимаете бифосфонаты) за последние 10 лет", True),
    ]
    pressure = _row(summary, 33)
    assert [s["answer"] for s in pressure["subs"]] == [True, False]
    assert pressure["note_label"] == "каковы цифры обычного для Вас артериального давления"
    assert pressure["note"] == "130/85"
    assert [s["answer"] for s in _row(summary, 42)["subs"]] == [True, False]


def test_form_bleeding_has_own_answer_and_sub_points():
    bleeding = _row(build_dental_summary(FULL)[0], 39)

    assert bleeding["answer"] is True
    assert [s["answer"] for s in bleeding["subs"]] == [False, True, False]


def test_form_allergy_underlines_reaction_and_fills_other_allergen():
    allergy = _row(build_dental_summary(FULL)[0], 41)

    assert allergy["answer"] is None
    assert [u["text"] for u in allergy["underline"] if u["selected"]] == ["крапивницы"]
    assert len(allergy["subs"]) == 11
    assert allergy["subs"][0] == {"text": "местные анестетики", "answer": True, "note": ""}
    assert allergy["subs"][-1] == {
        "text": "другие аллергены (указать конкретно)", "answer": True, "note": "латекс",
    }
    assert allergy["note"] == ""


def test_form_of_healthy_patient_says_no_everywhere():
    form = build_dental_summary(IGOR)[0]["paper_form"]

    assert all(row["answer"] in (False, None) for row in form["rows"])
    assert all(sub["answer"] is False for row in form["rows"] for sub in row["subs"])
    assert form["birth_date"] == ""
