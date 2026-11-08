"""Avoid overlapping collection by ML and fixed chat steps."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from app.models.questionnaire import Questionnaire
from app.services import questionnaire_flow as flow
from app.services.questionnaire_dedup import answered_fixed_topics, question_was_asked
from app.routers import public_questionnaire as public

MED='Какие лекарства принимаете сейчас? Если да — назовите, пожалуйста, названия и дозы.'
ALLERGY='Есть ли аллергия на лекарства или продукты? Если да — на что и какая реакция.'


def row(question,text='',kind='answer',step='ai_clarify'):
    return SimpleNamespace(question_text=question,answer_text=text,kind=kind,step_key=step,choice=None)


@pytest.mark.parametrize('target',['medications','medications_dose','allergy_anamnesis',None,[]])
def test_primary_ai_does_not_take_over_fixed_medication_and_allergy_questions(monkeypatch,target):
    monkeypatch.setattr(flow,'load_answers',AsyncMock(return_value=[]))
    monkeypatch.setattr(flow,'specialization_name',AsyncMock(return_value='Гастроэнтеролог'))
    monkeypatch.setattr(flow,'proxy_post_to_ml',AsyncMock(return_value={'status':'question','next_field':target,'messages':{'text':MED}}))
    save=AsyncMock();monkeypatch.setattr(flow,'add_answer',save)
    q=Questionnaire(id=uuid4(),kind='general',visit_type='primary',ai_unavailable=False,ai_questions_count=0)
    assert asyncio.run(flow.request_ai_question(AsyncMock(),q)) is None
    save.assert_not_awaited();assert q.ai_questions_count==0


def test_useful_complaint_clarification_is_kept_but_repeated_text_is_not(monkeypatch):
    existing=[];question='Когда началась боль?'
    monkeypatch.setattr(flow,'load_answers',AsyncMock(side_effect=lambda *args:existing))
    monkeypatch.setattr(flow,'specialization_name',AsyncMock(return_value='Гастроэнтеролог'))
    model=AsyncMock(return_value={'status':'question','next_field':'complaints_detail','messages':{'text':question}})
    monkeypatch.setattr(flow,'proxy_post_to_ml',model)
    save=AsyncMock();monkeypatch.setattr(flow,'add_answer',save)
    q=Questionnaire(id=uuid4(),kind='general',visit_type='primary',ai_unavailable=False,ai_questions_count=0)
    assert asyncio.run(flow.request_ai_question(AsyncMock(),q))==question
    existing.append(row(question,kind='ai_question'))
    model.return_value={'status':'question','next_field':'complaints_detail','messages':{'text':' КОГДА  началась боль?! '}}
    assert asyncio.run(flow.request_ai_question(AsyncMock(),q)) is None
    assert save.await_count==1 and q.ai_questions_count==1


def test_only_real_patient_answers_are_used_for_legacy_topic_completion():
    answers=[row(MED,kind='ai_question'),row(MED,'Препарат X, 5 мг'),row(ALLERGY,kind='ai_question'),row(ALLERGY,'Нет')]
    assert answered_fixed_topics(answers)=={'medications':'Препарат X, 5 мг','allergy':'Нет'}
    assert answered_fixed_topics([row(MED,kind='skip'),row(ALLERGY,'')])=={}
    assert not question_was_asked('Какая доза?',answers)


def test_resuming_a_legacy_session_skips_an_already_answered_medication_question(monkeypatch):
    q=Questionnaire(id=uuid4(),kind='general',status='in_progress',current_step='medications',visit_type='primary',ai_unavailable=False)
    monkeypatch.setattr(public,'_load_questionnaire_for_token',AsyncMock(return_value=q))
    monkeypatch.setattr(flow,'load_answers',AsyncMock(return_value=[row(MED,'Препарат X, 5 мг')]))
    db=AsyncMock()
    descriptor=asyncio.run(public.get_step(q.id,db=db,x_questionnaire_token='synthetic'))
    assert descriptor.step_key=='chronic'
    db.refresh.assert_awaited_once_with(q,with_for_update=True)
    db.commit.assert_awaited_once()


@pytest.mark.parametrize('specialty,expected',[
    ('Гастроэнтеролог','stool_changes'),
    ('Детский гастроэнтеролог','patient_info'),
    ('Терапевт','patient_info'),
])
def test_answered_allergy_is_skipped_without_losing_specialty_followups(monkeypatch,specialty,expected):
    q=Questionnaire(id=uuid4(),kind='general',visit_type='primary')
    monkeypatch.setattr(flow,'load_answers',AsyncMock(return_value=[row(ALLERGY,'Пенициллин — сыпь')]))
    monkeypatch.setattr(flow,'specialization_name',AsyncMock(return_value=specialty))
    assert asyncio.run(flow.next_unanswered_general_step(AsyncMock(),q,'allergy'))==expected


def test_model_state_alone_does_not_skip_patient_questions(monkeypatch):
    q=Questionnaire(id=uuid4(),kind='general',visit_type='primary',collect_form_state={'allergy_anamnesis':'denied','medications':'filled'})
    monkeypatch.setattr(flow,'load_answers',AsyncMock(return_value=[]))
    for step in ['medications','allergy']:
        assert asyncio.run(flow.next_unanswered_general_step(AsyncMock(),q,step))==step


def test_resuming_does_not_rewind_a_concurrently_advanced_session(monkeypatch):
    q=Questionnaire(id=uuid4(),kind='general',status='in_progress',current_step='medications',visit_type='primary',ai_unavailable=False)
    monkeypatch.setattr(public,'_load_questionnaire_for_token',AsyncMock(return_value=q))
    monkeypatch.setattr(flow,'load_answers',AsyncMock(return_value=[row(MED,'Препарат X, 5 мг')]))
    async def refresh(*args,**kwargs):
        q.current_step='patient_info'
    db=AsyncMock()
    db.refresh.side_effect=refresh
    descriptor=asyncio.run(public.get_step(q.id,db=db,x_questionnaire_token='synthetic'))
    assert descriptor.step_key=='patient_info'
    db.commit.assert_not_awaited()
