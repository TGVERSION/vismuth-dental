from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models.service_user import ServiceUser
from ..schemas.service_user import (
    ServiceUserCreate,
    ServiceUserIdRead,
    ServiceUserRead,
    ServiceUserUpdate,
)


router = APIRouter(prefix="/service-users", tags=["service_users"])


@router.get(
    "",
    response_model=List[ServiceUserIdRead],
)
async def list_service_users(
    db: AsyncSession = Depends(get_db),
) -> List[ServiceUserIdRead]:
    stmt = select(ServiceUser).order_by(ServiceUser.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/{service_user_id}",
    response_model=ServiceUserRead,
)
async def get_service_user(
    service_user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ServiceUserRead:
    stmt = select(ServiceUser).where(ServiceUser.id == service_user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service user not found",
        )

    return user


@router.post(
    "",
    response_model=ServiceUserRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_service_user(
    payload: ServiceUserCreate,
    db: AsyncSession = Depends(get_db),
) -> ServiceUserRead:
    now = datetime.now(timezone.utc)

    user = ServiceUser(
        login=payload.login,
        password_hash=payload.password_hash,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role or "admin",
        is_active=True if payload.is_active is None else payload.is_active,
        created_at=now,
        updated_at=None,
        deleted_at=None,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.put(
    "/{service_user_id}",
    response_model=ServiceUserRead,
)
async def update_service_user(
    service_user_id: UUID,
    payload: ServiceUserUpdate,
    db: AsyncSession = Depends(get_db),
) -> ServiceUserRead:
    stmt = select(ServiceUser).where(ServiceUser.id == service_user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service user not found",
        )

    if payload.login is not None:
        user.login = payload.login
    if payload.password_hash is not None:
        user.password_hash = payload.password_hash
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    user.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)

    return user


@router.delete(
    "/{service_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_service_user(
    service_user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    stmt = select(ServiceUser).where(ServiceUser.id == service_user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service user not found",
        )

    await db.delete(user)
    await db.commit()

    return None

