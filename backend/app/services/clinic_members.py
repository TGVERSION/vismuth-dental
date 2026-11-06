import asyncio
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..email import send_clinic_invite
from ..models.clinic import Clinic
from ..models.clinic_invitation import ClinicInvitation
from ..models.clinic_membership import ClinicMembership
from ..models.clinic_membership_specialization import (
    ClinicInvitationSpecialization,
    ClinicMembershipSpecialization,
)
from ..models.service_user import ServiceUser
from ..models.specialization import RefSpecialization
from .clinic_access import (
    build_invite_url,
    generate_invite_token,
    generate_public_slug,
    hash_invite_token,
    invite_expires_at,
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_clinic_or_404(db: AsyncSession, clinic_id: UUID) -> Clinic:
    result = await db.execute(
        select(Clinic).where(
            Clinic.id == clinic_id,
            Clinic.deleted_at.is_(None),
        ).with_for_update().execution_options(populate_existing=True),
    )
    clinic = result.scalar_one_or_none()
    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinic not found",
        )
    return clinic


async def doctors_count(db: AsyncSession, clinic_id: UUID) -> int:
    membership_count = await db.execute(
        select(func.count())
        .select_from(ClinicMembership)
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.is_doctor.is_(True),
            ClinicMembership.status == "active",
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    active = int(membership_count.scalar_one() or 0)

    invited_count = await db.execute(
        select(func.count())
        .select_from(ClinicInvitation)
        .where(
            ClinicInvitation.clinic_id == clinic_id,
            ClinicInvitation.is_doctor.is_(True),
            ClinicInvitation.used_at.is_(None),
            ClinicInvitation.deleted_at.is_(None),
            ClinicInvitation.expires_at > datetime.now(timezone.utc),
        ),
    )
    invited = int(invited_count.scalar_one() or 0)
    return active + invited


async def active_doctors_count(db: AsyncSession, clinic_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ClinicMembership)
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.is_doctor.is_(True),
            ClinicMembership.status == "active",
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    return int(result.scalar_one() or 0)


async def ensure_doctors_limit(
    db: AsyncSession,
    clinic: Clinic,
    *,
    adding_doctor: bool,
) -> None:
    if not adding_doctor:
        return
    count = await doctors_count(db, clinic.id)
    if count >= clinic.doctors_limit:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Лимит {clinic.doctors_limit} из {clinic.doctors_limit}, "
                "обратитесь к администратору"
            ),
        )


async def unique_membership_public_slug(db: AsyncSession) -> str:
    for _ in range(20):
        slug = generate_public_slug()
        exists = await db.execute(
            select(ClinicMembership.id).where(ClinicMembership.public_slug == slug),
        )
        if exists.scalar_one_or_none() is None:
            clinic_slug = await db.execute(
                select(Clinic.id).where(Clinic.public_slug == slug),
            )
            if clinic_slug.scalar_one_or_none() is None:
                return slug
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate unique public_slug",
    )


async def validate_specialization_ids(
    db: AsyncSession,
    specialization_ids: list[int],
) -> list[int]:
    if not specialization_ids:
        return []
    unique_ids = list(dict.fromkeys(specialization_ids))
    result = await db.execute(
        select(RefSpecialization.id).where(RefSpecialization.id.in_(unique_ids)),
    )
    found = {row[0] for row in result.all() if row[0] is not None}
    missing = [sid for sid in unique_ids if sid not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown specialization ids: {missing}",
        )
    return unique_ids


async def set_invitation_specializations(
    db: AsyncSession,
    invitation_id: UUID,
    specialization_ids: list[int],
) -> None:
    await db.execute(
        delete(ClinicInvitationSpecialization).where(
            ClinicInvitationSpecialization.invitation_id == invitation_id,
        ),
    )
    for sid in specialization_ids:
        db.add(
            ClinicInvitationSpecialization(
                invitation_id=invitation_id,
                specialization_id=sid,
            ),
        )


async def set_membership_specializations(
    db: AsyncSession,
    membership_id: UUID,
    specialization_ids: list[int],
) -> None:
    await db.execute(
        delete(ClinicMembershipSpecialization).where(
            ClinicMembershipSpecialization.membership_id == membership_id,
        ),
    )
    for sid in specialization_ids:
        db.add(
            ClinicMembershipSpecialization(
                membership_id=membership_id,
                specialization_id=sid,
            ),
        )


