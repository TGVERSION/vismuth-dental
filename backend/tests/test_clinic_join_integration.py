"""Opt-in PostgreSQL integration; only an explicitly named isolated test database."""

import asyncio
from datetime import date, datetime, timedelta, timezone
import os
from uuid import uuid4
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import Base, get_db
from app.main import app
from app.models import Clinic, ClinicMembership, Questionnaire, RefSpecialization, Role, ServiceUser
from app.security import create_access_token, hash_password
from app.services.roles import set_user_role


TEST_URL = os.getenv('CLINIC_JOIN_TEST_DATABASE_URL')
pytestmark = pytest.mark.skipif(not TEST_URL, reason='Requires isolated PostgreSQL CLINIC_JOIN_TEST_DATABASE_URL')


def test_join_approval_and_cross_clinic_access_on_postgres(monkeypatch):
    from app.routers import clinic_join
    monkeypatch.setattr(clinic_join, 'check_join_rate', AsyncMock())
    monkeypatch.setattr(clinic_join, 'generate_registration_code', lambda: '1234')
    monkeypatch.setattr(clinic_join, 'send_registration_code', lambda login, code: None)
    asyncio.run(_exercise())


async def _exercise():
    assert TEST_URL and '/clinic_join_test' in TEST_URL and '127.0.0.1:' in TEST_URL
    engine = create_async_engine(TEST_URL)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def test_db():
        async with sessions() as session:
            yield session

    async with sessions() as db:
        if (await db.execute(select(Role.id))).first() is None:
            db.add_all([Role(name=name, name_ru=name) for name in ['doctor', 'super_admin', 'admin', 'patient']])
            await db.flush()
        suffix = uuid4().hex[:10]
        admin = ServiceUser(login=f'admin-{suffix}@example.test', password_hash=hash_password('Test-password-123'))
        operator = ServiceUser(login=f'operator-{suffix}@example.test', password_hash=hash_password('Test-password-123'), clinic_join_restricted=True)
        physician = ServiceUser(login=f'physician-{suffix}@example.test', password_hash=hash_password('Test-password-123'), clinic_join_restricted=True)
        second_physician = ServiceUser(login=f'second-{suffix}@example.test', password_hash=hash_password('Test-password-123'), clinic_join_restricted=True)
        db.add_all([admin, operator, physician, second_physician])
        await db.flush()
        for user, role in [(admin, 'super_admin'), (operator, 'doctor'), (physician, 'doctor'), (second_physician, 'doctor')]:
            await set_user_role(db, user, role)
        clinic = Clinic(name=f'Test {suffix}', public_slug=f'clinic-{suffix}', access_type='trial',
                        access_until=date.today() + timedelta(days=30), questionnaire_kind='mixed', doctors_limit=1)
        other = Clinic(name=f'Other {suffix}', public_slug=f'other-{suffix}', access_type='trial',
                       access_until=date.today() + timedelta(days=30), questionnaire_kind='mixed')
        db.add_all([clinic, other])
        await db.flush()
        specialization_id = int(uuid4().hex[:6], 16)
        db.add(RefSpecialization(id=specialization_id, name=f'Test specialization {suffix}'))
        questionnaires = []
        for kind, target in [('dental', clinic), ('general', clinic), ('gastro', other)]:
            q = Questionnaire(clinic_id=target.id, kind=kind, status='completed', session_token_hash=uuid4().hex,
                              patient_last_name=f'Пациент-{suffix}', patient_first_name='Тест',
                              completed_at=datetime.now(timezone.utc), structured={'complaints': 'Синтетический ответ'},
                              dental_answers={} if kind == 'dental' else None)
            db.add(q)
            questionnaires.append(q)
        await db.commit()
        admin_id, operator_id, physician_id, clinic_id, other_id = admin.id, operator.id, physician.id, clinic.id, other.id
        second_physician_id = second_physician.id
        foreign_q_id = questionnaires[-1].id

    def headers(user_id):
        return {'Authorization': f'Bearer {create_access_token(user_id)}'}

    app.dependency_overrides[get_db] = test_db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            response = await client.post(f'/super-admin/clinics/{clinic_id}/join-link', headers=headers(admin_id))
            assert response.status_code == 200, response.text
            link = response.json()['url']
            token = link.rsplit('/', 1)[-1]
            preview = await client.get(f'/auth/clinic-join/{token}')
            assert preview.status_code == 200, preview.text
            assert preview.json()['clinic_id'] == str(clinic_id)
            new_email = f'join-{suffix}@example.org'
            registration = await client.post('/auth/clinic-join/register', json={
                'token': token, 'login': new_email, 'password': 'Test-password-123',
                'first_name': 'Тест', 'last_name': 'Сотрудник', 'requested_role': 'operator', 'specialization_ids': [],
            })
            assert registration.status_code == 200, registration.text
            # The generic confirmation must never turn a join registration into an unrestricted user.
            bypass = await client.post('/auth/register/confirm', json={'login': new_email, 'code': '1234'})
            assert bypass.status_code == 400, bypass.text
            confirmation = await client.post('/auth/clinic-join/confirm', json={'login': new_email, 'code': '1234'})
            assert confirmation.status_code == 200, confirmation.text
            new_headers = {'Authorization': f"Bearer {confirmation.json()['access_token']}"}
            assert (await client.get('/protocols', headers=new_headers)).status_code == 403
            new_status = (await client.get('/clinic-join/me', headers=new_headers)).json()
            assert new_status['restricted'] is True and new_status['requests'][0]['status'] == 'pending'
            rejected_id = new_status['requests'][0]['id']
            rejection = await client.post(f'/super-admin/join-requests/{rejected_id}/reject', headers=headers(admin_id))
            assert rejection.status_code == 200, rejection.text
            assert (await client.get('/clinic-join/me', headers=new_headers)).json()['restricted'] is True
            pending = await client.post('/clinic-join/requests', headers=headers(operator_id), json={
                'token': token, 'requested_role': 'operator', 'specialization_ids': [],
            })
            assert pending.status_code in (200, 201), pending.text
            request_id = pending.json()['id']
            denied = await client.get(f'/clinics/{clinic_id}/completed-questionnaires', headers=headers(operator_id))
            assert denied.status_code == 403
            denied = await client.post(f'/super-admin/join-requests/{request_id}/approve', headers=headers(physician_id))
            assert denied.status_code == 403
            approved = await client.post(f'/super-admin/join-requests/{request_id}/approve', headers=headers(admin_id))
            assert approved.status_code == 200, approved.text
            assert approved.json()['status'] == 'approved'
            again = await client.post(f'/super-admin/join-requests/{request_id}/approve', headers=headers(admin_id))
            assert again.status_code == 200
            own = await client.get(f'/clinics/{clinic_id}/completed-questionnaires', headers=headers(operator_id))
            assert own.status_code == 200, own.text
            assert own.json()['total'] == 2
            foreign = await client.get(f'/clinics/{other_id}/completed-questionnaires/{foreign_q_id}', headers=headers(operator_id))
            assert foreign.status_code == 403
            assert (await client.get(f'/clinics/{clinic_id}/members', headers=headers(operator_id))).status_code == 403
            assert (await client.get('/protocols', headers=headers(operator_id))).status_code == 403
            all_q = await client.get('/super-admin/questionnaires', headers=headers(admin_id), params={'name': suffix})
            assert all_q.status_code == 200, all_q.text
            assert all_q.json()['total'] == 3
            assert {row['kind'] for row in all_q.json()['items']} == {'general', 'gastro', 'dental'}
            doctor_request = await client.post('/clinic-join/requests', headers=headers(physician_id), json={
                'token': token, 'requested_role': 'doctor', 'specialization_ids': [specialization_id],
            })
            assert doctor_request.status_code in (200, 201), doctor_request.text
            rival_request = await client.post('/clinic-join/requests', headers=headers(second_physician_id), json={
                'token': token, 'requested_role': 'doctor', 'specialization_ids': [specialization_id],
            })
            assert rival_request.status_code in (200, 201), rival_request.text
            decisions = await asyncio.gather(*[
                client.post(f"/super-admin/join-requests/{item.json()['id']}/approve", headers=headers(admin_id))
                for item in [doctor_request, rival_request]
            ])
            assert sorted(item.status_code for item in decisions) == [200, 409], [item.text for item in decisions]
            expiring_email = f'revoked-{suffix}@example.org'
            assert (await client.post('/auth/clinic-join/register', json={
                'token': token, 'login': expiring_email, 'password': 'Test-password-123',
                'first_name': 'Тест', 'last_name': 'Отозванный', 'requested_role': 'operator', 'specialization_ids': [],
            })).status_code == 200
            assert (await client.delete(f'/super-admin/clinics/{clinic_id}/join-link', headers=headers(admin_id))).status_code in (200, 204)
            assert (await client.get(f'/auth/clinic-join/{token}')).status_code in (404, 410)
            revoked_confirmation = await client.post('/auth/clinic-join/confirm', json={'login': expiring_email, 'code': '1234'})
            assert revoked_confirmation.status_code in (404, 410), revoked_confirmation.text
            assert (await client.get('/clinic-join/me', headers=headers(operator_id))).json()['restricted'] is False
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
