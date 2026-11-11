"""Completion-day filters must not use invitation, printing or appointment dates."""
import asyncio
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.routers import clinic_questionnaires as registry


def test_completed_day_is_a_half_open_local_day_and_keeps_clinic_and_status_scope():
    clinic_id = uuid4()
    query = registry._registry_query(clinic_id, 'printed', 'Иван%_', date(2026, 11, 11), 300)
    compiled = query.compile(dialect=postgresql.dialect())
    where = str(compiled).split('WHERE', 1)[1]
    assert 'questionnaire.completed_at >=' in where and 'questionnaire.completed_at <' in where
    assert 'questionnaire.created_at >=' not in where
    assert 'questionnaire.appointment_date' not in where
    assert 'questionnaire.printed_at IS NOT NULL' in where
    assert clinic_id in compiled.params.values()
    assert datetime(2026, 11, 10, 19, tzinfo=timezone.utc) in compiled.params.values()
    assert datetime(2026, 11, 11, 19, tzinfo=timezone.utc) in compiled.params.values()
    assert '%Иван\\%\\_%' in compiled.params.values()


def test_all_dates_does_not_exclude_unfinished_links():
    compiled = registry._registry_query(uuid4()).compile(dialect=postgresql.dialect())
    assert 'completed_at' not in str(compiled).split('WHERE', 1)[1]


@pytest.mark.parametrize('day', [None, date(2026, 11, 11)])
def test_completed_only_list_filters_and_sorts_before_limit(monkeypatch, day):
    async def clinic(*args):
        return object()

    monkeypatch.setattr(registry, 'get_clinic_or_404', clinic)

    class DB:
        async def execute(self, query):
            compiled = query.compile(dialect=postgresql.dialect())
            sql = str(compiled)
            assert 'questionnaire.completed_at IS NOT NULL' in sql
            assert 'ORDER BY questionnaire.completed_at DESC, questionnaire.id DESC' in sql
            assert 'concat_ws(' in sql
            assert '%Иванов Иван%' in compiled.params.values()
            assert 'LIMIT' in sql
            return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))

    assert asyncio.run(registry.list_registry_questionnaires(
        uuid4(), registry_status_filter=None, name='Иванов Иван', completed_on=day,
        utc_offset_minutes=300, completed_only=True, _=None, db=DB(),
    )) == []


def test_calendar_is_distinct_completion_days_with_the_same_access_filters(monkeypatch):
    clinic_id = uuid4()
    async def clinic(*args): return object()
    monkeypatch.setattr(registry, 'get_clinic_or_404', clinic)
    class DB:
        async def execute(self, query):
            compiled = query.compile(dialect=postgresql.dialect())
            sql = str(compiled)
            assert sql.startswith('SELECT DISTINCT CAST(timezone(')
            assert 'questionnaire.completed_at IS NOT NULL' in sql
            assert 'questionnaire.signed_at IS NOT NULL' in sql
            assert clinic_id in compiled.params.values()
            assert timedelta(minutes=300) in compiled.params.values()
            assert date(2026, 11, 1) in compiled.params.values()
            return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [date(2026, 11, 11)]))
    result = asyncio.run(registry.registry_completion_dates(clinic_id, 'signed', 'Иван', date(2026, 11, 1), date(2026, 11, 30), 300, None, DB()))
    assert result == [date(2026, 11, 11)]


def test_calendar_rejects_reversed_range_and_static_route_precedes_uuid(monkeypatch):
    async def clinic(*args): return object()
    monkeypatch.setattr(registry, 'get_clinic_or_404', clinic)
    with pytest.raises(HTTPException) as error:
        asyncio.run(registry.registry_completion_dates(uuid4(), None, None, date(2026, 11, 30), date(2026, 11, 1), 0, None, None))
    assert error.value.status_code == 422
    paths = [route.path for route in registry.router.routes]
    assert paths.index('/clinics/{clinic_id}/questionnaires/completion-dates') < paths.index('/clinics/{clinic_id}/questionnaires/{questionnaire_id}')
