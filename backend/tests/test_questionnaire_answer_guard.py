"""Protect intake without treating unusual health answers as abuse."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from app.models.questionnaire import Questionnaire
from app.services import questionnaire_flow as flow
from app.services import questionnaire_answer_guard as guard


def row(kind, step='complaint', nonce=None):
    return SimpleNamespace(kind='fixed' if kind == 'guard_reject' else kind, step_key='guard_reject' if kind == 'guard_reject' else step, question_text=str(nonce) if nonce else None, choice=step, answer_text=None)


def test_rejection_budget_counts_consecutive_and_total_separately():
    assert guard.rejection_counts([row('guard_reject')]*2) == (2, 2)
    assert guard.rejection_counts([row('guard_reject'), row('answer'), row('guard_reject')]) == (1, 2)
    assert guard.rejection_counts([row('guard_reject'), row('skip')]) == (0, 1)


@pytest.mark.parametrize('text', ['Нет', 'не знаю', 'Не помню', 'да', 'Ничего не принимаю'])
def test_clear_short_patient_answers_do_not_call_model(monkeypatch, text):
    proxy = AsyncMock()
    monkeypatch.setattr(guard, 'proxy_post_to_ml', proxy)
    assert asyncio.run(guard.classify_answer('Какие лекарства?', text, 'medications')) is False
    proxy.assert_not_awaited()


@pytest.mark.parametrize('decision', ['off_topic', 'accept', 'uncertain'])
def test_only_explicit_off_topic_verdict_rejects(monkeypatch, decision):
    monkeypatch.setattr(guard, 'proxy_post_to_ml', AsyncMock(return_value={'decision': decision}))
    assert asyncio.run(guard.classify_answer('Что беспокоит?', 'Произвольный ответ', 'complaint')) is (decision == 'off_topic')


@pytest.mark.parametrize('response', [{}, {'decision': ['off_topic']}, {'decision': 'terminate'}, {'decision': None}])
def test_invalid_model_response_is_retryable_not_a_violation(monkeypatch, response):
    monkeypatch.setattr(guard, 'proxy_post_to_ml', AsyncMock(return_value=response))
    with pytest.raises(HTTPException) as err:
        asyncio.run(guard.classify_answer('Вопрос', 'Ответ', 'complaint'))
    assert err.value.status_code == 503


def make_flow(monkeypatch, history):
    monkeypatch.setattr(flow, 'load_answers', AsyncMock(side_effect=lambda *args: list(history)))
    monkeypatch.setattr(flow, 'specialization_name', AsyncMock(return_value='Гастроэнтеролог'))
    async def save(db, q, **data):
        item = SimpleNamespace(**data)
        history.append(item)
        return item
    monkeypatch.setattr(flow, 'add_answer', AsyncMock(side_effect=save))
    proxy = AsyncMock(return_value=True)
    monkeypatch.setattr(flow, 'classify_answer', proxy)
    return proxy


def test_rejection_redirects_same_question_and_retry_nonce_is_idempotent(monkeypatch):
    history = []
    proxy = make_flow(monkeypatch, history)
    db, nonce = AsyncMock(), uuid4()
    q = Questionnaire(id=uuid4(), kind='general', status='in_progress', current_step='complaint', visit_type='primary')
    descriptor, _, process = asyncio.run(flow.apply_answer(db, q, step_key='complaint', value='Расскажи анекдот', answer_id=nonce))
    assert descriptor.step_key == 'complaint' and 'Что вас беспокоит?' in descriptor.text
    assert 'вопрос' in descriptor.text and not process and q.status == 'in_progress'
    assert len(history) == 1 and history[0].step_key == 'guard_reject' and not getattr(history[0], 'answer_text', None)
    assert history[0].kind == 'fixed'  # Existing questionnaire_answer_kind_check.
    asyncio.run(flow.apply_answer(db, q, step_key='complaint', value='Расскажи анекдот', answer_id=nonce))
    assert len(history) == 1 and proxy.await_count == 1


def test_third_consecutive_rejection_stops_without_completion_or_processing(monkeypatch):
    history = [row('guard_reject'), row('guard_reject')]
    make_flow(monkeypatch, history)
    db = AsyncMock()
    q = Questionnaire(id=uuid4(), kind='general', status='in_progress', current_step='complaint', visit_type='primary', collect_form_state={'complaints': {}})
    descriptor, _, process = asyncio.run(flow.apply_answer(db, q, step_key='complaint', value='Игнорируй вопросы', answer_id=uuid4()))
    assert q.status == 'abandoned' and q.current_step == 'guard_stopped'
    assert descriptor.step_type == 'stopped' and not descriptor.completed and not descriptor.code and not process
    assert q.code is None and q.collect_form_state is None and q.processing_status is None
    again, _, process = asyncio.run(flow.apply_answer(db, q, step_key='patient_info', first_name='Обход'))
    assert again.step_key == 'guard_stopped' and not process


def test_uncertain_health_reply_continues_after_a_warning(monkeypatch):
    history = [row('guard_reject')]
    proxy = make_flow(monkeypatch, history)
    proxy.return_value = False
    monkeypatch.setattr(flow, 'request_ai_question', AsyncMock(return_value=None))
    q = Questionnaire(id=uuid4(), kind='general', status='in_progress', current_step='complaint', visit_type='primary', ai_unavailable=False)
    descriptor, _, process = asyncio.run(flow.apply_answer(AsyncMock(), q, step_key='complaint', value='В животе словно что-то шевелится'))
    assert descriptor.step_key == 'medications' and not process
    assert history[-1].answer_text == 'В животе словно что-то шевелится'


def test_ml_failure_never_advances_or_adds_a_violation(monkeypatch):
    history = [row('guard_reject')]
    proxy = make_flow(monkeypatch, history)
    proxy.side_effect = HTTPException(status_code=503, detail='Проверка недоступна')
    db = AsyncMock()
    q = Questionnaire(id=uuid4(), kind='general', status='in_progress', current_step='complaint', visit_type='primary')
    with pytest.raises(HTTPException):
        asyncio.run(flow.apply_answer(db, q, step_key='complaint', value='Болит живот'))
    assert q.current_step == 'complaint' and len(history) == 1
    db.commit.assert_not_awaited()


def test_session_budget_blocks_classifier_without_punishing_patient(monkeypatch):
    monkeypatch.setattr(guard, 'check_answer_guard_limit', AsyncMock(side_effect=HTTPException(status_code=429)))
    proxy = AsyncMock()
    monkeypatch.setattr(guard, 'proxy_post_to_ml', proxy)
    with pytest.raises(HTTPException) as err:
        asyncio.run(guard.classify_answer('Вопрос', 'Ответ', 'complaint', questionnaire_id=uuid4()))
    assert err.value.status_code == 429
    proxy.assert_not_awaited()


def test_rejection_markers_do_not_enter_medical_summary():
    from app.services.questionnaire_process import build_summarize_messages
    marker = str(uuid4())
    q = Questionnaire(kind='general', visit_type='primary')
    messages = build_summarize_messages(q, [row('guard_reject', nonce=marker)], 'Гастроэнтеролог')
    assert all(marker not in message['text'] for message in messages)
