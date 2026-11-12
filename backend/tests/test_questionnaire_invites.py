"""Персональная ссылка регистратуры: срок, статус для списка, проверка ввода."""

import asyncio
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.services.questionnaire_invites import (
    InviteInputError,
    clean_patient_name,
    create_test_invites,
    invite_expires_at,
    is_invite_expired,
    registry_status,
)
from app.services.questionnaire_limits import hash_session_token

def _q(**fields):
    base = dict(status="invited", printed_at=None, signed_at=None, invite_expires_at=None)
    return SimpleNamespace(**{**base, **fields})


def test_link_works_for_a_week_after_creation():
    created = datetime(2026, 10, 28, 15, 30, tzinfo=timezone.utc)

    assert invite_expires_at(created) == datetime(2026, 11, 4, 15, 30, tzinfo=timezone.utc)


def test_test_invites_are_independent_and_created_in_one_transaction(monkeypatch):
    monkeypatch.setattr(
        'app.services.questionnaire_invites.ensure_clinic_subscription_active',
        lambda clinic: None,
    )
    clinic = SimpleNamespace(id=uuid4(), questionnaire_kind='mixed')
    db = SimpleNamespace(add_all=Mock(), commit=AsyncMock())

    invites = asyncio.run(create_test_invites(db, clinic))

    assert len(invites) == len({token for _, token in invites}) == 5
    db.add_all.assert_called_once_with([q for q, _ in invites])
    db.commit.assert_awaited_once()
    for number, (questionnaire, token) in enumerate(invites, start=1):
        assert questionnaire.clinic_id == clinic.id
        assert questionnaire.kind == 'dental'
        assert questionnaire.status == 'invited'
        assert questionnaire.patient_last_name == 'Тестовая'
        assert questionnaire.patient_first_name == f'Анкета {number}'
        assert questionnaire.session_token_hash == hash_session_token(token)
        assert questionnaire.created_by_membership_id is None


def test_expired_only_after_deadline():
    q = _q(invite_expires_at=datetime(2026, 10, 30, tzinfo=timezone.utc))

    assert is_invite_expired(q, datetime(2026, 10, 29, 23, 59, tzinfo=timezone.utc)) is False
    assert is_invite_expired(q, datetime(2026, 10, 30, tzinfo=timezone.utc)) is True


def test_questionnaire_without_invite_never_expires():
    assert is_invite_expired(_q(), datetime(2030, 1, 1, tzinfo=timezone.utc)) is False


@pytest.mark.parametrize(
    ("fields", "expected"),
    [
        ({}, "invited"),
        ({"status": "in_progress"}, "in_progress"),
        ({"status": "completed"}, "completed"),
        ({"status": "completed", "printed_at": datetime(2026, 10, 26)}, "printed"),
        (
            {"status": "completed", "printed_at": datetime(2026, 10, 26),
             "signed_at": datetime(2026, 10, 26)},
            "signed",
        ),
    ],
)
def test_registry_status(fields, expected):
    assert registry_status(_q(**fields)) == expected


def test_patient_name_is_trimmed_and_middle_name_optional():
    assert clean_patient_name("  Белова ", " Ольга", "  ") == ("Белова", "Ольга", None)


@pytest.mark.parametrize(("last", "first"), [("", "Ольга"), ("Белова", "   ")])
def test_last_and_first_name_required(last, first):
    with pytest.raises(InviteInputError):
        clean_patient_name(last, first, None)


def test_create_invite_keeps_administrator_date_for_patient_print(monkeypatch):
    from uuid import uuid4
    from app.services import questionnaire_invites as invites
    from app.services.dental.flow import DentalAnswers
    from app.services.dental.paper_form import build_paper_form
    from app.schemas.clinic_questionnaires import RegistryQuestionnaireCreate
    from pydantic import ValidationError
    monkeypatch.setattr(invites, 'ensure_clinic_subscription_active', lambda clinic: None)
    class Database:
        def add(self, item):
            self.item = item
        async def commit(self):
            pass
        async def refresh(self, item):
            assert item is self.item
    db = Database()
    q, token = asyncio.run(invites.create_invite(db,
        SimpleNamespace(id=uuid4(), questionnaire_kind='dental'),
        last_name='Тестовый', first_name='Пациент', middle_name=None,
        created_by_membership_id=None, birth_date=date(1985, 3, 14)))
    assert token and q.patient_first_name == 'Пациент'
    assert q.dental_answers['flow_version'] == 2
    assert build_paper_form(DentalAnswers.model_validate(q.dental_answers))['birth_date'] == '1985-03-14'
    with pytest.raises(ValidationError):
        RegistryQuestionnaireCreate(last_name='Тестовый', first_name='Пациент', birth_date='2999-01-01')
