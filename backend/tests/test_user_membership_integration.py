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


def test_super_admin_transfers_preserve_history_and_enforce_operator_rights():
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
        for key, role in [('root', 'super_admin'), ('legacy', 'admin'), ('patient', 'patient'), ('worker', 'doctor'), ('rival', 'doctor')]:
            user = ServiceUser(login=f'{key}-{suffix}@example.test', password_hash='unused')
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
            assert row['clinic_id'] == str(first) and row['clinic_role'] == 'doctor'
            assert (await client.get('/super-admin/users', headers=headers('legacy'))).status_code == 403
            roles = await client.get('/super-admin/user-membership-roles', headers=headers('root'))
            assert roles.status_code == 200
            assert any(row['value'] == 'operator' and row['label'] == 'Оператор контакт-центра' for row in roles.json())
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
            for key in ['root','legacy','patient']:
                rejected = await client.put(f"/super-admin/users/{users[key]}/membership", headers=headers('root'), json=payload)
                assert rejected.status_code == 409, rejected.text
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
