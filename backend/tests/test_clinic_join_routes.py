"""Проверка реально подключённых маршрутов и серверного барьера ожидания."""

from types import SimpleNamespace
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import deps


NEW_PROTECTED_PATHS = [
    '/clinic-join/me',
    '/super-admin/join-requests',
    '/super-admin/questionnaires',
    '/super-admin/clinics/00000000-0000-0000-0000-000000000001/join-link',
    '/clinics/00000000-0000-0000-0000-000000000001/completed-questionnaires',
    '/clinics/00000000-0000-0000-0000-000000000001/patient-links',
]


@pytest.mark.parametrize('path', NEW_PROTECTED_PATHS)
def test_new_protected_routes_are_registered_and_require_identity(path):
    with TestClient(app) as client:
        assert client.get(path).status_code == 401


@pytest.mark.parametrize('path', ['/super-admin/join-requests', '/super-admin/questionnaires'])
def test_global_routes_refuse_ordinary_authenticated_user(path):
    app.dependency_overrides[deps.get_current_user] = lambda: SimpleNamespace(role='doctor')
    try:
        with TestClient(app) as client:
            assert client.get(path).status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize('path,body', [
    ('/protocols', {}),
    ('/ml_fullness_complaints', {'example_prompt': 'Синтетическая жалоба'}),
    ('/check_dms', {'mkb': 'I10', 'appointments': 'Тест'}),
])
def test_pending_identity_cannot_use_working_api(path, body):
    identity_dependency = getattr(deps, 'get_identity_user', None)
    assert identity_dependency is not None, 'A restricted identity must be separate from working access'
    app.dependency_overrides[identity_dependency] = lambda: SimpleNamespace(
        clinic_join_restricted=True, is_active=True, deleted_at=None, role='doctor',
    )
    try:
        with TestClient(app) as client:
            assert client.post(path, json=body).status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_pending_user_can_refresh_own_profile_without_working_access():
    identity_dependency = getattr(deps, 'get_identity_user', None)
    assert identity_dependency is not None
    user = SimpleNamespace(
        login='pending@example.test', first_name='Тест', last_name='Ожидающий',
        role='doctor', role_name_ru='Врач', is_active=True,
        created_at=datetime.now(timezone.utc), updated_at=None, deleted_at=None,
        clinic_join_restricted=True,
    )
    app.dependency_overrides[identity_dependency] = lambda: user
    try:
        with TestClient(app) as client:
            response = client.get('/service_user')
            assert response.status_code == 200
            assert response.json()['login'] == user.login
    finally:
        app.dependency_overrides.clear()
