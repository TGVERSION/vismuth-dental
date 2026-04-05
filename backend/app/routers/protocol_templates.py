from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.protocol_template import ProtocolTemplate, ProtocolTemplateField
from ..models.service_user import ServiceUser
from ..models.template_group import TemplateGroup
from ..schemas.protocol_template import (
    ProtocolPrivacy,
    ProtocolTemplateCreate,
    ProtocolTemplateFieldRead,
    ProtocolTemplateListItem,
    ProtocolTemplateRead,
)

router = APIRouter(prefix="/protocol-templates", tags=["protocol-templates"])

_ROLES_ALLOWED_GENERAL_PRIVACY = frozenset({"head_of_department", "administrator"})


@router.get(
    "",
    response_model=List[ProtocolTemplateListItem],
)
async def list_protocol_templates(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProtocolTemplateListItem]:
    """Личные шаблоны текущего пользователя и все общие (`privacy = general`)."""
    stmt = (
        select(ProtocolTemplate)
        .where(
            ProtocolTemplate.deleted_at.is_(None),
            or_(
                ProtocolTemplate.privacy == ProtocolPrivacy.general.value,
                and_(
                    ProtocolTemplate.privacy == ProtocolPrivacy.personal.value,
                    ProtocolTemplate.creator_id == current_user.id,
                ),
            ),
        )
        .order_by(
            ProtocolTemplate.updated_at.desc().nulls_last(),
            ProtocolTemplate.created_at.desc(),
        )
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return rows


@router.post(
    "",
    response_model=ProtocolTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_protocol_template(
    payload: ProtocolTemplateCreate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolTemplateRead:
    protocol_name = payload.protocol_name.strip()
    if not protocol_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Protocol name must not be empty",
        )

    if payload.privacy == ProtocolPrivacy.general:
        if current_user.role not in _ROLES_ALLOWED_GENERAL_PRIVACY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create a general protocol template",
            )

    if payload.group_id is not None:
        group_stmt = select(TemplateGroup.id).where(
            TemplateGroup.id == payload.group_id,
            TemplateGroup.creator_id == current_user.id,
            TemplateGroup.deleted_at.is_(None),
        )
        group_result = await db.execute(group_stmt)
        if group_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown group reference",
            )

    now = datetime.now(timezone.utc)
    privacy_value = payload.privacy.value

    template = ProtocolTemplate(
        protocol_name=protocol_name,
        group_id=payload.group_id,
        creator_id=current_user.id,
        privacy=privacy_value,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(template)
    await db.flush()

    field_rows: list[ProtocolTemplateField] = []
    for item in payload.fields:
        fname = item.field_name.strip()
        ftype = item.field_type.strip()
        if not fname or not ftype:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each field must have non-empty field_name and field_type",
            )
        row = ProtocolTemplateField(
            protocol_template_id=template.id,
            field_name=fname,
            field_type=ftype,
            field_value=item.field_value,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        db.add(row)
        field_rows.append(row)

    await db.commit()
    await db.refresh(template)

    for row in field_rows:
        await db.refresh(row)

    fields_read = [ProtocolTemplateFieldRead.model_validate(r) for r in field_rows]
    return ProtocolTemplateRead(
        id=template.id,
        protocol_name=template.protocol_name,
        group_id=template.group_id,
        creator_id=template.creator_id,
        privacy=template.privacy,
        created_at=template.created_at,
        updated_at=template.updated_at,
        deleted_at=template.deleted_at,
        fields=fields_read,
    )
