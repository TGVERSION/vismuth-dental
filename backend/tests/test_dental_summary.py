"""Карточка врача по ответам стоматологической анкеты: только правила, без ИИ."""

from app.services.dental.flow import DentalAnswers, GroupAnswer
from app.services.dental.summary import build_dental_summary


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
    assert len(rows) == 9
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

    assert gaps == ["По какому поводу назначен Эликвис"]


def test_igor_has_nothing_important():
    summary, gaps = build_dental_summary(IGOR)

    assert summary["important"] == []
    assert summary["complaints"] == "Профосмотр, чистка зубов."
    assert summary["medications"] == "Постоянно не принимает."
    assert summary["allergy_anamnesis"] == "Аллергии нет."
    assert all(row["has"] is False for row in summary["health"])
    assert gaps == []


def test_blood_thinner_without_dose_asks_for_dose():
    answers = _answers(["anticoagulants"], reason={"selected": ["checkup"]},
                       anticoagulants={"selected": ["xarelto"]})

    _, gaps = build_dental_summary(answers)

    assert "Доза и схема приёма препарата, разжижающего кровь" in gaps


def test_blood_thinner_written_in_other_meds_is_flagged():
    answers = _answers(["other_meds"], reason={"selected": ["checkup"]},
                       other_meds={"text": "Кардиомагнил 75 мг утром, конкор"})

    summary, gaps = build_dental_summary(answers)

    assert summary["important"] == [
        "Упомянут «Кардиомагнил» — разжижает кровь, а строка «разжижающие кровь» не отмечена",
    ]
    assert "Принимает ли Кардиомагнил сейчас и в какой дозе" in gaps
    assert summary["medications"] == "Кардиомагнил 75 мг утром, конкор"


def test_incomplete_pain_asks_what_is_missing():
    answers = _answers([], reason={"selected": ["pain"]},
                       pain__where={"selected": ["upper_left"]})

    summary, gaps = build_dental_summary(answers)

    assert summary["complaints"] == "Болит зуб сверху слева."
    assert gaps == ["От чего возникает боль", "Как давно болит"]


def test_other_reason_text_goes_to_complaint_and_gaps():
    answers = _answers([], reason={"selected": ["gums", "other"], "text": "Хочу консультацию по брекетам"})

    summary, gaps = build_dental_summary(answers)

    assert summary["complaints"] == "Кровоточат дёсны. Другое: Хочу консультацию по брекетам."
    assert gaps == ["Уточнить повод визита: «Хочу консультацию по брекетам»"]


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
        "Беременность или кормление грудью: беременность; 20 недель. "
        "Лечение остеопороза или онкологии: лекарства от остеопороза."
    )
    assert summary["important"] == [
        "Беременность; 20 недель: учитывать при рентгене и выборе анестетика",
        "Лекарства от остеопороза: риск осложнений при удалении и имплантации",
    ]


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
    assert gaps == ["Принимает ли Ксарелто сейчас и в какой дозе"]


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
