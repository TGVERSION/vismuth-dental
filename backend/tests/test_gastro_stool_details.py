"""Новые ветки стула, быстрые ответы и сохранность сведений для врача."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.questionnaire import Questionnaire
from app.services import questionnaire_flow as flow
from app.services.gastro_chat_questions import GASTRO_CHAT_QUESTIONS, append_gastro_chat_answers, gastro_choices


@pytest.fixture
def chat(monkeypatch):
    saved = AsyncMock()
    monkeypatch.setattr(flow, 'add_answer', saved)
    monkeypatch.setattr(flow, 'load_answers', AsyncMock(return_value=[]))
    monkeypatch.setattr(flow, 'classify_answer', AsyncMock(return_value=False))
    monkeypatch.setattr(flow, 'specialization_name', AsyncMock(return_value='Гастроэнтеролог'))
    q = Questionnaire(id=uuid4(), kind='general', status='in_progress', current_step='stool_frequency', visit_type='primary')
    return q, AsyncMock(), saved


def test_separate_answers_reach_doctor_without_losing_longstanding_symptoms(chat):
    q, db, saved = chat
    recorded = []
    for step, choice, expected in [
        ('stool_frequency', 'less_daily', 'stool_form'),
        ('stool_form', 'hard', 'stool_recent_changes'),
        ('stool_recent_changes', 'none', 'weight_changes'),
    ]:
        descriptor, _, _ = asyncio.run(flow.apply_answer(db, q, step_key=step, choice=choice))
        assert descriptor.step_key == expected
        recorded.append(SimpleNamespace(step_key=step, kind='answer', answer_text=saved.await_args.kwargs['answer_text']))
    summary = {}
    append_gastro_chat_answers(summary, recorded)
    assert 'Реже раза в день' in summary['complaints']
    assert 'Твёрдый, комочками' in summary['complaints']
    assert 'Недавних изменений привычного стула не отмечает' in summary['complaints']


@pytest.mark.parametrize('choice, expected', [('yes', 'stool_change_onset'), ('none', 'weight_changes'), ('unknown', 'weight_changes')])
def test_only_changes_require_onset(chat, choice, expected):
    q, db, saved = chat
    q.current_step = 'stool_recent_changes'
    result, _, _ = asyncio.run(flow.apply_answer(db, q, step_key=q.current_step, choice=choice))
    assert result.step_key == expected
    if choice == 'unknown':
        assert saved.await_args.kwargs['answer_text'] == 'Не знаю'


@pytest.mark.parametrize('step', ['stool_frequency', 'stool_form', 'stool_recent_changes', 'stool_change_onset'])
def test_every_offered_button_is_valid_and_saved_as_human_text(chat, step):
    q, db, saved = chat
    question = GASTRO_CHAT_QUESTIONS[step]
    for option in gastro_choices(question):
        q.current_step = step
        asyncio.run(flow.apply_answer(db, q, step_key=step, choice=option['value']))
        text = saved.await_args.kwargs['answer_text']
        assert text == (question['negative_text'] if option['value'] == 'none' else option['label'])


def test_free_text_is_preserved_and_contradictory_or_foreign_choices_rejected(chat):
    q, db, saved = chat
    text = 'Раз в три дня, так уже несколько лет'
    asyncio.run(flow.apply_answer(db, q, step_key='stool_frequency', value=text))
    assert saved.await_args.kwargs['answer_text'] == text
    for payload in [{'choice': 'hard'}, {'none_answer': True}, {'choice': 'daily', 'value': 'Иначе'}]:
        q.current_step = 'stool_frequency'
        with pytest.raises(HTTPException) as error:
            asyncio.run(flow.apply_answer(db, q, step_key=q.current_step, **payload))
        assert error.value.status_code == 400


@pytest.mark.parametrize('specialty, visit, extended', [('Гастроэнтеролог', 'primary', True), ('Терапевт', 'primary', False), ('Детский гастроэнтеролог', 'primary', False), ('Гастроэнтеролог', 'repeat', False)])
def test_medication_amount_and_allergy_reaction_prompts_are_scoped(monkeypatch, specialty, visit, extended):
    monkeypatch.setattr(flow, 'specialization_name', AsyncMock(return_value=specialty))
    q = Questionnaire(visit_type=visit)
    medication = asyncio.run(flow.fixed_question(AsyncMock(), q, 'medications'))
    allergy = asyncio.run(flow.fixed_question(AsyncMock(), q, 'allergy'))
    assert ('таблеток' in medication and 'мг' in medication) == extended
    assert ('как проявилась реакция' in allergy) == extended
