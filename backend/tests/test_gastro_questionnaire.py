import asyncio
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.questionnaire import Questionnaire
from app.services import gastro_questionnaire as gq
from app.services.questionnaire_flow import apply_answer
from app.schemas.questionnaire import QuestionnaireAnswerRequest, DoctorQuestionnaireDetail


def questionnaire(step="gastro_identity", state=None):
    return Questionnaire(kind="gastro", current_step=step, status="in_progress", gastro_answers=state or {"revision": 0}, ai_unavailable=False)


def test_schema_accepts_long_history_but_not_over_limit():
    assert QuestionnaireAnswerRequest(step_key="gastro_history", texts={"history_narrative": "x" * 20000}, revision=1).revision == 1
    with pytest.raises(ValueError):
        QuestionnaireAnswerRequest(step_key="gastro_history", texts={"history_narrative": "x" * 20001})


def test_identity_maps_name_and_date_without_completing():
    q = questionnaire()
    asyncio.run(gq.apply_gastro(AsyncMock(), q, step_key=q.current_step, revision=0, selections={}, texts={"first_name": "Анна", "appointment_date": date.today().isoformat()}))
    assert q.appointment_time is None
    assert q.patient_first_name == "Анна"
    assert q.current_step == "gastro_review"
    assert q.status == "in_progress"


def test_final_retry_returns_same_code_without_allocation(monkeypatch):
    db = AsyncMock()
    allocate = AsyncMock(return_value="1234")
    monkeypatch.setattr(gq, "allocate_code", allocate)
    q = questionnaire("gastro_questions", {"revision": 5, "sections": {"gastro_identity": {"values": {"first_name": "Анна", "appointment_date": date.today().isoformat()}}}})
    async def run():
        first = await apply_answer(db, q, step_key="gastro_questions", revision=5, texts={"patient_questions": '["Что дальше?"]'})
        second = await apply_answer(db, q, step_key="gastro_questions", revision=5, texts={"patient_questions": '["Что дальше?"]'})
        return first, second
    first, second = asyncio.run(run())
    assert first[0].code == second[0].code == "1234"
    assert allocate.await_count == 1
    assert q.structured["patient_questions"] == ["Что дальше?"]
    assert q.processing_status == "done"


def test_final_retry_with_different_questions_is_stale(monkeypatch):
    monkeypatch.setattr(gq, "allocate_code", AsyncMock(return_value="1234"))
    q = questionnaire("gastro_questions", {"revision": 5, "sections": {"gastro_identity": {"values": {"first_name": "Анна", "appointment_date": date.today().isoformat()}}}})
    async def run():
        await apply_answer(AsyncMock(), q, step_key="gastro_questions", revision=5, texts={"patient_questions": '["Первый вопрос?"]'})
        await apply_answer(AsyncMock(), q, step_key="gastro_questions", revision=5, texts={"patient_questions": '["Другой вопрос?"]'})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(run())
    assert exc.value.status_code == 409


def test_new_ai_question_does_not_reuse_previous_choices():
    q = questionnaire("gastro_ai_wait", {"revision": 7, "sections": {"gastro_ai_question": {"values": {"ai_choice": ["1"]}}}, "ai": [{"question": "Когда началось?", "choices": ["Недавно", "Давно"], "answer": "Давно"}]})
    assert gq.publish_ai(q, 7, {"status": "question", "question": "Что изменилось?", "choices": ["Чаще", "Реже"]})
    assert gq.build_gastro_descriptor(q).gastro["values"] == {}


def test_new_ai_question_does_not_restore_previous_question_draft():
    q = questionnaire("gastro_ai_wait", {"revision": 7, "drafts": {"gastro_ai_question": {"ai_choice": ["1"], "ai_text": "Черновик ответа на прежний вопрос"}}, "ai": [{"question": "Когда началось?", "choices": ["Недавно", "Давно"], "answer": "Давно"}]})
    assert gq.publish_ai(q, 7, {"status": "question", "question": "Что изменилось?", "choices": ["Чаще", "Реже"]})
    assert gq.build_gastro_descriptor(q).gastro["values"] == {}
    assert "gastro_ai_question" not in q.gastro_answers.get("drafts", {})


def test_stale_answer_http_conflict():
    q = questionnaire("gastro_reason", {"revision": 4})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(gq.apply_gastro(AsyncMock(), q, step_key=q.current_step, revision=3, selections={"complaints": ["none"]}, texts={}))
    assert exc.value.status_code == 409


def test_late_ai_response_cannot_replace_terminal_skip():
    q = questionnaire("gastro_identity", {"revision": 7, "ai_terminal": True})
    assert not gq.publish_ai(q, 6, {"status": "question", "question": "Когда началось?", "choices": []})
    assert q.current_step == "gastro_identity"


def test_ai_failure_moves_on_and_no_secret_in_payload():
    q = questionnaire("gastro_ai_wait", {"revision": 7, "sections": {"gastro_reason": {"values": {"complaints": ["other"]}}}})
    assert gq.publish_ai(q, 7, None)
    assert q.current_step == "gastro_identity"
    assert q.ai_unavailable is True
    assert set(gq.clarify_payload(q.gastro_answers)) == {"answers", "history"}


def test_guided_history_date_not_invented_and_detail_accepts_gastro():
    q = questionnaire("gastro_history")
    asyncio.run(gq.apply_gastro(AsyncMock(), q, step_key=q.current_step, revision=0, selections={"history_mode": ["guided"]}, texts={"history_treatments": "Раньше пробовал препарат, дату не помню"}))
    assert q.gastro_answers["sections"]["gastro_history"]["values"]["history_treatments"] == "Раньше пробовал препарат, дату не помню"
    assert "gastro" in DoctorQuestionnaireDetail.model_fields["kind"].annotation.__args__
