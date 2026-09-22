import asyncio
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_db
from ...deps import require_roles
from ...email import send_clinic_invite
from ...models.clinic import Clinic
from ...models.clinic_invitation import ClinicInvitation
from ...models.clinic_membership import ClinicMembership
from ...models.service_user import ServiceUser
from ...schemas.clinic import (
    ClinicCreate,
    ClinicInvitationCreate,
    ClinicInvitationCreated,
    ClinicInvitationRead,
    ClinicPatch,
    ClinicRead,
)
from ...services.clinic_access import (
    build_invite_url,
    clinic_to_read_fields,
    generate_invite_token,
    generate_public_slug,
    hash_invite_token,
    invite_expires_at,
)

router = APIRouter(prefix="/super-admin/clinics", tags=["super-admin-clinics"])

require_super_admin = require_roles("super_admin")


def _normalize_email(email: str) -> str:
    return email.strip().lower()


async def _get_clinic_or_404(db: AsyncSession, clinic_id: UUID) -> Clinic:
    result = await db.execute(
        select(Clinic).where(
            Clinic.id == clinic_id,
            Clinic.deleted_at.is_(None),
        ),
    )
    clinic = result.scalar_one_or_none()
    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinic not found",
        )
    return clinic


async def _doctors_count(db: AsyncSession, clinic_id: UUID) -> int:
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


async def _unique_public_slug(db: AsyncSession) -> str:
    for _ in range(20):
        slug = generate_public_slug()
        exists = await db.execute(
            select(Clinic.id).where(Clinic.public_slug == slug),
        )
        if exists.scalar_one_or_none() is None:
            return slug
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate unique public_slug",
    )


def _to_clinic_read(clinic: Clinic, doctors_count: int) -> ClinicRead:
    return ClinicRead.model_validate(clinic_to_read_fields(clinic, doctors_count))


async def _send_invite_email(
    email: str,
    clinic_name: str,
    invite_url: str,
) -> tuple[bool, str | None]:
    try:
        await asyncio.to_thread(send_clinic_invite, email, clinic_name, invite_url)
        return True, None
    except Exception as e:
        return False, str(e)


@router.post("", response_model=ClinicRead, status_code=status.HTTP_201_CREATED)
async def create_clinic(
    payload: ClinicCreate,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicRead:
    now = datetime.now(timezone.utc)
    clinic = Clinic(
        name=payload.name.strip(),
        phone=payload.phone,
        email=_normalize_email(str(payload.email)) if payload.email else None,
        logo_url=payload.logo_url,
        brand_color=payload.brand_color,
        doctors_limit=payload.doctors_limit,
        access_until=payload.access_until,
        access_type=payload.access_type,
        public_slug=await _unique_public_slug(db),
        created_at=now,
    )
    db.add(clinic)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Clinic conflict",
        ) from e
    await db.refresh(clinic)
    return _to_clinic_read(clinic, 0)


@router.get("", response_model=List[ClinicRead])
async def list_clinics(
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> List[ClinicRead]:
    result = await db.execute(
        select(Clinic)
        .where(Clinic.deleted_at.is_(None))
        .order_by(Clinic.created_at.desc()),
    )
    clinics = list(result.scalars().all())
    out: List[ClinicRead] = []
    for clinic in clinics:
        count = await _doctors_count(db, clinic.id)
        out.append(_to_clinic_read(clinic, count))
    return out


@router.get("/{clinic_id}", response_model=ClinicRead)
async def get_clinic(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicRead:
    clinic = await _get_clinic_or_404(db, clinic_id)
    count = await _doctors_count(db, clinic.id)
    return _to_clinic_read(clinic, count)


@router.patch("/{clinic_id}", response_model=ClinicRead)
async def patch_clinic(
    clinic_id: UUID,
    payload: ClinicPatch,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicRead:
    clinic = await _get_clinic_or_404(db, clinic_id)
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = _normalize_email(str(data["email"]))
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()

    for key, value in data.items():
        setattr(clinic, key, value)
    clinic.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(clinic)
    count = await _doctors_count(db, clinic.id)
    return _to_clinic_read(clinic, count)


@router.delete("/{clinic_id}", response_model=ClinicRead)
async def delete_clinic(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicRead:
    clinic = await _get_clinic_or_404(db, clinic_id)
    now = datetime.now(timezone.utc)
    clinic.deleted_at = now
    clinic.updated_at = now
    await db.commit()
    await db.refresh(clinic)
    count = await _doctors_count(db, clinic.id)
    return _to_clinic_read(clinic, count)


@router.post(
    "/{clinic_id}/invitations",
    response_model=ClinicInvitationCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    clinic_id: UUID,
    payload: ClinicInvitationCreate,
    current_user: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicInvitationCreated:
    if not payload.is_clinic_admin and not payload.is_doctor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation must have is_clinic_admin or is_doctor",
        )

    clinic = await _get_clinic_or_404(db, clinic_id)
    email_norm = _normalize_email(str(payload.email))

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
            ClinicInvitation.clinic_id == clinic_id,
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

    raw_token = generate_invite_token()
    now = datetime.now(timezone.utc)
    invitation = ClinicInvitation(
        clinic_id=clinic.id,
        email=email_norm,
        first_name=payload.first_name,
        last_name=payload.last_name,
        token_hash=hash_invite_token(raw_token),
        is_clinic_admin=payload.is_clinic_admin,
        is_doctor=payload.is_doctor,
        expires_at=invite_expires_at(now),
        created_by_user_id=current_user.id,
        created_at=now,
    )
    db.add(invitation)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invitation conflict",
        ) from e
    await db.refresh(invitation)

    invite_url = build_invite_url(raw_token)
    email_sent, email_error = await _send_invite_email(
        email_norm,
        clinic.name,
        invite_url,
    )

    base = ClinicInvitationRead.model_validate(invitation)
    return ClinicInvitationCreated(
        **base.model_dump(),
        invite_url=invite_url,
        email_sent=email_sent,
        email_error=email_error,
    )


@router.get(
    "/{clinic_id}/invitations",
    response_model=List[ClinicInvitationRead],
)
async def list_invitations(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> List[ClinicInvitationRead]:
    await _get_clinic_or_404(db, clinic_id)
    result = await db.execute(
        select(ClinicInvitation)
        .where(
            ClinicInvitation.clinic_id == clinic_id,
            ClinicInvitation.deleted_at.is_(None),
        )
        .order_by(ClinicInvitation.created_at.desc()),
    )
    return list(result.scalars().all())


@router.post(
    "/{clinic_id}/invitations/{invitation_id}/resend",
    response_model=ClinicInvitationCreated,
)
async def resend_invitation(
    clinic_id: UUID,
    invitation_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicInvitationCreated:
    clinic = await _get_clinic_or_404(db, clinic_id)
    result = await db.execute(
        select(ClinicInvitation).where(
            ClinicInvitation.id == invitation_id,
            ClinicInvitation.clinic_id == clinic_id,
            ClinicInvitation.deleted_at.is_(None),
        ),
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )
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
    email_sent, email_error = await _send_invite_email(
        invitation.email,
        clinic.name,
        invite_url,
    )

    base = ClinicInvitationRead.model_validate(invitation)
    return ClinicInvitationCreated(
        **base.model_dump(),
        invite_url=invite_url,
        email_sent=email_sent,
        email_error=email_error,
    )
