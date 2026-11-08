from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_db
from ...deps import require_roles
from ...models.clinic import Clinic
from ...models.clinic_invitation import ClinicInvitation
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
    clinic_to_read_fields,
    generate_public_slug,
)
from ...services.clinic_members import (
    create_invitation,
    doctors_count,
    get_clinic_or_404,
)

router = APIRouter(prefix="/super-admin/clinics", tags=["super-admin-clinics"])

require_super_admin = require_roles("super_admin")


def _normalize_email(email: str) -> str:
    return email.strip().lower()


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


def _to_clinic_read(
    clinic: Clinic,
    doctors_count_value: int,
    *,
    free_codes_ratio: float | None = None,
    clinic_daily_limit_exceeded: bool = False,
    questionnaires_completed_month: int = 0,
) -> ClinicRead:
    fields = clinic_to_read_fields(clinic, doctors_count_value)
    fields["free_codes_ratio"] = free_codes_ratio
    fields["clinic_daily_limit_exceeded"] = clinic_daily_limit_exceeded
    fields["questionnaires_completed_month"] = questionnaires_completed_month
    return ClinicRead.model_validate(fields)


@router.post(
    "",
    response_model=ClinicRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать клинику",
)
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
        button_color=payload.button_color,
        doctors_limit=payload.doctors_limit,
        access_until=payload.access_until,
        access_type=payload.access_type,
        questionnaire_kind=payload.questionnaire_kind,
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


@router.get(
    "",
    response_model=List[ClinicRead],
    summary="Список клиник",
)
async def list_clinics(
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> List[ClinicRead]:
    from ...services.questionnaire_limits import (
        clinic_daily_limit_exceeded,
        free_codes_ratio,
    )
    from ...services.questionnaire_statistics import completed_counts_for_month

    result = await db.execute(
        select(Clinic)
        .where(Clinic.deleted_at.is_(None))
        .order_by(Clinic.created_at.desc()),
    )
    clinics = list(result.scalars().all())
    month_counts = await completed_counts_for_month(
        db,
        [clinic.id for clinic in clinics],
    )
    out: List[ClinicRead] = []
    for clinic in clinics:
        count = await doctors_count(db, clinic.id)
        ratio = await free_codes_ratio(db, clinic.id)
        exceeded = await clinic_daily_limit_exceeded(db, clinic.id)
        out.append(
            _to_clinic_read(
                clinic,
                count,
                free_codes_ratio=ratio,
                clinic_daily_limit_exceeded=exceeded,
                questionnaires_completed_month=month_counts.get(clinic.id, 0),
            ),
        )
    return out


@router.get(
    "/{clinic_id}",
    response_model=ClinicRead,
    summary="Клиника по id",
)
async def get_clinic(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicRead:
    from ...services.questionnaire_limits import (
        clinic_daily_limit_exceeded,
        free_codes_ratio,
    )
    from ...services.questionnaire_statistics import completed_counts_for_month

    clinic = await get_clinic_or_404(db, clinic_id)
    count = await doctors_count(db, clinic.id)
    ratio = await free_codes_ratio(db, clinic.id)
    exceeded = await clinic_daily_limit_exceeded(db, clinic.id)
    month_counts = await completed_counts_for_month(db, [clinic.id])
    return _to_clinic_read(
        clinic,
        count,
        free_codes_ratio=ratio,
        clinic_daily_limit_exceeded=exceeded,
        questionnaires_completed_month=month_counts.get(clinic.id, 0),
    )


@router.patch(
    "/{clinic_id}",
    response_model=ClinicRead,
    summary="Обновить клинику",
)
async def patch_clinic(
    clinic_id: UUID,
    payload: ClinicPatch,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicRead:
    clinic = await get_clinic_or_404(db, clinic_id)
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = _normalize_email(str(data["email"]))
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "questionnaire_kind" in data and data["questionnaire_kind"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="questionnaire_kind cannot be null",
        )

    for key, value in data.items():
        setattr(clinic, key, value)
    clinic.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(clinic)
    count = await doctors_count(db, clinic.id)
    return _to_clinic_read(clinic, count)


@router.delete(
    "/{clinic_id}",
    response_model=ClinicRead,
    summary="Soft-delete клиники",
)
async def delete_clinic(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicRead:
    clinic = await get_clinic_or_404(db, clinic_id)
    now = datetime.now(timezone.utc)
    clinic.deleted_at = now
    clinic.updated_at = now
    await db.commit()
    await db.refresh(clinic)
    count = await doctors_count(db, clinic.id)
    return _to_clinic_read(clinic, count)


@router.post(
    "/{clinic_id}/invitations",
    response_model=ClinicInvitationCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Создать приглашение в клинику",
)
async def create_invitation_endpoint(
    clinic_id: UUID,
    payload: ClinicInvitationCreate,
    current_user: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicInvitationCreated:
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
        is_operator=payload.is_operator,
        specialization_ids=payload.specialization_ids,
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
    summary="Список приглашений клиники",
)
async def list_invitations(
    clinic_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> List[ClinicInvitationRead]:
    await get_clinic_or_404(db, clinic_id)
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
    summary="Повторно отправить приглашение",
)
async def resend_invitation_endpoint(
    clinic_id: UUID,
    invitation_id: UUID,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicInvitationCreated:
    from ...services.clinic_members import resend_invitation

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
    base = ClinicInvitationRead.model_validate(invitation)
    return ClinicInvitationCreated(
        **base.model_dump(),
        invite_url=invite_url,
        email_sent=email_sent,
        email_error=email_error,
    )
