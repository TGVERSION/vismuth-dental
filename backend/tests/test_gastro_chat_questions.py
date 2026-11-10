"""Three short gastro follow-ups in the existing general chat."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from app.models.questionnaire import Questionnaire
from app.services import questionnaire_flow as flow
from app.services import questionnaire_process as process
from app.services.gastro_chat_questions import GASTRO_CHAT_QUESTIONS, append_gastro_chat_answers


@pytest.mark.parametrize('specialty,visit,expected', [('Гастроэнтеролог','primary','stool_frequency'),('Терапевт','primary','patient_info'),('Детский гастроэнтеролог','primary','patient_info'),('Гастроэнтеролог','repeat','patient_info')])
def test_only_adult_primary_gastro_gets_extra_questions(monkeypatch,specialty,visit,expected):
    monkeypatch.setattr(flow,'specialization_name',AsyncMock(return_value=specialty))
    monkeypatch.setattr(flow,'add_answer',AsyncMock())
    q=Questionnaire(kind='general',status='in_progress',current_step='allergy',visit_type=visit,ai_unavailable=False)
    result,_,_=asyncio.run(flow.apply_answer(AsyncMock(),q,step_key='allergy',none_answer=True))
    assert result.step_key==expected


def test_three_answers_are_saved_in_order_and_return_to_patient_details(monkeypatch):
    monkeypatch.setattr(flow,'load_answers',AsyncMock(return_value=[]))
    saved=AsyncMock();monkeypatch.setattr(flow,'add_answer',saved)
    q=Questionnaire(id=uuid4(),kind='general',status='in_progress',current_step='stool_changes',visit_type='primary',ai_unavailable=False)
    db=AsyncMock()
    for key,next_key,text in [('stool_changes','weight_changes','Стул стал жидким неделю назад'),('weight_changes','family_history','Потерял 4 кг за два месяца'),('family_history','patient_info','У отца был рак кишечника')]:
        descriptor,_,_=asyncio.run(flow.apply_answer(db,q,step_key=key,value=text))
        assert descriptor.step_key==next_key
        assert saved.await_args.kwargs['answer_text']==text
        assert saved.await_args.kwargs['question_text']==GASTRO_CHAT_QUESTIONS[key]['text']


@pytest.mark.parametrize('choice', ['none','unknown'])
def test_negative_and_unknown_are_distinct_answers(monkeypatch,choice):
    saved=AsyncMock();monkeypatch.setattr(flow,'add_answer',saved)
    q=Questionnaire(kind='general',status='in_progress',current_step='family_history',visit_type='primary',ai_unavailable=False)
    asyncio.run(flow.apply_answer(AsyncMock(),q,step_key='family_history',choice=choice))
    text=saved.await_args.kwargs['answer_text']
    assert text == ('Не знаю' if choice=='unknown' else 'Такие заболевания у родственников не известны')


def test_unrecognized_choice_and_empty_input_are_not_recorded(monkeypatch):
    saved=AsyncMock();monkeypatch.setattr(flow,'add_answer',saved)
    for payload in ({'choice':'wrong'}, {}, {'value':'  '}, {'none_answer':True,'value':'Описание'}, {'none_answer':True,'choice':'unknown'}):
        q=Questionnaire(kind='general',status='in_progress',current_step='stool_changes',visit_type='primary',ai_unavailable=False)
        with pytest.raises(HTTPException) as error:
            asyncio.run(flow.apply_answer(AsyncMock(),q,step_key='stool_changes',**payload))
        assert error.value.status_code==400
    saved.assert_not_awaited()


def test_answers_reach_doctor_sections_verbatim_and_old_records_are_unchanged():
    structured={'complaints':'Исходные жалобы','life_anamnesis':'Хронических болезней нет'}
    old=structured.copy();append_gastro_chat_answers(structured,[]);assert structured==old
    answers=[SimpleNamespace(step_key=key,kind='answer',answer_text=text) for key,text in [('stool_changes','Жидкий стул 3 раза в день'),('weight_changes','Не знаю'),('family_history','У матери язвенный колит')]]
    append_gastro_chat_answers(structured,answers)
    assert 'Жидкий стул 3 раза в день' in structured['complaints']
    assert 'Изменение веса: Не знаю' in structured['complaints']
    assert 'У матери язвенный колит' in structured['life_anamnesis']
    assert structured['life_anamnesis'].startswith(old['life_anamnesis'])



def test_processing_includes_the_new_answers_in_the_doctor_card(monkeypatch):
    q=Questionnaire(id=uuid4(),kind='general',status='completed',current_step='code',visit_type='primary',ai_unavailable=False)
    db=AsyncMock()
    result=SimpleNamespace(scalar_one_or_none=lambda:q)
    db.execute.return_value=result
    context=AsyncMock()
    context.__aenter__.return_value=db
    context.__aexit__.return_value=False
    monkeypatch.setattr(process,'AsyncSessionLocal',lambda:context)
    answers=[SimpleNamespace(step_key=key,kind='answer',answer_text=text,question_text='Вопрос',choice=None) for key,text in [('stool_changes','Стул стал реже'),('weight_changes','Потеря 3 кг'),('family_history','У сестры целиакия')]]
    monkeypatch.setattr(process,'load_answers',AsyncMock(return_value=answers))
    monkeypatch.setattr(process,'specialization_name',AsyncMock(return_value='Гастроэнтеролог'))
    monkeypatch.setattr(process,'proxy_post_to_ml',AsyncMock(return_value={'complaints':'Исходные жалобы','medications':'Нет','allergy_anamnesis':'Нет'}))
    asyncio.run(process.run_questionnaire_processing(q.id))
    assert q.processing_status=='done'
    assert 'Стул стал реже' in q.structured['complaints'] and 'Потеря 3 кг' in q.structured['complaints']
    assert 'У сестры целиакия' in q.structured['life_anamnesis']
