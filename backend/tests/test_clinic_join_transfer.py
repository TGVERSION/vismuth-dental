"""Transfer requests preserve existing access, but cannot approve automatic transfer."""
import asyncio
from datetime import date, timedelta
import os
from uuid import uuid4
import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db import Base
from app.models import Clinic, ClinicMembership, ServiceUser
from app.services.clinic_join import create_join_request, lock_clinic, review_join_request

TEST_URL=os.getenv('CLINIC_JOIN_TEST_DATABASE_URL')
pytestmark=pytest.mark.skipif(not TEST_URL,reason='Requires isolated local PostgreSQL')


def test_other_clinic_employee_can_request_without_losing_access_but_cannot_transfer():
    asyncio.run(_exercise())


async def _exercise():
    assert TEST_URL and '/clinic_join_test' in TEST_URL and '127.0.0.1:' in TEST_URL
    engine=create_async_engine(TEST_URL)
    sessions=async_sessionmaker(engine,expire_on_commit=False)
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as db:
            suffix=uuid4().hex
            user=ServiceUser(login=f'transfer-{suffix}@example.test',password_hash='unused',clinic_join_restricted=False)
            admin=ServiceUser(login=f'reviewer-{suffix}@example.test',password_hash='unused')
            old=Clinic(name='Original',public_slug=uuid4().hex,access_type='trial',access_until=date.today()+timedelta(days=3))
            new=Clinic(name='Requested',public_slug=uuid4().hex,access_type='trial',access_until=date.today()+timedelta(days=3))
            db.add_all([user,admin,old,new])
            await db.flush()
            membership=ClinicMembership(user_id=user.id,clinic_id=old.id,is_doctor=True,status='active',public_slug=uuid4().hex)
            db.add(membership)
            await db.commit()
            await lock_clinic(db,new.id)
            request=await create_join_request(db,user,new,'operator',[])
            await db.commit()
            assert request.status == 'pending'
            assert user.clinic_join_restricted is False
            assert membership.status == 'active'
            with pytest.raises(HTTPException) as error:
                await review_join_request(db,request.id,admin,'approved')
            assert error.value.status_code == 409
            assert request.status == 'pending'
            await db.rollback()
    finally:
        await engine.dispose()
