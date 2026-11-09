import asyncio
from datetime import date, timedelta
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql
from app.services.patient_link_context import PatientLinkSelection, encode_appointment, decode_appointment, merge_appointment
from app.services.questionnaire_read import completed_query
from app.services import questionnaire_flow as flow
from app.models.questionnaire import Questionnaire


def test_short_link_is_opaque_and_reused_for_same_selection():
    from app.services.patient_link_context import create_short_appointment, load_appointment
    from app.models.patient_link import PatientLink
    from types import SimpleNamespace
    class DB:
        def __init__(self): self.links = {}
        async def execute(self, stmt):
            key = next(iter(stmt.compile().params.values()))
            return SimpleNamespace(scalar_one_or_none=lambda: next((v for v in self.links.values() if v.selection_key == key), None))
        async def get(self, model, slug): return self.links.get(slug)
        def add(self, value): self.links[value.slug] = value
        async def flush(self): pass
    db=DB();clinic=uuid4();doctor=uuid4()
    selection=PatientLinkSelection(doctor_membership_id=doctor,appointment_date=date.today(),appointment_time='12:30')
    slug=asyncio.run(create_short_appointment(db,clinic,selection))
    assert len(slug)==18 and slug.startswith('s.')
    assert str(clinic) not in slug and str(doctor) not in slug and '12:30' not in slug
    assert asyncio.run(create_short_appointment(db,clinic,selection))==slug and len(db.links)==1
    assert asyncio.run(create_short_appointment(db,clinic,selection.model_copy(update={'appointment_time':'13:00'})))!=slug
    assert asyncio.run(create_short_appointment(db,uuid4(),selection))!=slug
    context=asyncio.run(load_appointment(db,slug))
    assert context.clinic_id==clinic and context.doctor_membership_id==doctor and context.appointment_time=='12:30'
    with pytest.raises(HTTPException):asyncio.run(load_appointment(db,'s.unknown-invalid!'))


def test_link_is_deterministic_and_each_selection_changes_it():
    clinic=uuid4();selection=PatientLinkSelection(appointment_date=date.today(),appointment_time='12:30')
    token=encode_appointment(clinic,selection)
    assert encode_appointment(clinic,selection)==token
    assert decode_appointment(token).clinic_id==clinic
    assert encode_appointment(clinic,selection.model_copy(update={'appointment_time':'13:00'}))!=token
    assert encode_appointment(uuid4(),selection)!=token
    with pytest.raises(HTTPException):decode_appointment(token[:-1]+('0' if token[-1]!='0' else '1'))


@pytest.mark.parametrize('preset',[
    {'appointment_date':date.today().isoformat(),'appointment_time':'12:30'},
    {'appointment_date':date.today().isoformat()},
    {'appointment_time':'12:30'},
])
def test_merge_preserves_every_prefilled_part(preset):
    q=SimpleNamespace(gastro_answers={'appointment_context':preset})
    d,t=merge_appointment(q,None,None)
    assert d==(date.fromisoformat(preset['appointment_date']) if 'appointment_date'in preset else None)
    assert t==preset.get('appointment_time')
    if 'appointment_time'in preset:
        with pytest.raises(HTTPException):merge_appointment(q,None,'13:00')


def test_completed_filter_uses_appointment_not_completion_date():
    sql=str(completed_query(date_from=date.today(),date_to=date.today()).compile(dialect=postgresql.dialect()))
    where=sql.split('WHERE')[1]
    assert 'appointment_date >='in where and 'appointment_date <='in where
    assert 'completed_at'in sql.split('WHERE')[0] and 'completed_at'not in where


def test_name_only_finishes_when_both_appointment_parts_prefilled(monkeypatch):
    today=date.today()
    q=Questionnaire(id=uuid4(),clinic_id=uuid4(),kind='general',status='in_progress',current_step='patient_info',visit_type='primary',gastro_answers={'appointment_context':{'appointment_date':today.isoformat(),'appointment_time':'12:30'}})
    monkeypatch.setattr(flow,'allocate_code',AsyncMock(return_value='1234'))
    descriptor,_,process=asyncio.run(flow.apply_answer(AsyncMock(),q,step_key='patient_info',first_name='Тест'))
    assert descriptor.completed and process and q.appointment_date==today and q.appointment_time=='12:30'
