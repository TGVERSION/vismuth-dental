from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..models.template_group import TemplateGroup
from ..schemas.template_group import (
    TemplateGroupCreate,
    TemplateGroupIdNameRead,
    TemplateGroupRead,
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
