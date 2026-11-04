"""Paged dental route: explicit coverage, dependent branches and paper parity."""
import asyncio
from dataclasses import asdict
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.questionnaire import Questionnaire
from app.services import dental_questionnaire as dq
from app.services.dental.flow import DentalAnswers, GroupAnswer, health_state
from app.services.dental.questions import HEALTH_ITEMS
from app.services.dental.paper_form import build_paper_form

NOW = datetime(2026, 11, 1, tzinfo=timezone.utc)
ALL = [item.value for item in HEALTH_ITEMS]


def questionnaire():
    return Questionnaire(kind="dental", status="in_progress", current_step="dental_reason",
        dental_answers={"flow_version": 2, "groups": {"about.birth_date": {"text": "1985-03-14"}}},
        ai_unavailable=True, ai_questions_count=0)


def answer(q, *, selections=None, texts=None, none=False, choice=None):
    asyncio.run(dq.apply_dental(q, step_key=q.current_step,
        selections=selections or {}, texts=texts or {}, none_answer=none, skip=False,
        now=NOW, revision=q.dental_answers.get("revision", 0), choice=choice))


def start(q):
    answer(q, selections={"reason": ["checkup"]})


def health(q, positive=(), uncertain=()):
    for number in range(1, 7):
        assert q.current_step == f"dental_health_{number}"
        owned = {item["value"] for item in dq.build_dental_descriptor(q).choices}
        yes, unknown = list(owned & set(positive)), list(owned & set(uncertain))
        answer(q, selections={"health": yes, "health_unknown": unknown}, none=not (yes or unknown))


def test_six_health_pages_cover_every_paper_row_once_and_healthy_flow_is_eight_screens():
    q = questionnaire()
    start(q)
    assert q.current_step == "dental_health_1"
    values = []
    for n in range(1, 7):
        descriptor = dq.build_dental_descriptor(q)
        assert 6 <= len(descriptor.choices) <= 8
        assert descriptor.dental["page"] == {"kind": "health", "current": n, "total": 6}
        assert descriptor.dental["progress"]["current"] == n + 1
        values.extend(row["value"] for row in descriptor.choices)
        answer(q, none=True)
    assert len(values) == len(set(values)) == 43 and set(values) == set(ALL)
    assert q.current_step == "dental_about"
    assert dq.build_dental_descriptor(q).dental["progress"] == {"current": 8, "total": 8, "label": "Несколько слов о вас"}
    answer(q, texts={"about.more": "Полный исходный ответ"})
    assert q.status == "completed" and q.current_step == "done"
    assert q.structured["paper_form"]["birth_date"] == "1985-03-14"
    assert [row["number"] for row in q.structured["paper_form"]["rows"]] == list(range(1, 44))


def test_foreign_health_item_rejected_and_unseen_rows_are_never_negative():
    q = questionnaire()
    start(q)
    before = q.dental_answers.copy()
    with pytest.raises(HTTPException) as exc:
        answer(q, selections={"health": ["allergy"]})
    assert exc.value.status_code == 400 and q.dental_answers == before
    answer(q, selections={"health": ["fever"], "health_unknown": ["dry_mouth"]})
    saved = DentalAnswers.model_validate(q.dental_answers)
    assert health_state(saved, "fever") is True
    assert health_state(saved, "throat") is False
    assert health_state(saved, "dry_mouth") is None
    assert health_state(saved, "hepatitis") is None
    assert build_paper_form(saved)["rows"][0]["note"] == "Не отвечено"
    answer(q, none=True)
    assert q.dental_answers["health"] == ["fever"]
    assert q.dental_answers["health_unknown"] == ["dry_mouth"]


def test_incomplete_coverage_cannot_complete_even_with_forged_current_step():
    q = questionnaire()
    start(q)
    answer(q, none=True)
    q.current_step = "dental_about"
    with pytest.raises(HTTPException) as exc:
        answer(q)
    assert exc.value.status_code == 400 and q.status == "in_progress"


def test_complex_details_max_three_groups_medications_allergy_isolated_and_paper_exact():
    q = questionnaire()
    start(q)
    health(q, positive=ALL)
    descriptors, selections, texts = [], {}, {}
    while q.current_step.startswith("dental_details_"):
        step = dq.build_dental_descriptor(q)
        descriptors.append(step)
        assert 1 <= len(step.groups) <= 3
        page_selections, page_texts = {}, {}
        for group in step.groups:
            if group["required"] or group["key"] == "medications":
                page_selections[group["key"]] = [group["options"][0]["value"]]
            if group["text"]:
                page_texts[group["key"]] = "Исходный текст " + group["key"] + " я" * 250
        selections.update(page_selections)
        texts.update(page_texts)
        answer(q, selections=page_selections, texts=page_texts)
    assert [g["key"] for g in next(s for s in descriptors if s.step_key == "dental_details_medications").groups] == ["medications", "medications.dose"]
    assert [g["key"] for g in next(s for s in descriptors if s.step_key == "dental_details_allergy").groups] == ["allergy.substance", "allergy.reaction"]
    answer(q, texts={"about.visit_year": "2024", "about.visit_clinic": "Моя клиника", "about.more": "Ещё сведения"})
    assert q.status == "completed"
    expected = DentalAnswers(health=ALL, groups={
        "reason": GroupAnswer(selected=["checkup"]), "about.birth_date": GroupAnswer(text="1985-03-14"),
        "about.visit_year": GroupAnswer(text="2024"), "about.visit_clinic": GroupAnswer(text="Моя клиника"),
        "about.more": GroupAnswer(text="Ещё сведения"),
        **{key: GroupAnswer(selected=selections.get(key, []), text=texts.get(key, "")) for key in selections.keys() | texts.keys()},
    })
    assert q.structured["paper_form"] == build_paper_form(expected)


