"""Гастросценарий: факты, порядок шагов, возврат и защита от устаревшего ответа."""
import json

import pytest

from app.services.gastro.flow import GastroAnswerError, answer, descriptor, route_gastro, sequence
from app.services.gastro.summary import build_summary


def send(state, step, *, selections=None, texts=None, choice=None):
    return answer(state, step, revision=state.get("revision", 0), selections=selections or {}, texts=texts or {}, choice=choice)


@pytest.mark.parametrize("name,visit,expected", [
    ("Гастроэнтеролог", "primary", True), ("Детский гастроэнтеролог", "primary", False),
    ("Гастроэнтеролог", "repeat", False), ("Терапевт", "primary", False),
])
def test_route_selected_specialty(name, visit, expected):
    assert route_gastro(name, visit) is expected


def test_complaints_have_independent_timelines_and_both_stool_patterns():
    state, _ = send({}, "gastro_reason", selections={"complaints": ["pain", "stool"]})
    state, _ = send(state, "gastro_main", selections={"main": ["pain"]})
    state, _ = send(state, "gastro_pain", selections={"pain_onset": ["months"]}, texts={"pain_description": "После еды"})
    state, _ = send(state, "gastro_stool", selections={"stool_patterns": ["constipation", "diarrhea"], "stool_onset": ["days"]})
    structured, _ = build_summary(state)
    assert state["sections"]["gastro_pain"]["values"]["pain_onset"] == ["months"]
    assert state["sections"]["gastro_stool"]["values"]["stool_onset"] == ["days"]
    assert "Запор" in structured["complaints"] and "Жидкий стул" in structured["complaints"]


def test_no_symptoms_today_does_not_erase_prior_complaint():
    state, _ = send({}, "gastro_reason", selections={"complaints": ["pain"], "symptoms_today": ["no"]})
    assert "gastro_pain" in sequence(state)


def test_questions_are_last_ordered_verbatim_and_separate():
    raw = ["  Можно ли кофе?  ", "Что значат мои анализы?"]
    state, next_step = send({}, "gastro_questions", texts={"patient_questions": json.dumps(raw)})
    assert next_step == "code"
    structured, gaps = build_summary(state)
    assert structured["patient_questions"] == raw
    assert "кофе" not in structured["complaints"]
    assert all("кофе" not in g["question"] for g in gaps)
    assert sequence(state)[-4:] == ["gastro_identity", "gastro_review", "gastro_questions", "code"]


def test_no_negative_from_unanswered_vs_none_vs_unknown():
    blank, _ = build_summary({})
    none, _ = build_summary(send({}, "gastro_allergy", selections={"allergy_status": ["none"]})[0])
    unknown, _ = build_summary(send({}, "gastro_allergy", selections={"allergy_status": ["unknown"]})[0])
    assert "Не спрошено" in blank["allergy_anamnesis"]
    assert "Нет известных" in none["allergy_anamnesis"]
    assert "Не знаю" in unknown["allergy_anamnesis"]


def test_family_for_all_and_no_age_or_time_fields():
    for state in ({}, send({}, "gastro_reason", selections={"complaints": ["tests"]})[0]):
        assert "gastro_family" in sequence(state)
        keys = [f["key"] for step in sequence(state) if step != "code" for f in descriptor(step, state).gastro["fields"]]
        assert not any(part in key for key in keys for part in ("birth", "age", "appointment_time"))


