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

# Пункты бланка «Анкета о здоровье» (МК Дент) — в его порядке, 1–43.
FORM_ORDER = [
    "hepatitis", "tuberculosis", "transfusion", "injections", "mouth_ulcers",
    "fever", "throat", "lymph", "skin_spots", "night_sweats", "diarrhea",
    "weight_loss", "smoking", "oncology", "radio_chemo", "endocrine", "skin",
    "neurodermatitis", "urinary", "stomach", "musculoskeletal", "ent",
    "jaw_trauma", "surgery", "diabetes", "dry_mouth", "heart_defect",
    "heart_valve", "ischemia", "heart_attack", "pacemaker", "varicose",
    "pressure", "cns", "seizures", "concussion", "asthma", "liver", "bleeding",
    "medications", "allergy", "pregnancy", "hiv",
]


def test_reason_step_offers_problems_from_the_paper_form():
    step = dental_step("dental_reason", EMPTY)

    assert step.step_type == "chip_groups"
    [group] = step.groups
    assert group["key"] == "reason"
    assert group["multiple"] is True
    assert [o["value"] for o in group["options"]] == [
        "pain", "treatment", "gums", "checkup", "prosthetics", "implant",
        "braces", "aesthetic", "other",
    ]
    assert group["text"]["show"] == "on_other"


def test_pain_reason_leads_directly_to_health():
    answers, next_step = _answer(EMPTY, "dental_reason", selections={"reason": ["pain"]})

    assert next_step == "dental_health"
    assert answers.groups["reason"].selected == ["pain"]


def test_other_reasons_skip_pain_step():
    _, next_step = _answer(EMPTY, "dental_reason", selections={"reason": ["checkup", "implant"]})

    assert next_step == "dental_health"


def test_reason_is_required():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_reason", selections={"reason": []})


def test_other_reason_requires_text():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_reason", selections={"reason": ["other"]})


def test_other_reason_text_is_stripped_and_preserved():
    answers, _ = _answer(
        EMPTY,
        "dental_reason",
        selections={"reason": ["other"]},
        texts={"reason": "  " + "а" * 1200 + "  "},
    )

    assert answers.groups["reason"].text == "а" * 1200


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


def test_health_step_lists_all_43_points_of_the_paper_form_in_its_order():
    step = dental_step("dental_health", EMPTY)

    assert step.step_type == "checklist"
    assert step.allow_none is True
    assert [item["value"] for item in step.items] == FORM_ORDER
    medications = step.items[FORM_ORDER.index("medications")]
    assert "Кардиомагнил" in medications["hint"]


def test_health_none_leads_to_about_step():
    answers, next_step = _answer(EMPTY, "dental_health", none=True)

    assert next_step == "dental_about"
    assert answers.health == []


def test_health_needs_choice_or_none():
    with pytest.raises(DentalAnswerError):
        _health(EMPTY, [])


def test_health_none_with_items_is_rejected():
    with pytest.raises(DentalAnswerError):
        _answer(EMPTY, "dental_health", selections={"health": ["allergy"]}, none=True)


def test_health_items_lead_to_details_in_form_order():
    answers, next_step = _health(EMPTY, ["medications", "hepatitis"])

    assert next_step == "dental_details"
    assert answers.health == ["hepatitis", "medications"]


def test_items_without_details_skip_details_step():
    _, next_step = _health(EMPTY, ["tuberculosis", "night_sweats"])

    assert next_step == "dental_about"


def test_details_show_groups_only_for_checked_items():
    answers, _ = _health(EMPTY, ["allergy", "transfusion", "tuberculosis"])

    step = dental_step("dental_details", answers)

    assert [g["key"] for g in step.groups] == [
        "transfusion", "allergy.substance", "allergy.reaction",
    ]
    assert step.groups[1]["title"] == "Аллергия"
    assert step.groups[1]["required"] is True


def test_rows_without_own_yes_no_need_a_choice():
    answers, _ = _health(EMPTY, ["pressure"])

    with pytest.raises(DentalAnswerError):
        _answer(answers, "dental_details", texts={"pressure": "120/80"})


def test_medication_name_need_not_be_typed_after_selection():
    answers, _ = _health(EMPTY, ["medications"])

    updated, _ = _answer(answers, "dental_details", selections={"medications": ["eliquis"]})
    assert updated.groups["medications"].selected == ["eliquis"]


def test_details_reject_groups_of_unchecked_items():
    answers, _ = _health(EMPTY, ["allergy"])

    with pytest.raises(DentalAnswerError):
        _answer(answers, "dental_details", selections={"pressure": ["high"]})


def test_details_lead_to_about_step():
    answers, _ = _health(EMPTY, ["medications"])

    answers, next_step = _answer(
        answers,
        "dental_details",
        selections={"medications": ["eliquis"]},
        texts={"medications": "5 мг, 2 раза в день"},
    )

    assert next_step == "dental_about"
    assert answers.groups["medications"].text == "5 мг, 2 раза в день"


def test_about_step_asks_header_fields_of_the_paper_form():
    step = dental_step("dental_about", EMPTY)

    assert [g["key"] for g in step.groups] == [
        "about.visit_year", "about.visit_clinic", "about.more",
    ]
    assert all(g["options"] == [] and g["text"]["show"] == "always" for g in step.groups)
    assert not any(g["text"]["required"] for g in step.groups)


def test_about_step_may_stay_empty_and_leads_to_review():
    answers, next_step = _answer(EMPTY, "dental_about")

    assert next_step == "dental_review"
    assert answers.groups == {}


def test_apply_does_not_mutate_previous_answers():
    before = EMPTY

    _answer(before, "dental_reason", selections={"reason": ["pain"]})

    assert before.groups == {}
