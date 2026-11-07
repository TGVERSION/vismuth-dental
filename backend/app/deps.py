from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db
from .models.clinic_membership import ClinicMembership
from .models.role import PRIVILEGED_ROLE_NAMES
from .models.service_user import ServiceUser
from .security import decode_access_token_sub
from .services.roles import user_has_any_role, user_role_load_options

bearer_scheme = HTTPBearer(auto_error=False)


async def get_identity_user(
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> ServiceUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = decode_access_token_sub(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    stmt = (
        select(ServiceUser)
        .options(*user_role_load_options())
        .where(ServiceUser.id == user_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User deleted",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User inactive",
        )
    return user


async def get_current_user(
    current_user: ServiceUser = Depends(get_identity_user),
) -> ServiceUser:
    if getattr(current_user, 'clinic_join_restricted', False):
        raise HTTPException(status_code=403, detail='Ожидайте подтверждения заявки супер-администратором')
    return current_user


async def require_clinic_registry(
    clinic_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ServiceUser:
    if user_has_any_role(current_user, 'super_admin'):
        return current_user
    from .models.clinic import Clinic
    result = await db.execute(
        select(ClinicMembership).join(Clinic, Clinic.id == ClinicMembership.clinic_id).where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.user_id == current_user.id,
            (ClinicMembership.is_clinic_admin.is_(True) | ClinicMembership.is_operator.is_(True)),
            ClinicMembership.status == 'active',
            ClinicMembership.deleted_at.is_(None),
            Clinic.deleted_at.is_(None),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail='Clinic registry access required')
    return current_user


def require_roles(*role_names: str):
    async def _dependency(
        current_user: ServiceUser = Depends(get_current_user),
    ) -> ServiceUser:
        if not user_has_any_role(current_user, *role_names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        return current_user

    return _dependency


async def require_privileged(
    current_user: ServiceUser = Depends(get_current_user),
) -> ServiceUser:
    if not user_has_any_role(current_user, *PRIVILEGED_ROLE_NAMES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    return current_user


async def require_clinic_admin(
    clinic_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ServiceUser:
    if user_has_any_role(current_user, "super_admin"):
        return current_user

    result = await db.execute(
        select(ClinicMembership).where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.user_id == current_user.id,
            ClinicMembership.is_clinic_admin.is_(True),
            ClinicMembership.status == "active",
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clinic admin access required",
        )
    return current_user


async def get_active_doctor_membership(
    current_user: ServiceUser,
    db: AsyncSession,
) -> ClinicMembership:
    result = await db.execute(
        select(ClinicMembership).where(
            ClinicMembership.user_id == current_user.id,
            ClinicMembership.is_doctor.is_(True),
            ClinicMembership.status == "active",
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor membership required",
        )
    return membership


# Backward-compatible aliases used by older imports
require_admin = require_privileged
require_admin_or_head_of_department = require_privileged



async def require_clinical_user(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ServiceUser:
    """Historical operator access never becomes clinical access on deactivation."""
    if user_has_any_role(current_user, 'super_admin', 'admin'):
        return current_user
    from sqlalchemy.orm import aliased
    clinical = aliased(ClinicMembership)
    has_clinical_access = select(clinical.id).where(
        clinical.user_id == current_user.id,
        clinical.status == 'active',
        clinical.deleted_at.is_(None),
        clinical.is_doctor.is_(True),
    ).exists()
    result = await db.execute(select(ClinicMembership.id).where(
        ClinicMembership.user_id == current_user.id,
        ClinicMembership.is_operator.is_(True) | ClinicMembership.is_clinic_admin.is_(True),
        ClinicMembership.is_doctor.is_(False),
        ~has_clinical_access,
    ).limit(1))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=403, detail='Врачебные инструменты доступны только роли врача')
    return current_user
