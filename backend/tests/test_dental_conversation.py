import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import dental_questionnaire as dq
from app.services.dental.flow import DentalAnswers, GroupAnswer
from app.services.dental.paper_form import build_paper_form
from app.services.dental.summary import build_dental_summary


def questionnaire():
    return SimpleNamespace(id='synthetic', status='in_progress', current_step='dental_reason',
        dental_answers={'flow_version': 2}, ai_unavailable=True, ai_questions_count=0,
        structured=None, gaps=[], processing_status='pending', completed_at=None)


def answer(q, key, selected=(), text='', none=False):
    asyncio.run(dq.apply_dental(q, step_key=q.current_step, choice='question:' + key,
        selections={key: list(selected)} if selected else {}, texts={key: text} if text else {},
        none_answer=none, skip=False, revision=q.dental_answers.get('revision', 0), now=datetime.now(timezone.utc)))


def test_pain_has_one_question_and_partial_answers_survive_reload():
    q = questionnaire()
    answer(q, 'reason', ['pain'])
    step = dq.build_dental_descriptor(q)
    assert step.dental['question']['key'] == 'pain.where'
    assert step.dental['question_key'] == 'pain.where'
    answer(q, 'pain.where', text='Под старой коронкой слева')
    assert q.current_step == 'dental_pain'
    step = dq.build_dental_descriptor(q)
    assert step.dental['question']['key'] == 'pain.when'
    assert step.dental['history'][-1]['answer'] == 'Под старой коронкой слева'
    before = q.dental_answers.copy()
    with pytest.raises(HTTPException):
        answer(q, 'pain.where', text='повтор')
    assert q.dental_answers == before
    answer(q, 'pain.when', text='Когда жую яблоки')
    assert dq.build_dental_descriptor(q).dental['question']['key'] == 'pain.since'
    answer(q, 'pain.since', text='Третий день')
    assert q.current_step == 'dental_health_1'
    summary, _ = build_dental_summary(DentalAnswers.model_validate(q.dental_answers))
    assert 'Под старой коронкой слева' in summary['complaints']
    assert 'Когда жую яблоки' in summary['complaints']
    paper = build_paper_form(DentalAnswers.model_validate(q.dental_answers))
    assert 'Третий день' in paper['more']


def test_free_reason_can_replace_required_choice_and_is_preserved():
    q = questionnaire()
    answer(q, 'reason', text='Сломалась временная коронка')
    assert q.current_step == 'dental_health_1'
    assert q.dental_answers['groups']['reason']['text'] == 'Сломалась временная коронка'
    assert 'Сломалась временная коронка' in build_paper_form(DentalAnswers.model_validate(q.dental_answers))['more']
    typed = questionnaire()
    answer(typed, 'reason', text='Болит зуб')
    assert typed.current_step == 'dental_pain'


def test_health_free_answer_is_not_silently_converted_to_no():
    q = questionnaire()
    answer(q, 'reason', ['checkup'])
    answer(q, 'health', text='Иногда пересыхает во рту, причину не знаю')
    saved = DentalAnswers.model_validate(q.dental_answers)
    paper = build_paper_form(saved)
    assert q.current_step == 'dental_health_2'
    assert len(saved.health_answered) == 8
    owned = {c['value'] for c in dq.dental_step('dental_health_1', saved).items}
    assert set(saved.health_unknown) == owned
    assert 'Иногда пересыхает во рту, причину не знаю' in paper['more']
    assert not any(row['answer'] is False for row in paper['rows'])
    assert len(paper['rows']) == 43
    assert dq.build_dental_descriptor(q).dental['history'][-1]['answer'].endswith('Иногда пересыхает во рту, причину не знаю')


def test_about_questions_are_separate_and_optional_empty_answer_advances():
    q = questionnaire()
    answer(q, 'reason', ['checkup'])
    for _ in range(6):
        answer(q, 'health', none=True)
    assert dq.build_dental_descriptor(q).dental['question']['key'] == 'about.visit_year'
    answer(q, 'about.visit_year', text='Не помню')
    assert dq.build_dental_descriptor(q).dental['question']['key'] == 'about.visit_clinic'
    answer(q, 'about.visit_clinic', text='Рядом с домом')
    assert dq.build_dental_descriptor(q).dental['question']['key'] == 'about.more'
    answer(q, 'about.more')
    assert q.status == 'completed'
    assert len(q.structured['paper_form']['rows']) == 43


def test_free_details_are_printed_once_even_without_a_category():
    saved = DentalAnswers(health=['medications', 'allergy'], groups={
        'medications': GroupAnswer(selected=['eliquis']),
        'medications.dose': GroupAnswer(text='Дозу не помню'),
        'allergy.substance': GroupAnswer(text='На препарат с неизвестным названием'),
    }, free_text_groups=['medications.dose', 'allergy.substance'])
    paper = build_paper_form(saved)
    import json
    serialized = json.dumps(paper, ensure_ascii=False)
    assert serialized.count('Дозу не помню') == 1
    assert 'На препарат с неизвестным названием' in serialized
