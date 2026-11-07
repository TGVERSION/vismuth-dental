import asyncio
from datetime import date, timedelta
from types import SimpleNamespace
from uuid import uuid4
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.schemas.clinic_join import JoinRegistration, JoinSubmission
from app.services.clinic_join import ensure_join_available, ensure_role_specializations
from app.deps import get_current_user


def test_join_roles_cannot_assign_platform_or_admin():
    for role in ['super_admin', 'admin', 'patient']:
        with pytest.raises(ValidationError):
            JoinSubmission(token='x'*43, requested_role=role)


def test_operator_cannot_smuggle_doctor_specializations():
    with pytest.raises(HTTPException):
        ensure_role_specializations('operator', [1])
    with pytest.raises(HTTPException):
        ensure_role_specializations('doctor', [])
    ensure_role_specializations('doctor', [1])
    ensure_role_specializations('operator', [])


def test_join_rejects_expired_and_deleted_clinic():
    for fields in [dict(deleted_at=object(), access_until=date.today()+timedelta(days=1)), dict(deleted_at=None, access_until=date.today()-timedelta(days=1))]:
        with pytest.raises(HTTPException):
            ensure_join_available(SimpleNamespace(**fields))


def test_new_pending_account_cannot_call_working_dependency():
    user=SimpleNamespace(clinic_join_restricted=True)
    with pytest.raises(HTTPException) as error:
        asyncio.run(get_current_user(current_user=user))
    assert error.value.status_code == 403
    user.clinic_join_restricted=False
    assert asyncio.run(get_current_user(current_user=user)) is user


def test_operator_only_cannot_use_clinical_helpers():
    from app.deps import require_clinical_user
    from unittest.mock import AsyncMock
    class Result:
        def scalar_one_or_none(self):
            return object()
    db=SimpleNamespace(execute=AsyncMock(return_value=Result()))
    user=SimpleNamespace(id=uuid4(),role='doctor',user_role_link=None)
    with pytest.raises(HTTPException) as error:
        asyncio.run(require_clinical_user(current_user=user, db=db))
    assert error.value.status_code == 403


def test_blank_join_names_and_extra_admin_flags_are_rejected():
    base=dict(token='x'*43,requested_role='operator',login='new@example.test',password='long-password',first_name='Иван',last_name='Иванов')
    for changes in [dict(first_name='   '),dict(is_clinic_admin=True),dict(clinic_id=str(uuid4()))]:
        with pytest.raises(ValidationError):
            JoinRegistration(**{**base,**changes})


def test_join_rate_limit_is_atomic_and_does_not_include_raw_identity(monkeypatch):
    from app.routers import clinic_join
    from unittest.mock import AsyncMock
    client=SimpleNamespace(eval=AsyncMock(return_value=11),aclose=AsyncMock())
    monkeypatch.setattr(clinic_join,'get_redis_client',lambda:client)
    request=SimpleNamespace(client=SimpleNamespace(host='127.0.0.1'))
    with pytest.raises(HTTPException) as error:
        asyncio.run(clinic_join.check_join_rate(request,'register-email','employee@example.test'))
    assert error.value.status_code == 429
    args=client.eval.call_args.args
    assert 'EXPIRE' in args[0] and 'INCR' in args[0]
    assert 'employee@example.test' not in args[2]
    client.aclose.assert_awaited_once()


def test_join_rate_limit_fails_closed_when_redis_is_down(monkeypatch):
    from app.routers import clinic_join
    from unittest.mock import AsyncMock
    client=SimpleNamespace(eval=AsyncMock(side_effect=OSError('connection unavailable')),aclose=AsyncMock())
    monkeypatch.setattr(clinic_join,'get_redis_client',lambda:client)
    request=SimpleNamespace(client=SimpleNamespace(host='127.0.0.1'))
    with pytest.raises(HTTPException) as error:
        asyncio.run(clinic_join.check_join_rate(request,'preview'))
    assert error.value.status_code == 503
    assert 'connection unavailable' not in str(error.value.detail)


def test_expired_join_registration_can_restart_normal_registration(monkeypatch):
    from datetime import datetime, timezone
    from unittest.mock import AsyncMock
    from app.routers import auth
    from app.schemas.auth import RegisterRequest
    pending=SimpleNamespace(clinic_join_context={'link_id':str(uuid4())},expires_at=datetime.now(timezone.utc)-timedelta(minutes=1))
    class Result:
        def __init__(self,item): self.item=item
        def scalar_one_or_none(self): return self.item
    db=SimpleNamespace(execute=AsyncMock(side_effect=[Result(None),Result(pending)]),commit=AsyncMock(),rollback=AsyncMock())
    monkeypatch.setattr(auth,'send_registration_code',lambda *args:None)
    monkeypatch.setattr(auth,'hash_password',lambda password:'new-password-hash')
    response=asyncio.run(auth.register(RegisterRequest(login='expired@example.com',password='new-password-123'),db=db))
    assert response.detail == 'code_sent'
    assert pending.clinic_join_context is None
    assert pending.password_hash == 'new-password-hash'
    assert pending.expires_at > datetime.now(timezone.utc)
