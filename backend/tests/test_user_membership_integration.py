"""Membership transfers against an explicitly isolated local PostgreSQL database."""

import asyncio
import os
from datetime import date, timedelta
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import Base, get_db
from app.main import app
from app.models import Clinic, ClinicMembership, Questionnaire, RefSpecialization, Role, ServiceUser
from app.security import create_access_token
from app.services.roles import set_user_role


TEST_URL = os.getenv('CLINIC_JOIN_TEST_DATABASE_URL')
pytestmark = pytest.mark.skipif(not TEST_URL, reason='Requires isolated PostgreSQL CLINIC_JOIN_TEST_DATABASE_URL')


def test_super_admin_transfers_preserve_history_and_enforce_operator_rights(monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import clinic_members
    from app.routers import clinic_join
    monkeypatch.setattr(clinic_members, 'send_invite_email', AsyncMock(return_value=(True, None)))
    monkeypatch.setattr(clinic_join, 'check_join_rate', AsyncMock())
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

    suffix = uuid4().hex[:10]
    async with sessions() as db:
        existing_roles = set((await db.execute(select(Role.name))).scalars())
        db.add_all([Role(name=name, name_ru=name) for name in ['doctor', 'super_admin', 'admin', 'patient'] if name not in existing_roles])
        await db.flush()
        users = {}
        for key, role in [('root', 'super_admin'), ('legacy', 'admin'), ('patient', 'patient'), ('worker', 'doctor'), ('rival', 'doctor'), ('applicant','doctor')]:
            user = ServiceUser(login=f'{key}-{suffix}@example.test', password_hash='unused',
                               first_name='Иван', last_name='Тестовый', middle_name='Иванович', clinic_join_restricted=key=='applicant')
            db.add(user)
            await db.flush()
            await set_user_role(db, user, role)
            users[key] = user.id
        clinics = [Clinic(name=f'User transfer {suffix} {index}', public_slug=f'transfer-{suffix}-{index}', access_type='trial', access_until=date.today()+timedelta(days=30), questionnaire_kind='mixed', doctors_limit=1) for index in range(2)]
        db.add_all(clinics)
        await db.flush()
        specialization = RefSpecialization(id=int(uuid4().hex[:7],16), name=f'Transfer specialization {suffix}')
        db.add(specialization)
        old = ClinicMembership(clinic_id=clinics[0].id, user_id=users['worker'], is_doctor=True, is_operator=False, is_clinic_admin=False, status='active', public_slug=f'old-{suffix}')
        db.add(old)
        await db.flush()
        historical = Questionnaire(clinic_id=clinics[0].id, doctor_membership_id=old.id, status='completed', session_token_hash=uuid4().hex)
        db.add(historical)
        await db.commit()
        old_id, questionnaire_id = old.id, historical.id
        first, second, spec = clinics[0].id, clinics[1].id, specialization.id

    def headers(key):
        return {'Authorization': f'Bearer {create_access_token(users[key])}'}

    app.dependency_overrides[get_db] = test_db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            overview = await client.get('/super-admin/users', headers=headers('root'))
            assert overview.status_code == 200, overview.text
            row = next(row for row in overview.json() if row['id'] == str(users['worker']))
            assert [row.get(key) for key in ['last_name', 'first_name', 'middle_name']] == ['Тестовый', 'Иван', 'Иванович']
            assert row['clinic_id'] == str(first) and row['clinic_role'] == 'doctor'
            assert (await client.get('/super-admin/users', headers=headers('legacy'))).status_code == 403
            roles = await client.get('/super-admin/user-membership-roles', headers=headers('root'))
            assert roles.status_code == 200
            assert [row['label'] for row in roles.json()] == ['Админ', 'Админ и врач', 'Врач', 'Оператор контакт-центра / Регистратор']
            join_link = (await client.post(f'/super-admin/clinics/{first}/join-link', headers=headers('root'))).json()['url'].rsplit('/',1)[-1]
            own_root_request = await client.post('/clinic-join/requests', headers=headers('root'), json={
                'token':join_link, 'requested_role':'clinic_admin', 'specialization_ids':[],
            })
            assert own_root_request.status_code == 409
            from app.models import ClinicJoinRequest
            async with sessions() as db:
                stale_request = ClinicJoinRequest(clinic_id=first, user_id=users['root'], requested_role='clinic_admin', specialization_ids=[])
                db.add(stale_request); await db.commit(); stale_id=stale_request.id
            protected = await client.post(f'/super-admin/join-requests/{stale_id}/approve', headers=headers('root'))
            assert protected.status_code == 409
            assert (await client.get('/super-admin/users',headers=headers('root'))).status_code == 200
            admin_request = await client.post('/clinic-join/requests', headers=headers('applicant'), json={
                'token':join_link, 'requested_role':'clinic_admin', 'specialization_ids':[],
            })
            assert admin_request.status_code in (200,201), admin_request.text
            assert (await client.get(f'/clinics/{first}/members', headers=headers('applicant'))).status_code == 403
            approved = await client.post(f"/super-admin/join-requests/{admin_request.json()['id']}/approve", headers=headers('root'))
            assert approved.status_code == 200, approved.text
            assert (await client.get(f'/clinics/{first}/members', headers=headers('applicant'))).status_code == 200
            assert (await client.get('/protocols', headers=headers('applicant'))).status_code == 403
            invited = await client.post(f'/super-admin/clinics/{first}/invitations', headers=headers('root'), json={
                'email':f'operator-invite-{suffix}@example.org', 'is_clinic_admin':False, 'is_doctor':False,
                'is_operator':True, 'specialization_ids':[],
            })
            assert invited.status_code == 201, invited.text
            from urllib.parse import urlparse, parse_qs
            invite_token = parse_qs(urlparse(invited.json()['invite_url']).query)['token'][0]
            accepted = await client.post('/auth/invitations/accept', json={'token':invite_token, 'password':'Operator-test-password-123'})
            assert accepted.status_code == 200, accepted.text
            invited_headers = {'Authorization':'Bearer '+accepted.json()['access_token']}
            invited_member = (await client.get('/me/clinic', headers=invited_headers)).json()
            assert invited_member['is_operator'] and not invited_member['is_doctor'] and not invited_member['is_clinic_admin']
            assert (await client.get('/protocols', headers=invited_headers)).status_code == 403
            assert (await client.get(f'/clinics/{first}/completed-questionnaires', headers=invited_headers)).status_code == 200
            endpoint = f"/super-admin/users/{users['worker']}/membership"
            payload = {'clinic_id': str(second), 'clinic_role': 'operator', 'specialization_ids': []}
            assert (await client.put(endpoint, headers=headers('legacy'), json=payload)).status_code == 403
            assert (await client.put(endpoint, headers=headers('worker'), json=payload)).status_code == 403
            changed = await client.put(endpoint, headers=headers('root'), json=payload)
            assert changed.status_code == 200, changed.text
            assert changed.json()['clinic_id'] == str(second) and changed.json()['clinic_role'] == 'operator'
            assert (await client.get(f'/clinics/{first}/completed-questionnaires', headers=headers('worker'))).status_code == 403
            assert (await client.get(f'/clinics/{second}/completed-questionnaires', headers=headers('worker'))).status_code == 200
            assert (await client.get('/protocols', headers=headers('worker'))).status_code == 403
            assert (await client.get(f'/clinics/{second}/members', headers=headers('worker'))).status_code == 403
            old_link = await client.get(f'/public/links/old-{suffix}')
            assert old_link.status_code == 200 and old_link.json()['blocked'] is True
            async with sessions() as db:
                prior = await db.get(ClinicMembership, old_id)
                q = await db.get(Questionnaire, questionnaire_id)
                assert prior.clinic_id == first and prior.status == 'deactivated'
                assert q.clinic_id == first and q.doctor_membership_id == old_id
            # Bad payload or full clinic must leave the old access unchanged.
            invalid = {**payload, 'clinic_role':'doctor', 'specialization_ids':[]}
            assert (await client.put(endpoint, headers=headers('root'), json=invalid)).status_code == 422
            invalid = {**payload, 'specialization_ids':[spec]}
            assert (await client.put(endpoint, headers=headers('root'), json=invalid)).status_code == 422
            unknown_spec = {**payload, 'clinic_role':'doctor', 'specialization_ids':[-1]}
            assert (await client.put(endpoint, headers=headers('root'), json=unknown_spec)).status_code == 400
            rival = f"/super-admin/users/{users['rival']}/membership"
            doctor_payload = {'clinic_id':str(second), 'clinic_role':'doctor', 'specialization_ids':[spec]}
            assert (await client.put(rival, headers=headers('root'), json=doctor_payload)).status_code == 200
            full = await client.put(endpoint, headers=headers('root'), json=doctor_payload)
            assert full.status_code == 409, full.text
            assert (await client.get(f'/clinics/{second}/completed-questionnaires', headers=headers('worker'))).status_code == 200
            # Reusing one's own doctor slot must be possible at the limit.
            assert (await client.put(rival, headers=headers('root'), json=doctor_payload)).status_code == 200
            # Same account concurrently transferred to two clinics still has one active membership.
            results = await asyncio.gather(*[client.put(endpoint, headers=headers('root'), json={**payload,'clinic_id':str(target)}) for target in [first,second]])
            assert all(response.status_code == 200 for response in results), [response.text for response in results]
            async with sessions() as db:
                active = (await db.execute(select(ClinicMembership).where(ClinicMembership.user_id==users['worker'], ClinicMembership.status=='active', ClinicMembership.deleted_at.is_(None)))).scalars().all()
                assert len(active) == 1
            # Detaching closes working and clinical APIs, including existing tokens.
            detached = await client.put(endpoint, headers=headers('root'), json={'clinic_id':None,'clinic_role':None,'specialization_ids':[]})
            assert detached.status_code == 200 and detached.json()['clinic_id'] is None
            assert (await client.get('/protocols', headers=headers('worker'))).status_code == 403
            assert (await client.get('/clinic-join/me', headers=headers('worker'))).json()['restricted'] is True
            restored = await client.put(endpoint, headers=headers('root'), json={'clinic_id':str(first),'clinic_role':'doctor','specialization_ids':[spec]})
            assert restored.status_code == 200 and restored.json()['membership_id'] == str(old_id)
            assert (await client.get('/questionnaires', headers=headers('worker'))).status_code == 200
            assert (await client.get('/clinic-join/me', headers=headers('worker'))).json()['restricted'] is False
            # Switching the same membership to an operator removes clinical tools immediately.
            same_clinic = await client.put(endpoint, headers=headers('root'), json={**payload,'clinic_id':str(first)})
            assert same_clinic.status_code == 200 and same_clinic.json()['membership_id'] == str(old_id)
            assert (await client.get('/protocols', headers=headers('worker'))).status_code == 403
            # Assignment cannot quietly bypass the operator barrier through a privileged platform role.
            for key in ['root']:
                rejected = await client.put(f"/super-admin/users/{users[key]}/membership", headers=headers('root'), json=payload)
                assert rejected.status_code == 409, rejected.text
            for key in ['legacy', 'patient']:
                converted = await client.put(f"/super-admin/users/{users[key]}/membership", headers=headers('root'), json=payload)
                assert converted.status_code == 200 and converted.json()['role'] == 'doctor', converted.text
                assert (await client.get('/protocols', headers=headers(key))).status_code == 403
                assert (await client.get('/service_user_ids', headers=headers(key))).status_code == 403
            admin_only = await client.put(endpoint, headers=headers('root'), json={**payload, 'clinic_role':'clinic_admin'})
            assert admin_only.status_code == 200
            assert (await client.get('/protocols', headers=headers('worker'))).status_code == 403
            assert (await client.get(f'/clinics/{second}/members', headers=headers('worker'))).status_code == 200
            # A target that expired or does not exist cannot gain an assignment.
            async with sessions() as db:
                expired = await db.get(Clinic, first)
                expired.access_until = date.today()-timedelta(days=1)
                await db.commit()
            assert (await client.put(endpoint, headers=headers('root'), json={**payload,'clinic_id':str(first)})).status_code == 403
            assert (await client.put(endpoint, headers=headers('root'), json={**payload,'clinic_id':str(uuid4())})).status_code == 404
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
