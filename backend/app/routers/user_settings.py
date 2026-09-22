from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.role import PRIVILEGED_ROLE_NAMES
from ..models.service_user import ServiceUser
from ..models.user_settings import UserSettings
from ..schemas.user_settings import (
    UserSettingsCreate,
    UserSettingsPatch,
    UserSettingsRead,
    UserSettingsUpdate,
)
from ..services.roles import user_has_any_role

router = APIRouter(prefix="/user-settings", tags=["user-settings"])


def _ensure_access(current_user: ServiceUser, target_user_id: UUID) -> None:
    if current_user.id == target_user_id:
        return
    if user_has_any_role(current_user, *PRIVILEGED_ROLE_NAMES):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied",
    )


async def _get_settings(db: AsyncSession, user_id: UUID) -> UserSettings | None:
    stmt = select(UserSettings).where(UserSettings.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _ensure_target_user_exists(db: AsyncSession, user_id: UUID) -> None:
    stmt = select(ServiceUser.id).where(ServiceUser.id == user_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )


@router.get(
    "/{user_id}",
    response_model=UserSettingsRead,
)
async def get_user_settings(
    user_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    _ensure_access(current_user, user_id)

    settings = await _get_settings(db, user_id)
    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User settings not found",
        )
    return settings


@router.post(
    "/{user_id}",
    response_model=UserSettingsRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_user_settings(
    user_id: UUID,
    payload: UserSettingsCreate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    _ensure_access(current_user, user_id)
    await _ensure_target_user_exists(db, user_id)

    existing = await _get_settings(db, user_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User settings already exist",
        )

    init_kwargs: dict = {"user_id": user_id}
    if payload.mkb_code is not None:
        init_kwargs["mkb_code"] = payload.mkb_code
    if payload.autocomplete is not None:
        init_kwargs["autocomplete"] = payload.autocomplete
    if payload.fullness_complaints is not None:
        init_kwargs["fullness_complaints"] = payload.fullness_complaints

    settings = UserSettings(**init_kwargs)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


@router.put(
    "/{user_id}",
    response_model=UserSettingsRead,
)
async def replace_user_settings(
    user_id: UUID,
    payload: UserSettingsUpdate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    _ensure_access(current_user, user_id)

    settings = await _get_settings(db, user_id)
    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User settings not found",
        )

    settings.mkb_code = payload.mkb_code
    settings.autocomplete = payload.autocomplete
    settings.fullness_complaints = payload.fullness_complaints
    settings.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(settings)
    return settings


@router.patch(
    "/{user_id}",
    response_model=UserSettingsRead,
)
async def patch_user_settings(
    user_id: UUID,
    payload: UserSettingsPatch,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    _ensure_access(current_user, user_id)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    settings = await _get_settings(db, user_id)
    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User settings not found",
        )

    for field, value in updates.items():
        setattr(settings, field, value)
    settings.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(settings)
    return settings
