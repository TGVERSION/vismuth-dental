import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.deps import require_clinic_admin, require_clinic_registry, require_roles


class DB:
    def __init__(self, membership): self.membership = membership; self.statements = []
    async def execute(self, statement):
        self.statements.append(statement)
        return SimpleNamespace(scalar_one_or_none=lambda: self.membership)


def test_superadmin_registry_without_membership():
    user = SimpleNamespace(id=uuid4(), role='super_admin')
    db = DB(None)
    assert asyncio.run(require_clinic_registry(uuid4(), user, db)) is user
    assert db.statements == []


def test_registry_operator_check_is_scoped_active_and_not_admin_management():
    user = SimpleNamespace(id=uuid4(), role='doctor')
    clinic_id = uuid4()
    db = DB(SimpleNamespace(is_operator=True))
    assert asyncio.run(require_clinic_registry(clinic_id, user, db)) is user
    query = db.statements[0].compile(dialect=postgresql.dialect())
    assert clinic_id in query.params.values() and user.id in query.params.values()
    assert 'clinic_membership.is_operator IS true' in str(query)
    assert 'clinic_membership.status =' in str(query)
    assert 'clinic_membership.deleted_at IS NULL' in str(query)
    assert 'clinic.deleted_at IS NULL' in str(query)
    with pytest.raises(HTTPException) as error:
        asyncio.run(require_clinic_admin(clinic_id, user, DB(None)))
    assert error.value.status_code == 403


@pytest.mark.parametrize('role', ['admin', 'doctor', 'patient'])
def test_other_clinic_and_no_platform_permission(role):
    user = SimpleNamespace(id=uuid4(), role=role)
    with pytest.raises(HTTPException) as error:
        asyncio.run(require_clinic_registry(uuid4(), user, DB(None)))
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        asyncio.run(require_roles('super_admin')(user))
    assert error.value.status_code == 403


def test_my_clinic_and_member_schemas_report_operator():
    from app.schemas.clinic_admin import ClinicMemberRead, MyClinicRead
    assert 'is_operator' in ClinicMemberRead.model_fields
    assert 'is_operator' in MyClinicRead.model_fields


def test_dental_registry_routes_use_scoped_registry_permission():
    from app.routers.clinic_questionnaires import router
    for route in router.routes:
        assert require_clinic_registry in [d.call for d in route.dependant.dependencies]
