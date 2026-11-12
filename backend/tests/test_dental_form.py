"""Grouped form navigation, dependent fields and old-session continuation."""
import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.questionnaire import Questionnaire
from app.services import dental_questionnaire as dq
from app.services.dental.flow import DentalAnswers, AiTurn, dental_route, dental_step
from app.services.dental.questions import HEALTH_ITEMS, is_uncertain_choice
from app.services.dental.clarify import ai_step


def questionnaire():
    return Questionnaire(kind='dental', status='in_progress', current_step='dental_reason',
        dental_answers={'flow_version': 2}, ai_unavailable=False, ai_questions_count=0)


def submit(q, selections=None, texts=None, none=False, choice='form', revision=None):
    asyncio.run(dq.apply_dental(q, step_key=q.current_step, selections=selections or {},
        texts=texts or {}, none_answer=none, skip=False, choice=choice,
        revision=q.dental_answers.get('revision', 0) if revision is None else revision,
        now=datetime.now(timezone.utc)))


def health(q, allergy=False):
    for number in range(1, 7):
        assert q.current_step == f'dental_health_{number}'
        submit(q, selections={'health': ['allergy']} if allergy and number == 6 else {},
            none=not (allergy and number == 6))


def test_form_back_and_next_visit_adjacent_sections_without_losing_answers():
    q = questionnaire()
    submit(q, {'reason': ['pain']})
    submit(q, {'health': ['dry_mouth']})
    assert q.current_step == 'dental_health_2'
    submit(q, choice='form:back')
    assert q.current_step == 'dental_health_1'
    assert q.dental_answers['health'] == ['dry_mouth']
    submit(q, choice='form:back')
    assert q.current_step == 'dental_reason'
    submit(q, {'reason': ['pain']})
    assert q.current_step == 'dental_health_1'
    submit(q, {'health': ['dry_mouth']})
    assert q.current_step == 'dental_health_2'


def test_changed_health_adds_and_removes_required_details_and_form_finishes():
    q = questionnaire()
    submit(q, {'reason': ['checkup']})
    health(q)
    assert q.current_step == 'dental_about'
    submit(q, choice='form:back')
    assert q.current_step == 'dental_health_6'
    submit(q, {'health': ['allergy']})
    assert q.current_step == 'dental_details_allergy'
    submit(q, selections={'allergy.substance': ['antibiotics']})
    assert q.current_step == 'dental_details_allergy_reaction'
    submit(q, selections={'allergy.reaction': ['urticaria']})
    assert q.current_step == 'dental_about'
    submit(q, choice='form:back')
    assert q.current_step == 'dental_details_allergy_reaction'
    assert q.dental_answers['groups']['allergy.reaction']['selected'] == ['urticaria']
    submit(q, choice='form:back')
    assert q.current_step == 'dental_details_allergy'
    submit(q, choice='form:back')
    assert q.current_step == 'dental_health_6'
    submit(q, none=True)
    assert q.current_step == 'dental_about'
    assert 'allergy.substance' not in q.dental_answers['groups']
    submit(q, texts={'about.visit_year': 'Не помню', 'about.more': 'Дополнение'})
    assert q.status == 'completed'
    assert len(q.structured['paper_form']['rows']) == 43


def test_previous_combined_allergy_answer_resumes_without_losing_either_group():
    q = questionnaire()
    submit(q, {'reason': ['checkup']})
    health(q, allergy=True)
    q.current_step = 'dental_about'
    q.dental_answers = {**q.dental_answers,
        'completed_steps': [*q.dental_answers['completed_steps'], 'dental_details_allergy'],
        'groups': {**q.dental_answers['groups'],
            'allergy.substance': {'selected': ['antibiotics'], 'text': 'Амоксициллин'},
            'allergy.reaction': {'selected': ['urticaria'], 'text': ''},
            'about.more': {'selected': [], 'text': 'Ранее сохранённое дополнение'}}}
    assert dq.build_dental_descriptor(q).step_key == 'dental_about'
    submit(q, texts={'about.visit_year': '2025'})
    assert q.status == 'completed'
    assert 'Ранее сохранённое дополнение' in q.structured['paper_form']['more']


def test_other_reaction_needs_its_text_and_stays_on_its_own_page():
    q = questionnaire()
    submit(q, {'reason': ['checkup']})
    health(q, allergy=True)
    assert [g['key'] for g in dq.build_dental_descriptor(q).groups] == ['allergy.substance']
    submit(q, {'allergy.substance': ['antibiotics']})
    descriptor = dq.build_dental_descriptor(q)
    assert [g['key'] for g in descriptor.groups] == ['allergy.reaction']
    assert descriptor.groups[0]['required'] is True
    assert descriptor.allow_skip is False
    for texts in ({}, {'allergy.reaction': 'Сыпь'}):
        with pytest.raises(HTTPException) as error:
            submit(q, texts=texts)
        assert error.value.status_code == 400
        assert q.current_step == 'dental_details_allergy_reaction'
    with pytest.raises(HTTPException):
        submit(q, {'allergy.reaction': ['other']})
    submit(q, {'allergy.reaction': ['other']}, {'allergy.reaction': 'Необычная реакция'})
    assert q.current_step == 'dental_about'
    submit(q)
    assert 'Необычная реакция' in q.structured['paper_form']['more']


def test_in_progress_form_returns_to_previously_skipped_allergy_reaction():
    q = questionnaire()
    submit(q, {'reason': ['checkup']})
    health(q, allergy=True)
    submit(q, {'allergy.substance': ['antibiotics']})
    q.current_step = 'dental_about'
    q.dental_answers = {
        **q.dental_answers,
        'completed_steps': [*q.dental_answers['completed_steps'], 'dental_details_allergy_reaction'],
    }
    assert dq.build_dental_descriptor(q).step_key == 'dental_details_allergy_reaction'
    submit(q, {'allergy.reaction': ['urticaria']})
    assert q.current_step == 'dental_about'


def test_form_comment_does_not_turn_unspecified_conditions_into_negative_answers():
    q = questionnaire()
    submit(q, texts={'reason': 'Осмотр перед лечением'})
    submit(q, texts={'health': 'Была сухость во рту, причину не знаю'})
    assert len(q.dental_answers['health_unknown']) == 8
    assert q.dental_answers['health_comments']['dental_health_1'].startswith('Была сухость')
    submit(q, choice='form:back')
    submit(q, none=True)
    assert q.dental_answers['health_unknown'] == []
    assert 'dental_health_1' not in q.dental_answers['health_comments']


def test_form_does_not_accept_stale_revision_or_payload_on_back():
    q = questionnaire()
    submit(q, {'reason': ['checkup']})
    with pytest.raises(HTTPException) as error:
        submit(q, none=True, revision=0)
    assert error.value.status_code == 409
    with pytest.raises(HTTPException) as error:
        submit(q, texts={'health': 'текст'}, choice='form:back')
    assert error.value.status_code == 400
    assert q.current_step == 'dental_health_1'


def test_all_form_choices_hide_uncertainty_but_keep_original_ai_indices():
    answers = DentalAnswers(flow_version=2, health=[item.value for item in HEALTH_ITEMS])
    for key in dental_route(answers):
        for group in dental_step(key, answers).groups:
            assert all(not is_uncertain_choice(option['label']) for option in group['options'])
            assert all(not is_uncertain_choice(label) for label in (group.get('text') or {}).get('quick_choices', []))
    step = ai_step(DentalAnswers(ai=[AiTurn(question='Уточнение', choices=['Не знаю', 'Да', 'Не помню'])]))
    assert step.groups[0]['options'] == [{'value': '1', 'label': 'Да'}]
