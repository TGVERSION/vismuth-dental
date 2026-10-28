"""Карточка врача по ответам стоматологической анкеты: только правила, без ИИ."""

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
    ["allergy", "anticoagulants"],
    reason={"selected": ["pain"]},
    pain__where={"selected": ["lower_right"]},
    pain__when={"selected": ["cold", "bite"]},
    pain__since={"selected": ["days"]},
    allergy__substance={"selected": ["antibiotics"], "text": "амоксициллин"},
    allergy__reaction={"selected": ["rash"]},
    anticoagulants={"selected": ["eliquis"], "text": "5 мг, 2 раза в день"},
)

IGOR = _answers([], reason={"selected": ["checkup", "cleaning"]})


def test_olga_important_lists_blood_thinner_and_allergy():
    summary, _ = build_dental_summary(OLGA)

    assert summary["important"] == [
        "Принимает Эликвис, 5 мг, 2 раза в день: риск кровотечения при удалении и хирургии",
        "Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд",
    ]


def test_olga_complaint_is_built_from_buttons():
    summary, _ = build_dental_summary(OLGA)

    assert summary["complaints"] == (
        "Болит зуб снизу справа: от холодного, при накусывании; несколько дней."
    )


def test_olga_health_marks_checked_and_negative_rows():
    summary, _ = build_dental_summary(OLGA)

    rows = {row["key"]: row for row in summary["health"]}
    assert len(rows) == 20
    assert rows["anticoagulants"]["has"] is True
    assert rows["anticoagulants"]["detail"] == "Эликвис; 5 мг, 2 раза в день"
    assert rows["diabetes"]["has"] is False
    assert rows["diabetes"]["detail"] == ""


def test_olga_protocol_fields():
    summary, _ = build_dental_summary(OLGA)

    assert summary["medications"] == "Эликвис, 5 мг, 2 раза в день"
    assert summary["allergy_anamnesis"] == "Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд"
    assert summary["life_anamnesis"] == "Хронических заболеваний не отмечено."


def test_olga_gaps_ask_why_blood_thinner_is_prescribed():
    _, gaps = build_dental_summary(OLGA)

    assert _questions(gaps) == ["По какому поводу назначен Эликвис"]


def test_igor_has_nothing_important():
    summary, gaps = build_dental_summary(IGOR)

    assert summary["important"] == []
    assert summary["complaints"] == "Профосмотр, чистка зубов."
    assert summary["medications"] == "Постоянно не принимает."
    assert summary["allergy_anamnesis"] == "Аллергии нет."
    assert all(row["has"] is False for row in summary["health"])
    assert _questions(gaps) == []


def test_blood_thinner_without_dose_asks_for_dose():
    answers = _answers(["anticoagulants"], reason={"selected": ["checkup"]},
                       anticoagulants={"selected": ["xarelto"]})

    _, gaps = build_dental_summary(answers)

    assert "Доза и схема приёма препарата, разжижающего кровь" in _questions(gaps)


def test_blood_thinner_written_in_other_meds_is_flagged():
    answers = _answers(["other_meds"], reason={"selected": ["checkup"]},
                       other_meds={"text": "Кардиомагнил 75 мг утром, конкор"})

    summary, gaps = build_dental_summary(answers)

    assert summary["important"] == [
        "Упомянут «Кардиомагнил» — разжижает кровь, а строка «разжижающие кровь» не отмечена",
    ]
    assert "Принимает ли Кардиомагнил сейчас и в какой дозе" in _questions(gaps)
    assert summary["medications"] == "Кардиомагнил 75 мг утром, конкор"


def test_incomplete_pain_asks_what_is_missing():
    answers = _answers([], reason={"selected": ["pain"]},
                       pain__where={"selected": ["upper_left"]})

    summary, gaps = build_dental_summary(answers)

    assert summary["complaints"] == "Болит зуб сверху слева."
    assert _questions(gaps) == ["От чего возникает боль", "Как давно болит"]


def test_other_reason_text_goes_to_complaint_and_gaps():
    answers = _answers([], reason={"selected": ["gums", "other"], "text": "Хочу консультацию по брекетам"})

    summary, gaps = build_dental_summary(answers)

    assert summary["complaints"] == "Кровоточат дёсны. Другое: Хочу консультацию по брекетам."
    assert _questions(gaps) == ["Уточнить повод визита: «Хочу консультацию по брекетам»"]


