"""Связка стоматологической анкеты с ml-service: когда спрашивать и что при сбое."""

import asyncio
from datetime import datetime, timezone

import pytest

from app.models.questionnaire import Questionnaire
from app.services import dental_questionnaire as dq

NOW = datetime(2026, 10, 28, tzinfo=timezone.utc)


def _questionnaire(step: str, answers: dict) -> Questionnaire:
    return Questionnaire(
        kind="dental",
        status="in_progress",
        current_step=step,
        dental_answers=answers,
        ai_unavailable=False,
        ai_questions_count=0,
    )


def _answer(q, step_key, *, selections=None, texts=None, none=False, skip=False):
    asyncio.run(
        dq.apply_dental(
            q,
            step_key=step_key,
            selections=selections or {},
            texts=texts or {},
            none_answer=none,
            skip=skip,
            now=NOW,
        ),
    )


@pytest.fixture
def ml(monkeypatch):
    calls = []
    replies = []

    async def fake(path, body, timeout):
        calls.append((path, body))
        reply = replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(dq, "proxy_post_to_ml", fake)
    return calls, replies


OTHER_REASON = {"groups": {"reason": {"selected": ["other"], "text": "Шатается зуб"}}}


def test_nothing_to_clarify_completes_without_model(ml):
    calls, _ = ml
    q = _questionnaire("dental_mouth", {"groups": {"reason": {"selected": ["checkup"]}}})

    _answer(q, "dental_mouth")

    assert q.status == "completed"
    assert calls == []


def test_model_question_opens_clarify_step(ml):
    calls, replies = ml
    replies.append({"status": "question", "question": "Давно шатается?", "choices": ["Неделю", "Месяц"]})
    q = _questionnaire("dental_mouth", OTHER_REASON)

    _answer(q, "dental_mouth")

    assert q.status == "in_progress"
    assert q.current_step == "dental_ai"
    assert calls[0][0] == "/dental_clarify"
    assert "Шатается зуб" in calls[0][1]["answers"]
    assert dq.build_dental_descriptor(q).groups[0]["question"] == "Давно шатается?"


def test_model_failure_completes_without_clarifications(ml):
    _, replies = ml
    replies.append(RuntimeError("model down"))
    q = _questionnaire("dental_mouth", OTHER_REASON)

    _answer(q, "dental_mouth")

    assert q.status == "completed"
    assert q.ai_unavailable is True
    assert q.structured["clarifications"] == []


def test_answer_then_model_done_completes_with_clarification(ml):
    _, replies = ml
    replies += [
        {"status": "question", "question": "Давно шатается?", "choices": ["Неделю", "Месяц"]},
        {"status": "done"},
    ]
    q = _questionnaire("dental_mouth", OTHER_REASON)

    _answer(q, "dental_mouth")
    _answer(q, "dental_ai", selections={"ai": ["1"]})

    assert q.status == "completed"
    assert q.structured["clarifications"] == [{"question": "Давно шатается?", "answer": "Месяц"}]


def test_no_more_than_the_limit_of_questions(ml, monkeypatch):
    calls, replies = ml
    monkeypatch.setattr(dq.settings, "questionnaire_dental_ai_max", 1)
    replies.append({"status": "question", "question": "Давно шатается?", "choices": []})
    q = _questionnaire("dental_mouth", OTHER_REASON)

    _answer(q, "dental_mouth")
    _answer(q, "dental_ai", skip=True)

    assert q.status == "completed"
    assert len(calls) == 1
