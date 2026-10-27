"""Персональная ссылка регистратуры: срок, статус для списка, проверка ввода."""

from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.questionnaire_invites import (
    InviteInputError,
    clean_patient_name,
    invite_expires_at,
    is_invite_expired,
    registry_status,
    validate_appointment,
)

TODAY = date(2026, 10, 26)


def _q(**fields):
    base = dict(status="invited", printed_at=None, signed_at=None, invite_expires_at=None)
    return SimpleNamespace(**{**base, **fields})


def test_link_works_until_end_of_next_day_after_appointment():
    assert invite_expires_at(date(2026, 10, 28)) == datetime(2026, 10, 30, tzinfo=timezone.utc)


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


def test_appointment_today_or_within_window_is_valid():
    validate_appointment(TODAY, "09:30", today=TODAY, days_ahead=30)
    validate_appointment(date(2026, 11, 25), "23:59", today=TODAY, days_ahead=30)


@pytest.mark.parametrize(
    ("day", "time"),
    [
        (date(2026, 10, 25), "10:00"),
        (date(2026, 11, 26), "10:00"),
        (TODAY, "24:00"),
        (TODAY, "9:30"),
    ],
)
def test_appointment_out_of_range_or_bad_time_is_rejected(day, time):
    with pytest.raises(InviteInputError):
        validate_appointment(day, time, today=TODAY, days_ahead=30)
