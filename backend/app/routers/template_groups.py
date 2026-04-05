from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.protocol_template import ProtocolTemplate
from ..models.service_user import ServiceUser
from ..models.template_group import TemplateGroup
from ..schemas.template_group import (
    TemplateGroupCreate,
    TemplateGroupIdNameRead,
    TemplateGroupRead,
    TemplateGroupUpdate,
)

router = APIRouter(prefix="/template-groups", tags=["template-groups"])


@router.get(
    "",
    response_model=List[TemplateGroupIdNameRead],
)
async def list_template_groups(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[TemplateGroupIdNameRead]:
    stmt = (
        select(TemplateGroup)
        .where(
            TemplateGroup.creator_id == current_user.id,
            TemplateGroup.deleted_at.is_(None),
        )
        .order_by(TemplateGroup.updated_at.desc(), TemplateGroup.created_at.desc())
    )
    result = await db.execute(stmt)
    groups = result.scalars().all()
    return groups


@router.post(
    "",
    response_model=TemplateGroupRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_template_group(
    payload: TemplateGroupCreate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TemplateGroupRead:
    normalized_name = payload.group_name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name must not be empty",
        )

    existing_stmt = select(TemplateGroup.id).where(
        TemplateGroup.creator_id == current_user.id,
        TemplateGroup.deleted_at.is_(None),
        func.lower(TemplateGroup.group_name) == normalized_name.lower(),
    )
    existing_result = await db.execute(existing_stmt)
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Group with this name already exists. Please choose another name",
        )

    now = datetime.now(timezone.utc)
    group = TemplateGroup(
        group_name=normalized_name,
        creator_id=current_user.id,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.put(
    "/{group_id}",
    response_model=TemplateGroupRead,
)
async def update_template_group(
    group_id: UUID,
    payload: TemplateGroupUpdate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TemplateGroupRead:
    group_stmt = select(TemplateGroup).where(
        TemplateGroup.id == group_id,
        TemplateGroup.creator_id == current_user.id,
        TemplateGroup.deleted_at.is_(None),
    )
    group_result = await db.execute(group_stmt)
    group = group_result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    normalized_name = payload.group_name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name must not be empty",
        )

    duplicate_stmt = select(TemplateGroup.id).where(
        TemplateGroup.creator_id == current_user.id,
        TemplateGroup.deleted_at.is_(None),
        TemplateGroup.id != group.id,
        func.lower(TemplateGroup.group_name) == normalized_name.lower(),
    )
    duplicate_result = await db.execute(duplicate_stmt)
    if duplicate_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Group with this name already exists. Please choose another name",
        )

    group.group_name = normalized_name
    group.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(group)
    return group


@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_template_group(
    group_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    group_stmt = select(TemplateGroup).where(
        TemplateGroup.id == group_id,
        TemplateGroup.creator_id == current_user.id,
        TemplateGroup.deleted_at.is_(None),
    )
    group_result = await db.execute(group_stmt)
    group = group_result.scalar_one_or_none()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    now = datetime.now(timezone.utc)
    await db.execute(
        update(ProtocolTemplate)
        .where(ProtocolTemplate.group_id == group_id)
        .values(group_id=None, updated_at=now)
    )
    await db.execute(delete(TemplateGroup).where(TemplateGroup.id == group_id))
    await db.commit()
