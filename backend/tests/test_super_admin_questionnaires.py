import asyncio
from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.services.questionnaire_read import completed_query, list_completed, get_completed


def sql(stmt):
    return str(stmt.compile(dialect=postgresql.dialect()))


def test_completed_query_all_dates_all_kinds_and_printed_signed():
    query = sql(completed_query())
    assert 'questionnaire.status =' in query
    assert 'completed_at >=' not in query
    assert 'printed_at IS NULL' not in query
    assert 'signed_at IS NULL' not in query
    assert 'clinic.deleted_at IS NULL' not in query
    assert 'questionnaire.kind =' not in query


def test_completed_query_filters_bound_name_and_clinic_and_appointment_dates():
    clinic_id = uuid4()
    stmt = completed_query(clinic_id=clinic_id, kind='gastro', name='Петров Иван',
                           date_from=date(2026, 11, 1), date_to=date(2026, 11, 6))
    compiled = stmt.compile(dialect=postgresql.dialect())
    assert clinic_id in compiled.params.values()
    assert 'gastro' in compiled.params.values()
    assert '%Петров Иван%' in compiled.params.values()
    assert date(2026, 11, 1) in compiled.params.values()
    assert date(2026, 11, 6) in compiled.params.values()
    assert 'Петров' not in str(compiled)


def test_reversed_dates_rejected_before_database():
    with pytest.raises(HTTPException) as error:
        completed_query(date_from=date(2026, 11, 7), date_to=date(2026, 11, 1))
    assert error.value.status_code == 422


def test_paging_stable_and_total():
    class DB:
        def __init__(self): self.statements = []
        async def execute(self, statement):
            self.statements.append(statement)
            return SimpleNamespace(scalar_one=lambda: 8, all=lambda: [])
    db = DB()
    result = asyncio.run(list_completed(db, page=2, page_size=3))
    assert result.model_dump() == dict(items=[], total=8, page=2, page_size=3)
    compiled = db.statements[1].compile(dialect=postgresql.dialect())
    assert 'appointment_date DESC NULLS LAST, questionnaire.appointment_time ASC NULLS LAST, questionnaire.id DESC' in str(compiled)
    assert compiled.params['param_1'] == 3
    assert compiled.params['param_2'] == 3


def test_detail_scope_does_not_leak_foreign_questionnaire():
    class DB:
        async def execute(self, statement):
            assert 'questionnaire.clinic_id =' in sql(statement)
            return SimpleNamespace(first=lambda: None)
    with pytest.raises(HTTPException) as error:
        asyncio.run(get_completed(DB(), uuid4(), clinic_id=uuid4()))
    assert error.value.status_code == 404

@pytest.mark.parametrize('kind', ['general', 'gastro', 'dental'])
def test_completed_list_keeps_kind_clinic_and_printed_signed(kind):
    clinic_id, questionnaire_id = uuid4(), uuid4()
    completed_at = datetime(2026, 11, 1, tzinfo=timezone.utc)
    q = SimpleNamespace(id=questionnaire_id, clinic_id=clinic_id, kind=kind,
        completed_at=completed_at, printed_at=completed_at, signed_at=completed_at,
        appointment_time=None, appointment_date=None, patient_last_name='Иванов',
        patient_first_name='Иван', patient_middle_name=None, visit_type=None,
        code='1234', protocol_id=None)
    class DB:
        async def execute(self, statement):
            return SimpleNamespace(scalar_one=lambda: 1, all=lambda: [(q, 'Клиника', None)])
    result = asyncio.run(list_completed(DB()))
    item = result.items[0]
    assert item.kind == kind and item.clinic_id == clinic_id
    assert item.printed_at == completed_at and item.signed_at == completed_at
    assert item.clinic_name == 'Клиника'


def test_read_routers_are_scoped_to_platform_or_registry_dependency():
    from app.routers.super_admin.questionnaires import router as platform
    from app.routers.clinic_completed_questionnaires import router as registry
    from app.deps import require_clinic_registry
    assert len(platform.routes) == 2 and len(registry.routes) == 2
    for route in registry.routes:
        assert require_clinic_registry in [d.call for d in route.dependant.dependencies]
    for route in platform.routes:
        user = SimpleNamespace(role='admin')
        with pytest.raises(HTTPException) as error:
            asyncio.run(route.dependant.dependencies[0].call(user))
        assert error.value.status_code == 403

@pytest.mark.parametrize('invite', [None, datetime(2026, 11, 1, tzinfo=timezone.utc)])
def test_dental_print_detail_includes_completed_without_invite(invite):
    from app.routers.clinic_questionnaires import get_registry_questionnaire
    q = SimpleNamespace(id=uuid4(), status='completed', patient_last_name='Иванов',
        patient_first_name='Иван', patient_middle_name=None, created_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc), printed_at=None, signed_at=None,
        invite_expires_at=invite, structured={'paper_form': {}}, gaps=[])
    clinic_id = uuid4()
    class DB:
        async def execute(self, statement):
            compiled = statement.compile(dialect=postgresql.dialect())
            assert clinic_id in compiled.params.values()
            assert q.id in compiled.params.values()
            assert 'questionnaire.status =' in str(compiled) and ' OR ' in str(compiled)
            assert 'completed' in compiled.params.values()
            return SimpleNamespace(scalar_one_or_none=lambda: q)
    result = asyncio.run(get_registry_questionnaire(clinic_id, q.id, None, DB()))
    assert result.structured == {'paper_form': {}}


def test_registry_mutation_loader_still_requires_invite():
    from app.routers.clinic_questionnaires import _base_query
    assert 'questionnaire.invite_expires_at IS NOT NULL' in sql(_base_query(uuid4()))
