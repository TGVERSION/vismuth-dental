"""Сценарий стоматологической анкеты: шаги, проверка ответов, переходы."""

import pytest

from app.services.dental.flow import (
    DentalAnswerError,
    DentalAnswers,
    apply_dental_answer,
    dental_step,
)


def _answer(answers, step, *, selections=None, texts=None, none=False):
    return apply_dental_answer(
        step,
        answers,
        selections=selections or {},
        texts=texts or {},
        none=none,
    )


def _health(answers, items):
    return _answer(answers, "dental_health", selections={"health": items})


EMPTY = DentalAnswers()


def test_reason_step_offers_seven_reasons_with_other_text():
    step = dental_step("dental_reason", EMPTY)

    assert step.step_type == "chip_groups"
    [group] = step.groups
    assert group["key"] == "reason"
    assert group["multiple"] is True
    assert [o["value"] for o in group["options"]] == [
        "pain", "checkup", "cleaning", "gums", "broken", "missing", "other",
    ]
    assert group["text"]["show"] == "on_other"


def test_pain_reason_leads_to_pain_step():
    answers, next_step = _answer(EMPTY, "dental_reason", selections={"reason": ["pain"]})

    assert next_step == "dental_pain"
    assert answers.groups["reason"].selected == ["pain"]


def test_checkup_reason_skips_pain_step():
    _, next_step = _answer(EMPTY, "dental_reason", selections={"reason": ["checkup", "cleaning"]})

    assert next_step == "dental_health"


def test_reason_is_required():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_reason", selections={"reason": []})


def test_other_reason_requires_text():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_reason", selections={"reason": ["other"]})


def test_other_reason_text_is_stripped_and_truncated():
    answers, _ = _answer(
        EMPTY,
        "dental_reason",
        selections={"reason": ["other"]},
        texts={"reason": "  " + "а" * 1200 + "  "},
    )

    assert answers.groups["reason"].text == "а" * 1000


def test_unknown_value_is_rejected():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_reason", selections={"reason": ["teeth_whitening"]})


def test_foreign_group_is_rejected():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_reason", selections={"reason": ["pain"], "pain.since": ["today"]})


def test_pain_step_has_where_when_since():
    step = dental_step("dental_pain", EMPTY)

    assert [g["key"] for g in step.groups] == ["pain.where", "pain.when", "pain.since"]
    assert [g["multiple"] for g in step.groups] == [True, True, False]


def test_single_choice_group_accepts_one_value():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_pain", selections={"pain.since": ["today", "days"]})


def test_pain_groups_may_stay_empty():
    _, next_step = _answer(EMPTY, "dental_pain", selections={})

    assert next_step == "dental_health"


def test_health_step_is_checklist_like_paper_forms_with_none():
    step = dental_step("dental_health", EMPTY)

    assert step.step_type == "checklist"
    assert step.allow_none is True
    assert [item["value"] for item in step.items] == [
        "allergy", "anesthesia_reaction", "anticoagulants", "bleeding", "heart",
        "lungs", "diabetes", "thyroid", "liver_kidney", "pregnancy", "epilepsy",
        "infections", "bone_onco", "other_meds",
    ]
    anticoagulants = step.items[2]
    assert "Кардиомагнил" in anticoagulants["hint"]


def test_health_none_completes_questionnaire():
    answers, next_step = _answer(EMPTY, "dental_health", none=True)

    assert next_step == "done"
    assert answers.health == []


def test_health_needs_choice_or_none():
    with pytest.raises(DentalAnswerError):
        _health(EMPTY, [])


def test_health_none_with_items_is_rejected():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_health", selections={"health": ["allergy"]}, none=True)


def test_health_items_lead_to_details():
    answers, next_step = _health(EMPTY, ["anticoagulants", "allergy"])

    assert next_step == "dental_details"
    assert answers.health == ["allergy", "anticoagulants"]


def test_details_show_groups_only_for_checked_items_in_list_order():
    answers, _ = _health(EMPTY, ["other_meds", "allergy"])

    step = dental_step("dental_details", answers)

    assert [g["key"] for g in step.groups] == [
        "allergy.substance", "allergy.reaction", "other_meds",
    ]
    assert step.groups[0]["title"] == "Вы отметили: аллергия на лекарства"
    assert step.groups[0]["text"]["show"] == "on_select"
    assert step.groups[2]["text"] == {
        "placeholder": "Например: Конкор 5 мг утром", "required": True, "show": "always",
    }


def test_details_other_meds_text_is_required():
    answers, _ = _health(EMPTY, ["other_meds"])

    with pytest.raises(DentalAnswerError):
        _answer(answers, "dental_details", texts={"other_meds": "  "})


def test_details_reject_groups_of_unchecked_items():
    answers, _ = _health(EMPTY, ["allergy"])

    with pytest.raises(DentalAnswerError):
        _answer(answers, "dental_details", selections={"anticoagulants": ["eliquis"]})


def test_details_complete_questionnaire():
    answers, _ = _health(EMPTY, ["anticoagulants"])

    answers, next_step = _answer(
        answers,
        "dental_details",
        selections={"anticoagulants": ["eliquis"]},
        texts={"anticoagulants": "5 мг, 2 раза в день"},
    )

    assert next_step == "done"
    assert answers.groups["anticoagulants"].text == "5 мг, 2 раза в день"


def test_apply_does_not_mutate_previous_answers():
    before = EMPTY

    _answer(before, "dental_reason", selections={"reason": ["pain"]})

    assert before.groups == {}