def test_health_edit_keeps_other_pages_dob_valid_details_but_invalidates_completion():
    q = questionnaire()
    start(q)
    health(q, positive=["medications", "allergy"])
    answer(q, selections={"medications": ["eliquis"]}, texts={"medications.dose": "5 мг"})
    answer(q, selections={"allergy.substance": ["antibiotics"]})
    assert q.current_step == "dental_about"
    answer(q, choice="edit:dental_health_6")
    answer(q, selections={"health": ["medications", "pregnancy"], "health_unknown": ["oncology"]})
    assert q.current_step.startswith("dental_details_")
    assert q.dental_answers["groups"]["medications.dose"]["text"] == "5 мг"
    assert "allergy.substance" not in q.dental_answers["groups"]
    assert q.dental_answers["groups"]["about.birth_date"]["text"] == "1985-03-14"
    assert not any(key.startswith("dental_details_") for key in q.dental_answers["completed_steps"])
    with pytest.raises(HTTPException):
        answer(q, choice="edit:dental_about")
    reloaded = Questionnaire(kind="dental", status=q.status, current_step=q.current_step,
        dental_answers=q.dental_answers.copy(), ai_unavailable=True, ai_questions_count=0)
    assert asdict(dq.build_dental_descriptor(reloaded)) == asdict(dq.build_dental_descriptor(q))


def test_legacy_missing_version_keeps_single_health_page():
    q = questionnaire()
    q.dental_answers.pop("flow_version")
    start(q)
    assert q.current_step == "dental_health"
    assert len(dq.build_dental_descriptor(q).choices) == 43


def test_editing_earlier_no_page_preserves_later_positive_unknown_and_incomplete_branches():
    q = questionnaire()
    start(q)
    health(q, positive=["fever", "allergy"], uncertain=["hepatitis"])
    answer(q, selections={"allergy.substance": ["antibiotics"]})
    answer(q, choice="edit:dental_health_1")
    answer(q, none=True)
    assert q.dental_answers["health"] == ["allergy"]
    assert q.dental_answers["health_unknown"] == ["hepatitis"]
    assert q.current_step == "dental_details_allergy"
    assert q.dental_answers["groups"]["allergy.substance"]["selected"] == ["antibiotics"]
    descriptor = dq.build_dental_descriptor(q)
    assert [entry["step_key"] for entry in descriptor.dental["navigation"]] == descriptor.dental["editable_steps"]
    assert "dental_about" not in descriptor.dental["editable_steps"]
    answer(q, selections={"allergy.substance": ["antibiotics"]})
    assert q.current_step == "dental_about"


def test_details_reject_foreign_groups_and_required_allergy_cannot_be_empty():
    q = questionnaire()
    start(q)
    health(q, positive=["medications", "allergy"])
    for selections in ({"allergy.substance": ["antibiotics"]}, {}):
        with pytest.raises(HTTPException) as exc:
            answer(q, selections=selections)
        assert exc.value.status_code == 400
    answer(q, selections={"medications": ["eliquis"]})
    with pytest.raises(HTTPException):
        answer(q)
    assert q.current_step == "dental_details_allergy"


def test_reason_edit_adds_required_pain_before_previously_completed_pages(monkeypatch):
    q = questionnaire()
    start(q)
    health(q)
    answer(q, choice="edit:dental_reason")
    answer(q, selections={"reason": ["pain"]})
    assert q.current_step == "dental_pain"
    answer(q, selections={"pain.where": ["upper_left"], "pain.when": ["cold"], "pain.since": ["today"]})
    assert q.current_step == "dental_about"
    answer(q, texts={"about.more": "а" * 18000})
    assert q.status == "completed"
    assert q.structured["paper_form"]["more"] == "а" * 18000


def test_version_two_ai_completes_directly_and_health_return_clears_ai(monkeypatch):
    async def ask(*args, **kwargs):
        return {"status": "question", "question": "Где болит?", "choices": []}
    monkeypatch.setattr(dq, "proxy_post_to_ml", ask)
    q = questionnaire()
    q.ai_unavailable = False
    answer(q, selections={"reason": ["pain"]})
    answer(q)
    health(q)
    answer(q)
    assert q.current_step == "dental_ai"
    answer(q, choice="edit:dental_health_6")
    assert q.dental_answers["ai"] == [] and q.ai_questions_count == 0
    answer(q, none=True)
    assert q.current_step == "dental_ai"
    answer(q, texts={"ai": "Слева сверху"})
    assert q.current_step == "done" and q.status == "completed"


def test_completed_version_two_descriptor_remains_terminal():
    q = questionnaire()
    q.status = "completed"
    q.current_step = "done"
    assert dq.build_dental_descriptor(q).completed is True