async def load_specializations_map(
    db: AsyncSession,
    *,
    membership_ids: list[UUID] | None = None,
    invitation_ids: list[UUID] | None = None,
) -> tuple[dict[UUID, list[dict]], dict[UUID, list[dict]]]:
    membership_map: dict[UUID, list[dict]] = {}
    invitation_map: dict[UUID, list[dict]] = {}

    if membership_ids:
        result = await db.execute(
            select(
                ClinicMembershipSpecialization.membership_id,
                RefSpecialization.id,
                RefSpecialization.code,
                RefSpecialization.name,
            )
            .join(
                RefSpecialization,
                RefSpecialization.id
                == ClinicMembershipSpecialization.specialization_id,
            )
            .where(
                ClinicMembershipSpecialization.membership_id.in_(membership_ids),
            )
            .order_by(RefSpecialization.name),
        )
        for membership_id, sid, code, name in result.all():
            membership_map.setdefault(membership_id, []).append(
                {"id": sid, "code": code, "name": name},
            )

    if invitation_ids:
        result = await db.execute(
            select(
                ClinicInvitationSpecialization.invitation_id,
                RefSpecialization.id,
                RefSpecialization.code,
                RefSpecialization.name,
            )
            .join(
                RefSpecialization,
                RefSpecialization.id
                == ClinicInvitationSpecialization.specialization_id,
            )
            .where(
                ClinicInvitationSpecialization.invitation_id.in_(invitation_ids),
            )
            .order_by(RefSpecialization.name),
        )
        for invitation_id, sid, code, name in result.all():
            invitation_map.setdefault(invitation_id, []).append(
                {"id": sid, "code": code, "name": name},
            )

    return membership_map, invitation_map


async def send_invite_email(
    email: str,
    clinic_name: str,
    invite_url: str,
) -> tuple[bool, str | None]:
    try:
        await asyncio.to_thread(send_clinic_invite, email, clinic_name, invite_url)
        return True, None
    except Exception as e:
        return False, str(e)


async def create_invitation(
    db: AsyncSession,
    *,
    clinic: Clinic,
    created_by_user_id: UUID,
    email: str,
    first_name: str | None,
    last_name: str | None,
    middle_name: str | None,
    photo_url: str | None,
    is_clinic_admin: bool,
    is_doctor: bool,
    specialization_ids: list[int],
) -> tuple[ClinicInvitation, str, bool, str | None]:
    clinic = await get_clinic_or_404(db, clinic.id)
    if not is_clinic_admin and not is_doctor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation must have is_clinic_admin or is_doctor",
        )

    email_norm = normalize_email(email)
    existing_user = await db.execute(
        select(ServiceUser.id).where(
            func.lower(ServiceUser.login) == email_norm,
            ServiceUser.deleted_at.is_(None),
        ),
    )
    if existing_user.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    pending = await db.execute(
        select(ClinicInvitation).where(
            ClinicInvitation.clinic_id == clinic.id,
            func.lower(ClinicInvitation.email) == email_norm,
            ClinicInvitation.used_at.is_(None),
            ClinicInvitation.deleted_at.is_(None),
        ),
    )
    if pending.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pending invitation for this email already exists",
        )

    await ensure_doctors_limit(db, clinic, adding_doctor=is_doctor)
    validated_specs = await validate_specialization_ids(db, specialization_ids)
    if is_doctor and not validated_specs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor invitation requires at least one specialization",
        )

    raw_token = generate_invite_token()
    now = datetime.now(timezone.utc)
    invitation = ClinicInvitation(
        clinic_id=clinic.id,
        email=email_norm,
        first_name=first_name,
        last_name=last_name,
        middle_name=middle_name,
        photo_url=photo_url,
        token_hash=hash_invite_token(raw_token),
        is_clinic_admin=is_clinic_admin,
        is_doctor=is_doctor,
        expires_at=invite_expires_at(now),
        created_by_user_id=created_by_user_id,
        created_at=now,
    )
    db.add(invitation)
    try:
        await db.flush()
        await set_invitation_specializations(db, invitation.id, validated_specs)
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invitation conflict",
        ) from e
    await db.refresh(invitation)

    invite_url = build_invite_url(raw_token)
    email_sent, email_error = await send_invite_email(
        email_norm,
        clinic.name,
        invite_url,
    )
    return invitation, invite_url, email_sent, email_error


async def resend_invitation(
    db: AsyncSession,
    *,
    clinic: Clinic,
    invitation: ClinicInvitation,
) -> tuple[ClinicInvitation, str, bool, str | None]:
    clinic = await get_clinic_or_404(db, clinic.id)
    await ensure_doctors_limit(db, clinic, adding_doctor=invitation.is_doctor and invitation.expires_at <= datetime.now(timezone.utc))
    if invitation.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation already used",
        )

    raw_token = generate_invite_token()
    now = datetime.now(timezone.utc)
    invitation.token_hash = hash_invite_token(raw_token)
    invitation.expires_at = invite_expires_at(now)
    invitation.updated_at = now
    await db.commit()
    await db.refresh(invitation)

    invite_url = build_invite_url(raw_token)
    email_sent, email_error = await send_invite_email(
        invitation.email,
        clinic.name,
        invite_url,
    )
    return invitation, invite_url, email_sent, email_error


async def deactivate_membership(
    db: AsyncSession,
    membership: ClinicMembership,
) -> ClinicMembership:
    now = datetime.now(timezone.utc)
    membership.status = "deactivated"
    membership.updated_at = now

    user_result = await db.execute(
        select(ServiceUser).where(ServiceUser.id == membership.user_id),
    )
    user = user_result.scalar_one_or_none()
    if user is not None:
        user.is_active = False
        user.updated_at = now

    await db.commit()
    await db.refresh(membership)
    return membership
