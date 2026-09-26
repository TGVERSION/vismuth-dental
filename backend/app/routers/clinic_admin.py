from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..deps import get_current_user, require_clinic_admin
from ..models.clinic import Clinic
from ..models.clinic_invitation import ClinicInvitation
from ..models.clinic_membership import ClinicMembership
from ..models.service_user import ServiceUser
from ..models.specialization import RefSpecialization
from ..schemas.clinic_admin import (
    ClinicAdminPatch,
    ClinicAdminRead,
    ClinicInvitationAdminCreated,
    ClinicMemberInviteCreate,
    ClinicMemberPatch,
    ClinicMemberRead,
    MyClinicRead,
    SpecializationRead,
)
from ..services.clinic_access import clinic_to_read_fields
from ..services.clinic_members import (
    create_invitation,
    deactivate_membership,
    doctors_count,
    get_clinic_or_404,
    load_specializations_map,
    resend_invitation,
    set_membership_specializations,
    validate_specialization_ids,
)

router = APIRouter(tags=["clinic-admin"])


def _public_url(slug: str) -> str:
    base = settings.frontend_public_url.rstrip("/")
    return f"{base}/q/{slug}"


@router.get("/specializations", response_model=List[SpecializationRead])
async def list_specializations(
    _: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[SpecializationRead]:
    result = await db.execute(
        select(RefSpecialization).order_by(RefSpecialization.name),
    )
    rows = result.scalars().all()
    return [
        SpecializationRead(id=row.id, code=row.code, name=row.name)
        for row in rows
        if row.id is not None
    ]


@router.get("/me/clinic", response_model=MyClinicRead)
async def my_clinic(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MyClinicRead:
    result = await db.execute(
        select(ClinicMembership, Clinic)
        .join(Clinic, Clinic.id == ClinicMembership.clinic_id)
        .where(
            ClinicMembership.user_id == current_user.id,
            ClinicMembership.status == "active",
            ClinicMembership.deleted_at.is_(None),
            Clinic.deleted_at.is_(None),
        ),
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinic membership not found",
        )
    membership, clinic = row
    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=[membership.id],
    )
    specs = [
        SpecializationRead(**item)
        for item in membership_map.get(membership.id, [])
    ]
    doctor_slug = membership.public_slug if membership.is_doctor else None
    return MyClinicRead(
        clinic_id=clinic.id,
        clinic_name=clinic.name,
        clinic_public_slug=clinic.public_slug,
        clinic_public_url=_public_url(clinic.public_slug),
        membership_id=membership.id,
        is_clinic_admin=membership.is_clinic_admin,
        is_doctor=membership.is_doctor,
        doctor_public_slug=doctor_slug,
        doctor_public_url=_public_url(doctor_slug) if doctor_slug else None,
        specializations=specs,
    )


@router.get("/clinics/{clinic_id}", response_model=ClinicAdminRead)
async def get_clinic_admin(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicAdminRead:
    clinic = await get_clinic_or_404(db, clinic_id)
    count = await doctors_count(db, clinic.id)
    fields = clinic_to_read_fields(clinic, count)
    return ClinicAdminRead(
        id=clinic.id,
        name=clinic.name,
        phone=clinic.phone,
        logo_url=clinic.logo_url,
        brand_color=clinic.brand_color,
        public_slug=clinic.public_slug,
        public_url=_public_url(clinic.public_slug),
        doctors_limit=clinic.doctors_limit,
        doctors_count=count,
        access_status_code=fields["access_status_code"],
        access_status_label=fields["access_status_label"],
    )


@router.patch("/clinics/{clinic_id}", response_model=ClinicAdminRead)
async def patch_clinic_admin(
    clinic_id: UUID,
    payload: ClinicAdminPatch,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicAdminRead:
    clinic = await get_clinic_or_404(db, clinic_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    for key, value in data.items():
        setattr(clinic, key, value)
    clinic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(clinic)
    count = await doctors_count(db, clinic.id)
    fields = clinic_to_read_fields(clinic, count)
    return ClinicAdminRead(
        id=clinic.id,
        name=clinic.name,
        phone=clinic.phone,
        logo_url=clinic.logo_url,
        brand_color=clinic.brand_color,
        public_slug=clinic.public_slug,
        public_url=_public_url(clinic.public_slug),
        doctors_limit=clinic.doctors_limit,
        doctors_count=count,
        access_status_code=fields["access_status_code"],
        access_status_label=fields["access_status_label"],
    )


@router.get("/clinics/{clinic_id}/members", response_model=List[ClinicMemberRead])
async def list_members(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> List[ClinicMemberRead]:
    await get_clinic_or_404(db, clinic_id)

    memberships_result = await db.execute(
        select(ClinicMembership, ServiceUser)
        .join(ServiceUser, ServiceUser.id == ClinicMembership.user_id)
        .where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.deleted_at.is_(None),
        )
        .order_by(ClinicMembership.created_at.desc()),
    )
    membership_rows = list(memberships_result.all())

    invitations_result = await db.execute(
        select(ClinicInvitation)
        .where(
            ClinicInvitation.clinic_id == clinic_id,
            ClinicInvitation.used_at.is_(None),
            ClinicInvitation.deleted_at.is_(None),
        )
        .order_by(ClinicInvitation.created_at.desc()),
    )
    invitations = list(invitations_result.scalars().all())

    membership_ids = [m.id for m, _ in membership_rows]
    invitation_ids = [i.id for i in invitations]
    membership_map, invitation_map = await load_specializations_map(
        db,
        membership_ids=membership_ids,
        invitation_ids=invitation_ids,
    )

    out: List[ClinicMemberRead] = []
    for membership, user in membership_rows:
        status_value = "active" if membership.status == "active" else "deactivated"
        out.append(
            ClinicMemberRead(
                id=membership.id,
                kind="membership",
                status=status_value,
                email=user.login,
                first_name=user.first_name,
                last_name=user.last_name,
                middle_name=user.middle_name,
                photo_url=membership.photo_url,
                is_clinic_admin=membership.is_clinic_admin,
                is_doctor=membership.is_doctor,
                specializations=[
                    SpecializationRead(**item)
                    for item in membership_map.get(membership.id, [])
                ],
                public_slug=membership.public_slug if membership.is_doctor else None,
                public_url=(
                    _public_url(membership.public_slug)
                    if membership.is_doctor
                    else None
                ),
                user_id=user.id,
            ),
        )

    now = datetime.now(timezone.utc)
    for invitation in invitations:
        if invitation.expires_at < now:
            continue
        out.append(
            ClinicMemberRead(
                id=invitation.id,
                kind="invitation",
                status="invited",
                email=invitation.email,
                first_name=invitation.first_name,
                last_name=invitation.last_name,
                middle_name=invitation.middle_name,
                photo_url=invitation.photo_url,
                is_clinic_admin=invitation.is_clinic_admin,
                is_doctor=invitation.is_doctor,
                specializations=[
                    SpecializationRead(**item)
                    for item in invitation_map.get(invitation.id, [])
                ],
                expires_at=invitation.expires_at,
            ),
        )
    return out


@router.post(
    "/clinics/{clinic_id}/invitations",
    response_model=ClinicInvitationAdminCreated,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    clinic_id: UUID,
    payload: ClinicMemberInviteCreate,
    current_user: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicInvitationAdminCreated:
    clinic = await get_clinic_or_404(db, clinic_id)
    invitation, invite_url, email_sent, email_error = await create_invitation(
        db,
        clinic=clinic,
        created_by_user_id=current_user.id,
        email=str(payload.email),
        first_name=payload.first_name,
        last_name=payload.last_name,
        middle_name=payload.middle_name,
        photo_url=payload.photo_url,
        is_clinic_admin=payload.is_clinic_admin,
        is_doctor=payload.is_doctor,
        specialization_ids=payload.specialization_ids,
    )
    _, invitation_map = await load_specializations_map(
        db,
        invitation_ids=[invitation.id],
    )
    return ClinicInvitationAdminCreated(
        id=invitation.id,
        clinic_id=invitation.clinic_id,
        email=invitation.email,
        first_name=invitation.first_name,
        last_name=invitation.last_name,
        middle_name=invitation.middle_name,
        photo_url=invitation.photo_url,
        is_clinic_admin=invitation.is_clinic_admin,
        is_doctor=invitation.is_doctor,
        expires_at=invitation.expires_at,
        used_at=invitation.used_at,
        created_by_user_id=invitation.created_by_user_id,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
        deleted_at=invitation.deleted_at,
        invite_url=invite_url,
        email_sent=email_sent,
        email_error=email_error,
        specializations=[
            SpecializationRead(**item)
            for item in invitation_map.get(invitation.id, [])
        ],
    )


@router.post(
    "/clinics/{clinic_id}/invitations/{invitation_id}/resend",
    response_model=ClinicInvitationAdminCreated,
)
async def resend_member_invitation(
    clinic_id: UUID,
    invitation_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicInvitationAdminCreated:
    clinic = await get_clinic_or_404(db, clinic_id)
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
    invitation, invite_url, email_sent, email_error = await resend_invitation(
        db,
        clinic=clinic,
        invitation=invitation,
    )
    _, invitation_map = await load_specializations_map(
        db,
        invitation_ids=[invitation.id],
    )
    return ClinicInvitationAdminCreated(
        id=invitation.id,
        clinic_id=invitation.clinic_id,
        email=invitation.email,
        first_name=invitation.first_name,
        last_name=invitation.last_name,
        middle_name=invitation.middle_name,
        photo_url=invitation.photo_url,
        is_clinic_admin=invitation.is_clinic_admin,
        is_doctor=invitation.is_doctor,
        expires_at=invitation.expires_at,
        used_at=invitation.used_at,
        created_by_user_id=invitation.created_by_user_id,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
        deleted_at=invitation.deleted_at,
        invite_url=invite_url,
        email_sent=email_sent,
        email_error=email_error,
        specializations=[
            SpecializationRead(**item)
            for item in invitation_map.get(invitation.id, [])
        ],
    )


@router.patch(
    "/clinics/{clinic_id}/members/{member_id}",
    response_model=ClinicMemberRead,
)
async def patch_member(
    clinic_id: UUID,
    member_id: UUID,
    payload: ClinicMemberPatch,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicMemberRead:
    await get_clinic_or_404(db, clinic_id)
    result = await db.execute(
        select(ClinicMembership, ServiceUser)
        .join(ServiceUser, ServiceUser.id == ClinicMembership.user_id)
        .where(
            ClinicMembership.id == member_id,
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )
    membership, user = row
    data = payload.model_dump(exclude_unset=True)

    if "first_name" in data:
        user.first_name = data["first_name"]
    if "last_name" in data:
        user.last_name = data["last_name"]
    if "middle_name" in data:
        user.middle_name = data["middle_name"]
    if "photo_url" in data:
        membership.photo_url = data["photo_url"]
    if "is_clinic_admin" in data:
        membership.is_clinic_admin = bool(data["is_clinic_admin"])
    if "is_doctor" in data:
        membership.is_doctor = bool(data["is_doctor"])
    if not membership.is_clinic_admin and not membership.is_doctor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member must have is_clinic_admin or is_doctor",
        )

    if "specialization_ids" in data and data["specialization_ids"] is not None:
        specs = await validate_specialization_ids(db, data["specialization_ids"])
        if membership.is_doctor and not specs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor requires at least one specialization",
            )
        await set_membership_specializations(db, membership.id, specs)

    now = datetime.now(timezone.utc)
    user.updated_at = now
    membership.updated_at = now
    await db.commit()

    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=[membership.id],
    )
    status_value = "active" if membership.status == "active" else "deactivated"
    return ClinicMemberRead(
        id=membership.id,
        kind="membership",
        status=status_value,
        email=user.login,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        photo_url=membership.photo_url,
        is_clinic_admin=membership.is_clinic_admin,
        is_doctor=membership.is_doctor,
        specializations=[
            SpecializationRead(**item)
            for item in membership_map.get(membership.id, [])
        ],
        public_slug=membership.public_slug if membership.is_doctor else None,
        public_url=(
            _public_url(membership.public_slug) if membership.is_doctor else None
        ),
        user_id=user.id,
    )


@router.post(
    "/clinics/{clinic_id}/members/{member_id}/deactivate",
    response_model=ClinicMemberRead,
)
async def deactivate_member(
    clinic_id: UUID,
    member_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicMemberRead:
    await get_clinic_or_404(db, clinic_id)
    result = await db.execute(
        select(ClinicMembership, ServiceUser)
        .join(ServiceUser, ServiceUser.id == ClinicMembership.user_id)
        .where(
            ClinicMembership.id == member_id,
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )
    membership, user = row
    membership = await deactivate_membership(db, membership)
    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=[membership.id],
    )
    return ClinicMemberRead(
        id=membership.id,
        kind="membership",
        status="deactivated",
        email=user.login,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        photo_url=membership.photo_url,
        is_clinic_admin=membership.is_clinic_admin,
        is_doctor=membership.is_doctor,
        specializations=[
            SpecializationRead(**item)
            for item in membership_map.get(membership.id, [])
        ],
        public_slug=membership.public_slug if membership.is_doctor else None,
        public_url=(
            _public_url(membership.public_slug) if membership.is_doctor else None
        ),
        user_id=user.id,
    )
