"""Regressions: retained answers, uncertainty, review and edits."""
import asyncio
from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from app.models.questionnaire import Questionnaire
from app.services import dental_questionnaire as dq
from app.services.dental.flow import DentalAnswers, GroupAnswer, AiTurn, apply_dental_answer, DentalAnswerError, dental_step
from app.services.dental.clarify import needs_clarification
from app.services.dental.paper_form import build_paper_form


def apply(answers, step, selections=None, texts=None, none=False):
    return apply_dental_answer(step, answers, selections=selections or {}, texts=texts or {}, none=none)


def test_unknown_health_is_neither_no_nor_yes_and_prints_explanation():
    answers, _ = apply(DentalAnswers(), 'dental_health', {'health': ['asthma'], 'health_unknown': ['allergy']})
    paper = build_paper_form(answers)
    assert answers.health_unknown == ['allergy']
    assert all(sub['answer'] is None for sub in paper['rows'][40]['subs'])
    assert 'Не знаю' in paper['rows'][40]['note']
    assert paper['rows'][36]['answer'] is True
    assert paper['rows'][0]['answer'] is False


def test_edit_health_removes_hidden_details_and_ai_but_keeps_other_answers():
    before = DentalAnswers(health=['allergy', 'asthma'], groups={
        'allergy.substance': GroupAnswer(selected=['antibiotics'], text='Амоксициллин'),
        'asthma': GroupAnswer(text='Сальбутамол'), 'about.birth_date': GroupAnswer(text='1980')},
        ai=[AiTurn(question='Как давно?', answer='Год')])
    after, _ = apply(before, 'dental_health', {'health': ['asthma']})
    assert 'allergy.substance' not in after.groups
    assert after.groups['asthma'].text == 'Сальбутамол'
    assert after.ai == []
    assert after.groups['about.birth_date'].text == '1980'


def test_edit_reason_clears_pain_and_erasing_optional_text_actually_erases_it():
    before = DentalAnswers(groups={'reason': GroupAnswer(selected=['pain']), 'pain.since': GroupAnswer(selected=['today']), 'about.more': GroupAnswer(text='старое')})
    after, _ = apply(before, 'dental_reason', {'reason': ['checkup']})
    assert 'pain.since' not in after.groups
    after, _ = apply(after, 'dental_about')
    assert 'about.more' not in after.groups


def test_selected_medication_name_is_enough_and_unknown_dose_is_printed():
    answers, _ = apply(DentalAnswers(health=['medications']), 'dental_details', {'medications': ['eliquis'], 'medications.dose': ['unknown']})
    row = build_paper_form(answers)['rows'][39]
    assert 'Эликвис' in row['note']
    assert 'Дозу не помню' in row['note']


def test_paper_keeps_named_allergen_free_reason_extra_details_and_patient_ai():
    answers = DentalAnswers(health=['allergy','asthma','diabetes','pregnancy'], groups={
        'reason': GroupAnswer(selected=['other'], text='Шатается зуб'),
        'allergy.substance': GroupAnswer(selected=['antibiotics'], text='Амоксициллин'),
        'asthma': GroupAnswer(text='Сальбутамол'), 'diabetes': GroupAnswer(selected=['type2'], text='Метформин'),
        'pregnancy': GroupAnswer(selected=['pregnant'], text='12 недель')}, ai=[AiTurn(question='Давно?', answer='Год')])
    paper = build_paper_form(answers)
    assert paper['rows'][40]['subs'][1]['note'] == 'Амоксициллин'
    assert all(s in paper['more'] for s in ['Шатается зуб', 'Сальбутамол', 'Метформин', '12 недель', 'Давно?', 'Год'])


def test_adequate_short_text_does_not_trigger_model():
    assert not needs_clarification(DentalAnswers(health=['heart_attack'], groups={'heart_attack': GroupAnswer(text='2019')}))
    assert not needs_clarification(DentalAnswers(groups={'reason': GroupAnswer(selected=['other'], text='Шатается зуб')}))


def test_text_is_not_silently_clipped_and_approximate_input_is_preserved():
    answer, _ = apply(DentalAnswers(), 'dental_about', texts={'about.more': 'а' * 1200, 'about.visit_year': 'примерно 2019'})
    assert len(answer.groups['about.more'].text) == 1200
    assert answer.groups['about.visit_year'].text == 'примерно 2019'
    with pytest.raises(DentalAnswerError):
        apply(DentalAnswers(), 'dental_about', texts={'about.more': 'а' * 20001})
    groups = dental_step('dental_about', DentalAnswers()).groups
    assert groups[0]['text']['input_kind'] == 'year'
    assert groups[2]['text']['optional_reveal'] is True


def test_revision_hydration_edit_and_direct_completion(monkeypatch):
    async def no_model(*args):
        pytest.fail('Adequate answers must not call ML')
    monkeypatch.setattr(dq, '_ask_model', no_model)
    q = Questionnaire(kind='dental', status='in_progress', current_step='dental_reason', dental_answers={}, ai_unavailable=False)
    def submit(step, **kwargs):
        asyncio.run(dq.apply_dental(q, step_key=step, selections=kwargs.pop('selections', {}), texts={}, none_answer=kwargs.pop('none_answer', False), skip=False, now=datetime.now(timezone.utc), **kwargs))
    submit('dental_reason', selections={'reason':['checkup']}, revision=0)
    submit('dental_health', none_answer=True, revision=1)
    assert q.current_step == 'dental_about'
    descriptor = dq.build_dental_descriptor(q)
    assert descriptor.dental['answers']['groups']['reason']['selected'] == ['checkup']
    assert 'dental_health' in descriptor.dental['editable_steps']
    with pytest.raises(HTTPException) as err:
        submit('dental_about', choice='edit:dental_pain', revision=2)
    assert err.value.status_code == 400
    with pytest.raises(HTTPException) as err:
        submit('dental_about', choice='edit:dental_health', revision=1)
    assert err.value.status_code == 409
    submit('dental_about', choice='edit:dental_health', revision=2)
    submit('dental_health', none_answer=True, revision=3)
    assert q.current_step == 'dental_about'
    submit('dental_about', revision=4)
    assert q.status == 'completed' and q.current_step == 'done'
    assert len(q.structured['paper_form']['rows']) == 43


