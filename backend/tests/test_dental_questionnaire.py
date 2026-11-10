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


def _answer(q, step_key, *, selections=None, texts=None, none=False, skip=False, choice=None):
    asyncio.run(
        dq.apply_dental(
            q,
            step_key=step_key,
            selections=selections or {},
            texts=texts or {},
            none_answer=none,
            skip=skip,
            now=NOW,
            revision=(q.dental_answers or {}).get("revision", 0),
            choice=choice,
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
INCOMPLETE_PAIN = {"health": [], "groups": {"reason": {"selected": ["pain"]}, "pain.where": {"selected": ["upper_left"]}}}


def test_last_answer_completes_without_review_or_model(ml):
    calls, _ = ml
    q = _questionnaire("dental_about", {"health": [], "groups": {"reason": {"selected": ["checkup"]}}})

    _answer(q, "dental_about")

    assert q.current_step == "done"
    assert q.status == "completed"
    assert calls == []


def test_pain_completes_without_requesting_model_questions(ml):
    calls, _ = ml
    q = _questionnaire('dental_about', INCOMPLETE_PAIN)
    _answer(q, 'dental_about')
    assert q.status == 'completed'
    assert calls == []
    assert q.gaps == []


def test_model_failure_completes_without_clarifications(ml):
    _, replies = ml
    replies.append(RuntimeError("model down"))
    q = _questionnaire("dental_about", INCOMPLETE_PAIN)

    _answer(q, "dental_about")

    assert q.current_step == "done"
    assert q.status == "completed"
    assert q.ai_unavailable is False
    assert q.structured["clarifications"] == []


def test_answer_then_model_done_completes_with_clarification(ml):
    _, replies = ml
    replies += [
        {"status": "question", "question": "Давно шатается?", "choices": ["Неделю", "Месяц"]},
        {"status": "done"},
    ]
    q = _questionnaire("dental_about", INCOMPLETE_PAIN)

    q.current_step = 'dental_ai'
    q.dental_answers = {**INCOMPLETE_PAIN, 'ai': [
        {'question': replies[0]['question'], 'choices': replies[0]['choices']}]}
    _answer(q, "dental_ai", selections={"ai": ["1"]})

    assert q.current_step == "done"
    assert q.status == "completed"
    assert q.structured["clarifications"] == [{"question": "Давно шатается?", "answer": "Месяц"}]


def test_no_more_than_the_limit_of_questions(ml, monkeypatch):
    calls, replies = ml
    monkeypatch.setattr(dq.settings, "questionnaire_dental_ai_max", 1)
    replies.append({"status": "question", "question": "Давно шатается?", "choices": []})
    q = _questionnaire("dental_about", INCOMPLETE_PAIN)

    q.current_step = 'dental_ai'
    q.dental_answers = {**INCOMPLETE_PAIN, 'ai': [
        {'question': replies[0]['question'], 'choices': []}]}
    _answer(q, "dental_ai", skip=True)

    assert q.current_step == "done"
    assert q.status == "completed"
    assert calls == []
