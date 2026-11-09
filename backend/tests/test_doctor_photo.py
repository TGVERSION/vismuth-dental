import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.routers.clinic_admin import public_doctor_photo
from app.services import doctor_photo


def test_public_photo_requires_current_active_doctor_and_clinic(monkeypatch):
    membership_id, version = uuid4(), uuid4()
    def unexpected(*args):
        raise AssertionError('Unknown photo must not access storage')
    monkeypatch.setattr(doctor_photo, 'read_doctor_photo', unexpected)
    class DB:
        async def execute(self, stmt):
            compiled = stmt.compile(dialect=postgresql.dialect())
            query = str(compiled)
            assert membership_id in compiled.params.values()
            assert doctor_photo.doctor_photo_url(membership_id, version) in compiled.params.values()
            for condition in ['clinic_membership.status =', 'clinic_membership.is_doctor IS true',
                              'clinic_membership.deleted_at IS NULL', 'clinic.deleted_at IS NULL',
                              'service_user.deleted_at IS NULL', 'service_user.is_active IS true']:
                assert condition in query
            return SimpleNamespace(scalar_one_or_none=lambda: None)
    with pytest.raises(HTTPException) as error:
        asyncio.run(public_doctor_photo(membership_id, version, DB()))
    assert error.value.status_code == 404


def test_current_photo_is_png_with_safe_response_headers(monkeypatch):
    monkeypatch.setattr(doctor_photo, 'read_doctor_photo', lambda *args: b'png-test')
    class DB:
        async def execute(self, stmt):
            return SimpleNamespace(scalar_one_or_none=lambda: uuid4())
    response = asyncio.run(public_doctor_photo(uuid4(), uuid4(), DB()))
    assert response.body == b'png-test'
    assert response.headers['content-type'] == 'image/png'
    assert response.headers['x-content-type-options'] == 'nosniff'