def test_direct_completion_validates_required_details_without_review():
    q = Questionnaire(kind='dental', status='in_progress', current_step='dental_about',
        dental_answers={'revision': 1, 'health': ['allergy'], 'groups': {'reason': {'selected': ['checkup']}}}, ai_unavailable=False)
    with pytest.raises(HTTPException) as error:
        asyncio.run(dq.apply_dental(q, step_key='dental_about', selections={}, texts={}, none_answer=False,
            skip=False, now=datetime.now(timezone.utc), revision=1))
    assert error.value.status_code == 400
    assert q.status == 'in_progress'


def test_edit_from_review_asks_new_required_details_before_returning():
    q = Questionnaire(kind='dental', status='in_progress', current_step='dental_review',
        dental_answers={'revision': 1, 'health': [], 'completed_steps': ['dental_reason','dental_health','dental_about'],
        'groups': {'reason': {'selected': ['checkup']}}}, ai_unavailable=False)
    def submit(**kwargs):
        asyncio.run(dq.apply_dental(q, step_key=q.current_step, selections=kwargs.pop('selections', {}),
            texts={}, none_answer=False, skip=False, now=datetime.now(timezone.utc),
            revision=q.dental_answers['revision'], **kwargs))
    submit(choice='edit:dental_health')
    submit(selections={'health': ['allergy']})
    assert q.current_step == 'dental_details'
    submit(selections={'allergy.substance': ['antibiotics'], 'allergy.reaction': ['urticaria']})
    assert q.current_step == 'dental_review'


def test_review_cannot_finalize_missing_conditional_answer():
    q = Questionnaire(kind='dental', status='in_progress', current_step='dental_review',
        dental_answers={'revision': 1, 'health': ['allergy'], 'groups': {'reason': {'selected': ['checkup']}}})
    with pytest.raises(HTTPException) as error:
        asyncio.run(dq.apply_dental(q, step_key='dental_review', selections={}, texts={}, none_answer=False,
            skip=False, now=datetime.now(timezone.utc), revision=1, choice='confirm'))
    assert error.value.status_code == 400
    assert q.status == 'in_progress'


def test_back_does_not_allow_jumping_forward_to_skip_a_new_required_branch():
    q = Questionnaire(kind='dental', status='in_progress', current_step='dental_health', dental_answers={
        'revision': 4, 'health': [], 'completed_steps': ['dental_reason','dental_health','dental_about'],
        'groups': {'reason': {'selected':['checkup']}}})
    assert dq.build_dental_descriptor(q).dental['editable_steps'] == ['dental_reason']


def test_ai_question_input_advertises_the_accepted_limit():
    from app.services.dental.clarify import ai_step
    step = ai_step(DentalAnswers(ai=[AiTurn(question='Где болит?')]))
    assert step.groups[0]['text']['max_length'] == 20000


def test_request_accepts_all_43_positive_health_rows():
    from app.schemas.questionnaire import QuestionnaireAnswerRequest
    from app.services.dental.questions import HEALTH_ITEMS
    payload = QuestionnaireAnswerRequest(step_key='dental_health', revision=0,
        selections={'health': [item.value for item in HEALTH_ITEMS]})
    assert len(payload.selections['health']) == 43


def test_usual_pressure_is_printed_once_in_its_own_note():
    paper = build_paper_form(DentalAnswers(health=['pressure'], groups={
        'pressure': GroupAnswer(selected=['high'], text='140/90')}))
    row = paper['rows'][32]
    assert row['note'] == '140/90'
    assert all(not sub['note'] for sub in row['subs'])


def test_administrator_birth_date_is_not_asked_and_survives_patient_submission():
    before = DentalAnswers(health=[], groups={
        'about.birth_date': GroupAnswer(text='1985-03-14')})
    step = dental_step('dental_about', before)
    assert 'about.birth_date' not in {g['key'] for g in step.groups}
    after, _ = apply(before, 'dental_about', texts={'about.visit_year': '2024'})
    assert build_paper_form(after)['birth_date'] == '1985-03-14'
    with pytest.raises(DentalAnswerError):
        apply(before, 'dental_about', texts={'about.birth_date': '1990-01-01'})


def test_unknown_dose_has_no_button_and_legacy_answer_still_prints():
    step = dental_step('dental_details', DentalAnswers(health=['medications']))
    dose = next(g for g in step.groups if g['key'] == 'medications.dose')
    assert dose['options'] == []
    assert dose['text']['quick_choices'] == []
    for answer in [GroupAnswer(selected=['unknown']), GroupAnswer(text='Дозу не помню')]:
        paper = build_paper_form(DentalAnswers(health=['medications'], groups={
            'medications': GroupAnswer(selected=['eliquis']), 'medications.dose': answer}))
        assert paper['rows'][39]['note'].count('Дозу не помню') == 1