def test_long_history_preserved_without_truncation():
    text = "История по словам пациента; дата неизвестна. " * 400
    state, _ = send({}, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": text})
    result, _ = build_summary(state)
    assert result["history"]["raw"]["history_narrative"] == text
    assert text in result["life_anamnesis"]
    with pytest.raises(GastroAnswerError, match="20000"):
        send({}, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": "x" * 20001})


def test_back_restores_history_and_invalidates_only_removed_branches():
    state, _ = send({}, "gastro_reason", selections={"complaints": ["pain", "heartburn"]})
    state, _ = send(state, "gastro_pain", texts={"pain_description": "Давно"})
    state, _ = send(state, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": "Обследовался"})
    state, _ = send(state, "gastro_reason", selections={"complaints": ["heartburn"]})
    assert "gastro_pain" not in state["sections"]
    assert descriptor("gastro_history", state).gastro["values"]["history_narrative"] == "Обследовался"
    state, prev = send(state, "gastro_review", choice="back")
    assert prev == "gastro_identity"


def test_stale_revision_rejected():
    state, _ = send({}, "gastro_reason", selections={"complaints": ["none"]})
    with pytest.raises(GastroAnswerError, match="revision"):
        answer(state, "gastro_reason", revision=0, selections={"complaints": ["pain"]}, texts={})


def test_specific_urgent_fact_only_and_past_period_preserved():
    ordinary, _ = send({}, "gastro_reason", selections={"complaints": ["pain"]})
    result, _ = build_summary(ordinary)
    assert result["important"] == []
    state, _ = send(ordinary, "gastro_safety", selections={"risk_present": ["black_stool", "vomit_blood"], "black_stool": ["past"], "vomit_blood": ["now"]})
    result, _ = build_summary(state)
    assert len(result["important"]) == 2
    assert "раньше" in " ".join(result["important"])
    assert "Сейчас" in " ".join(result["important"])
    assert descriptor("gastro_medications", state).gastro["warnings"]


def test_current_and_stopped_medications_remain_separate():
    state, _ = send({}, "gastro_medications", selections={"medication_status": ["yes"]}, texts={"current_medications": "Омепразол", "stopped_attempts": "Отменил железо"})
    result, _ = build_summary(state)
    assert "Омепразол" in result["medications"]
    assert "Ранее пробовали / отменили: Отменил железо" in result["life_anamnesis"]


def test_hidden_or_unknown_fields_and_exclusive_values_rejected():
    with pytest.raises(GastroAnswerError):
        send({}, "gastro_reason", selections={"complaints": ["pain", "none"]})
    with pytest.raises(GastroAnswerError):
        send({}, "gastro_reason", texts={"birth_date": "2000-01-01"})
    with pytest.raises(GastroAnswerError):
        send({}, "gastro_history", selections={"history_mode": ["skip"]}, texts={"history_narrative": "hidden"})


def test_ai_terminal_skip_never_asks_next_question():
    state = {"revision": 2, "sections": {}, "ai": [{"question": "Когда началось?", "choices": []}]}
    state, next_step = send(state, "gastro_ai_question", choice="finish_ai")
    assert next_step == "gastro_identity"
    assert state["ai_terminal"] is True


def test_identity_requires_date_and_name_without_time():
    state, next_step = send({}, "gastro_identity", texts={"first_name": "Анна", "appointment_date": "2026-10-31"})
    assert next_step == "gastro_review"
    assert "appointment_time" not in state["sections"]["gastro_identity"]["values"]


def test_safety_is_one_short_list_with_periods_only_for_selected():
    fields = descriptor("gastro_safety", {}).gastro["fields"]
    assert fields[0]["key"] == "risk_present"
    assert fields[0]["type"] == "multi"
    assert all(f.get("show_when") for f in fields[1:])
    state, _ = send({}, "gastro_safety", selections={"risk_present": ["none"]})
    summary, _ = build_summary(state)
    assert "Не было" not in summary["safety"]
    assert "Ничего из перечисленного" in summary["safety"]


def test_chronological_facts_preserve_explicit_periods_without_invented_dates():
    state, _ = send({}, "gastro_reason", selections={"complaints": ["pain"]})
    state, _ = send(state, "gastro_pain", selections={"pain_onset": ["months"]})
    state, _ = send(state, "gastro_history", selections={"history_mode": ["guided"]}, texts={"history_examinations": "ФГДС, дату не помню", "history_changes": "Теперь реже"})
    summary, _ = build_summary(state)
    facts = summary["history"]["chronology"]
    assert any(f["period"] == "Несколько месяцев" for f in facts)
    assert any(f["text"] == "ФГДС, дату не помню" and f["date"] is None for f in facts)
    assert all(f["date"] is None for f in facts)


def test_recipient_change_is_explicit_and_preserves_medical_history():
    state, _ = send({}, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": "Раньше лечился"})
    state, next_step = send(state, "gastro_review", choice="change_doctor")
    assert next_step == "choose_doctor"
    assert state["sections"]["gastro_history"]["values"]["history_narrative"] == "Раньше лечился"


def test_complete_narrative_does_not_offer_model_only_for_other_checkbox():
    state, _ = send({}, "gastro_reason", selections={"complaints": ["other"]})
    state, next_step = send(state, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": "Хочу обсудить питание, жалоб нет"})
    assert next_step == "gastro_identity"
    assert "gastro_ai_offer" not in sequence(state)


def test_back_saves_incomplete_draft_questions_without_confirming_it():
    state, _ = send({}, "gastro_identity", texts={"first_name": "Анна", "appointment_date": "2026-10-31"})
    state, prev = send(state, "gastro_questions", choice="back", texts={"patient_questions": '["Новый вопрос?"]'})
    assert prev == "gastro_review"
    assert descriptor("gastro_questions", state).gastro["values"]["patient_questions"] == ["Новый вопрос?"]
    assert build_summary(state)[0]["patient_questions"] == []
    state, _ = send(state, "gastro_identity", choice="back", texts={"first_name": "Новое имя"})
    assert descriptor("gastro_identity", state).gastro["values"] == {"first_name": "Новое имя"}
    assert state["sections"]["gastro_identity"]["values"]["first_name"] == "Анна"


def test_back_rejects_invalid_draft_and_confirm_removes_it():
    with pytest.raises(GastroAnswerError):
        send({}, "gastro_history", choice="back", texts={"history_narrative": "x" * 20001})
    state, _ = send({}, "gastro_identity", choice="back", texts={"first_name": "Анна"})
    state, _ = send(state, "gastro_identity", texts={"first_name": "Анна", "appointment_date": "2026-10-31"})
    assert "gastro_identity" not in state.get("drafts", {})


def test_current_jaundice_has_specific_immediate_warning_and_highlight():
    state, _ = send({}, "gastro_reason", selections={"complaints": ["jaundice"]})
    state, _ = send(state, "gastro_jaundice", selections={"jaundice_period": ["now"]})
    result, _ = build_summary(state)
    assert any("Желтизна" in fact for fact in result["important"])
    assert any("срочная" in warning for warning in descriptor("gastro_safety", state).gastro["warnings"])
    period = next(f for f in descriptor("gastro_jaundice", state).gastro["fields"] if f["key"] == "jaundice_period")
    assert next(o for o in period["options"] if o["value"] == "now")["warning"]


def test_recent_medication_exposures_reach_doctor_and_protocol_with_period():
    state, _ = send({}, "gastro_medications", selections={"medication_status": ["none"], "recent_exposures": ["nsaids", "anticoagulants"]})
    result, _ = build_summary(state)
    assert "За последние 3 месяца" in result["medications"]
    assert "НПВП" in result["medications"]
    assert any("За последние 3 месяца" in fact and "разжижения" in fact for fact in result["important"])
    assert "Принимает сейчас" not in result["medications"]


def test_clinical_change_invalidates_ai_turn_section_and_draft():
    state = {"revision": 1, "sections": {"gastro_ai_question": {"values": {"ai_text": "Устаревшее уточнение"}}}, "drafts": {"gastro_ai_question": {"ai_text": "Старый черновик"}}, "ai": [{"question": "Когда началось?", "answer": "Недавно"}]}
    state, _ = send(state, "gastro_reason", selections={"complaints": ["none"]})
    assert state["ai"] == []
    assert "gastro_ai_question" not in state["sections"]
    assert "gastro_ai_question" not in state["drafts"]


def test_narrative_extracts_only_source_event_fragments_and_explicit_periods():
    text = "В 2020 году прошёл ФГДС. В 2022 принимал омепразол, помог. Мне 40 лет, родился в 1986 году. Сейчас симптомы реже."
    state, _ = send({}, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": text})
    result, _ = build_summary(state)
    facts = result["history"]["chronology"]
    assert facts[0]["text"] == "В 2020 году прошёл ФГДС."
    assert facts[0]["period"] == "2020"
    assert facts[1]["text"] == "В 2022 принимал омепразол, помог."
    assert facts[1]["period"] == "2022"
    assert facts[2]["period"] == "Дата не указана"
    assert not any("1986" in fact["text"] or "40 лет" in fact["text"] for fact in facts)
    assert result["history"]["raw"]["history_narrative"] == text


def test_long_narrative_excerpts_are_bounded_and_marked_without_losing_raw():
    text = "\n".join(f"В {2000 + i} году принимал препарат " + "давно " * 100 + "." for i in range(10))
    state, _ = send({}, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": text})
    result, _ = build_summary(state)
    facts = result["history"]["chronology"]
    assert 1 <= len(facts) <= 6
    assert all(len(fact["text"]) < 320 for fact in facts)
    assert all("отрывок" in fact["text"] for fact in facts)
    assert result["history"]["raw"]["history_narrative"] == text


def test_medication_dose_is_not_extracted_as_a_year():
    state, _ = send({}, "gastro_history", selections={"history_mode": ["narrative"]}, texts={"history_narrative": "Принимал препарат 2000 мг, дату не помню."})
    facts = build_summary(state)[0]["history"]["chronology"]
    assert facts[0]["period"] == "Дата не указана"