def test_chronic_conditions_go_to_life_anamnesis_and_important():
    answers = _answers(
        ["heart", "diabetes", "pregnancy", "bone_onco"],
        reason={"selected": ["checkup"]},
        heart={"selected": ["hypertension"]},
        diabetes={"selected": ["type2"], "text": "метформин"},
        pregnancy={"selected": ["pregnant"], "text": "20 недель"},
        bone_onco={"selected": ["osteoporosis_drugs"]},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["life_anamnesis"] == (
        "Болезни сердца или давление: повышенное давление. "
        "Сахарный диабет: второго типа; метформин. "
        "Онкология или лечение остеопороза: лекарства от остеопороза. "
        "Беременность или кормление грудью: беременность; 20 недель."
    )
    assert summary["important"] == [
        "Лекарства от остеопороза: риск осложнений при удалении и имплантации",
        "Беременность; 20 недель: учитывать при рентгене и выборе анестетика",
    ]


def test_bleeding_and_past_anesthesia_reaction_are_important():
    answers = _answers(
        ["anesthesia_reaction", "bleeding"],
        reason={"selected": ["checkup"]},
        anesthesia_reaction={"selected": ["fainting", "palpitations"]},
        bleeding={"selected": ["long_bleeding"]},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == [
        "Терял(а) сознание, сильно билось сердце: подобрать анестетик, наблюдать после укола",
        "Долго идёт кровь после пореза или удаления зуба: "
        "риск кровотечения при удалении и хирургии",
    ]
    assert summary["important_facts"] == [
        "Терял(а) сознание, сильно билось сердце",
        "Долго идёт кровь после пореза или удаления зуба",
    ]
    assert summary["life_anamnesis"] == (
        "Плохо переносили обезболивание у стоматолога: терял(а) сознание, сильно билось сердце. "
        "Кровоточивость или плохая свёртываемость крови: "
        "долго идёт кровь после пореза или удаления зуба."
    )


def test_only_asthma_and_raised_thyroid_function_reach_important():
    answers = _answers(
        ["lungs", "thyroid", "liver_kidney"],
        reason={"selected": ["checkup"]},
        lungs={"selected": ["asthma", "copd"], "text": "Сальбутамол"},
        thyroid={"selected": ["hyperthyroid"]},
        liver_kidney={"selected": ["kidney"]},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == [
        "Бронхиальная астма: риск приступа в кресле — ингалятор пациента под рукой",
        "Повышенная функция (тиреотоксикоз): осторожно с анестетиком с адреналином",
    ]
    assert summary["life_anamnesis"] == (
        "Астма или болезни лёгких: бронхиальная астма, хронический бронхит или ХОБЛ; Сальбутамол. "
        "Болезни щитовидной железы: повышенная функция (тиреотоксикоз). "
        "Болезни печени или почек: почки."
    )


def test_copd_and_low_thyroid_function_stay_in_anamnesis():
    answers = _answers(
        ["lungs", "thyroid"],
        reason={"selected": ["checkup"]},
        lungs={"selected": ["copd"]},
        thyroid={"selected": ["hypothyroid"]},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == []
    assert "Болезни щитовидной железы: пониженная функция (гипотиреоз)." in summary["life_anamnesis"]


def test_paper_form_diseases_go_to_life_anamnesis():
    answers = _answers(
        ["stomach", "ent", "bones_skin", "lymph", "transfusion", "other_diseases"],
        reason={"selected": ["checkup"]},
        stomach={"selected": ["ulcer"]},
        ent={"selected": ["sinusitis"]},
        bones_skin={"selected": ["bones"]},
        lymph={"text": "на шее, полгода"},
        transfusion={"text": "в 2015 году"},
        other_diseases={"text": "Удаление аппендицита в 2010"},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == []
    assert summary["life_anamnesis"] == (
        "Болезни желудка или кишечника: язва или гастрит. "
        "Болезни уха, горла, носа или гайморит: гайморит. "
        "Болезни костей, суставов или кожи: кости или суставы. "
        "Постоянно увеличены лимфоузлы: на шее, полгода. "
        "Было переливание крови: в 2015 году. "
        "Другие болезни, операции или травмы: Удаление аппендицита в 2010."
    )


def test_strong_gag_reflex_is_important():
    answers = _answers(["stomach"], reason={"selected": ["checkup"]},
                       stomach={"selected": ["gag"]})

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == [
        "Сильный рвотный рефлекс: учитывать при слепках и снимках",
    ]


def test_dental_history_lists_every_sign_with_yes_or_no():
    answers = _answers(
        [],
        reason={"selected": ["checkup"]},
        mouth__last_visit={"selected": ["over_year"]},
        mouth__signs={"selected": ["gums_bleed", "bruxism"]},
        mouth__complications={"selected": ["long_bleeding", "other"], "text": "болела десна неделю"},
    )

    summary, _ = build_dental_summary(answers)

    history = summary["dental_history"]
    assert history["last_visit"] == "Больше года назад"
    assert [(row["key"], row["has"]) for row in history["signs"]] == [
        ("tmj", False), ("bruxism", True), ("gums_bleed", True),
        ("herpes", False), ("dry_mouth", False), ("bad_breath", False),
    ]
    assert history["complications"] == "Долго шла кровь; болела десна неделю"
    assert summary["dental_anamnesis"] == (
        "Последний визит к стоматологу: больше года назад. "
        "Бывает: скрежет зубами (бруксизм), кровоточат дёсны при чистке. "
        "Осложнения при прошлом лечении: долго шла кровь; болела десна неделю."
    )


def test_empty_dental_history_says_nothing_noted():
    summary, _ = build_dental_summary(IGOR)

    assert summary["dental_history"]["last_visit"] == ""
    assert summary["dental_history"]["complications"] == ""
    assert summary["dental_anamnesis"] == "Жалоб на дёсны, челюсть и прошлое лечение не отмечено."


def _other_meds(text, **extra):
    return _answers(["other_meds"], reason={"selected": ["checkup"]},
                    other_meds={"text": text}, **extra)


def test_pacemaker_and_infection_are_important():
    answers = _answers(
        ["heart", "infections"],
        reason={"selected": ["checkup"]},
        heart={"selected": ["pacemaker"]},
        infections={"selected": ["hepatitis_c"]},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important"] == [
        "Кардиостимулятор: осторожно с анестетиком с адреналином и электроприборами",
        "Гепатит C: соблюдать меры инфекционной безопасности",
    ]


def test_latin_brand_name_is_recognised():
    summary, gaps = build_dental_summary(_other_meds("Xarelto 20 mg"))

    assert summary["important"] == [
        "Упомянут «Ксарелто» — разжижает кровь, а строка «разжижающие кровь» не отмечена",
    ]
    assert _questions(gaps) == ["Принимает ли Ксарелто сейчас и в какой дозе"]


def test_hyphenated_brand_name_is_recognised():
    summary, _ = build_dental_summary(_other_meds("Тромбо-АСС 100"))

    assert summary["important"] == [
        "Упомянут «Аспирин» — разжижает кровь, а строка «разжижающие кровь» не отмечена",
    ]


def test_same_drug_named_twice_gives_one_line():
    summary, _ = build_dental_summary(_other_meds("ацетилсалициловая кислота (аспирин)"))

    assert len(summary["important"]) == 1


def test_allergy_to_aspirin_is_not_taken_as_blood_thinner():
    answers = _answers(
        ["allergy"],
        reason={"selected": ["checkup"]},
        allergy__substance={"selected": ["painkillers"], "text": "аспирин"},
    )

    summary, gaps = build_dental_summary(answers)

    assert summary["important"] == ["Аллергия: таблетки от боли — аспирин"]
    assert all("разжижает" not in line for line in summary["important"])


def test_unknown_stored_value_does_not_break_the_card():
    answers = _answers([], reason={"selected": ["pain", "removed_reason"]},
                       pain__when={"selected": ["removed_trigger"]})

    summary, _ = build_dental_summary(answers)

    assert summary["complaints"].startswith("Болит зуб")


def test_signed_sheet_gets_facts_without_doctor_warnings():
    summary, _ = build_dental_summary(OLGA)

    assert summary["important_facts"] == [
        "Принимает Эликвис, 5 мг, 2 раза в день",
        "Аллергия: антибиотики — амоксициллин; реакция: сыпь, зуд",
    ]


def test_dictionary_hits_are_not_patient_facts():
    summary, _ = build_dental_summary(_other_meds("Кардиомагнил 75 мг"))

    assert summary["important"] != []
    assert summary["important_facts"] == []


def test_risk_facts_keep_patient_words_only():
    answers = _answers(
        ["heart", "pregnancy"],
        reason={"selected": ["checkup"]},
        heart={"selected": ["pacemaker"]},
        pregnancy={"selected": ["pregnant"], "text": "20 недель"},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important_facts"] == ["Кардиостимулятор", "Беременность; 20 недель"]


def test_other_label_never_appears_in_text():
    answers = _answers(
        ["anticoagulants"],
        reason={"selected": ["checkup"]},
        anticoagulants={"selected": ["warfarin", "other"], "text": "Синкумар"},
    )

    summary, _ = build_dental_summary(answers)

    assert summary["important_facts"] == ["Принимает Варфарин, Синкумар"]
    assert "Другое" not in summary["medications"]


def test_gaps_are_attached_to_doctor_card_sections():
    answers = _answers(
        ["anticoagulants", "allergy"],
        reason={"selected": ["pain", "other"], "text": "Шатается зуб"},
        anticoagulants={"selected": ["xarelto"]},
    )

    _, gaps = build_dental_summary(answers)

    assert {(gap["section"], gap["question"]) for gap in gaps} >= {
        ("complaints", "Уточнить повод визита: «Шатается зуб»"),
        ("complaints", "Как давно болит"),
        ("medications", "Доза и схема приёма препарата, разжижающего кровь"),
        ("medications", "По какому поводу назначен Ксарелто"),
        ("allergy_anamnesis", "На что аллергия"),
    }
