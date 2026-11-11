import asyncio
from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
import pytest

from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app import deps
from app.db import get_db
from app.main import app
from app.services.questionnaire_read import completed_dates, completed_query


def test_completed_dates_are_distinct_and_scoped_without_patient_data():
    clinic_id = uuid4()
    class DB:
        async def execute(self, stmt):
            compiled = stmt.compile(dialect=postgresql.dialect())
            query = str(compiled)
            assert query.startswith('SELECT DISTINCT questionnaire.appointment_date')
            assert clinic_id in compiled.params.values()
            assert 'completed' in compiled.params.values()
            assert 'questionnaire.appointment_date IS NOT NULL' in query
            return SimpleNamespace(scalars=lambda: [date(2026, 11, 10)])
    assert asyncio.run(completed_dates(DB(), clinic_id=clinic_id)) == [date(2026, 11, 10)]


def test_doctor_cannot_generate_patient_links_and_calendar_requires_identity():
    class DB:
        async def execute(self, stmt):
            query = str(stmt.compile(dialect=postgresql.dialect()))
            assert 'clinic_membership.is_clinic_admin IS true OR clinic_membership.is_operator IS true' in query
            return SimpleNamespace(scalar_one_or_none=lambda: None)
    app.dependency_overrides[deps.get_current_user] = lambda: SimpleNamespace(id=uuid4(), role='doctor')
    app.dependency_overrides[get_db] = lambda: DB()
    try:
        with TestClient(app) as client:
            assert client.post(f'/clinics/{uuid4()}/patient-links', json={}).status_code == 403
    finally:
        app.dependency_overrides.clear()
    with TestClient(app) as client:
        for endpoint in ['/questionnaires/appointment-dates', '/super-admin/questionnaires/appointment-dates',
                         f'/clinics/{uuid4()}/completed-questionnaires/appointment-dates']:
            assert client.get(endpoint).status_code == 401


def test_doctor_calendar_uses_own_visibility_and_appointment_day(monkeypatch):
    from app.routers import questionnaires
    member = SimpleNamespace(id=uuid4(), clinic_id=uuid4())
    async def membership(*args):
        return member
    monkeypatch.setattr(questionnaires, 'get_active_doctor_membership', membership)
    class DB:
        async def execute(self, stmt):
            compiled = stmt.compile(dialect=postgresql.dialect())
            query = str(compiled)
            assert 'SELECT DISTINCT CASE' in query
            assert member.id in compiled.params.values() and member.clinic_id in compiled.params.values()
            assert 'completed' in compiled.params.values()
            assert 'ELSE questionnaire.appointment_date END' in query
            assert date(2026, 11, 1) in compiled.params.values()
            return SimpleNamespace(scalars=lambda: [])
    assert asyncio.run(questionnaires.appointment_dates(date_from=date(2026, 11, 1), name=None,
                                                       current_user=None, db=DB())) == []


@pytest.mark.parametrize('day', [None, date(2026, 11, 11)])
def test_doctor_completion_mode_keeps_scope_and_orders_by_completion(monkeypatch, day):
    from app.routers import questionnaires

    member = SimpleNamespace(id=uuid4(), clinic_id=uuid4())

    async def membership(*args):
        return member

    monkeypatch.setattr(questionnaires, 'get_active_doctor_membership', membership)

    class DB:
        async def execute(self, stmt):
            compiled = stmt.compile(dialect=postgresql.dialect())
            sql = str(compiled)
            assert member.id in compiled.params.values()
            assert member.clinic_id in compiled.params.values()
            assert 'completed' in compiled.params.values()
            assert 'ORDER BY questionnaire.completed_at DESC' in sql
            assert 'questionnaire.completed_at IS NOT NULL' in sql
            assert 'questionnaire.kind !=' in sql
            assert 'dental' in compiled.params.values()
            assert '%Иванов Иван%' in compiled.params.values()
            assert ('questionnaire.completed_at >=' in sql) == (day is not None)
            if day is not None:
                assert datetime(2026, 11, 10, 19, tzinfo=timezone.utc) in compiled.params.values()
                assert datetime(2026, 11, 11, 19, tzinfo=timezone.utc) in compiled.params.values()
            return SimpleNamespace(all=lambda: [])

    assert asyncio.run(questionnaires.list_questionnaires(
        name='Иванов Иван', date_filter=day, visit_type=None, code=None,
        current_user=None, db=DB(), by_completion=True, utc_offset_minutes=300,
        exclude_dental=True,
    )) == []


def test_admin_completion_range_uses_local_days():
    day = date(2026, 11, 11)
    query = completed_query(
        date_from=day, date_to=day, by_completion=True, utc_offset_minutes=300,
        exclude_dental=True,
    ).compile(dialect=postgresql.dialect())
    assert 'questionnaire.completed_at >=' in str(query)
    assert 'questionnaire.completed_at <' in str(query)
    assert 'questionnaire.kind !=' in str(query)
    assert datetime(2026, 11, 10, 19, tzinfo=timezone.utc) in query.params.values()
    assert datetime(2026, 11, 11, 19, tzinfo=timezone.utc) in query.params.values()
