from datetime import date, datetime, timezone
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.clinic import Clinic
from ..models.clinic_join import ClinicJoinLink, ClinicJoinRequest
from ..models.clinic_membership import ClinicMembership
from ..models.service_user import ServiceUser
from ..models.specialization import RefSpecialization
from ..schemas.clinic_join import JoinRequestRead
from .clinic_access import generate_invite_token, hash_invite_token
from .clinic_members import ensure_doctors_limit, set_membership_specializations, unique_membership_public_slug, validate_specialization_ids


def ensure_join_available(clinic):
    if clinic.deleted_at is not None:
        raise HTTPException(404, 'Клиника недоступна')
    if clinic.access_until < date.today():
        raise HTTPException(403, 'Подписка клиники завершена')


def ensure_role_specializations(role, ids):
    if role not in ('operator', 'doctor'):
        raise HTTPException(400, 'Недопустимая роль')
    if (role == 'doctor' and not ids) or (role == 'operator' and ids):
        raise HTTPException(400, 'Выберите специализации только для врача')


async def lock_clinic(db, clinic_id):
    clinic = (await db.execute(select(Clinic).where(Clinic.id == clinic_id).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if clinic is None:
        raise HTTPException(404, 'Клиника не найдена')
    return clinic


async def load_join_link(db, token):
    link = (await db.execute(select(ClinicJoinLink).where(
        ClinicJoinLink.token_hash == hash_invite_token(token), ClinicJoinLink.revoked_at.is_(None),
    ))).scalar_one_or_none()
    if link is None:
        raise HTTPException(404, 'Ссылка подключения недоступна')
    clinic = await lock_clinic(db, link.clinic_id)
    # Lock in clinic -> link order, shared by rotation and request submission.
    link = (await db.execute(select(ClinicJoinLink).where(
        ClinicJoinLink.id == link.id, ClinicJoinLink.revoked_at.is_(None),
    ).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if link is None:
        raise HTTPException(404, 'Ссылка подключения недоступна')
    ensure_join_available(clinic)
    return link, clinic


async def rotate_join_link(db, clinic_id, actor):
    clinic = await lock_clinic(db, clinic_id)
    ensure_join_available(clinic)
    await revoke_join_link(db, clinic_id, commit=False)
    token = generate_invite_token()
    db.add(ClinicJoinLink(clinic_id=clinic_id, token_hash=hash_invite_token(token), created_by=actor.id))
    await db.commit()
    return token


async def revoke_join_link(db, clinic_id, *, commit=True):
    await lock_clinic(db, clinic_id)
    links = (await db.execute(select(ClinicJoinLink).where(
        ClinicJoinLink.clinic_id == clinic_id, ClinicJoinLink.revoked_at.is_(None),
    ).with_for_update())).scalars().all()
    for link in links:
        link.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    if commit:
        await db.commit()


async def create_join_request(db, user, clinic, role, ids):
    # Serialize on user as well: two clinics cannot concurrently approve one account.
    await db.execute(select(ServiceUser.id).where(ServiceUser.id == user.id).with_for_update())
    ensure_role_specializations(role, ids)
    ids = await validate_specialization_ids(db, ids)
    membership = (await db.execute(select(ClinicMembership).where(
        ClinicMembership.user_id == user.id, ClinicMembership.clinic_id == clinic.id,
        ClinicMembership.status == 'active',
        ClinicMembership.deleted_at.is_(None),
    ))).scalar_one_or_none()
    if membership:
        raise HTTPException(409, 'У пользователя уже есть активное членство в клинике')
    pending = (await db.execute(select(ClinicJoinRequest).where(
        ClinicJoinRequest.user_id == user.id, ClinicJoinRequest.clinic_id == clinic.id,
        ClinicJoinRequest.status == 'pending',
    ))).scalar_one_or_none()
    if pending:
        raise HTTPException(409, 'Заявка уже ожидает рассмотрения')
    request = ClinicJoinRequest(clinic_id=clinic.id, user_id=user.id, requested_role=role, specialization_ids=ids)
    db.add(request)
    await db.flush()
    return request


async def read_request(db, request):
    clinic = (await db.execute(select(Clinic).where(Clinic.id == request.clinic_id))).scalar_one()
    user = (await db.execute(select(ServiceUser).where(ServiceUser.id == request.user_id))).scalar_one()
    return JoinRequestRead(
        id=request.id, clinic_id=clinic.id, clinic_name=clinic.name, user_id=user.id,
        email=user.login, first_name=user.first_name, last_name=user.last_name, middle_name=user.middle_name,
        requested_role=request.requested_role, specialization_ids=request.specialization_ids,
        status=request.status, created_at=request.created_at, reviewed_at=request.reviewed_at,
    )


async def review_join_request(db, request_id, actor, decision):
    initial = (await db.execute(select(ClinicJoinRequest).where(ClinicJoinRequest.id == request_id))).scalar_one_or_none()
    if initial is None:
        raise HTTPException(404, 'Заявка не найдена')
    clinic = await lock_clinic(db, initial.clinic_id)
    user = (await db.execute(select(ServiceUser).where(ServiceUser.id == initial.user_id).with_for_update())).scalar_one()
    request = (await db.execute(select(ClinicJoinRequest).where(
        ClinicJoinRequest.id == request_id,
    ).with_for_update().execution_options(populate_existing=True))).scalar_one()
    if request.status != 'pending':
        if request.status != decision:
            raise HTTPException(409, 'Заявка уже рассмотрена')
        return await read_request(db, request)
    if decision == 'approved':
        ensure_join_available(clinic)
        if not user.is_active or user.deleted_at is not None:
            raise HTTPException(409, 'Учётная запись недоступна')
        memberships = (await db.execute(select(ClinicMembership).where(
            ClinicMembership.user_id == user.id, ClinicMembership.status == 'active',
            ClinicMembership.deleted_at.is_(None),
        ).with_for_update())).scalars().all()
        if memberships:
            raise HTTPException(409, 'Пользователь уже состоит в клинике; требуется решение о переводе')
        await ensure_doctors_limit(db, clinic, adding_doctor=request.requested_role == 'doctor')
        ids = await validate_specialization_ids(db, request.specialization_ids)
        ensure_role_specializations(request.requested_role, ids)
        membership = ClinicMembership(
            clinic_id=clinic.id, user_id=user.id, is_clinic_admin=False,
            is_doctor=request.requested_role == 'doctor', is_operator=request.requested_role == 'operator',
            status='active', public_slug=await unique_membership_public_slug(db),
        )
        db.add(membership)
        await db.flush()
        await set_membership_specializations(db, membership.id, ids)
        user.clinic_join_restricted = False
    request.status = decision
    request.reviewed_at = datetime.now(timezone.utc)
    request.reviewed_by = actor.id
    await db.commit()
    return await read_request(db, request)


async def read_requests(db, requests):
    if not requests:
        return []
    clinics = {c.id:c for c in (await db.execute(select(Clinic).where(Clinic.id.in_({r.clinic_id for r in requests})))).scalars().all()}
    users = {u.id:u for u in (await db.execute(select(ServiceUser).where(ServiceUser.id.in_({r.user_id for r in requests})))).scalars().all()}
    return [JoinRequestRead(
        id=r.id, clinic_id=r.clinic_id, clinic_name=clinics[r.clinic_id].name, user_id=r.user_id,
        email=users[r.user_id].login, first_name=users[r.user_id].first_name,
        last_name=users[r.user_id].last_name, middle_name=users[r.user_id].middle_name,
        requested_role=r.requested_role, specialization_ids=r.specialization_ids,
        status=r.status, created_at=r.created_at, reviewed_at=r.reviewed_at,
    ) for r in requests]
