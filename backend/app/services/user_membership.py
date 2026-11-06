"""Super-admin clinic assignment, retaining the original membership of old questionnaires."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.clinic import Clinic
from ..models.clinic_membership import ClinicMembership
from ..models.service_user import ServiceUser
from ..schemas.user_membership import UserMembershipRead, UserMembershipUpdate
from .clinic_join import ensure_join_available, lock_clinic
from .clinic_members import ensure_doctors_limit, load_specializations_map, set_membership_specializations, unique_membership_public_slug, validate_specialization_ids
from .roles import user_role_load_options


def membership_role(membership):
    if membership.is_clinic_admin:
        return 'clinic_admin_doctor' if membership.is_doctor else 'clinic_admin'
    return 'doctor' if membership.is_doctor else 'operator'


async def list_user_memberships(db: AsyncSession, user_id: UUID | None = None):
    users_stmt = select(ServiceUser).options(*user_role_load_options()).where(ServiceUser.deleted_at.is_(None))
    if user_id is not None:
        users_stmt = users_stmt.where(ServiceUser.id == user_id)
    users = (await db.execute(users_stmt.order_by(ServiceUser.created_at.desc(), ServiceUser.id))).scalars().all()
    if not users:
        return []
    rows = (await db.execute(select(ClinicMembership, Clinic).join(Clinic, Clinic.id == ClinicMembership.clinic_id).where(
        ClinicMembership.user_id.in_([user.id for user in users]),
        ClinicMembership.status == 'active', ClinicMembership.deleted_at.is_(None),
    ))).all()
    memberships = {}
    for member, clinic in rows:
        if member.user_id in memberships:
            raise HTTPException(409, 'У пользователя несколько активных клиник; требуется исправление членства')
        memberships[member.user_id] = (member, clinic)
    specs, _ = await load_specializations_map(db, membership_ids=[member.id for member, _ in rows])
    result = []
    for user in users:
        pair = memberships.get(user.id)
        member, clinic = pair if pair else (None, None)
        result.append(UserMembershipRead(
            id=user.id, login=user.login, role=user.role, role_name_ru=user.role_name_ru, is_active=user.is_active,
            first_name=user.first_name, last_name=user.last_name, middle_name=user.middle_name,
            clinic_id=clinic.id if clinic else None, clinic_name=clinic.name if clinic else None,
            membership_id=member.id if member else None, clinic_role=membership_role(member) if member else None,
            specialization_ids=[row['id'] for row in specs.get(member.id, [])] if member and member.is_doctor else [],
        ))
    return result


async def assign_user_membership(db: AsyncSession, user_id: UUID, payload: UserMembershipUpdate):
    # Approval/invitation paths lock the target clinic before the user. Only the
    # target clinic needs a capacity lock: leaving another clinic frees a slot.
    clinic = None
    if payload.clinic_id is not None:
        clinic = await lock_clinic(db, payload.clinic_id)
        ensure_join_available(clinic)
    user = (await db.execute(select(ServiceUser).options(*user_role_load_options()).where(
        ServiceUser.id == user_id, ServiceUser.deleted_at.is_(None),
    ).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, 'Пользователь не найден')
    if user.role != 'doctor':
        raise HTTPException(409, 'Сначала назначьте пользователю платформенную роль «Врач»; супер-администратору клиника не назначается')
    if not user.is_active:
        raise HTTPException(409, 'Учётная запись отключена')
    memberships = (await db.execute(select(ClinicMembership).where(
        ClinicMembership.user_id == user_id, ClinicMembership.deleted_at.is_(None),
    ).with_for_update().execution_options(populate_existing=True))).scalars().all()
    target = next((row for row in memberships if row.clinic_id == payload.clinic_id), None)
    doctor = payload.clinic_role in ('doctor', 'clinic_admin_doctor')
    ids = await validate_specialization_ids(db, payload.specialization_ids)
    if clinic:
        await ensure_doctors_limit(db, clinic, adding_doctor=doctor and not (
            target is not None and target.status == 'active' and target.is_doctor
        ))
    now = datetime.now(timezone.utc)
    for membership in memberships:
        if membership is not target and membership.status == 'active':
            membership.status = 'deactivated'
            membership.updated_at = now
    if clinic:
        if target is None:
            target = ClinicMembership(clinic_id=clinic.id, user_id=user.id, public_slug=await unique_membership_public_slug(db))
            db.add(target)
        target.status = 'active'
        target.is_doctor = doctor
        target.is_operator = payload.clinic_role == 'operator'
        target.is_clinic_admin = payload.clinic_role in ('clinic_admin', 'clinic_admin_doctor')
        target.updated_at = now
        await db.flush()
        await set_membership_specializations(db, target.id, ids)
    user.clinic_join_restricted = clinic is None
    user.updated_at = now
    await db.commit()
    return (await list_user_memberships(db, user_id))[0]
