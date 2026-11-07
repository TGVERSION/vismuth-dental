"""Границы публичного API и старые маршруты без реальной БД и модели."""
import asyncio
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.models.questionnaire import Questionnaire
from app.routers import public_questionnaire as public
from app.routers import questionnaires as doctor
from app.services import questionnaire_flow as flow
from app.services import questionnaire_process as process
from app.services.gastro.summary import build_summary


@pytest.mark.parametrize("specialty,visit,kind,next_step", [
    ("Гастроэнтеролог", "primary", "general", "complaint"),
    ("Гастроэнтеролог", "repeat", "general", "repeat_change"),
    ("Детский гастроэнтеролог", "primary", "general", "complaint"),
    ("Терапевт", "primary", "general", "complaint"),
])
def test_visit_routes_preserve_other_flows(monkeypatch, specialty, visit, kind, next_step):
    monkeypatch.setattr(flow, "specialization_name", AsyncMock(return_value=specialty))
    q = Questionnaire(kind="general", status="in_progress", current_step="visit_type", ai_unavailable=False)
    descriptor, _, process_flag = asyncio.run(flow.apply_answer(AsyncMock(), q, step_key="visit_type", choice=visit))
    assert q.kind == kind and descriptor.step_key == next_step
    assert process_flag is False


def test_public_answer_lock_and_get_without_lock():
    q = Questionnaire(id=uuid4(), session_token_hash=public.hash_session_token("synthetic"))
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = q
    db.execute.return_value = result
    async def run():
        await public._load_questionnaire_for_token(db, q.id, "synthetic", lock=True)
        await public._load_questionnaire_for_token(db, q.id, "synthetic")
    asyncio.run(run())
    assert db.execute.await_args_list[0].args[0]._for_update_arg is not None
    assert db.execute.await_args_list[1].args[0]._for_update_arg is None


def test_gastro_protocol_fallback_preserves_history_and_excludes_patient_questions():
    state = {"sections": {"gastro_history": {"values": {"history_mode": ["narrative"], "history_narrative": "Лечился раньше, даты не помню"}}, "gastro_questions": {"values": {"patient_questions": ["Можно ли кофе?"]}}}}
    structured, _ = build_summary(state)
    mapped = doctor._map_structured_to_fields(structured)
    assert "Лечился раньше, даты не помню" in mapped["life_anamnesis"]
    assert "Можно ли кофе?" not in str(mapped)


def test_rule_summary_fallback_for_doctor_detail(monkeypatch):
    q = Questionnaire(id=uuid4(), kind="gastro", status="completed", current_step="code", ai_unavailable=True, gastro_answers={"sections": {"gastro_history": {"values": {"history_narrative": "Длинная история", "history_mode": ["narrative"]}}}}, structured=None)
    monkeypatch.setattr(doctor, "_answers_for_mapping", AsyncMock(return_value=[]))
    monkeypatch.setattr(doctor, "specialization_name", AsyncMock(return_value="Гастроэнтеролог"))
    detail = asyncio.run(doctor._build_doctor_detail(AsyncMock(), q))
    assert detail.structured["history"]["raw"]["history_narrative"] == "Длинная история"


def test_gastro_processing_never_uses_general_model(monkeypatch):
    q = Questionnaire(id=uuid4(), kind="gastro", status="completed", current_step="code", gastro_answers={"sections": {"gastro_history": {"values": {"history_narrative": "Моя история", "history_mode": ["narrative"]}}}})
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = q
    db.execute.return_value = result
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=db)
    context.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(process, "AsyncSessionLocal", lambda: context)
    model = AsyncMock()
    monkeypatch.setattr(process, "proxy_post_to_ml", model)
    asyncio.run(process.run_questionnaire_processing(q.id))
    model.assert_not_awaited()
    assert q.processing_status == "done" and "Моя история" in q.structured["life_anamnesis"]
