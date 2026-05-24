from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user, require_admin
from ..models.service_user import ServiceUser
from ..schemas.service_user import (
    ServiceUserIdRead,
    ServiceUserMeResponse,
    ServiceUserPatch,
    ServiceUserRead,
    ServiceUserUpdate,
)
from ..security import hash_password

router = APIRouter(tags=["service_user"])


def _normalize_login(login: str) -> str:
    return login.strip().lower()


async def _load_user(db: AsyncSession, user_id: UUID) -> ServiceUser | None:
    stmt = select(ServiceUser).where(
        ServiceUser.id == user_id,
        ServiceUser.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _ensure_user_found(user: ServiceUser | None) -> ServiceUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


async def _check_login_unique(
    db: AsyncSession,
    login: str,
    exclude_id: UUID | None = None,
) -> None:
    login_norm = _normalize_login(login)
    stmt = select(ServiceUser.id).where(func.lower(ServiceUser.login) == login_norm)
    if exclude_id is not None:
        stmt = stmt.where(ServiceUser.id != exclude_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )


@router.get("/service_user", response_model=ServiceUserMeResponse)
async def get_service_user_me(
    current_user: ServiceUser = Depends(get_current_user),
) -> ServiceUserMeResponse:
    return ServiceUserMeResponse.model_validate(current_user)


@router.get("/service_user_ids", response_model=List[ServiceUserIdRead])
async def list_service_user_ids(
    _: ServiceUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[ServiceUserIdRead]:
    stmt = (
        select(ServiceUser)
        .where(ServiceUser.deleted_at.is_(None))
        .order_by(ServiceUser.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/service_user/{user_id}", response_model=ServiceUserRead)
async def get_service_user(
    user_id: UUID,
    _: ServiceUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceUserRead:
    user = _ensure_user_found(await _load_user(db, user_id))
    return ServiceUserRead.model_validate(user)


@router.put("/service_user/{user_id}", response_model=ServiceUserRead)
async def replace_service_user(
    user_id: UUID,
    payload: ServiceUserUpdate,
    _: ServiceUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceUserRead:
    user = _ensure_user_found(await _load_user(db, user_id))
    login_norm = _normalize_login(str(payload.login))
    await _check_login_unique(db, login_norm, exclude_id=user_id)

    now = datetime.now(timezone.utc)
    user.login = login_norm
    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.role = payload.role
    user.is_active = payload.is_active
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    user.updated_at = now

    try:
        await db.flush()
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        ) from exc

    return ServiceUserRead.model_validate(user)


@router.patch("/service_user/{user_id}", response_model=ServiceUserRead)
async def patch_service_user(
    user_id: UUID,
    payload: ServiceUserPatch,
    _: ServiceUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ServiceUserRead:
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    user = _ensure_user_found(await _load_user(db, user_id))
    now = datetime.now(timezone.utc)

    if "login" in update_data and update_data["login"] is not None:
        login_norm = _normalize_login(str(update_data["login"]))
        await _check_login_unique(db, login_norm, exclude_id=user_id)
        user.login = login_norm
    if "first_name" in update_data:
        user.first_name = update_data["first_name"]
    if "last_name" in update_data:
        user.last_name = update_data["last_name"]
    if "role" in update_data and update_data["role"] is not None:
        user.role = update_data["role"]
    if "is_active" in update_data and update_data["is_active"] is not None:
        user.is_active = update_data["is_active"]
    if "password" in update_data and update_data["password"] is not None:
        user.password_hash = hash_password(update_data["password"])
    user.updated_at = now

    try:
        await db.flush()
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        ) from exc

    return ServiceUserRead.model_validate(user)


@router.delete("/service_user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_user(
    user_id: UUID,
    _: ServiceUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = _ensure_user_found(await _load_user(db, user_id))
    now = datetime.now(timezone.utc)
    user.deleted_at = now
    user.updated_at = now
    await db.commit()
